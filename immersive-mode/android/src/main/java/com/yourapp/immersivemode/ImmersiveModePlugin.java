package com.yourapp.immersivemode;

import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Hide / show Android status + navigation bars for POS kiosk-style use.
 */
@CapacitorPlugin(name = "ImmersiveMode")
public class ImmersiveModePlugin extends Plugin {

    @PluginMethod
    public void activate(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                applyImmersive(true);
                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to activate immersive mode: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void deactivate(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                applyImmersive(false);
                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to deactivate immersive mode: " + e.getMessage(), e);
            }
        });
    }

    private void applyImmersive(boolean hide) {
        Window window = getActivity().getWindow();
        if (window == null) {
            return;
        }

        View decorView = window.getDecorView();
        WindowCompat.setDecorFitsSystemWindows(window, !hide);

        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(window, decorView);
        if (controller == null) {
            return;
        }

        if (hide) {
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                WindowManager.LayoutParams lp = window.getAttributes();
                lp.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                window.setAttributes(lp);
            }
        } else {
            controller.show(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_DEFAULT
            );
        }
    }
}
