package io.github.rachane16.rmweather;

import android.Manifest;
import android.annotation.SuppressLint;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import java.util.Collections;

public final class MainActivity extends ComponentActivity {
    private static final int LOCATION_REQUEST = 10;
    private WebView web;
    private FrameLayout root;
    private LinearLayout offline;
    private ProgressBar progress;
    private View fullScreen;
    private WebChromeClient.CustomViewCallback fullScreenCallback;
    private GeolocationPermissions.Callback locationCallback;
    private String locationOrigin;
    private boolean loadFailed;
    private int connectionRetries;

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        setContentView(root);
        web = new WebView(this);
        web.setContentDescription("RMWeather แผนที่ฝน ลม และระดับน้ำ");
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);
        String appVersion = "1.1";
        try { appVersion = getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
        catch (PackageManager.NameNotFoundException ignored) { /* Own package is always installed. */ }
        settings.setUserAgentString(settings.getUserAgentString() + " RMWeatherAndroid/" + appVersion);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                String url = request.getUrl().toString();
                if (NavigationPolicy.isAppPage(url)) return false;
                if (NavigationPolicy.isExternalWebPage(url)) openBrowser(url);
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                loadFailed = false; offline.setVisibility(View.GONE); progress.setVisibility(View.VISIBLE);
            }
            @Override public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                if (!loadFailed) { offline.setVisibility(View.GONE); connectionRetries = 0; }
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    android.util.Log.w("RMWeatherNetwork", "Main page failed: " + error.getErrorCode());
                    retryConnection(error.getErrorCode());
                }
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) {
                    android.util.Log.w("RMWeatherNetwork", "Main page HTTP status: " + response.getStatusCode());
                    if (response.getStatusCode() >= 500 || response.getStatusCode() == 429) retryConnection(WebViewClient.ERROR_CONNECT);
                    else showOffline();
                }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) {
                if (value >= 100) progress.setVisibility(View.GONE);
            }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (!NavigationPolicy.isLocationOrigin(origin) || !NavigationPolicy.isAppPage(web.getUrl())) {
                    callback.invoke(origin, false, false); return;
                }
                if (hasLocationPermission()) { callback.invoke(origin, true, false); return; }
                denyPendingLocation();
                locationOrigin = origin; locationCallback = callback;
                requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION}, LOCATION_REQUEST);
            }
            @Override public void onGeolocationPermissionsHidePrompt() { denyPendingLocation(); }
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullScreen != null) { callback.onCustomViewHidden(); return; }
                fullScreen = view; fullScreenCallback = callback;
                root.addView(view, new FrameLayout.LayoutParams(-1, -1)); web.setVisibility(View.GONE);
            }
            @Override public void onHideCustomView() { closeFullScreen(); }
        });
        web.setDownloadListener((url, agent, disposition, mime, length) -> {
            if (NavigationPolicy.isExternalWebPage(url)) openBrowser(url);
        });
        progress = new ProgressBar(this);
        progress.setContentDescription(getString(R.string.connecting));
        FrameLayout.LayoutParams loading = new FrameLayout.LayoutParams(dp(40), dp(40), Gravity.CENTER);
        root.addView(progress, loading);
        createOfflineView();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { goBack(); }
        });
        if (state == null || web.restoreState(state) == null) loadHome();
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void createOfflineView() {
        offline = new LinearLayout(this);
        offline.setOrientation(LinearLayout.VERTICAL); offline.setGravity(Gravity.CENTER);
        offline.setPadding(dp(28), dp(24), dp(28), dp(24)); offline.setBackgroundColor(Color.WHITE);
        ImageView logo = new ImageView(this); logo.setImageResource(R.drawable.rmweather_logo); logo.setContentDescription("RMWeather");
        offline.addView(logo, new LinearLayout.LayoutParams(dp(240), dp(90)));
        TextView title = new TextView(this); title.setText(R.string.offline_title); title.setTextSize(21); title.setTextColor(Color.rgb(23,59,49)); title.setGravity(Gravity.CENTER);
        offline.addView(title, new LinearLayout.LayoutParams(-1, -2));
        TextView description = new TextView(this); description.setText(R.string.offline_message); description.setTextSize(16); description.setGravity(Gravity.CENTER); description.setPadding(0,dp(12),0,dp(18));
        offline.addView(description, new LinearLayout.LayoutParams(-1,-2));
        Button retry = new Button(this); retry.setText(R.string.retry); retry.setOnClickListener(view -> { connectionRetries = 0; loadHome(); }); offline.addView(retry);
        Button browser = new Button(this); browser.setText(R.string.open_browser); browser.setOnClickListener(view -> openBrowser(NavigationPolicy.HOME)); offline.addView(browser);
        root.addView(offline, new FrameLayout.LayoutParams(-1,-1)); offline.setVisibility(View.GONE);
    }
    private void showOffline() { loadFailed = true; progress.setVisibility(View.GONE); offline.setVisibility(View.VISIBLE); }
    private void retryConnection(int code) {
        showOffline();
        if ((code == WebViewClient.ERROR_HOST_LOOKUP || code == WebViewClient.ERROR_CONNECT || code == WebViewClient.ERROR_TIMEOUT) && connectionRetries < 2) {
            int delay = 2000 * ++connectionRetries;
            web.postDelayed(() -> { if (!isFinishing() && !isDestroyed() && loadFailed) loadHome(); }, delay);
        }
    }
    private void loadHome() { loadFailed = false; offline.setVisibility(View.GONE); web.loadUrl(NavigationPolicy.HOME, Collections.singletonMap("Cache-Control","max-age=0")); }
    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }
    private void denyPendingLocation() {
        if (locationCallback != null) locationCallback.invoke(locationOrigin, false, false);
        locationCallback = null; locationOrigin = null;
    }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == LOCATION_REQUEST && locationCallback != null) {
            locationCallback.invoke(locationOrigin, hasLocationPermission() && NavigationPolicy.isAppPage(web.getUrl()), false);
            locationCallback = null; locationOrigin = null;
        }
    }
    private void openBrowser(String url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
        catch (ActivityNotFoundException ignored) { android.widget.Toast.makeText(this, R.string.offline_message, android.widget.Toast.LENGTH_LONG).show(); }
    }
    private void closeFullScreen() {
        if (fullScreen == null) return;
        root.removeView(fullScreen); fullScreen = null; web.setVisibility(View.VISIBLE);
        if (fullScreenCallback != null) fullScreenCallback.onCustomViewHidden(); fullScreenCallback = null;
    }
    private void goBack() {
        if (fullScreen != null) { closeFullScreen(); return; }
        if (!NavigationPolicy.isAppPage(web.getUrl())) { finish(); return; }
        // Close one of RMWeather's visible control windows before leaving the map.
        web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.close();return true;}const pairs=[['forecast-layer-panel','forecast-layer-close'],['development-dialog','development-close'],['development-timeline','development-timeline-close'],['radar-player','radar-close'],['advance-forecast-panel','advance-forecast-close'],['display-panel','display-close'],['maptools-panel','maptools-close'],['basemap-panel','basemap-close'],['sidebar','sidebar-close']];for(const [panel,id] of pairs){const p=document.getElementById(panel),b=document.getElementById(id);if(p&&p.getClientRects().length&&b){b.click();return true;}}for(const id of ['weather-map-panel','seven-day-panel']){const p=document.getElementById(id),b=p?.querySelector('[data-close-tool]');if(p&&p.getClientRects().length&&b){b.click();return true;}}return false;})()", closed -> {
            if (!"true".equals(closed)) { if (web.canGoBack()) web.goBack(); else finish(); }
        });
    }
    @Override protected void onSaveInstanceState(Bundle state) { web.saveState(state); super.onSaveInstanceState(state); }
    @Override protected void onPause() { web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() { denyPendingLocation(); closeFullScreen(); if (web != null) { root.removeView(web); web.destroy(); } super.onDestroy(); }
}
