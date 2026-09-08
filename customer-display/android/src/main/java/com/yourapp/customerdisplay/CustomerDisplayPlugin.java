package com.yourapp.customerdisplay;

import android.annotation.SuppressLint;
import android.app.Presentation;
import android.content.Context;
import android.graphics.Color;
import android.hardware.display.DisplayManager;
import android.os.Bundle;
import android.view.Display;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Customer-facing secondary display via Android {@link Presentation} + {@link WebView}.
 * Loads a URL (e.g. /customer-display) and receives cart snapshots from the main Capacitor WebView.
 */
@CapacitorPlugin(name = "CustomerDisplay")
public class CustomerDisplayPlugin extends Plugin {

    private CustomerDisplayPresentation presentation;
    private String pendingCartJson = "{\"mode\":\"idle\",\"lines\":[]}";

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", findSecondaryDisplay() != null);
        call.resolve(result);
    }

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url", "");
        if (url == null || url.trim().isEmpty()) {
            call.reject("url is required");
            return;
        }
        final String loadUrl = url.trim();

        getActivity().runOnUiThread(() -> {
            try {
                Display display = findSecondaryDisplay();
                if (display == null) {
                    call.resolve();
                    return;
                }

                if (presentation != null && presentation.isShowing()) {
                    if (presentation.getDisplay().getDisplayId() == display.getDisplayId()) {
                        presentation.loadUrlIfNeeded(loadUrl);
                        call.resolve();
                        return;
                    }
                    dismissPresentation();
                }

                presentation = new CustomerDisplayPresentation(getActivity(), display, loadUrl);
                presentation.setCartJson(pendingCartJson);
                presentation.show();
                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to open customer display: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void updateCart(PluginCall call) {
        JSObject data = call.getData();
        final String json = data != null ? data.toString() : "{\"mode\":\"idle\",\"lines\":[]}";
        pendingCartJson = json;

        getActivity().runOnUiThread(() -> {
            try {
                if (presentation != null && presentation.isShowing()) {
                    presentation.setCartJson(json);
                    presentation.deliverCartJson();
                }
                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to update customer display: " + e.getMessage(), e);
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
     * Full-screen WebView on the secondary display.
     */
    private static class CustomerDisplayPresentation extends Presentation {

        private final String initialUrl;
        private WebView webView;
        private String cartJson = "{\"mode\":\"idle\",\"lines\":[]}";
        private String loadedUrl = "";
        private boolean pageReady = false;

        CustomerDisplayPresentation(Context outerContext, Display display, String url) {
            super(outerContext, display);
            this.initialUrl = url;
        }

        void setCartJson(String json) {
            if (json != null && !json.isEmpty()) {
                cartJson = json;
            }
        }

        void loadUrlIfNeeded(String url) {
            if (webView == null || url == null || url.isEmpty()) return;
            if (url.equals(loadedUrl)) return;
            pageReady = false;
            loadedUrl = url;
            webView.loadUrl(url);
        }

        void deliverCartJson() {
            if (webView == null || !pageReady) return;
            // cartJson is already JSON from Capacitor JSObject — embed as a JS object literal.
            String script =
                "(function(){try{"
                    + "var data=" + cartJson + ";"
                    + "window.dispatchEvent(new CustomEvent('customer-display-cart',{detail:data}));"
                    + "if(typeof window.__onCustomerDisplayCart==='function'){window.__onCustomerDisplayCart(data);}"
                    + "}catch(e){}})();";
            webView.evaluateJavascript(script, null);
        }

        @SuppressLint("SetJavaScriptEnabled")
        @Override
        protected void onCreate(Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);

            FrameLayout root = new FrameLayout(getContext());
            root.setLayoutParams(
                new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            );
            root.setBackgroundColor(Color.WHITE);

            webView = new WebView(getContext());
            webView.setLayoutParams(
                new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            );

            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setLoadWithOverviewMode(true);
            settings.setUseWideViewPort(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
                CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
            }
            CookieManager.getInstance().setAcceptCookie(true);

            webView.setWebChromeClient(new WebChromeClient());
            webView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    pageReady = true;
                    loadedUrl = url != null ? url : loadedUrl;
                    deliverCartJson();
                }
            });

            root.addView(webView);
            setContentView(root);

            loadedUrl = initialUrl;
            webView.loadUrl(initialUrl);
        }

        @Override
        public void dismiss() {
            if (webView != null) {
                try {
                    webView.stopLoading();
                    webView.destroy();
                } catch (Exception ignored) {
                    // Best-effort cleanup.
                }
                webView = null;
            }
            super.dismiss();
        }
    }
}
