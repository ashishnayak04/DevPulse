/* ============================================================
   DevPulse — Counter Roll-Up
   Animates numbers from 0 → target on scroll into view
   ============================================================ */

(function () {
  'use strict';

  const DURATION = 1800; // ms
  const FPS = 60;

  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function formatNumber(value, decimals, suffix) {
    let formatted;
    if (decimals > 0) {
      formatted = value.toFixed(decimals);
    } else {
      formatted = Math.round(value).toLocaleString();
    }
    return formatted + (suffix || '');
  }

  function animateCounter(element) {
    const target = parseFloat(element.dataset.target);
    const suffix = element.dataset.suffix || '';
    const decimals = parseInt(element.dataset.decimals || '0', 10);

    if (isNaN(target)) return;

    let startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / DURATION, 1);
      const easedProgress = easeOutQuart(progress);
      const currentValue = easedProgress * target;

      element.textContent = formatNumber(currentValue, decimals, suffix);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  // Observe counters
  const counters = document.querySelectorAll('.counter');

  if (counters.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.5
    }
  );

  counters.forEach(counter => observer.observe(counter));
})();
