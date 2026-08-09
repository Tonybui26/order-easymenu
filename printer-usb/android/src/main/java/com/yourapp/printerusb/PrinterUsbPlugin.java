package com.yourapp.printerusb;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.util.Base64;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Android USB host transport for raw ESC/POS receipt printers.
 * Mirrors PrinterTcpSocket's connect / send / disconnect lifecycle.
 */
@CapacitorPlugin(name = "PrinterUsb")
public class PrinterUsbPlugin extends Plugin {

    private static final String ACTION_USB_PERMISSION = "com.yourapp.printerusb.USB_PERMISSION";
    private static final int USB_CLASS_PRINTER = 7;
    private static final int BULK_TRANSFER_TIMEOUT_MS = 5000;
    private static final int MAX_CHUNK_SIZE = 16384;
    /** User tapped Allow on the system USB permission dialog. */
    private static final int USB_PERMISSION_GRANTED = 1;
    /** User tapped Deny / Cancel on the system USB permission dialog. */
    private static final int USB_PERMISSION_DENIED = 0;
    private static final int USB_PERMISSION_ERROR = -1;

    private final ConcurrentHashMap<String, OpenConnection> activeConnections =
            new ConcurrentHashMap<>();
    private final ExecutorService executor = Executors.newCachedThreadPool();

    private static class OpenConnection {
        final UsbDevice device;
        final UsbDeviceConnection connection;
        final UsbInterface usbInterface;
        final UsbEndpoint endpointOut;

        OpenConnection(
                UsbDevice device,
                UsbDeviceConnection connection,
                UsbInterface usbInterface,
                UsbEndpoint endpointOut) {
            this.device = device;
            this.connection = connection;
            this.usbInterface = usbInterface;
            this.endpointOut = endpointOut;
        }
    }

    private UsbManager getUsbManager() {
        return (UsbManager) getContext().getSystemService(Context.USB_SERVICE);
    }

