// == YouTube Livestream Catch-Up (Dynamic, Buffer-Safe, No-RED-Seeks) =======
// Paste into Enhancer for YouTube → Settings → Features → "Custom script"

(() => {
  if (window.__LiveCatchupInstalled) return;
  window.__LiveCatchupInstalled = true;

  const CONFIG = {
    MAX_ALLOWED_LAG: 2.8,    // Seek only if we're this far or more behind the raw live edge (seconds)
    MIN_SAFETY_OFFSET: 0.10, // Smallest cushion we allow behind the live edge (seconds)
    MAX_SAFETY_OFFSET: 3.0,  // Hard cap; some streams need ~2s cushion
    PLAYABLE_MARGIN: 0.25,   // Stay at least this far inside buffered end (seconds)
    SEEK_MIN_STEP: 0.30,     // Don’t bother seeking unless we move forward by at least this (seconds)
    CHECK_INTERVAL_MS: 1000, // How often to check lag
    POST_SEEK_COOLDOWN_MS: 15000,
    BUFFERING_GRACE_MS: 5000,

    // Debugging
    DEBUG_CONSOLE: false,    // console logs
    DEBUG_UI: false,          // small on-screen overlay, use it to find the problem and fix with basic knowledge
    DEBUG_UI_HOTKEY: 'L',    // Shift + L toggles overlay
  };

  // ---------- State ----------
  let video = null;
  let checkTimer = null;
  let lastSeekTs = 0;
  let userScrubbing = false;
  let isLiveCached = false;

  // Learned tolerances
  let learnedLiveTolerance = 0.20; // How close to edge YouTube allows while LIVE = red
  let learnedGapEdgeToBufferedEMA = 0.0; // EMA of (seekable.end - buffered.end)

  // Debug UI
  let dbg = { el: null, visible: false, lastAction: 'init' };

  const log = (...args) => CONFIG.DEBUG_CONSOLE && console.log('[LiveCatchup]', ...args);
  const now = () => performance.now();

  // ---------- Helpers ----------
  const getVideo = () =>
    document.querySelector('video.html5-main-video') || document.querySelector('video');

  const liveButtonPressed = () => {
    const btn = document.querySelector('.ytp-live-button');
    return !!(btn && btn.getAttribute('aria-pressed') === 'true');
  };

  function isLiveByPlayerResponse() {
    try {
      const pr =
        window.ytInitialPlayerResponse ||
        (window.ytplayer?.config?.args?.player_response &&
          JSON.parse(window.ytplayer.config.args.player_response));
      return !!pr?.videoDetails?.isLiveContent;
    } catch (_) { return false; }
  }

  function isLiveByUI() {
    return !!document.querySelector('.ytp-live-badge, .ytp-live-button');
  }

  function isLiveByMedia() {
    if (!video) return false;
    return video.duration === Infinity || (video.seekable?.length > 0);
  }

  function computeIsLive() {
    isLiveCached = isLiveByPlayerResponse() || isLiveByUI() || isLiveByMedia();
    return isLiveCached;
  }

  function getRawLiveEdge() {
    if (!video) return NaN;
    const s = video.seekable;
    if (s && s.length > 0) {
      try { return s.end(s.length - 1); } catch { return NaN; }
    }
    return NaN;
  }

  function getBufferedEnd() {
    if (!video) return NaN;
    const b = video.buffered;
    if (b && b.length > 0) {
      try { return b.end(b.length - 1); } catch { return NaN; }
    }
    return NaN;
  }

  function getLag() {
    const edge = getRawLiveEdge();
    if (!isFinite(edge)) return 0;
    return edge - (video?.currentTime ?? 0);
  }

  // Learn the smallest stable tolerance that still yields a red LIVE dot.
  function learnFromRedLive() {
    if (!video) return;
    if (!liveButtonPressed()) return;

    const edge = getRawLiveEdge();
    if (!isFinite(edge)) return;

    const lag = edge - video.currentTime;       // how far behind raw edge we are when LIVE is red
    if (lag < 0) return;

    // Keep a conservative running minimum with a tiny safety margin
    // Only adjust if this lag is smaller than what we already think is safe.
    const candidate = Math.max(0, Math.min(lag + 0.05, CONFIG.MAX_SAFETY_OFFSET)); // +50ms margin
    if (candidate < learnedLiveTolerance) {
      learnedLiveTolerance = Math.max(candidate, 0.05); // never less than 50ms
      log('Learned live tolerance:', learnedLiveTolerance.toFixed(3));
    }
  }

  // Smoothly track how far ahead of buffered end the raw live edge sits.
  function updateGapEMA() {
    const edge = getRawLiveEdge();
    const be = getBufferedEnd();
    if (!isFinite(edge) || !isFinite(be)) return;
    const gap = Math.max(0, edge - be);
    // EMA: alpha tuned for gentle smoothing
    const alpha = 0.2;
    learnedGapEdgeToBufferedEMA = (1 - alpha) * learnedGapEdgeToBufferedEMA + alpha * gap;
  }

  // Compute a dynamic, safe offset from the raw live edge.
  function getDynamicSafetyOffset() {
    // Base it on the learned red-LIVE tolerance.
    let offset = Math.max(learnedLiveTolerance, CONFIG.MIN_SAFETY_OFFSET);

    // Ensure we also stay behind the buffered end gap + a small playable margin.
    // If the live edge sits 1.2s ahead of buffered end, we need >= 1.2 + PLAYABLE_MARGIN.
    const neededForBuffer = learnedGapEdgeToBufferedEMA + CONFIG.PLAYABLE_MARGIN + 0.05;
    offset = Math.max(offset, neededForBuffer);

    // Clamp for sanity
    if (!isFinite(offset)) offset = 1.0;
    offset = Math.min(Math.max(offset, CONFIG.MIN_SAFETY_OFFSET), CONFIG.MAX_SAFETY_OFFSET);
    return offset;
  }

  function willSeekTarget() {
    // Preview target without applying it
    const edge = getRawLiveEdge();
    const be = getBufferedEnd();
    if (!isFinite(edge) || !isFinite(be)) return { ok: false };

    const dyn = getDynamicSafetyOffset();
    // Target must be within buffered range and behind edge by dyn
    let target = Math.min(edge - dyn, be - CONFIG.PLAYABLE_MARGIN);
    target = Math.max(0, target);
    return { ok: true, target, dyn, edge, be };
  }

  function safeSeekForward() {
    const preview = willSeekTarget();
    if (!preview.ok) return false;

    const { target, dyn, edge, be } = preview;
    const before = video.currentTime;

    // Only seek forward, and only if it's a meaningful step (avoid micro-jitters).
    if (target <= before + CONFIG.SEEK_MIN_STEP) {
      dbg.lastAction = 'skip: small step';
      return false;
    }

    // Safety: never jump into unbuffered territory (target already constrained)
    // Perform the seek
    video.currentTime = target;

    // If paused by buffer/event, resume
    if (video.paused) {
      try { video.play().catch(() => {}); } catch {}
    }

    lastSeekTs = now();
    dbg.lastAction = `seek ${before.toFixed(2)}→${target.toFixed(2)} (dyn=${dyn.toFixed(2)} edge=${edge.toFixed(2)} be=${be.toFixed(2)})`;
    log(dbg.lastAction);
    return true;
  }

  // ---------- Tick Loop ----------
  function tick() {
    if (!video || !isLiveCached || userScrubbing) return;

    // First, continuously learn characteristics from the current stream
    learnFromRedLive();
    updateGapEMA();

    // If YouTube itself says we’re live (red dot), DO NOT SEEK.
    const isLiveRed = liveButtonPressed();
    if (isLiveRed) {
      dbg.lastAction = 'idle: LIVE red';
      renderDebug();
      return;
    }

    const lag = getLag();
    const sinceSeek = now() - lastSeekTs;
    const buffering = (video.readyState < 2) || (video.paused && lag > CONFIG.MAX_ALLOWED_LAG + 1);
    const cooldown = buffering
      ? Math.min(CONFIG.POST_SEEK_COOLDOWN_MS, CONFIG.BUFFERING_GRACE_MS)
      : CONFIG.POST_SEEK_COOLDOWN_MS;

    if (lag > CONFIG.MAX_ALLOWED_LAG && sinceSeek > cooldown) {
      // Only seek if target is valid and forward
      safeSeekForward();
    } else {
      dbg.lastAction = 'idle';
    }

    renderDebug();
  }

  // ---------- User Interaction Guards ----------
  function attachScrubGuards() {
    const progressBar = document.querySelector('.ytp-progress-bar, .ytp-progress-bar-container');
    const on = () => { userScrubbing = true; };
    const off = () => { userScrubbing = false; };
    progressBar?.addEventListener('mousedown', on, { passive: true });
    document.addEventListener('mouseup', off, { passive: true });
    video?.addEventListener('seeking', on, { passive: true });
    video?.addEventListener('seeked', off, { passive: true });
  }

  // ---------- Debug Overlay ----------
  function ensureDebugUI() {
    if (!CONFIG.DEBUG_UI || dbg.el) return;
    const el = document.createElement('div');
    el.id = 'livecatchup-debug';
    el.style.cssText = [
      'position:fixed',
      'left:12px',
      'bottom:12px',
      'z-index:999999',
      'font:12px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial',
      'background:rgba(0,0,0,0.6)',
      'color:#fff',
      'padding:8px 10px',
      'border-radius:10px',
      'box-shadow:0 6px 18px rgba(0,0,0,0.25)',
      'user-select:none',
      'pointer-events:none',
      'white-space:pre',
      'max-width:50vw',
    ].join(';');
    el.textContent = 'LiveCatchup: loading…';
    document.body.appendChild(el);
    dbg.el = el;

    // Toggle with Shift+<key>
    document.addEventListener('keydown', (e) => {
      if (e.key.toUpperCase() === CONFIG.DEBUG_UI_HOTKEY.toUpperCase() && e.shiftKey) {
        dbg.visible = !dbg.visible;
        if (dbg.el) dbg.el.style.display = dbg.visible ? 'block' : 'none';
      }
    });

    // Default visible initially (you can hide with Shift+L)
    dbg.visible = true;
  }

  function renderDebug() {
    if (!CONFIG.DEBUG_UI || !dbg.el || !video) return;

    const edge = getRawLiveEdge();
    const be = getBufferedEnd();
    const lag = getLag();
    const preview = willSeekTarget();
    const dyn = getDynamicSafetyOffset();

    const lines = [
      `LIVE red: ${liveButtonPressed() ? 'yes' : 'no'}`,
      `readyState: ${video.readyState}  paused: ${video.paused ? 'yes' : 'no'}`,
      `current: ${isFinite(video.currentTime) ? video.currentTime.toFixed(2) : 'n/a'}`,
      `edge:    ${isFinite(edge) ? edge.toFixed(2) : 'n/a'}`,
      `buffEnd: ${isFinite(be) ? be.toFixed(2) : 'n/a'}`,
      `gap(edge-buffEnd) EMA: ${learnedGapEdgeToBufferedEMA.toFixed(2)}`,
      `learned LIVE tol: ${learnedLiveTolerance.toFixed(2)}`,
      `dyn offset: ${dyn.toFixed(2)}`,
      `lag(edge-now): ${isFinite(lag) ? lag.toFixed(2) : 'n/a'}`,
      `target: ${preview.ok ? preview.target.toFixed(2) : 'n/a'} (${preview.ok ? 'ok' : 'n/a'})`,
      `since last seek: ${( (now() - lastSeekTs) / 1000 ).toFixed(1)}s`,
      `action: ${dbg.lastAction}`
    ];
    dbg.el.textContent = lines.join('\n');
  }

  // ---------- Lifecycle ----------
  function startLoop() {
    if (checkTimer) clearInterval(checkTimer);
    checkTimer = setInterval(tick, CONFIG.CHECK_INTERVAL_MS);
  }

  function stopLoop() {
    if (checkTimer) {
      clearInterval(checkTimer);
      checkTimer = null;
    }
  }

  function onNewVideo() {
    stopLoop();
    video = getVideo();
    if (!video) { log('No <video> found yet'); return; }

    computeIsLive();
    if (!isLiveCached) {
      log('Not a live stream; idle.');
      return;
    }

    // Reset learned state for the new stream (keep mild prior knowledge)
    learnedGapEdgeToBufferedEMA = 0.0;
    // Keep learnedLiveTolerance small; it will re-learn quickly to the stream’s real value.
    learnedLiveTolerance = Math.min(learnedLiveTolerance, 0.20);

    attachScrubGuards();
    ensureDebugUI();
    startLoop();
    dbg.lastAction = 'loop started';
    renderDebug();
    log('Live stream detected. Catch-up loop running.');
  }

  function installNavHooks() {
    window.addEventListener('yt-navigate-finish', () => {
      // Slight delay to let player mount and ranges populate
      setTimeout(onNewVideo, 800);
    });

    // Also observe DOM changes in case player swaps without navigate event
    const obs = new MutationObserver(() => {
      const v = getVideo();
      if (v && v !== video) {
        setTimeout(onNewVideo, 400);
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  function init() {
    // Try to attach soon after script load; if not, nav hooks will catch it
    setTimeout(onNewVideo, 800);
    installNavHooks();
  }

  init();
})();
