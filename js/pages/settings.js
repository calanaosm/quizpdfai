/**
 * QUIZPDF AI — Settings Page (Phase 3)
 * js/pages/settings.js
 */

const SettingsPage = (() => {
  function _maskKey(key) {
    if (!key || key.length < 8) return key;
    return key.slice(0, 4) + '••••••••••••' + key.slice(-4);
  }

  function _updateApiStatus(state = 'auto') {
    const key  = Store.getApiKey();
    const dot  = document.getElementById('api-status-dot');
    const text = document.getElementById('api-status-text');
    const inp  = document.getElementById('api-key-input');

    if (state === 'testing') {
      if (dot)  dot.className = 'api-dot testing';
      if (text) text.textContent = 'Testing connection…';
      return;
    }
    if (state === 'ok') {
      if (dot)  dot.className = 'api-dot saved';
      if (text) text.textContent = '✓ API key valid — connected to Gemini';
      return;
    }
    if (state === 'error') {
      if (dot)  dot.className = 'api-dot error';
      if (text) text.textContent = '✗ API key invalid or network error';
      return;
    }

    // auto
    if (key) {
      if (dot)  dot.className = 'api-dot saved';
      if (text) text.textContent = 'API key saved';
      if (inp)  inp.placeholder = _maskKey(key);
    } else {
      if (dot)  dot.className = 'api-dot empty';
      if (text) text.textContent = 'No API key saved';
      if (inp)  inp.placeholder = 'Enter your Gemini API key…';
    }
  }

  function _toggleReveal() {
    const inp = document.getElementById('api-key-input');
    const btn = document.getElementById('reveal-key-btn');
    if (!inp) return;
    if (inp.type === 'password') {
      inp.type = 'text';
      btn.innerHTML = `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    } else {
      inp.type = 'password';
      btn.innerHTML = `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    }
  }

  function _saveKey() {
    const inp = document.getElementById('api-key-input');
    const val = inp?.value?.trim();
    if (!val) {
      Toast.error('Please enter an API key.');
      return;
    }
    Store.setApiKey(val);
    if (inp) inp.value = '';
    _updateApiStatus();
    Toast.success('API key saved successfully!');
  }

  function _deleteKey() {
    const key = Store.getApiKey();
    if (!key) {
      Toast.info('No API key to delete.');
      return;
    }
    Store.removeApiKey();
    _updateApiStatus();
    Toast.success('API key deleted.');
  }

  // ── Phase 3: Real Test Connection ────────────────────────────
  async function _testConnection() {
    const apiKey = Store.getApiKey();
    if (!apiKey) {
      Toast.error('Save an API key first before testing.');
      return;
    }

    const btn = document.getElementById('btn-test-connection');
    const origBtnHTML = btn?.innerHTML;

    // Update UI to loading state
    _updateApiStatus('testing');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"
             stroke-width="2.5" style="animation:spin 0.8s linear infinite">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
          <path d="M12 2a10 10 0 0110 10" stroke-dasharray="30" stroke-dashoffset="30"/>
        </svg>
        Testing…`;
    }

    try {
      const result = await GeminiClient.testConnection(apiKey);

      if (result.success) {
        _updateApiStatus('ok');
        Toast.success(`✓ Connected to Gemini (${result.model || 'gemini-1.5-flash'})`, 5000);
      } else {
        _updateApiStatus('error');
        Toast.error(`✗ Connection failed: ${result.error}`, 8000);
      }
    } catch (err) {
      _updateApiStatus('error');
      Toast.error(`✗ Unexpected error: ${err.message}`, 8000);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origBtnHTML;
      }
    }
  }

  function _syncDarkToggle() {
    const toggle = document.getElementById('dark-mode-toggle');
    if (toggle) toggle.checked = Theme.isDark();
  }

  function _clearHistory() {
    Store.clearQuizHistory();
    Store.clearGeneratedQuiz();
    Toast.success('Quiz history cleared.');
  }

  // ── Update About version ─────────────────────────────────────
  function _updateVersionBadge() {
    const versionEl = document.querySelector('.settings-version');
    if (versionEl) versionEl.textContent = 'QuizPDF AI v1.0.0 · Phase 3';
    const aboutDesc = document.querySelector('[data-about-version]');
    if (aboutDesc) aboutDesc.textContent = 'Version 1.0.0 — Phase 3';
  }

  function init() {
    _updateApiStatus();
    _syncDarkToggle();
    _updateVersionBadge();

    document.getElementById('btn-save-key')?.addEventListener('click', _saveKey);
    document.getElementById('btn-delete-key')?.addEventListener('click', _deleteKey);
    document.getElementById('btn-test-connection')?.addEventListener('click', _testConnection);
    document.getElementById('reveal-key-btn')?.addEventListener('click', _toggleReveal);
    document.getElementById('btn-clear-history')?.addEventListener('click', _clearHistory);

    const darkToggle = document.getElementById('dark-mode-toggle');
    darkToggle?.addEventListener('change', () => Theme.toggle());

    document.getElementById('api-key-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') _saveKey();
    });
  }

  function onEnter() {
    _updateApiStatus();
    _syncDarkToggle();
  }

  return { init, onEnter };
})();

window.SettingsPage = SettingsPage;
