/* ============================================================
   DevPulse — Navigation
   Sticky frosted glass nav, smooth scroll, mobile menu
   ============================================================ */

(function () {
  'use strict';

  const nav = document.getElementById('nav');
  const navLinks = document.getElementById('navLinks');
  const navToggle = document.getElementById('navToggle');
  const navOverlay = document.getElementById('navOverlay');
  const bgGrid = document.getElementById('bgGrid');

  if (!nav) return;

  // ── Sticky nav on scroll ──
  let lastScroll = 0;
  let ticking = false;

  function updateNav() {
    const scrollY = window.scrollY;

    if (scrollY > 50) {
      nav.classList.add('nav--scrolled');
    } else {
      nav.classList.remove('nav--scrolled');
    }

    // Parallax background grid (subtle)
    if (bgGrid) {
      bgGrid.style.transform = `translateY(${scrollY * 0.15}px)`;
    }

    lastScroll = scrollY;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateNav);
      ticking = true;
    }
  }, { passive: true });

  // ── Smooth scroll for anchor links ──
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();
      closeMobileMenu();

      const navHeight = nav.offsetHeight;
      const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight - 20;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    });
  });

  // ── Mobile menu toggle ──
  function openMobileMenu() {
    navLinks.classList.add('nav__links--open');
    navToggle.classList.add('nav__toggle--active');
    navOverlay.classList.add('nav__overlay--visible');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileMenu() {
    navLinks.classList.remove('nav__links--open');
    navToggle.classList.remove('nav__toggle--active');
    navOverlay.classList.remove('nav__overlay--visible');
    document.body.style.overflow = '';
  }

  if (navToggle) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.contains('nav__links--open');
      if (isOpen) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });
  }

  if (navOverlay) {
    navOverlay.addEventListener('click', closeMobileMenu);
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileMenu();
    }
  });

  // ── Active link highlighting ──
  const sections = document.querySelectorAll('section[id]');
  const navLinkEls = document.querySelectorAll('.nav__link');

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinkEls.forEach(link => {
            link.classList.toggle('nav__link--active',
              link.getAttribute('href') === `#${id}`
            );
          });
        }
      });
    },
    { rootMargin: '-30% 0px -70% 0px' }
  );

  sections.forEach(section => sectionObserver.observe(section));
})();
