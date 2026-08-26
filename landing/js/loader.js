/* ============================================================
   DevPulse — Preloader
   Heartbeat ECG animation → fade out → reveal page
   ============================================================ */

(function () {
  'use strict';

  const preloader = document.getElementById('preloader');
  if (!preloader) return;

  // Prevent scrolling while preloader is visible
  document.body.style.overflow = 'hidden';

  const TOTAL_DURATION = 2200; // ms before we start fading out

  function hidePreloader() {
    preloader.classList.add('preloader--hidden');
    document.body.style.overflow = '';

    // Remove from DOM after transition
    preloader.addEventListener('transitionend', () => {
      preloader.remove();
    }, { once: true });
  }

  // Wait for the heartbeat line to draw, then fade out
  setTimeout(hidePreloader, TOTAL_DURATION);

  // Safety fallback — if fonts/resources are slow, hide after 4s max
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (!preloader.classList.contains('preloader--hidden')) {
        hidePreloader();
      }
    }, Math.max(0, TOTAL_DURATION - performance.now()));
  });
})();
