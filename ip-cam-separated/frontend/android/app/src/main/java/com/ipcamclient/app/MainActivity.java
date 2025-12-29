package com.ipcamclient.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 获取 WebView 并配置允许混合内容
        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();

        // 允许 HTTPS 页面加载 HTTP 资源（混合内容）
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // 允许跨域请求
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        // 启用 DOM Storage
        settings.setDomStorageEnabled(true);

        // 启用 JavaScript
        settings.setJavaScriptEnabled(true);

        // 允许媒体自动播放
        settings.setMediaPlaybackRequiresUserGesture(false);
    }
}
