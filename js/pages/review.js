/**
 * QUIZPDF AI — Review Page (Phase 5)
 * js/pages/review.js
 */

const ReviewPage = (() => {
  let _filter = 'all'; // all | correct | incorrect | skipped
  let _record = null;

  function _getStatus(q, ansIndex) {
    if (ansIndex === null || ansIndex === undefined) return 'skipped';
    return ansIndex === q.correct ? 'correct' : 'incorrect';
  }

  function _renderList() {
    const container = document.getElementById('review-list');
    if (!container) return;

    if (!_record || !_record.questions) {
      container.innerHTML = `<div class="empty-state">No review data available</div>`;
      return;
    }

    const { questions, answers } = _record;

    // Filter questions
    const filteredItems = [];
    questions.forEach((q, i) => {
      const status = _getStatus(q, answers[i]);
      if (_filter === 'all' || _filter === status) {
        filteredItems.push({ q, index: i, status, ansIndex: answers[i] });
      }
    });

    if (filteredItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">No questions found</div>
          <div class="empty-state-desc">Try selecting a different filter.</div>
        </div>
      `;
      return;
    }

    const letters = ['A', 'B', 'C', 'D'];

    container.innerHTML = filteredItems.map((item, uiIndex) => {
      const { q, index, status, ansIndex } = item;
      const isCorrect = status === 'correct';
      const isSkipped = status === 'skipped';

      const statusBadge = isSkipped
        ? `<span class="review-status-badge skipped">⏭ Skipped</span>`
        : isCorrect
          ? `<span class="review-status-badge correct">✓ Correct</span>`
          : `<span class="review-status-badge incorrect">✗ Incorrect</span>`;

      const yourAnswerHtml = isSkipped
        ? `<div class="review-answer-text" style="color:var(--text-muted);font-style:italic">Not answered</div>`
        : `<div class="review-answer-label your-answer">Your Answer</div>
           <div class="review-answer-text ${isCorrect ? 'correct-bg' : 'wrong-bg'}">
             ${letters[ansIndex]} — ${q.choices[ansIndex]}
           </div>`;

      const correctAnswerHtml = isCorrect ? '' : `
        <div class="review-answer-label correct-answer">Correct Answer</div>
        <div class="review-answer-text correct-bg">
          ${letters[q.correct]} — ${q.choices[q.correct]}
        </div>
      `;

      // AI Confidence badge
      const confPct = Math.round((q.confidence || 0.9) * 100);
      const confClass = confPct < 70 ? 'badge-warning' : 'badge-primary';

      return `
        <div class="review-card animate-fade-in" style="animation-delay:${uiIndex * 60}ms">
          <div class="review-card-header" style="justify-content:space-between">
            <span class="review-q-num">Q ${index + 1}</span>
            <div style="display:flex;gap:8px;align-items:center">
              <span class="badge ${confClass} badge-sm">AI Conf: ${confPct}%</span>
              ${statusBadge}
            </div>
          </div>
          <div class="review-card-body">
            <p class="review-question-text">${q.text}</p>
            <div class="review-answer-row">
              ${yourAnswerHtml}
              ${correctAnswerHtml}
            </div>
            <div class="review-explanation">💡 <strong>Explanation:</strong> ${q.explanation || 'No explanation provided.'}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function _setFilter(f) {
    _filter = f;
    document.querySelectorAll('.filter-chip').forEach(el => {
      el.classList.toggle('active', el.dataset.filter === f);
    });
    _renderList();
  }

  function init() {
    document.querySelectorAll('.filter-chip').forEach(el => {
      // remove old listeners by replacing element or just ensure single binding
      el.addEventListener('click', () => _setFilter(el.dataset.filter));
    });

    document.getElementById('btn-review-back')?.addEventListener('click', () => {
      Router.navigate('results');
    });

    onEnter();
  }

  function onEnter() {
    const history = Store.getQuizHistory();
    if (history && history.length > 0) {
      _record = history[history.length - 1];
    } else {
      _record = null;
    }

    // Reset filter
    _filter = 'all';
    document.querySelectorAll('.filter-chip').forEach(el => {
      el.classList.toggle('active', el.dataset.filter === 'all');
    });

    // We don't have "Bookmarked" in the history record currently, so we'll hide that chip if it exists
    const bkChip = document.querySelector('.filter-chip[data-filter="bookmarked"]');
    if (bkChip) bkChip.style.display = 'none';

    _renderList();
  }

  return { init, onEnter };
})();

window.ReviewPage = ReviewPage;
