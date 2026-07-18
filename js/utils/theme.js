/**
 * QUIZPDF AI — Theme Manager
 * js/utils/theme.js
 */

const Theme = (() => {
  const DARK  = 'dark';
  const LIGHT = 'light';

  let _current = DARK;

  function init() {
    _current = Store.getTheme();
    _apply(_current);
    _updateToggles(_current);
  }

  function _apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = theme === DARK ? '#0B0B16' : '#F0F2FF';
    }
  }

  function _updateToggles(theme) {
    document.querySelectorAll('[data-theme-toggle]').forEach(el => {
      el.setAttribute('aria-pressed', theme === DARK ? 'true' : 'false');
      // Update icon visibility
      const moonIcon = el.querySelector('.icon-moon');
      const sunIcon  = el.querySelector('.icon-sun');
      if (moonIcon) moonIcon.style.display = theme === DARK  ? 'none' : 'block';
      if (sunIcon)  sunIcon.style.display  = theme === LIGHT ? 'none' : 'block';
    });

    // Sync toggle inputs
    document.querySelectorAll('[data-dark-toggle]').forEach(el => {
      if (el.tagName === 'INPUT') {
        el.checked = theme === DARK;
      }
    });
  }

  function toggle() {
    _current = _current === DARK ? LIGHT : DARK;
    _apply(_current);
    _updateToggles(_current);
    Store.setTheme(_current);
    return _current;
  }

  function set(theme) {
    _current = theme;
    _apply(_current);
    _updateToggles(_current);
    Store.setTheme(_current);
  }

  function get() { return _current; }
  function isDark() { return _current === DARK; }

  return { init, toggle, set, get, isDark };
})();

window.Theme = Theme;
