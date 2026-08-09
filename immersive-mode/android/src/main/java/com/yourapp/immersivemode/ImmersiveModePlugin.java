package com.yourapp.immersivemode;

import android.app.Activity;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Hide Android status + navigation bars for POS kiosk-style use.
 *
 * Android always allows an edge swipe to briefly reveal system UI (safety).
 * While immersive is active we immediately re-hide bars whenever they appear,
 * so the reveal does not stick — staff exit via the in-app gesture instead.
 */
@CapacitorPlugin(name = "ImmersiveMode")
public class ImmersiveModePlugin extends Plugin {

    private static final long REHIDE_INTERVAL_MS = 350;

    private boolean immersiveActive = false;
    private boolean listenersAttached = false;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private final Runnable rehideRunnable =
        new Runnable() {
            @Override
            public void run() {
                if (!immersiveActive) {
                    return;
                }
                hideSystemBarsNow();
                mainHandler.postDelayed(this, REHIDE_INTERVAL_MS);
            }
        };

    private final View.OnAttachStateChangeListener attachListener =
        new View.OnAttachStateChangeListener() {
            @Override
            public void onViewAttachedToWindow(View v) {
                if (immersiveActive) {
                    hideSystemBarsNow();
                }
            }

            @Override
            public void onViewDetachedFromWindow(View v) {
                // no-op
            }
        };

    @PluginMethod
    public void activate(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                immersiveActive = true;
                ensureListeners();
                hideSystemBarsNow();
                startRehideLoop();
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
                immersiveActive = false;
                stopRehideLoop();
                showSystemBarsNow();
                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to deactivate immersive mode: " + e.getMessage(), e);
            }
        });
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (immersiveActive) {
            getActivity().runOnUiThread(() -> {
                hideSystemBarsNow();
                startRehideLoop();
            });
        }
    }

    @Override
    protected void handleOnPause() {
        stopRehideLoop();
        super.handleOnPause();
    }

    @Override
    protected void handleOnDestroy() {
        immersiveActive = false;
        stopRehideLoop();
        detachListeners();
        super.handleOnDestroy();
    }

    private void ensureListeners() {
        if (listenersAttached) {
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            return;
        }
        Window window = activity.getWindow();
        if (window == null) {
            return;
        }
        View decorView = window.getDecorView();

        decorView.addOnAttachStateChangeListener(attachListener);

        // Legacy visibility callback — fires when bars are revealed by edge swipe.
        decorView.setOnSystemUiVisibilityChangeListener(
            visibility -> {
                if (!immersiveActive) {
                    return;
                }
                boolean fullscreen =
                    (visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) != 0;
                if (!fullscreen) {
                    hideSystemBarsNow();
                }
            }
        );

        ViewCompat.setOnApplyWindowInsetsListener(
            decorView,
            (v, insets) -> {
                if (immersiveActive
                    && insets.isVisible(WindowInsetsCompat.Type.systemBars())) {
                    // Re-hide on next frame so we don't recurse inside inset dispatch.
                    mainHandler.post(this::hideSystemBarsNow);
                }
                return insets;
            }
        );

        listenersAttached = true;
    }

    private void detachListeners() {
        Activity activity = getActivity();
        if (activity == null) {
            listenersAttached = false;
            return;
        }
        Window window = activity.getWindow();
        if (window == null) {
            listenersAttached = false;
            return;
        }
        View decorView = window.getDecorView();
        decorView.removeOnAttachStateChangeListener(attachListener);
        decorView.setOnSystemUiVisibilityChangeListener(null);
        ViewCompat.setOnApplyWindowInsetsListener(decorView, null);
        listenersAttached = false;
    }

    private void startRehideLoop() {
        stopRehideLoop();
        if (immersiveActive) {
            mainHandler.post(rehideRunnable);
        }
    }

    private void stopRehideLoop() {
        mainHandler.removeCallbacks(rehideRunnable);
    }

    private void hideSystemBarsNow() {
        Activity activity = getActivity();
        if (activity == null) {
            return;
        }
        Window window = activity.getWindow();
        if (window == null) {
            return;
        }

        View decorView = window.getDecorView();
        WindowCompat.setDecorFitsSystemWindows(window, false);

        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(window, decorView);
        if (controller != null) {
            // Prefer non-transient behavior + immediate re-hide so bars do not linger.
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_DEFAULT
            );
            controller.hide(WindowInsetsCompat.Type.systemBars());
        }

        // Also apply classic flags for older WebView / OEM stacks.
        int flags =
            View.SYSTEM_UI_FLAG_IMMERSIVE
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN;
        decorView.setSystemUiVisibility(flags);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(lp);
        }
    }

    private void showSystemBarsNow() {
        Activity activity = getActivity();
        if (activity == null) {
            return;
        }
        Window window = activity.getWindow();
        if (window == null) {
            return;
        }

        View decorView = window.getDecorView();
        WindowCompat.setDecorFitsSystemWindows(window, true);

        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(window, decorView);
        if (controller != null) {
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_DEFAULT
            );
            controller.show(WindowInsetsCompat.Type.systemBars());
        }

        decorView.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
    }
}