    @PluginMethod
    public void listDevices(PluginCall call) {
        executor.execute(() -> {
            try {
                UsbManager usbManager = getUsbManager();
                if (usbManager == null) {
                    call.reject("USB host not available on this device");
                    return;
                }

                JSArray devices = new JSArray();
                HashMap<String, UsbDevice> deviceList = usbManager.getDeviceList();
                for (UsbDevice device : deviceList.values()) {
                    JSObject item = new JSObject();
                    item.put("vendorId", device.getVendorId());
                    item.put("productId", device.getProductId());
                    item.put("deviceName", device.getDeviceName());
                    item.put("deviceId", device.getDeviceId());
                    item.put("hasPermission", usbManager.hasPermission(device));
                    item.put("isPrinterClass", isPrinterClassDevice(device));

                    String productName = null;
                    String manufacturerName = null;
                    String serialNumber = null;
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            productName = device.getProductName();
                            manufacturerName = device.getManufacturerName();
                        }
                        if (usbManager.hasPermission(device)
                                && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            serialNumber = device.getSerialNumber();
                        }
                    } catch (SecurityException ignored) {
                        // Serial requires permission on some Android versions
                    }

                    if (productName != null) item.put("productName", productName);
                    if (manufacturerName != null) item.put("manufacturerName", manufacturerName);
                    if (serialNumber != null) item.put("serialNumber", serialNumber);

                    devices.put(item);
                }

                JSObject result = new JSObject();
                result.put("devices", devices);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Failed to list USB devices: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void connect(PluginCall call) {
        Integer vendorId = call.getInt("vendorId");
        Integer productId = call.getInt("productId");
        String serialNumber = call.getString("serialNumber");
        // timeoutMs is accepted for API compatibility but permission waits until the user answers

        executor.execute(() -> {
            try {
                UsbManager usbManager = getUsbManager();
                if (usbManager == null) {
                    call.reject("USB host not available on this device");
                    return;
                }

                UsbDevice device;
                if (vendorId != null && productId != null) {
                    device = findDevice(usbManager, vendorId, productId, serialNumber);
                    if (device == null) {
                        call.reject(
                                "USB printer not found (VID="
                                        + vendorId
                                        + " PID="
                                        + productId
                                        + "). Is it plugged in?");
                        return;
                    }
                } else {
                    // Default POS flow: auto-pick the plugged-in printer
                    device = findAutoUsbPrinter(usbManager);
                    if (device == null) {
                        call.reject(
                                "No USB printer found. Plug the printer into this tablet and try again.");
                        return;
                    }
                }

                if (!usbManager.hasPermission(device)) {
                    // Wait until the user answers the system dialog — do not treat
                    // a slow confirm as "denied" (that was firing false error toasts).
                    int permissionResult = requestUsbPermission(usbManager, device);
                    if (permissionResult == USB_PERMISSION_DENIED) {
                        call.reject("USB permission denied for printer");
                        return;
                    }
                    if (permissionResult != USB_PERMISSION_GRANTED) {
                        call.reject("USB permission request failed");
                        return;
                    }
                }

                UsbInterface usbInterface = findPrinterInterface(device);
                UsbEndpoint endpointOut = findBulkOutEndpoint(usbInterface);
                if (usbInterface == null || endpointOut == null) {
                    call.reject("No USB bulk OUT endpoint found on this device");
                    return;
                }

                UsbDeviceConnection connection = usbManager.openDevice(device);
                if (connection == null) {
                    call.reject("Failed to open USB device");
                    return;
                }

                if (!connection.claimInterface(usbInterface, true)) {
                    connection.close();
                    call.reject("Failed to claim USB interface");
                    return;
                }

                String connectionId = UUID.randomUUID().toString();
                activeConnections.put(
                        connectionId,
                        new OpenConnection(device, connection, usbInterface, endpointOut));

                JSObject result = new JSObject();
                result.put("connectionId", connectionId);
                result.put("success", true);
                result.put("vendorId", device.getVendorId());
                result.put("productId", device.getProductId());
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        String productName = device.getProductName();
                        if (productName != null) {
                            result.put("productName", productName);
                        }
                    }
                } catch (SecurityException ignored) {
                }
                call.resolve(result);
            } catch (Exception e) {
                call.reject("USB connect failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void send(PluginCall call) {
        String connectionId = call.getString("connectionId");
        String data = call.getString("data");
        String encoding = call.getString("encoding", "base64");

        if (connectionId == null || data == null) {
            call.reject("Connection ID and data are required");
            return;
        }

        OpenConnection open = activeConnections.get(connectionId);
        if (open == null) {
            call.reject("Connection not found or already closed: " + connectionId);
            return;
        }

        executor.execute(() -> {
            try {
                byte[] bytes;
                if ("base64".equals(encoding)) {
                    bytes = Base64.decode(data, Base64.DEFAULT);
                } else {
                    bytes = data.getBytes("UTF-8");
                }

                int offset = 0;
                while (offset < bytes.length) {
                    int chunkLen = Math.min(MAX_CHUNK_SIZE, bytes.length - offset);
                    int written =
                            open.connection.bulkTransfer(
                                    open.endpointOut, bytes, offset, chunkLen, BULK_TRANSFER_TIMEOUT_MS);
                    if (written < 0) {
                        throw new RuntimeException("USB bulkTransfer failed at offset " + offset);
                    }
                    offset += written;
                }

                call.resolve();
            } catch (Exception e) {
                activeConnections.remove(connectionId);
                closeQuietly(open);
                call.reject("USB send failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        String connectionId = call.getString("connectionId");
        if (connectionId == null) {
            call.reject("Connection ID is required");
            return;
        }

        OpenConnection open = activeConnections.remove(connectionId);
        if (open != null) {
            closeQuietly(open);
        }
        call.resolve();
    }

    @PluginMethod
    public void resetAll(PluginCall call) {
        int cleared = activeConnections.size();
        for (Map.Entry<String, OpenConnection> entry : activeConnections.entrySet()) {
            closeQuietly(entry.getValue());
        }
        activeConnections.clear();

        JSObject result = new JSObject();
        result.put("connectionsCleared", cleared);
        result.put("message", "All USB printer connections cleared");
        call.resolve(result);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSArray ids = new JSArray();
        for (String id : activeConnections.keySet()) {
            ids.put(id);
        }
        JSObject result = new JSObject();
        result.put("activeConnections", activeConnections.size());
        result.put("connectionIds", ids);
        result.put("platform", "android");
        call.resolve(result);
    }

    /**
     * Shows the system USB permission dialog and waits until the user responds.
     * Does not time out — a slow Allow must not be reported as "denied".
     *
     * @return {@link #USB_PERMISSION_GRANTED}, {@link #USB_PERMISSION_DENIED}, or
     *     {@link #USB_PERMISSION_ERROR}
     */
    private int requestUsbPermission(UsbManager usbManager, UsbDevice device)
            throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(1);
        final boolean[] granted = {false};
        final boolean[] answered = {false};

        BroadcastReceiver receiver =
                new BroadcastReceiver() {
                    @Override
                    public void onReceive(Context context, Intent intent) {
                        if (!ACTION_USB_PERMISSION.equals(intent.getAction())) {
                            return;
                        }
                        answered[0] = true;
                        granted[0] =
                                intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
                        try {
                            getContext().unregisterReceiver(this);
                        } catch (Exception ignored) {
                        }
                        latch.countDown();
                    }
                };

        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(receiver, filter);
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_MUTABLE;
        }
        PendingIntent permissionIntent =
                PendingIntent.getBroadcast(
                        getContext(), 0, new Intent(ACTION_USB_PERMISSION), flags);

        usbManager.requestPermission(device, permissionIntent);

        // Block until Allow or Deny — no timeout (avoids false "denied" toasts)
        latch.await();

        if (!answered[0]) {
            try {
                getContext().unregisterReceiver(receiver);
            } catch (Exception ignored) {
            }
            return USB_PERMISSION_ERROR;
        }
        return granted[0] ? USB_PERMISSION_GRANTED : USB_PERMISSION_DENIED;
    }

    /**
     * Prefer a USB printer-class device with bulk OUT; otherwise any device with bulk OUT.
     * Typical POS case: only the receipt printer is plugged into the tablet.
     */
    private UsbDevice findAutoUsbPrinter(UsbManager usbManager) {
        UsbDevice fallback = null;
        for (UsbDevice device : usbManager.getDeviceList().values()) {
            UsbInterface iface = findPrinterInterface(device);
            if (iface == null || findBulkOutEndpoint(iface) == null) {
                continue;
            }
            if (isPrinterClassDevice(device)) {
                return device;
            }
            if (fallback == null) {
                fallback = device;
            }
        }
        return fallback;
    }

    private UsbDevice findDevice(
            UsbManager usbManager, int vendorId, int productId, String serialNumber) {
        for (UsbDevice device : usbManager.getDeviceList().values()) {
            if (device.getVendorId() != vendorId || device.getProductId() != productId) {
                continue;
            }
            if (serialNumber == null || serialNumber.isEmpty()) {
                return device;
            }
            try {
                if (usbManager.hasPermission(device)
                        && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP
                        && serialNumber.equals(device.getSerialNumber())) {
                    return device;
                }
            } catch (SecurityException ignored) {
            }
            // If serial cannot be read yet, still match VID/PID as fallback
            if (!usbManager.hasPermission(device)) {
                return device;
            }
        }
        return null;
    }

    private boolean isPrinterClassDevice(UsbDevice device) {
        if (device.getDeviceClass() == USB_CLASS_PRINTER) {
            return true;
        }
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface iface = device.getInterface(i);
            if (iface.getInterfaceClass() == USB_CLASS_PRINTER) {
                return true;
            }
        }
        return false;
    }

    private UsbInterface findPrinterInterface(UsbDevice device) {
        UsbInterface fallbackWithBulkOut = null;
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface iface = device.getInterface(i);
            UsbEndpoint out = findBulkOutEndpoint(iface);
            if (out == null) continue;
            if (iface.getInterfaceClass() == USB_CLASS_PRINTER) {
                return iface;
            }
            if (fallbackWithBulkOut == null) {
                fallbackWithBulkOut = iface;
            }
        }
        return fallbackWithBulkOut;
    }

    private UsbEndpoint findBulkOutEndpoint(UsbInterface usbInterface) {
        if (usbInterface == null) return null;
        for (int i = 0; i < usbInterface.getEndpointCount(); i++) {
            UsbEndpoint endpoint = usbInterface.getEndpoint(i);
            if (endpoint.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK
                    && endpoint.getDirection() == UsbConstants.USB_DIR_OUT) {
                return endpoint;
            }
        }
        return null;
    }

    private void closeQuietly(OpenConnection open) {
        try {
            open.connection.releaseInterface(open.usbInterface);
        } catch (Exception ignored) {
        }
        try {
            open.connection.close();
        } catch (Exception ignored) {
        }
    }
}
