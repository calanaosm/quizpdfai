/**
 * QUIZPDF AI — Quiz Page (Phase 4)
 * js/pages/quiz.js
 * 
 * Powered by Gemini JSON. Implements auto-save and submission validation.
 */

const QuizPage = (() => {
  let _quizData = null;      // The GeneratedQuiz object
  let _questions = [];       // Array of questions
  let _currentIndex = 0;
  let _answers = {};         // { questionIndex: choiceIndex }
  let _bookmarks = new Set();
  let _timerInterval = null;
  let _elapsed = 0;

  // ── Auto-Save ────────────────────────────────────────────────
  function _saveState() {
    if (!_quizData) return;
    Store.setActiveQuizState({
      quizGeneratedAt: _quizData.generatedAt,
      elapsed: _elapsed,
      answers: _answers,
      bookmarks: Array.from(_bookmarks)
    });
  }

  function _restoreState() {
    const active = Store.getActiveQuizState();
    if (active && _quizData && active.quizGeneratedAt === _quizData.generatedAt) {
      _elapsed = active.elapsed || 0;
      _answers = active.answers || {};
      _bookmarks = new Set(active.bookmarks || []);
      
      // Auto-restore progress to first unanswered question, or 0
      let firstUnanswered = 0;
      for (let i = 0; i < _questions.length; i++) {
        if (_answers[i] === undefined) {
          firstUnanswered = i;
          break;
        }
      }
      // if all answered, go to 0 or last
      if (Object.keys(_answers).length === _questions.length) {
        firstUnanswered = 0;
      }
      _currentIndex = firstUnanswered;
      
      Toast.info('Restored your quiz progress');
      return true;
    }
    return false;
  }

  // ── Timer ────────────────────────────────────────────────────
  function _formatTime(secs) {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function _startTimer() {
    clearInterval(_timerInterval);
    // Render initial time
    const el = document.getElementById('quiz-timer-display');
    if (el) el.textContent = _formatTime(_elapsed);

    _timerInterval = setInterval(() => {
      _elapsed++;
      if (el) el.textContent = _formatTime(_elapsed);
      if (_elapsed % 5 === 0) _saveState(); // auto-save every 5s
    }, 1000);
  }

  // ── Rendering ────────────────────────────────────────────────
  function _renderQuestion(idx) {
    const q = _questions[idx];
    if (!q) return;

    const total = _questions.length;

    // Counter
    const counter = document.getElementById('quiz-counter');
    if (counter) counter.textContent = `Q ${idx + 1} of ${total}`;

    // Progress bar
    const progress = document.getElementById('quiz-progress');
    if (progress) {
      const pct = ((idx + 1) / total) * 100;
      progress.style.width = pct + '%';
    }

    // Question text
    const qText = document.getElementById('question-text');
    if (qText) {
      qText.textContent = q.text;
      qText.classList.remove('animate-fade-in');
      void qText.offsetWidth; // trigger reflow
      qText.classList.add('animate-fade-in');
    }

    // Choices
    const choicesEl = document.getElementById('answer-choices');
    if (choicesEl) {
      const letters = ['A', 'B', 'C', 'D'];
      const selected = _answers[idx];
      choicesEl.innerHTML = q.choices.map((choice, ci) => `
        <div class="answer-option ripple-container ${selected === ci ? 'selected' : ''}"
             role="radio"
             aria-checked="${selected === ci}"
             tabindex="0"
             data-choice="${ci}"
             onclick="QuizPage.selectAnswer(${ci})"
             onkeydown="if(event.key==='Enter'||event.key===' ') { event.preventDefault(); QuizPage.selectAnswer(${ci}); }">
          <div class="answer-letter">${letters[ci]}</div>
          <div class="answer-text">${choice}</div>
        </div>
      `).join('');
    }

    // Bookmark button
    const bkBtn = document.getElementById('bookmark-btn');
    if (bkBtn) {
      const isBookmarked = _bookmarks.has(idx);
      bkBtn.classList.toggle('active', isBookmarked);
      bkBtn.setAttribute('aria-pressed', String(isBookmarked));
      bkBtn.title = isBookmarked ? 'Remove Bookmark' : 'Bookmark Question';
    }

    // Footer nav buttons
    const prevBtn = document.getElementById('quiz-prev-btn');
    const nextBtn = document.getElementById('quiz-next-btn');
    const submitBtn = document.getElementById('quiz-submit-btn');
    
    if (prevBtn) prevBtn.disabled = idx === 0;
    
    if (idx === total - 1) {
      if (nextBtn) nextBtn.style.display = 'none';
      if (submitBtn) submitBtn.style.display = 'flex';
    } else {
      if (nextBtn) nextBtn.style.display = 'flex';
      if (submitBtn) submitBtn.style.display = 'none';
    }

    _renderNavigator(idx);
  }

  function _renderNavigator(activeIdx) {
    const grid = document.getElementById('q-nav-grid');
    if (!grid) return;

    grid.innerHTML = _questions.map((_, i) => {
      let cls = 'q-nav-btn';
      if (i === activeIdx) cls += ' current';
      else if (_bookmarks.has(i)) cls += ' bookmarked';
      else if (_answers[i] !== undefined) cls += ' answered';
      else cls += ' unanswered';
      return `<button class="${cls}" onclick="QuizPage.goToQuestion(${i})" aria-label="Go to question ${i + 1}">${i + 1}</button>`;
    }).join('');
  }

  // ── Actions ──────────────────────────────────────────────────
  function selectAnswer(choiceIndex) {
    _answers[_currentIndex] = choiceIndex;
    _saveState();
    _renderQuestion(_currentIndex);
    
    // Auto-advance if settings allow (optional future setting)
    // if (Store.getSettings().autoAdvance) { setTimeout(_nextQuestion, 400); }
  }

  function goToQuestion(idx) {
    if (idx < 0 || idx >= _questions.length) return;
    _currentIndex = idx;
    _renderQuestion(idx);
  }

  function _nextQuestion() {
    if (_currentIndex < _questions.length - 1) {
      _currentIndex++;
      _renderQuestion(_currentIndex);
    }
  }

  function _prevQuestion() {
    if (_currentIndex > 0) {
      _currentIndex--;
      _renderQuestion(_currentIndex);
    }
  }

  function _toggleBookmark() {
    if (_bookmarks.has(_currentIndex)) {
      _bookmarks.delete(_currentIndex);
      Toast.info('Bookmark removed');
    } else {
      _bookmarks.add(_currentIndex);
      Toast.success('Question bookmarked');
    }
    _saveState();
    _renderQuestion(_currentIndex);
  }

  // ── Submit Modal ─────────────────────────────────────────────
  function _showSubmitModal() {
    const answeredCount = Object.keys(_answers).length;
    const unanswered = _questions.length - answeredCount;
    const warningEl = document.getElementById('submit-modal-warning');
    
    if (warningEl) {
      if (unanswered > 0) {
        warningEl.innerHTML = `You have <strong>${unanswered} unanswered</strong> question${unanswered > 1 ? 's' : ''}.<br>Are you sure you want to submit?`;
      } else {
        warningEl.textContent = 'You have answered all questions. Ready to see your score?';
      }
    }

    const overlay = document.getElementById('submit-modal-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.classList.add('visible');
    }
  }

  function _hideSubmitModal() {
    const overlay = document.getElementById('submit-modal-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.classList.add('hidden'), 300); // fade out
    }
  }

  function _confirmSubmit() {
    _hideSubmitModal();
    clearInterval(_timerInterval);

    // Calculate score
    let correctCount = 0;
    _questions.forEach((q, i) => {
      if (_answers[i] === q.correct) correctCount++;
    });

    const scorePct = Math.round((correctCount / _questions.length) * 100);

    // Build history record
    const historyRecord = {
      quizId: _quizData.generatedAt, // use timestamp as ID
      title: _quizData.sourceFile || 'Generated Quiz',
      date: new Date().toISOString(),
      score: scorePct,
      correct: correctCount,
      total: _questions.length,
      elapsed: _elapsed,
      answers: _answers,
      questions: _questions // Phase 5: store questions for review mode
    };

    // Save to history (Phase 5 prep)
    const history = Store.getQuizHistory();
    history.push(historyRecord);
    Store.setQuizHistory(history);

    // Clear active state
    Store.clearActiveQuizState();

    // In Phase 5, the results page will read the latest history record.
    Router.navigate('results');
  }

  // ── Initialization ───────────────────────────────────────────
  function reset() {
    _quizData = null;
    _questions = [];
    _currentIndex = 0;
    _answers = {};
    _bookmarks = new Set();
    _elapsed = 0;
    clearInterval(_timerInterval);
  }

  function init() {
    reset();

    // 1. Fetch active quiz
    const quiz = Store.getActiveQuiz();
    if (!quiz || !quiz.questions || quiz.questions.length === 0) {
      Toast.error('No quiz found. Generate one first!');
      Router.navigate('home');
      return;
    }

    _quizData = quiz;
    _questions = quiz.questions;

    // 2. Try to restore saved state
    if (!_restoreState()) {
      // Fresh start
      _elapsed = 0;
      _answers = {};
      _bookmarks = new Set();
      _currentIndex = 0;
      _saveState();
    }

    // 3. Bind events (ensure one-time binding)
    _bindEvents();

    // 4. Start
    _startTimer();
    _renderQuestion(_currentIndex);
  }

  let _eventsBound = false;
  function _bindEvents() {
    if (_eventsBound) return;
    
    document.getElementById('quiz-prev-btn')?.addEventListener('click', _prevQuestion);
    document.getElementById('quiz-next-btn')?.addEventListener('click', _nextQuestion);
    document.getElementById('bookmark-btn')?.addEventListener('click', _toggleBookmark);
    document.getElementById('quiz-submit-btn')?.addEventListener('click', _showSubmitModal);
    
    document.getElementById('submit-cancel-btn')?.addEventListener('click', _hideSubmitModal);
    document.getElementById('submit-confirm-btn')?.addEventListener('click', _confirmSubmit);

    _eventsBound = true;
  }

  function onEnter() {
    init();
  }

  return { init, onEnter, selectAnswer, goToQuestion };
})();

window.QuizPage = QuizPage;
