package com.yourapp.customerdisplay;

import android.app.Presentation;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.hardware.display.DisplayManager;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Display;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Show a simple idle UI on an Android secondary / customer-facing display
 * (e.g. iMin Swan 2 rear screen) via {@link Presentation}.
 */
@CapacitorPlugin(name = "CustomerDisplay")
public class CustomerDisplayPlugin extends Plugin {

    private IdlePresentation presentation;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", findSecondaryDisplay() != null);
        call.resolve(result);
    }

    @PluginMethod
    public void open(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                Display display = findSecondaryDisplay();
                if (display == null) {
                    call.resolve();
                    return;
                }

                if (presentation != null && presentation.isShowing()) {
                    if (presentation.getDisplay().getDisplayId() == display.getDisplayId()) {
                        call.resolve();
                        return;
                    }
                    dismissPresentation();
                }

                presentation = new IdlePresentation(getActivity(), display);
                presentation.show();
                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to open customer display: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void close(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                dismissPresentation();
                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to close customer display: " + e.getMessage(), e);
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        dismissPresentation();
        super.handleOnDestroy();
    }

    private void dismissPresentation() {
        if (presentation != null) {
            try {
                if (presentation.isShowing()) {
                    presentation.dismiss();
                }
            } catch (Exception ignored) {
                // Display may already be gone.
            }
            presentation = null;
        }
    }

    private Display findSecondaryDisplay() {
        Context context = getContext();
        if (context == null) {
            return null;
        }

        DisplayManager displayManager =
            (DisplayManager) context.getSystemService(Context.DISPLAY_SERVICE);
        if (displayManager == null) {
            return null;
        }

        Display[] presentationDisplays =
            displayManager.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION);
        if (presentationDisplays != null && presentationDisplays.length > 0) {
            return presentationDisplays[0];
        }

        Display defaultDisplay = getActivity() != null
            ? getActivity().getWindowManager().getDefaultDisplay()
            : null;
        int defaultId = defaultDisplay != null ? defaultDisplay.getDisplayId() : Display.DEFAULT_DISPLAY;

        Display[] allDisplays = displayManager.getDisplays();
        if (allDisplays == null) {
            return null;
        }

        for (Display display : allDisplays) {
            if (display != null && display.getDisplayId() != defaultId) {
                return display;
            }
        }

        return null;
    }

    /**
     * Idle customer-facing screen: centered Welcome + Powered by Easy Menu.
     */
    private static class IdlePresentation extends Presentation {

        IdlePresentation(Context outerContext, Display display) {
            super(outerContext, display);
        }

        @Override
        protected void onCreate(Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);

            LinearLayout root = new LinearLayout(getContext());
            root.setOrientation(LinearLayout.VERTICAL);
            root.setGravity(Gravity.CENTER);
            root.setBackgroundColor(Color.WHITE);
            root.setLayoutParams(
                new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            );
            int pad = dp(24);
            root.setPadding(pad, pad, pad, pad);

            TextView welcome = new TextView(getContext());
            welcome.setText("Welcome");
            welcome.setTextColor(Color.parseColor("#171717"));
            welcome.setTextSize(TypedValue.COMPLEX_UNIT_SP, 42);
            welcome.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
            welcome.setGravity(Gravity.CENTER);
            root.addView(
                welcome,
                new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
            );

            TextView powered = new TextView(getContext());
            powered.setText("Powered by Easy Menu");
            powered.setTextColor(Color.parseColor("#737373"));
            powered.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
            powered.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL));
            powered.setGravity(Gravity.CENTER);
            LinearLayout.LayoutParams poweredLp =
                new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                );
            poweredLp.topMargin = dp(12);
            root.addView(powered, poweredLp);

            setContentView(root);
        }

        private int dp(int value) {
            float density = getContext().getResources().getDisplayMetrics().density;
            return Math.round(value * density);
        }
    }
}
