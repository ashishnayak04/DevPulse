/* ============================================================
   DevPulse — Scroll Reveal
   IntersectionObserver-driven fade-in animations
   ============================================================ */

(function () {
  'use strict';

  const REVEAL_SELECTOR = '.reveal';

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    // Make everything visible immediately
    document.querySelectorAll(REVEAL_SELECTOR).forEach(el => {
      el.classList.add('reveal--visible');
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal--visible');
          // Once revealed, stop observing for performance
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -60px 0px'
    }
  );

  // Observe all reveal elements
  document.querySelectorAll(REVEAL_SELECTOR).forEach(el => {
    observer.observe(el);
  });
})();
