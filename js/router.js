/**
 * QUIZPDF AI — SPA Router
 * js/router.js
 */

const Router = (() => {
  const PAGES = ['home', 'quiz', 'results', 'review', 'settings'];
  const DEFAULT = 'home';

  let _current = null;
  let _listeners = [];

  function _getHash() {
    const hash = window.location.hash.replace('#', '').trim();
    return PAGES.includes(hash) ? hash : DEFAULT;
  }

  function _showPage(id) {
    if (_current === id) return;
    const prev = _current;

    // Hide all pages
    PAGES.forEach(p => {
      const el = document.getElementById(`page-${p}`);
      if (el) el.classList.remove('active');
    });

    // Show target page
    const target = document.getElementById(`page-${id}`);
    if (target) {
      target.classList.add('active');
    }

    // Update nav items
    document.querySelectorAll('[data-nav-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.navPage === id);
    });

    _current = id;

    // Notify listeners
    _listeners.forEach(fn => fn(id, prev));
  }

  function navigate(pageId) {
    if (!PAGES.includes(pageId)) pageId = DEFAULT;
    window.location.hash = pageId;
  }

  function init() {
    window.addEventListener('hashchange', () => {
      _showPage(_getHash());
    });

    // Initial route
    _showPage(_getHash());
  }

  function getCurrent() { return _current; }

  function on(fn) { _listeners.push(fn); }

  function off(fn) {
    _listeners = _listeners.filter(f => f !== fn);
  }

  return { init, navigate, getCurrent, on, off, PAGES };
})();

window.Router = Router;
