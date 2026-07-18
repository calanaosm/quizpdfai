/**
 * QUIZPDF AI — Results Page (Phase 5)
 * js/pages/results.js
 */

const ResultsPage = (() => {
  let _currentRecord = null;

  function _getGrade(pct) {
    if (pct >= 90) return { label: 'Excellent!',   emoji: '🏆', color: 'var(--color-success)' };
    if (pct >= 75) return { label: 'Good Job!',    emoji: '🎉', color: 'var(--color-primary)' };
    if (pct >= 60) return { label: 'Not Bad',      emoji: '👍', color: 'var(--color-accent)' };
    if (pct >= 40) return { label: 'Keep Trying',  emoji: '💪', color: 'var(--color-warning)' };
    return              { label: 'Needs Work',     emoji: '📚', color: 'var(--color-error)' };
  }

  function _formatTime(secs) {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function _animateScore(targetPct) {
    const arc = document.getElementById('score-arc');
    const pctEl = document.getElementById('score-percent');

    if (!arc || !pctEl) return;

    const circumference = 440;
    const offset = circumference - (targetPct / 100) * circumference;

    // Animate the arc
    setTimeout(() => {
      arc.style.strokeDashoffset = offset;
    }, 100);

    // Animate the number
    let start = 0;
    const duration = 1500;
    const startTime = performance.now();

    function step(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
      const current = Math.round(eased * targetPct);
      pctEl.textContent = current;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function render() {
    const history = Store.getQuizHistory();
    if (!history || history.length === 0) {
      Toast.error('No quiz results found.');
      Router.navigate('home');
      return;
    }

    _currentRecord = history[history.length - 1]; // latest record
    const { score, correct, total, elapsed, answers, title } = _currentRecord;

    const answeredCount = Object.keys(answers).length;
    const skipped = total - answeredCount;
    const wrong = answeredCount - correct;

    const grade = _getGrade(score);

    // Update badge
    const badge = document.getElementById('results-grade-badge');
    if (badge) badge.textContent = `${grade.emoji} ${grade.label}`;

    // Reset and trigger score animation
    const pctEl = document.getElementById('score-percent');
    if (pctEl) pctEl.textContent = '0';
    setTimeout(() => _animateScore(score), 300);

    // Time & Title
    const labelEl = document.querySelector('.results-score-label');
    if (labelEl) labelEl.textContent = `${title} · ${_formatTime(elapsed)} time taken`;

    // Stats
    const correctEl  = document.getElementById('stat-correct');
    const wrongEl    = document.getElementById('stat-wrong');
    const skippedEl  = document.getElementById('stat-skipped');
    if (correctEl)  correctEl.textContent  = correct;
    if (wrongEl)    wrongEl.textContent    = wrong;
    if (skippedEl)  skippedEl.textContent  = skipped;

    // Performance Bars
    const bars = document.querySelectorAll('.results-body .progress-bar-fill');
    if (bars.length >= 2) {
      bars[0].style.width = score + '%';
      // Speed heuristic just for visual flavor: (time per question)
      const secPerQ = elapsed / total;
      let speedPct = 100;
      if (secPerQ > 30) speedPct = 40;
      else if (secPerQ > 15) speedPct = 70;
      bars[1].style.width = speedPct + '%';
    }

    // Toggle Retake Incorrect Button
    const retryBtn = document.getElementById('btn-retake-incorrect');
    if (retryBtn) {
      if (wrong > 0 || skipped > 0) {
        retryBtn.classList.remove('hidden');
      } else {
        retryBtn.classList.add('hidden');
      }
    }
  }

  function _retakeIncorrect() {
    if (!_currentRecord || !_currentRecord.questions) return;
    
    // Filter questions that were wrong or skipped
    const retryQuestions = _currentRecord.questions.filter((q, idx) => {
      const ans = _currentRecord.answers[idx];
      return ans === undefined || ans === null || ans !== q.correct;
    });

    if (retryQuestions.length === 0) {
      Toast.info('No incorrect questions to retake!');
      return;
    }

    // Build a new subset quiz for active mode
    const retryQuiz = {
      questions: retryQuestions,
      sourceFile: _currentRecord.title + ' (Retry)',
      generatedAt: Date.now(), // new session
    };

    Store.setActiveQuiz(retryQuiz);
    Store.clearActiveQuizState(); // ensure clean state
    Router.navigate('quiz');
  }

  function _retakeFull() {
    if (!_currentRecord) return;
    
    // Fallback to original generated quiz to get all questions
    const genQuiz = Store.getGeneratedQuiz();
    if (genQuiz) {
      Store.setActiveQuiz(genQuiz);
    }
    Store.clearActiveQuizState();
    Router.navigate('quiz');
  }

  function init() {
    render();

    // Prevent duplicate binding
    document.getElementById('btn-review-answers')?.addEventListener('click', () => Router.navigate('review'));
    document.getElementById('btn-retake-quiz')?.addEventListener('click', _retakeFull);
    document.getElementById('btn-retake-incorrect')?.addEventListener('click', _retakeIncorrect);
    document.getElementById('btn-back-home')?.addEventListener('click', () => Router.navigate('home'));
  }

  function onEnter() {
    render();
  }

  return { init, onEnter };
})();

window.ResultsPage = ResultsPage;
