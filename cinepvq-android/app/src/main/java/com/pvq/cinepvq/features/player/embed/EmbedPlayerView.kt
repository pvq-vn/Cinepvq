package com.pvq.cinepvq.features.player.embed

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color as ComposeColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView

private fun buildIframeHtml(embedUrl: String): String {
    return """
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                html, body { width: 100%; height: 100%; background-color: #000; overflow: hidden; }
                iframe { width: 100%; height: 100%; border: none; position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
            </style>
        </head>
        <body>
            <iframe src="$embedUrl" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen="true" frameborder="0"></iframe>
        </body>
        </html>
    """.trimIndent()
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun EmbedPlayerView(
    url: String,
    modifier: Modifier = Modifier,
    onCustomViewChange: ((View?, WebChromeClient.CustomViewCallback?) -> Unit)? = null
) {
    val context = LocalContext.current

    val normalizedUrl = remember(url) {
        when {
            url.isBlank() -> "about:blank"
            url.startsWith("//") -> "https:$url"
            !url.startsWith("http://") && !url.startsWith("https://") -> "https://$url"
            else -> url
        }
    }

    var webViewRef: WebView? = remember { null }

    DisposableEffect(normalizedUrl) {
        onDispose {
            webViewRef?.let { wv ->
                try {
                    wv.stopLoading()
                    wv.loadUrl("about:blank")
                    wv.clearHistory()
                    wv.removeAllViews()
                    wv.destroy()
                } catch (_: Exception) {}
            }
            webViewRef = null
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(ComposeColor.Black)
    ) {
        AndroidView(
            factory = { ctx ->
                WebView(ctx).apply {
                    layoutParams = FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    setBackgroundColor(Color.BLACK)
                    setLayerType(View.LAYER_TYPE_HARDWARE, null)

                    val cookieManager = CookieManager.getInstance()
                    cookieManager.setAcceptCookie(true)
                    cookieManager.setAcceptThirdPartyCookies(this, true)

                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        databaseEnabled = true
                        mediaPlaybackRequiresUserGesture = false
                        allowFileAccess = false
                        allowContentAccess = false
                        loadWithOverviewMode = true
                        useWideViewPort = true
                        setSupportZoom(false)
                        builtInZoomControls = false
                        displayZoomControls = false
                        mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                        // Standard mobile Chrome User-Agent without non-standard bot-triggering tokens
                        userAgentString = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
                        cacheMode = WebSettings.LOAD_DEFAULT
                    }

                    webChromeClient = object : WebChromeClient() {
                        override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                            onCustomViewChange?.invoke(view, callback)
                        }

                        override fun onHideCustomView() {
                            onCustomViewChange?.invoke(null, null)
                        }
                    }

                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                            val uri = request?.url ?: return false
                            val scheme = uri.scheme ?: return false
                            if (scheme == "http" || scheme == "https") {
                                return false // Allow WebView to load inside embed frame
                            }
                            // Handle external intent schemes safely (e.g. app links)
                            return try {
                                val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                }
                                ctx.startActivity(intent)
                                true
                            } catch (_: Exception) {
                                true
                            }
                        }
                    }

                    tag = normalizedUrl
                    if (normalizedUrl != "about:blank") {
                        val html = buildIframeHtml(normalizedUrl)
                        loadDataWithBaseURL(normalizedUrl, html, "text/html", "UTF-8", null)
                    } else {
                        loadUrl("about:blank")
                    }
                    webViewRef = this
                }
            },
            update = { webView ->
                val loaded = webView.tag as? String
                if (loaded != normalizedUrl) {
                    webView.tag = normalizedUrl
                    if (normalizedUrl != "about:blank") {
                        val html = buildIframeHtml(normalizedUrl)
                        webView.loadDataWithBaseURL(normalizedUrl, html, "text/html", "UTF-8", null)
                    } else {
                        webView.loadUrl("about:blank")
                    }
                }
            },
            modifier = Modifier.fillMaxSize()
        )
    }
}
