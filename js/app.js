/**
 * QUIZPDF AI — App Entry Point
 * js/app.js
 */

(function () {
  'use strict';

  // ── Service Worker Registration ──────────────────────────────
  function registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => {
            console.log('[QuizPDF AI] Service Worker registered:', reg.scope);
          })
          .catch(err => {
            console.warn('[QuizPDF AI] SW registration failed:', err);
          });
      });
    }
  }

  // ── Splash Screen ────────────────────────────────────────────
  function initSplash() {
    const splash = document.getElementById('splash');
    if (!splash) return;

    const MIN_SHOW = 1800; // ms
    const start = Date.now();

    function hideSplash() {
      const elapsed = Date.now() - start;
      const delay = Math.max(0, MIN_SHOW - elapsed);
      setTimeout(() => {
        splash.classList.add('hidden');
        splash.addEventListener('transitionend', () => {
          splash.style.display = 'none';
        }, { once: true });
      }, delay);
    }

    // Hide splash after DOM is ready
    if (document.readyState === 'complete') {
      hideSplash();
    } else {
      window.addEventListener('load', hideSplash);
    }
  }

  // ── Scroll-header ────────────────────────────────────────────
  function initScrollHeaders() {
    document.querySelectorAll('.page-content, .quiz-body, .review-list').forEach(el => {
      el.addEventListener('scroll', () => {
        const header = el.closest('.page')?.querySelector('.page-header, .quiz-header');
        if (header) {
          header.classList.toggle('scrolled', el.scrollTop > 4);
        }
      }, { passive: true });
    });
  }

  // ── Ripple Effect ────────────────────────────────────────────
  function initRipple() {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('.ripple-container');
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top  - size / 2;
      const ripple = document.createElement('span');
      ripple.className = 'ripple-wave';
      ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
      target.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  }

  // ── Global Theme Toggle ──────────────────────────────────────
  function initThemeToggles() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-theme-toggle]');
      if (btn) {
        Theme.toggle();
      }
    });
  }

  // ── Router Page Handlers ─────────────────────────────────────
  function initPageHandlers() {
    Router.on((page, prevPage) => {
      switch (page) {
        case 'home':
          HomePage.init();
          break;
        case 'quiz':
          QuizPage.onEnter();
          break;
        case 'results':
          ResultsPage.onEnter();
          break;
        case 'review':
          ReviewPage.onEnter();
          break;
        case 'settings':
          SettingsPage.onEnter();
          break;
      }
    });
  }

  // ── Network Status ────────────────────────────────────────────
  function initNetworkListeners() {
    window.addEventListener('offline', () => {
      Toast.error('You are currently offline. Generation features are disabled.', 0);
    });
    window.addEventListener('online', () => {
      Toast.success('You are back online.', 5000);
    });
  }

  // ── Boot ─────────────────────────────────────────────────────
  function boot() {
    // Init theme first to prevent flash
    Theme.init();

    // Register SW
    registerSW();

    // Start splash
    initSplash();

    // Init router
    Router.init();

    // Page handlers
    initPageHandlers();

    // Init all pages (for static event binding)
    HomePage.init();
    QuizPage.init();
    ResultsPage.init();
    ReviewPage.init();
    SettingsPage.init();

    // Ripple + scroll headers + theme toggles + network
    initRipple();
    initScrollHeaders();
    initThemeToggles();
    initNetworkListeners();

    console.log('[QuizPDF AI] App booted ✓');
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
