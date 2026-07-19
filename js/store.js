/**
 * QUIZPDF AI — Local Storage Store
 * js/store.js
 */

const Store = (() => {
  const PREFIX = 'quizpdfai_';

  function key(name) {
    return PREFIX + name;
  }

  function get(name, fallback = null) {
    try {
      const val = localStorage.getItem(key(name));
      if (val === null) return fallback;
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }

  function set(name, value, skipSync = false) {
    try {
      localStorage.setItem(key(name), JSON.stringify(value));
      if (!skipSync && (name === 'settings' || name === 'quiz_history')) {
        _syncToCloud();
      }
      return true;
    } catch {
      return false;
    }
  }

  function remove(name) {
    try {
      localStorage.removeItem(key(name));
      return true;
    } catch {
      return false;
    }
  }

  function clear() {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(PREFIX))
        .forEach(k => localStorage.removeItem(k));
      return true;
    } catch {
      return false;
    }
  }

  // Typed helpers
  function getApiKey()      { return get('api_key', ''); }
  function setApiKey(v)     { return set('api_key', v); }
  function removeApiKey()   { return remove('api_key'); }

  function getTheme()       { return get('theme', 'dark'); }
  function setTheme(v)      { return set('theme', v); }

  function getRecentQuizzes() { return get('recent_quizzes', []); }
  function setRecentQuizzes(v) { return set('recent_quizzes', v); }

  function getQuizHistory() { return get('quiz_history', []); }
  function clearQuizHistory() { return remove('quiz_history'); }

  function getSettings() {
    return get('settings', {
      autoSubmit: false,
      showTimer:  true,
      soundFx:    false,
    });
  }
  function setSettings(v) { return set('settings', v); }

  // ── Phase 2: Extracted PDF text ──────────────────────────────
  /**
   * @typedef {Object} PDFStore
   * @property {string}   text
   * @property {string[]} pageTexts
   * @property {number}   pageCount
   * @property {number}   wordCount
   * @property {number}   charCount
   * @property {string}   fileName
   * @property {number}   fileSizeMB
   * @property {boolean}  likelyScanned
   * @property {string[]} warnings
   * @property {number}   extractedAt
   */

  function getExtractedPDF()  { return get('extracted_pdf', null); }
  function clearExtractedPDF() { return remove('extracted_pdf'); }

  /**
   * Store extracted PDF result. Trims text to avoid localStorage overflow.
   * @param {Object} result - ExtractionResult from PDFExtractor
   */
  function setExtractedPDF(result) {
    // localStorage has ~5 MB limit per origin; trim very large texts
    const MAX_CHARS = 200_000;
    const trimmed   = result.text.length > MAX_CHARS;
    const payload   = {
      text:         trimmed ? result.text.slice(0, MAX_CHARS) + '\n\n[...trimmed — text exceeds storage limit]' : result.text,
      pageTexts:    result.pageTexts?.map(t => t.slice(0, 5000)) ?? [],
      pageCount:    result.pageCount,
      wordCount:    result.wordCount,
      charCount:    result.charCount,
      fileName:     result.fileName,
      fileSizeMB:   result.fileSizeMB,
      likelyScanned: result.likelyScanned,
      warnings:     result.warnings,
      extractedAt:  result.extractedAt,
      trimmed,
    };
    return set('extracted_pdf', payload);
  }

  // ── Phase 3: Generated Quiz ──────────────────────────────────
  /**
   * @typedef {Object} GeneratedQuiz
   * @property {Object[]} questions
   * @property {string}   sourceFile
   * @property {number}   pageCount
   * @property {number}   wordCount
   * @property {number}   chunksUsed
   * @property {number}   generatedAt
   */

  function getGeneratedQuiz()   { return get('generated_quiz', null); }
  function clearGeneratedQuiz() { return remove('generated_quiz'); }

  /**
   * Store a validated GeneratedQuiz object.
   * @param {GeneratedQuiz} quiz
   */
  function setGeneratedQuiz(quiz) {
    if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      console.warn('[Store] setGeneratedQuiz: invalid quiz object — not saved.');
      return false;
    }
    set('generated_quiz', quiz);
    setActiveQuiz(quiz); // Auto-set active quiz on new generation
    return true;
  }

  // ── Phase 5: Active Quiz Data & History ─────────────────────────
  function getActiveQuiz() { return get('active_quiz', null); }
  function setActiveQuiz(quiz) { return set('active_quiz', quiz); }

  function getQuizHistory() { return get('quiz_history', []); }
  function setQuizHistory(history) {
    // Keep only the 10 most recent quizzes
    if (Array.isArray(history) && history.length > 10) {
      history = history.slice(-10);
    }
    return set('quiz_history', history);
  }

  // ── Phase 4: Active Quiz State ───────────────────────────────
  /**
   * @typedef {Object} ActiveQuizState
   * @property {number}   quizGeneratedAt - Timestamp to map back to GeneratedQuiz
   * @property {number}   elapsed         - Elapsed seconds
   * @property {Object}   answers         - { [questionIndex: number]: number }
   * @property {number[]} bookmarks       - Array of question indices
   */

  function getActiveQuizState()   { return get('active_quiz_state', null); }
  function clearActiveQuizState() { return remove('active_quiz_state'); }
  function setActiveQuizState(state) {
    return set('active_quiz_state', state);
  }

  // ── Phase 6: Cloud Sync ─────────────────────────────────────
  let _syncDebounce = null;
  function _syncToCloud() {
    if (!window.FirebaseClient || !window.FirebaseClient.currentUser) return;
    clearTimeout(_syncDebounce);
    _syncDebounce = setTimeout(() => {
      window.FirebaseClient.syncDataToCloud({
        settings: getSettings(),
        quiz_history: getQuizHistory()
      });
    }, 1500);
  }

  function _loadFromCloud(cloudData) {
    if (cloudData.settings) set('settings', cloudData.settings, true);
    if (cloudData.quiz_history) set('quiz_history', cloudData.quiz_history, true);
    // Reload UI if on a page that needs it, or just rely on next render
    window.dispatchEvent(new CustomEvent('quizpdfai-cloud-sync'));
  }

  window.addEventListener('load', () => {
    // Wait for the Firebase module to attach to window
    setTimeout(() => {
      if (window.FirebaseClient) {
        window.FirebaseClient.onUserChange(async (user) => {
          if (user) {
            const data = await window.FirebaseClient.fetchDataFromCloud();
            if (data) _loadFromCloud(data);
          }
        });
      }
    }, 500);
  });

  return {
    get, set, remove, clear,
    getApiKey, setApiKey, removeApiKey,
    getTheme, setTheme,
    getRecentQuizzes, setRecentQuizzes,
    getQuizHistory, clearQuizHistory,
    getSettings, setSettings,
    getExtractedPDF, setExtractedPDF, clearExtractedPDF,
    getGeneratedQuiz, setGeneratedQuiz, clearGeneratedQuiz,
    getActiveQuiz, setActiveQuiz,
    getQuizHistory, setQuizHistory,
    getActiveQuizState, setActiveQuizState, clearActiveQuizState,
  };
})();

window.Store = Store;
