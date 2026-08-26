/* ============================================================
   DevPulse — Cookie Consent Banner
   Fixed bottom banner; persists acceptance in localStorage
   ============================================================ */

(function () {
  'use strict';

  var CONSENT_KEY = 'cookieConsent';
  var BANNER_ID = 'cb-banner';

  function storageAvailable() {
    try {
      var probe = '__devpulse_cb__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch (err) {
      return false;
    }
  }

  function init() {
    if (document.getElementById(BANNER_ID)) return; // guard against double-injection
    if (!storageAvailable()) return;
    if (window.localStorage.getItem(CONSENT_KEY)) return;

    var banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.className = 'cb-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie consent');

    var text = document.createElement('p');
    text.className = 'cb-banner__text';
    text.innerHTML = "We use cookies for authentication and analytics. By continuing, you agree to our <a href='/privacy'>Privacy Policy</a>.";

    var accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'cb-banner__accept';
    accept.textContent = 'Accept';
    accept.addEventListener('click', function () {
      try {
        window.localStorage.setItem(CONSENT_KEY, 'accepted');
      } catch (err) { /* ignore */ }
      banner.remove();
    });

    banner.appendChild(text);
    banner.appendChild(accept);
    document.body.appendChild(banner);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
