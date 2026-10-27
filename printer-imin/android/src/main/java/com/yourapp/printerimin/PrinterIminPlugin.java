package com.yourapp.printerimin;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.os.RemoteException;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.imin.printer.INeoPrinterCallback;
import com.imin.printer.InitPrinterCallback;
import com.imin.printer.PrinterHelper;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * iMin built-in printer transport for raw ESC/POS bytes.
 * Binds IminPrinterLibrary once and keeps the service for later jobs.
 */
@CapacitorPlugin(name = "PrinterImin")
public class PrinterIminPlugin extends Plugin {

    private static final String TAG = "PrinterImin";
    private static final long BIND_TIMEOUT_MS = 10000;
    private static final long PRINT_TIMEOUT_MS = 20000;

    private final Set<String> activeConnections = ConcurrentHashMap.newKeySet();
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Object serviceLock = new Object();

    @PluginMethod
    public void connect(PluginCall call) {
        executor.execute(() -> {
            try {
                ensureServiceBound();
                String connectionId = UUID.randomUUID().toString();
                activeConnections.add(connectionId);

                JSObject result = new JSObject();
                result.put("connectionId", connectionId);
                result.put("success", true);
                result.put("productName", "iMin built-in");
                call.resolve(result);
            } catch (Exception e) {
                Log.e(TAG, "connect failed", e);
                call.reject(e.getMessage() != null ? e.getMessage() : "iMin connect failed");
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
        if (!activeConnections.contains(connectionId)) {
            call.reject("Connection not found or already closed: " + connectionId);
            return;
        }

        executor.execute(() -> {
            try {
                ensureServiceBound();
                byte[] bytes;
                if ("base64".equals(encoding)) {
                    bytes = Base64.decode(data, Base64.DEFAULT);
                } else {
                    bytes = data.getBytes("UTF-8");
                }
                sendAndWait(bytes);
                call.resolve();
            } catch (Exception e) {
                Log.e(TAG, "send failed", e);
                call.reject(e.getMessage() != null ? e.getMessage() : "iMin print failed");
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
        activeConnections.remove(connectionId);
        call.resolve();
    }

    /**
     * Bind once. PrinterHelper.initPrinterService connects asynchronously and
     * calls initPrinter itself when the AIDL service is up. Later jobs reuse it.
     */
    private void ensureServiceBound() throws Exception {
        synchronized (serviceLock) {
            if (PrinterHelper.getNeoPrinterService() != null) {
                return;
            }

            Context appContext = getContext().getApplicationContext();
            CountDownLatch latch = new CountDownLatch(1);
            AtomicBoolean connected = new AtomicBoolean(false);
            AtomicReference<String> bindError = new AtomicReference<>();

            new Handler(Looper.getMainLooper()).post(() -> {
                boolean submitted = PrinterHelper.getInstance().initPrinterService(
                        appContext,
                        new InitPrinterCallback() {
                            @Override
                            public void onConnected() {
                                // SDK already called initPrinter inside onConnected.
                                PrinterHelper.getInstance().initPrinter(
                                        appContext.getPackageName(), null);
                                connected.set(PrinterHelper.getNeoPrinterService() != null);
                                latch.countDown();
                            }

                            @Override
                            public void onDisconnected() {
                                bindError.set("iMin printer service disconnected");
                                latch.countDown();
                            }
                        });
                if (!submitted) {
                    bindError.set("iMin print service is not available on this device");
                    latch.countDown();
                }
            });

            if (!latch.await(BIND_TIMEOUT_MS, TimeUnit.MILLISECONDS)) {
                throw new Exception("Timed out waiting for the iMin printer");
            }
            if (bindError.get() != null && !connected.get()) {
                throw new Exception(bindError.get());
            }
            if (!connected.get() || PrinterHelper.getNeoPrinterService() == null) {
                throw new Exception("iMin printer service did not connect");
            }
        }
    }

    /**
     * The first terminal callback wins. onRunResult(true) means the service
     * accepted the bytes (the SDK often does not follow it with onPrintResult
     * for raw ESC/POS). onPrintResult code 1 is success, anything else fails.
     */
    private void sendAndWait(byte[] bytes) throws Exception {
        if (PrinterHelper.getNeoPrinterService() == null) {
            throw new Exception("iMin printer is not connected");
        }

        CountDownLatch latch = new CountDownLatch(1);
        AtomicBoolean finished = new AtomicBoolean(false);
        AtomicReference<String> error = new AtomicReference<>();

        PrinterHelper.getInstance().sendRAWData(bytes, new INeoPrinterCallback() {
            @Override
            public void onRunResult(boolean isSuccess) throws RemoteException {
                if (finished.compareAndSet(false, true)) {
                    if (!isSuccess) {
                        error.set("iMin printer rejected the job");
                    }
                    latch.countDown();
                }
            }

            @Override
            public void onReturnString(String result) throws RemoteException {
            }

            @Override
            public void onRaiseException(int code, String msg) throws RemoteException {
                if (finished.compareAndSet(false, true)) {
                    error.set(msg != null && msg.length() > 0
                            ? msg
                            : "iMin printer error " + code);
                    latch.countDown();
                }
            }

            @Override
            public void onPrintResult(int code, String msg) throws RemoteException {
                if (finished.compareAndSet(false, true)) {
                    if (code != 1) {
                        error.set(msg != null && msg.length() > 0
                                ? msg
                                : "iMin print failed");
                    }
                    latch.countDown();
                }
            }
        });

        if (!latch.await(PRINT_TIMEOUT_MS, TimeUnit.MILLISECONDS)) {
            throw new Exception("iMin printer did not acknowledge the job");
        }
        if (error.get() != null) {
            throw new Exception(error.get());
        }
    }
}
