(() => {
  const CONFIG = {
    MAX_ALLOWED_LAG: 2.8,     // seek only if more than this many seconds behind
    MIN_SAFETY_OFFSET: 0.4,   // smallest offset to keep before live edge
    CHECK_INTERVAL_MS: 1000,  // how often to check lag
    POST_SEEK_COOLDOWN_MS: 15000,
    DEBUG: true
  };

  let video = null;
  let lastSeekTime = 0;

  function log(...args) {
    if (CONFIG.DEBUG) console.log("[LiveFix]", ...args);
  }

  function getVideo() {
    return document.querySelector("video");
  }

  function getLiveButtonPressed() {
    const btn = document.querySelector(".ytp-live-badge[aria-label]");
    return btn && btn.getAttribute("aria-label").toLowerCase().includes("live");
  }

  function getBufferedEnd() {
    if (!video || !video.buffered || video.buffered.length === 0) return NaN;
    return video.buffered.end(video.buffered.length - 1);
  }

  function getSeekableEnd() {
    if (!video || !video.seekable || video.seekable.length === 0) return NaN;
    return video.seekable.end(video.seekable.length - 1);
  }

  function getDynamicSafetyOffset() {
    if (getLiveButtonPressed()) {
      const seekableEnd = getSeekableEnd();
      if (isFinite(seekableEnd)) {
        const lag = seekableEnd - video.currentTime;
        if (lag >= 0 && lag < CONFIG.MIN_SAFETY_OFFSET + 0.2) {
          return Math.max(lag - 0.05, CONFIG.MIN_SAFETY_OFFSET);
        }
      }
    }
    return CONFIG.MIN_SAFETY_OFFSET;
  }

  function checkAndCorrectLag() {
    if (!video) video = getVideo();
    if (!video || video.readyState < 2) return;

    const now = performance.now();
    if (now - lastSeekTime < CONFIG.POST_SEEK_COOLDOWN_MS) return;

    const seekableEnd = getSeekableEnd();
    const bufferedEnd = getBufferedEnd();
    if (!isFinite(seekableEnd) || !isFinite(bufferedEnd)) return;

    const currentLag = seekableEnd - video.currentTime;
    const offset = getDynamicSafetyOffset();

    // If already live (YT's definition) or lag is small, do nothing
    if (getLiveButtonPressed() || currentLag <= CONFIG.MAX_ALLOWED_LAG) return;

    // Ensure we never seek beyond what is buffered
    const targetTime = Math.min(bufferedEnd - offset, seekableEnd - offset);

    if (targetTime > video.currentTime + 0.05) {
      log(`Seeking from ${video.currentTime.toFixed(2)} → ${targetTime.toFixed(2)} (lag ${currentLag.toFixed(2)}s)`);
      video.currentTime = targetTime;
      lastSeekTime = now;
    }
  }

  log("Starting live lag corrector...");
  setInterval(checkAndCorrectLag, CONFIG.CHECK_INTERVAL_MS);
})();
