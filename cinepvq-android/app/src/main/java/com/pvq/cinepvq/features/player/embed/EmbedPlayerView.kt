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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color as ComposeColor
import androidx.compose.ui.input.pointer.pointerInput
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
    isInMiniPlayer: Boolean = false,
    onStreamSniffed: ((String) -> Unit)? = null,
    onCustomViewChange: ((View?, WebChromeClient.CustomViewCallback?) -> Unit)? = null
) {
    val context = LocalContext.current
    val playbackManager = remember { com.pvq.cinepvq.CinepvqApp.instance.playbackManager }

    val normalizedUrl = remember(url) {
        val raw = when {
            url.isBlank() -> "about:blank"
            url.startsWith("//") -> "https:$url"
            !url.startsWith("http://") && !url.startsWith("https://") -> "https://$url"
            else -> url
        }
        if ((raw.contains("vsmov") || raw.contains("streamvsmov")) && !raw.contains("embed=")) {
            if (raw.contains("?")) "$raw&embed=1" else "$raw?embed=1"
        } else {
            raw
        }
    }

    val currentOnCustomViewChange = androidx.compose.runtime.rememberUpdatedState(onCustomViewChange)
    val currentOnStreamSniffed = androidx.compose.runtime.rememberUpdatedState(onStreamSniffed)

    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var containerRef by remember { mutableStateOf<FrameLayout?>(null) }
    var activeCustomView by remember { mutableStateOf<View?>(null) }
    var activeCustomCallback by remember { mutableStateOf<WebChromeClient.CustomViewCallback?>(null) }

    DisposableEffect(normalizedUrl) {
        onDispose {
            activeCustomCallback?.onCustomViewHidden()
            activeCustomCallback = null
            activeCustomView?.let { v ->
                (v.parent as? ViewGroup)?.removeView(v)
            }
            activeCustomView = null

            // Only pause if playback is actually closed or idle (do not pause during transitions between active presentations like PiP/Mini/Full)
            val presentation = playbackManager.presentationState.value
            val isPlayingState = presentation in listOf(
                com.pvq.cinepvq.data.player.PlayerPresentationState.FULL_PORTRAIT,
                com.pvq.cinepvq.data.player.PlayerPresentationState.FULL_LANDSCAPE,
                com.pvq.cinepvq.data.player.PlayerPresentationState.MINI_IN_APP,
                com.pvq.cinepvq.data.player.PlayerPresentationState.SYSTEM_PIP
            )
            if (!isPlayingState || !playbackManager.hasActivePlayback) {
                webViewRef?.onPause()
                webViewRef?.evaluateJavascript("try { document.querySelector('video')?.pause(); } catch(e) {}", null)
                playbackManager.setEmbedPlaying(false)
            }
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(ComposeColor.Black)
    ) {
        AndroidView(
            factory = { ctx ->
                val container = FrameLayout(ctx).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    setBackgroundColor(Color.BLACK)
                    fitsSystemWindows = false
                    setPadding(0, 0, 0, 0)
                }

                val (webView, isNew) = playbackManager.getOrCreateEmbedWebView(ctx, normalizedUrl)
                webViewRef = webView

                webView.fitsSystemWindows = false
                webView.setPadding(0, 0, 0, 0)

                // Sniffer and control JavaScript interface (always re-attached with latest state)
                webView.addJavascriptInterface(object {
                    @android.webkit.JavascriptInterface
                    fun onMediaDetected(src: String) {
                        if (src.isNotBlank() && (src.startsWith("http://") || src.startsWith("https://"))) {
                            playbackManager.setSniffedEmbedStream(src)
                            currentOnStreamSniffed.value?.invoke(src)
                        }
                    }

                    @android.webkit.JavascriptInterface
                    fun onPlaybackStateChanged(isPlaying: Boolean) {
                        playbackManager.setEmbedPlaying(isPlaying)
                    }

                    @android.webkit.JavascriptInterface
                    fun onTimeUpdate(currentTimeSec: Float, durationSec: Float) {
                        val posMs = (currentTimeSec * 1000L).toLong()
                        playbackManager.updateEmbedPosition(posMs)
                    }

                    @android.webkit.JavascriptInterface
                    fun onExitFullscreenRequested() {
                        val target = webViewRef ?: return
                        target.post {
                            activeCustomView?.let { v ->
                                (v.parent as? ViewGroup)?.removeView(v)
                            }
                            activeCustomView = null
                            target.visibility = View.VISIBLE
                            try {
                                activeCustomCallback?.onCustomViewHidden()
                            } catch (_: Exception) {}
                            activeCustomCallback = null
                            currentOnCustomViewChange.value?.invoke(null, null)
                        }
                    }
                }, "AndroidMediaSniffer")

                if (isNew) {
                    webView.apply {
                        layoutParams = FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        setBackgroundColor(Color.BLACK)
                        setLayerType(View.LAYER_TYPE_NONE, null)

                        val cookieManager = CookieManager.getInstance()
                        cookieManager.setAcceptCookie(true)
                        cookieManager.setAcceptThirdPartyCookies(this, true)

                        settings.apply {
                            javaScriptEnabled = true
                            domStorageEnabled = true
                            databaseEnabled = true
                            mediaPlaybackRequiresUserGesture = false
                            allowFileAccess = true
                            allowContentAccess = true
                            allowFileAccessFromFileURLs = true
                            allowUniversalAccessFromFileURLs = true
                            loadWithOverviewMode = false
                            useWideViewPort = false
                            setSupportZoom(false)
                            builtInZoomControls = false
                            displayZoomControls = false
                            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                            userAgentString = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
                            cacheMode = WebSettings.LOAD_DEFAULT
                        }

                        webChromeClient = object : WebChromeClient() {
                            override fun onCreateWindow(view: WebView?, isDialog: Boolean, isUserGesture: Boolean, resultMsg: android.os.Message?): Boolean {
                                val transport = resultMsg?.obj as? WebView.WebViewTransport
                                transport?.webView = view
                                resultMsg?.sendToTarget()
                                return true
                            }

                            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                                if (view == null) return
                                activeCustomView?.let { prev -> (prev.parent as? ViewGroup)?.removeView(prev) }
                                activeCustomView = view
                                activeCustomCallback = callback

                                view.fitsSystemWindows = false
                                view.setPadding(0, 0, 0, 0)

                                val parentLayout = (parent as? ViewGroup) ?: containerRef ?: container
                                parentLayout.addView(
                                    view,
                                    FrameLayout.LayoutParams(
                                        ViewGroup.LayoutParams.MATCH_PARENT,
                                        ViewGroup.LayoutParams.MATCH_PARENT
                                    )
                                )
                                visibility = View.INVISIBLE
                                currentOnCustomViewChange.value?.invoke(view, callback)
                            }

                            override fun onHideCustomView() {
                                activeCustomView?.let { v ->
                                    (v.parent as? ViewGroup)?.removeView(v)
                                }
                                activeCustomView = null
                                visibility = View.VISIBLE
                                try {
                                    activeCustomCallback?.onCustomViewHidden()
                                } catch (_: Exception) {}
                                activeCustomCallback = null
                                currentOnCustomViewChange.value?.invoke(null, null)
                            }
                        }

                        webViewClient = object : WebViewClient() {
                            override fun onPageStarted(view: WebView?, pageUrl: String?, favicon: android.graphics.Bitmap?) {
                                super.onPageStarted(view, pageUrl, favicon)
                                view?.evaluateJavascript(
                                    "(function(){ try { document.documentElement.classList.add('bc-embed'); } catch(e){} })();",
                                    null
                                )
                            }

                            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): android.webkit.WebResourceResponse? {
                                val uri = request?.url?.toString() ?: return null
                                if (uri.contains(".m3u8", ignoreCase = true) ||
                                    (uri.contains(".mp4", ignoreCase = true) && !uri.contains("thumb") && !uri.contains("preview") && !uri.contains("poster"))
                                ) {
                                    val reqHeaders = (request.requestHeaders ?: emptyMap()).toMutableMap()
                                    val cookies = CookieManager.getInstance().getCookie(uri)
                                        ?: CookieManager.getInstance().getCookie(normalizedUrl)
                                    if (!cookies.isNullOrBlank()) {
                                        reqHeaders["Cookie"] = cookies
                                    }
                                    playbackManager.setSniffedEmbedStream(uri, reqHeaders)
                                    currentOnStreamSniffed.value?.invoke(uri)
                                }
                                return super.shouldInterceptRequest(view, request)
                            }

                            override fun onPageFinished(view: WebView?, pageUrl: String?) {
                                super.onPageFinished(view, pageUrl)
                                // Inject responsive styles, fullscreen layout fit, settings popup scaling, and touch guard
                                val js = """
                                    (function() {
                                        function injectResponsiveCss(doc) {
                                            try {
                                                if (!doc) return;
                                                if (doc.documentElement) {
                                                    doc.documentElement.classList.add('bc-embed');
                                                }
                                                if (doc.getElementById('cinepvq-embed-responsive-style')) return;
                                                var style = doc.createElement('style');
                                                style.id = 'cinepvq-embed-responsive-style';
                                                style.textContent = `
                                                    /* Hide top bar / header from vsmov and other embeds */
                                                    #player_top, #player_bottom, #video_mask, .bc-player-boot, [id*="player_top"], .bc-top-ticker {
                                                        display: none !important;
                                                        opacity: 0 !important;
                                                        visibility: hidden !important;
                                                        height: 0 !important;
                                                        pointer-events: none !important;
                                                    }
                                                    html.bc-embed #player_top {
                                                        display: none !important;
                                                    }

                                                    /* Full viewport fit for HTML, body, and player containers */
                                                    html, body {
                                                        width: 100% !important;
                                                        height: 100% !important;
                                                        max-width: 100% !important;
                                                        max-height: 100% !important;
                                                        overflow: hidden !important;
                                                        margin: 0 !important;
                                                        padding: 0 !important;
                                                        background-color: #000 !important;
                                                    }

                                                    #rp-player,
                                                    #rp-player.bc-css-fullscreen,
                                                    .main-player,
                                                    #player,
                                                    .jwplayer,
                                                    .jwplayer .jw-wrapper,
                                                    .art-video-player,
                                                    .artplayer-app {
                                                        position: absolute !important;
                                                        inset: 0 !important;
                                                        top: 0 !important;
                                                        left: 0 !important;
                                                        right: 0 !important;
                                                        bottom: 0 !important;
                                                        width: 100% !important;
                                                        height: 100% !important;
                                                        max-width: 100% !important;
                                                        max-height: 100% !important;
                                                        margin: 0 !important;
                                                        padding: 0 !important;
                                                        overflow: hidden !important;
                                                        box-sizing: border-box !important;
                                                        background: #000 !important;
                                                    }

                                                    /* Eliminate jw-aspect padding which forces 16:9 width-based height and pushes bottom offscreen */
                                                    .jwplayer .jw-aspect,
                                                    [class*="jw-aspect"] {
                                                        display: none !important;
                                                        padding-bottom: 0 !important;
                                                        height: 100% !important;
                                                    }

                                                    /* Contain video cleanly */
                                                    .jwplayer video,
                                                    .jw-media video,
                                                    video {
                                                        object-fit: contain !important;
                                                        width: 100% !important;
                                                        height: 100% !important;
                                                    }

                                                    /* Pin control bar strictly to the bottom of the visible screen */
                                                    .jwplayer .jw-controlbar,
                                                    .jw-controlbar,
                                                    #rp-player .b_func,
                                                    .b_func,
                                                    .art-bottom {
                                                        position: absolute !important;
                                                        bottom: 0 !important;
                                                        left: 0 !important;
                                                        right: 0 !important;
                                                        width: 100% !important;
                                                        max-width: 100% !important;
                                                        z-index: 2147483640 !important;
                                                    }

                                                    /* Subtitles: Pin above the control bar so they are never cut off */
                                                    #bc-dual-subs,
                                                    .bc-dual-subs,
                                                    .jwplayer .jw-captions,
                                                    .jw-captions {
                                                        position: absolute !important;
                                                        bottom: 50px !important;
                                                        left: 4% !important;
                                                        right: 4% !important;
                                                        z-index: 2147483639 !important;
                                                    }

                                                    /* Scale and clamp NguonC ArtPlayer Settings popup so it is never too large or obscured */
                                                    .art-settings,
                                                    .art-setting,
                                                    .art-setting-panel,
                                                    .art-setting-inner,
                                                    .art-contextmenu,
                                                    [class*="art-setting"],
                                                    .dplayer-setting-box,
                                                    .jw-settings-menu {
                                                        max-height: 80% !important;
                                                        max-width: 82% !important;
                                                        width: auto !important;
                                                        min-width: 160px !important;
                                                        overflow-y: auto !important;
                                                        -webkit-overflow-scrolling: touch !important;
                                                        bottom: 38px !important;
                                                        right: 8px !important;
                                                        top: auto !important;
                                                        font-size: 12px !important;
                                                        border-radius: 8px !important;
                                                        background: rgba(18, 18, 22, 0.95) !important;
                                                        backdrop-filter: blur(10px) !important;
                                                        -webkit-backdrop-filter: blur(10px) !important;
                                                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important;
                                                        z-index: 2147483647 !important;
                                                    }

                                                    .art-setting-item,
                                                    .art-setting-panel-item,
                                                    [class*="art-setting-item"],
                                                    .art-contextmenu-item {
                                                        height: 32px !important;
                                                        min-height: 32px !important;
                                                        line-height: 32px !important;
                                                        padding: 0 10px !important;
                                                        font-size: 12px !important;
                                                    }

                                                    /* Responsive modal dialogs */
                                                    #resumeModal, .rz-card, [class*="auto-playback"], [class*="resume"], [class*="continue"], 
                                                    .art-layer-auto-playback, .jw-modal, [class*="modal"], [class*="popup"], [class*="dialog"],
                                                    [id*="popup"], [id*="dialog"], .swal2-container, .layui-layer, [role="dialog"], [role="alertdialog"],
                                                    .pop-content, .modal-content, .dialog-box, [class*="layer-popup"] {
                                                        max-width: 94vw !important;
                                                        max-height: 88vh !important;
                                                        max-width: 94% !important;
                                                        max-height: 88% !important;
                                                        box-sizing: border-box !important;
                                                        overflow-y: auto !important;
                                                        z-index: 2147483647 !important;
                                                    }
                                                    .modal-dialog, [class*="modal-dialog"], .popup-wrapper, [class*="modal-wrap"], .layui-layer-content {
                                                        max-width: 94% !important;
                                                        max-height: 88% !important;
                                                        margin: auto !important;
                                                        overflow-y: auto !important;
                                                    }
                                                    .rz-badge {
                                                        display: none !important;
                                                    }
                                                    .rz-card {
                                                        padding: 12px 16px 12px !important;
                                                    }
                                                `;
                                                (doc.head || doc.body).appendChild(style);

                                                if (!doc._obsAttached) {
                                                    doc._obsAttached = true;
                                                    var observer = new MutationObserver(function() {
                                                        injectResponsiveCss(doc);
                                                        fitEmbedLayout(doc);
                                                    });
                                                    observer.observe(doc.body || doc.documentElement, { childList: true, subtree: true });
                                                }
                                            } catch(e) {}
                                        }

                                        function fitEmbedLayout(doc) {
                                            try {
                                                if (!doc) return;
                                                var rp = doc.getElementById('rp-player');
                                                if (rp && !rp.classList.contains('bc-css-fullscreen')) {
                                                    rp.classList.add('bc-css-fullscreen');
                                                }
                                                if (window.jwplayer) {
                                                    try {
                                                        var jw = window.jwplayer();
                                                        if (jw && typeof jw.resize === 'function') {
                                                            jw.resize('100%', '100%');
                                                        }
                                                    } catch(e) {}
                                                }
                                            } catch(e) {}
                                        }

                                        // Tap Guard: Wake controls on first tap, interact on second tap (Issue 3)
                                        var areControlsAwake = false;
                                        var wakeTimer = null;

                                        function markControlsAwake() {
                                            areControlsAwake = true;
                                            if (wakeTimer) clearTimeout(wakeTimer);
                                            wakeTimer = setTimeout(function() {
                                                areControlsAwake = false;
                                            }, 4000);
                                        }

                                        function setupTapGuardAndListeners(doc) {
                                            if (!doc || doc._tapGuardAttached) return;
                                            doc._tapGuardAttached = true;

                                            var swallowedTouch = false;

                                            doc.addEventListener('touchstart', function(e) {
                                                var jw = doc.querySelector('.jwplayer');
                                                var isJwInactive = jw && jw.classList.contains('jw-flag-user-inactive');
                                                var target = e.target;
                                                var onInteractiveButton = target.closest && target.closest(
                                                    '.jw-controlbar, .b_func, .jw-display-icon-container, .bc-display-skip, .art-control, .art-bottom, .jw-slider-time, .jw-icon-playback'
                                                );

                                                if ((isJwInactive || !areControlsAwake) && onInteractiveButton) {
                                                    swallowedTouch = true;
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    if (jw) {
                                                        jw.classList.remove('jw-flag-user-inactive');
                                                    }
                                                    if (window.jwplayer) {
                                                        try { window.jwplayer().setControls(true); } catch(ex) {}
                                                    }
                                                    markControlsAwake();
                                                } else {
                                                    swallowedTouch = false;
                                                    markControlsAwake();
                                                }
                                            }, true);

                                            doc.addEventListener('touchend', function(e) {
                                                if (swallowedTouch) {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    swallowedTouch = false;
                                                }
                                            }, true);

                                            doc.addEventListener('click', function(e) {
                                                if (swallowedTouch) {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    swallowedTouch = false;
                                                    return;
                                                }

                                                // Check if user clicked an exit fullscreen button (Issue 2)
                                                var target = e.target;
                                                var exitBtn = target.closest && target.closest(
                                                    '.item-min, .art-icon-fullscreen-web, .art-icon-fullscreen, [data-action="fullscreen"], [data-action="fullscreenWeb"], .jw-icon-fullscreen'
                                                );
                                                if (exitBtn) {
                                                    setTimeout(function() {
                                                        var isStillFs = doc.fullscreenElement || document.fullscreenElement ||
                                                                        doc.webkitFullscreenElement || document.webkitFullscreenElement ||
                                                                        doc.querySelector('.art-fullscreen, .art-fullscreen-web');
                                                        if (!isStillFs) {
                                                            if (window.AndroidMediaSniffer && window.AndroidMediaSniffer.onExitFullscreenRequested) {
                                                                window.AndroidMediaSniffer.onExitFullscreenRequested();
                                                            }
                                                        }
                                                    }, 200);
                                                }
                                            }, true);

                                            // Fullscreen change observers (Issue 2)
                                            function checkFsExit() {
                                                var isFs = doc.fullscreenElement || document.fullscreenElement ||
                                                           doc.webkitFullscreenElement || document.webkitFullscreenElement;
                                                if (!isFs) {
                                                    if (window.AndroidMediaSniffer && window.AndroidMediaSniffer.onExitFullscreenRequested) {
                                                        window.AndroidMediaSniffer.onExitFullscreenRequested();
                                                    }
                                                }
                                            }
                                            doc.addEventListener('fullscreenchange', checkFsExit);
                                            doc.addEventListener('webkitfullscreenchange', checkFsExit);
                                        }

                                        var dismissCount = 0;
                                        function autoDismissPrompt() {
                                            try {
                                                var docs = [document];
                                                var iframes = document.querySelectorAll('iframe');
                                                for (var f = 0; f < iframes.length; f++) {
                                                    try {
                                                        if (iframes[f].contentDocument) docs.push(iframes[f].contentDocument);
                                                    } catch(e) {}
                                                }
                                                for (var d = 0; d < docs.length; d++) {
                                                    var doc = docs[d];
                                                    injectResponsiveCss(doc);
                                                    fitEmbedLayout(doc);
                                                    setupTapGuardAndListeners(doc);

                                                    var rzGo = doc.getElementById('rzGo') || doc.querySelector('.rz-go');
                                                    if (rzGo) {
                                                        rzGo.click();
                                                        break;
                                                    }
                                                    var buttons = doc.querySelectorAll('button, a, .btn, [role="button"], span, div, p');
                                                    for (var i = 0; i < buttons.length; i++) {
                                                        var b = buttons[i];
                                                        var rawTxt = (b.innerText || b.textContent || '');
                                                        var norm = rawTxt.replace(/[\s\u00A0\u200B]+/g, ' ').trim().toLowerCase();
                                                        if (norm.indexOf('xem tiếp') !== -1 || 
                                                            norm.indexOf('tiếp tục xem') !== -1 || 
                                                            norm.indexOf('tiếp tục') !== -1 || 
                                                            norm.indexOf('resume') !== -1 || 
                                                            norm.indexOf('xem tiep') !== -1) {
                                                            if (norm.length < 35) {
                                                                b.click();
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                            } catch(e) {}
                                            dismissCount++;
                                            if (dismissCount > 25) clearInterval(dismissTimer);
                                        }
                                        var dismissTimer = setInterval(autoDismissPrompt, 300);
                                        autoDismissPrompt();

                                        function monitorVideo() {
                                            try {
                                                var docs = [document];
                                                var iframes = document.querySelectorAll('iframe');
                                                for (var f = 0; f < iframes.length; f++) {
                                                    try {
                                                        if (iframes[f].contentDocument) docs.push(iframes[f].contentDocument);
                                                    } catch(e) {}
                                                }
                                                for (var d = 0; d < docs.length; d++) {
                                                    var doc = docs[d];
                                                    fitEmbedLayout(doc);
                                                    setupTapGuardAndListeners(doc);

                                                    var videos = doc.querySelectorAll('video');
                                                    for (var i = 0; i < videos.length; i++) {
                                                        var v = videos[i];
                                                        if (!v._monitored) {
                                                            v._monitored = true;
                                                            if (v.src && v.src.indexOf('http') === 0) {
                                                                window.AndroidMediaSniffer && window.AndroidMediaSniffer.onMediaDetected(v.src);
                                                            }
                                                            // Guard against stuck 3x gesture speed
                                                            v.addEventListener('ratechange', function() {
                                                                if (v.playbackRate > 1.25) {
                                                                    setTimeout(function() {
                                                                        if (v.playbackRate > 1.25) v.playbackRate = 1.0;
                                                                    }, 800);
                                                                }
                                                            });
                                                            v.addEventListener('play', function() {
                                                                window.AndroidMediaSniffer && window.AndroidMediaSniffer.onPlaybackStateChanged(true);
                                                            });
                                                            v.addEventListener('playing', function() {
                                                                window.AndroidMediaSniffer && window.AndroidMediaSniffer.onPlaybackStateChanged(true);
                                                            });
                                                            v.addEventListener('pause', function() {
                                                                window.AndroidMediaSniffer && window.AndroidMediaSniffer.onPlaybackStateChanged(false);
                                                            });
                                                            v.addEventListener('ended', function() {
                                                                window.AndroidMediaSniffer && window.AndroidMediaSniffer.onPlaybackStateChanged(false);
                                                            });
                                                            v.addEventListener('timeupdate', function() {
                                                                window.AndroidMediaSniffer && window.AndroidMediaSniffer.onTimeUpdate(v.currentTime, v.duration || 0);
                                                            });
                                                        }
                                                    }
                                                }
                                            } catch(e) {}
                                        }
                                        setInterval(monitorVideo, 600);
                                        monitorVideo();
                                        window.addEventListener('resize', function() {
                                            var docs = [document];
                                            var iframes = document.querySelectorAll('iframe');
                                            for (var f = 0; f < iframes.length; f++) {
                                                try { if (iframes[f].contentDocument) docs.push(iframes[f].contentDocument); } catch(e) {}
                                            }
                                            for (var d = 0; d < docs.length; d++) {
                                                fitEmbedLayout(docs[d]);
                                            }
                                        });
                                    })();
                                """.trimIndent()
                                view?.evaluateJavascript(js, null)
                            }

                            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                                val uri = request?.url ?: return false
                                val scheme = uri.scheme ?: return false
                                if (scheme == "http" || scheme == "https") {
                                    return false
                                }
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

                        if (normalizedUrl != "about:blank") {
                            val headers = mutableMapOf<String, String>()
                            if (normalizedUrl.contains("streamc") || normalizedUrl.contains("nguonc")) {
                                headers["Referer"] = "https://phim.nguonc.com/"
                            } else if (normalizedUrl.contains("vsmov")) {
                                headers["Referer"] = "https://vsmov.com/"
                            }
                            loadUrl(normalizedUrl, headers)
                        } else {
                            loadUrl("about:blank")
                        }
                    }
                } else {
                    webView.onResume()
                }

                (webView.parent as? ViewGroup)?.removeView(webView)
                webView.visibility = View.VISIBLE
                container.addView(webView)
                containerRef = container
                webView.onResume()
                webView.requestLayout()
                webView.invalidate()
                webView.evaluateJavascript(
                    """(function() {
                        try {
                            var docs = [document];
                            var iframes = document.querySelectorAll('iframe');
                            for (var f = 0; f < iframes.length; f++) {
                                try { if (iframes[f].contentDocument) docs.push(iframes[f].contentDocument); } catch(e) {}
                            }
                            for (var d = 0; d < docs.length; d++) {
                                var videos = docs[d].querySelectorAll('video');
                                for (var i = 0; i < videos.length; i++) {
                                    if (videos[i].paused) videos[i].play();
                                }
                            }
                        } catch(e) {}
                    })();""",
                    null
                )
                container
            },
            update = { container ->
                containerRef = container
                val (webView, _) = playbackManager.getOrCreateEmbedWebView(container.context, normalizedUrl)
                if (webView.parent !== container) {
                    (webView.parent as? ViewGroup)?.removeView(webView)
                    webView.visibility = View.VISIBLE
                    container.addView(
                        webView,
                        FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                    )
                }
                webView.visibility = View.VISIBLE
                webView.onResume()
                webView.requestLayout()
                webView.invalidate()
                webView.evaluateJavascript(
                    "(function() { try { window.dispatchEvent(new Event('resize')); var ifr = document.querySelectorAll('iframe'); for(var i=0;i<ifr.length;i++){ try{ ifr[i].contentWindow.dispatchEvent(new Event('resize')); }catch(e){} } } catch(e){} })();",
                    null
                )
            },
            onRelease = { container ->
                container.removeAllViews()
            },
            modifier = Modifier.fillMaxSize()
        )
    }
}
