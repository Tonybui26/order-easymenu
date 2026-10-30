package com.yourapp.imincashbox;

import android.content.Context;
import android.os.Build;
import android.util.Log;

import com.device.manager.sdk.tiramusu.biz.IminSDKManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * iMin RJ12 cash drawer. Uses the device service (IminSDKManager), not the printer SDK.
 * On Android 13+ that service is "iminservice". Older iMin desktops use the same call,
 * which falls back to the cash-box GPIO inside the library.
 */
@CapacitorPlugin(name = "IminCashbox")
public class IminCashboxPlugin extends Plugin {

    private static final String TAG = "IminCashbox";

    @PluginMethod
    public void open(PluginCall call) {
        try {
            Context context = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                Object service = context.getSystemService("iminservice");
                if (service == null) {
                    call.reject("This terminal has no iMin cash drawer port");
                    return;
                }
            }
            IminSDKManager.opencashBox(context);
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "open failed", e);
            call.reject(e.getMessage() != null ? e.getMessage() : "iMin cash drawer failed");
        }
    }
}
