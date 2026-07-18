/**
 * QUIZPDF AI — Home Page (Phase 3)
 * js/pages/home.js
 */

const HomePage = (() => {
  const RECENT_PLACEHOLDER = [
    { id: 1, title: 'Introduction to Biology',  emoji: '🧬', score: 85, total: 20, date: '2 days ago' },
    { id: 2, title: 'World History — WWI',      emoji: '📜', score: 72, total: 15, date: '5 days ago' },
    { id: 3, title: 'Python Programming Basics', emoji: '🐍', score: 90, total: 25, date: '1 week ago' },
  ];

  // ── Recent quizzes ───────────────────────────────────────────
  function _renderRecentQuizzes() {
    const container = document.getElementById('recent-quizzes-list');
    if (!container) return;
    const quizzes = Store.getRecentQuizzes();
    const data    = quizzes.length > 0 ? quizzes : RECENT_PLACEHOLDER;
    container.innerHTML = data.map((q, i) => `
      <div class="recent-quiz-card animate-fade-in"
           style="animation-delay: ${i * 80}ms"
           role="button" tabindex="0"
           aria-label="View quiz: ${q.title}"
           onclick="Router.navigate('results')">
        <div class="recent-quiz-icon">${q.emoji}</div>
        <div class="recent-quiz-info">
          <div class="recent-quiz-title">${q.title}</div>
          <div class="recent-quiz-meta">${q.total} questions · ${q.date}</div>
        </div>
        <div class="recent-quiz-score">${q.score}%</div>
      </div>
    `).join('');
  }

  // ── Extraction progress overlay ──────────────────────────────
  function _showExtractionOverlay(fileName) {
    const overlay = document.getElementById('extraction-overlay');
    const fnEl    = document.getElementById('extraction-filename');
    if (fnEl) fnEl.textContent = fileName;
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.classList.add('visible');
    }
    _setExtractionProgress(0, 0, 0);
  }

  function _hideExtractionOverlay() {
    const overlay = document.getElementById('extraction-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.classList.add('hidden'), 400);
    }
  }

  function _setExtractionProgress(page, total, percent) {
    const bar  = document.getElementById('extraction-progress-bar');
    const text = document.getElementById('extraction-progress-text');
    const pct  = document.getElementById('extraction-progress-pct');
    if (bar)  bar.style.width  = percent + '%';
    if (text) text.textContent = total > 0 ? `Reading page ${page} of ${total}…` : 'Loading PDF…';
    if (pct)  pct.textContent  = percent + '%';
  }

  // ── Debug panel ──────────────────────────────────────────────
  function _updateDebugPanel(result) {
    const panel   = document.getElementById('debug-panel');
    const content = document.getElementById('debug-content');
    const meta    = document.getElementById('debug-meta');
    if (!panel || !content || !meta) return;

    if (!result) {
      meta.textContent    = '';
      content.textContent = '';
      panel.classList.add('hidden');
      return;
    }

    meta.innerHTML = [
      `<span class="debug-tag">📄 ${result.fileName}</span>`,
      `<span class="debug-tag">${result.pageCount} pages</span>`,
      `<span class="debug-tag">${result.wordCount.toLocaleString()} words</span>`,
      `<span class="debug-tag">${result.charCount.toLocaleString()} chars</span>`,
      `<span class="debug-tag">${result.fileSizeMB} MB</span>`,
      result.likelyScanned ? `<span class="debug-tag debug-tag-warn">⚠ Likely Scanned</span>` : '',
      result.trimmed ? `<span class="debug-tag debug-tag-warn">✂ Text Trimmed</span>` : '',
    ].filter(Boolean).join('');

    content.textContent = result.text || '(no text extracted)';
    panel.classList.remove('hidden');
  }

  function _toggleDebugPanel() {
    const panel  = document.getElementById('debug-panel');
    const btn    = document.getElementById('debug-toggle-btn');
    const body   = document.getElementById('debug-panel-body');
    if (!panel || !body) return;

    const collapsed = body.classList.toggle('collapsed');
    if (btn) btn.textContent = collapsed ? '▼ Show' : '▲ Hide';
  }

  function _copyDebugText() {
    const content = document.getElementById('debug-content');
    if (!content?.textContent) return;
    navigator.clipboard.writeText(content.textContent)
      .then(() => Toast.success('Extracted text copied to clipboard!'))
      .catch(() => Toast.error('Could not copy text.'));
  }

  function _clearExtractedPDF() {
    Store.clearExtractedPDF();
    _updateDebugPanel(null);
    _resetDropzone();
    Toast.info('Extracted PDF data cleared.');
  }

  // ── Dropzone state ───────────────────────────────────────────
  function _resetDropzone() {
    const dz   = document.getElementById('pdf-dropzone');
    const text = document.getElementById('dropzone-text');
    const sub  = document.getElementById('dropzone-sub');
    const genBtn = document.getElementById('generate-quiz-btn');
    const genTooltip = document.getElementById('generate-tooltip');

    if (dz) {
      dz.style.borderColor = '';
      dz.classList.remove('dz-success', 'dz-error');
    }
    if (text) text.textContent = 'Drop your PDF here';
    if (sub)  sub.textContent  = 'or tap to browse files';
    if (genBtn) {
      genBtn.setAttribute('disabled', '');
      genBtn.setAttribute('aria-disabled', 'true');
    }
    if (genTooltip) genTooltip.style.display = '';

    // Reset file input so same file can be re-selected
    const input = document.getElementById('pdf-file-input');
    if (input) input.value = '';
  }

  function _setDropzoneSuccess(fileName, stats) {
    const dz   = document.getElementById('pdf-dropzone');
    const text = document.getElementById('dropzone-text');
    const sub  = document.getElementById('dropzone-sub');
    if (dz)   dz.style.borderColor = 'var(--color-success)';
    if (text) text.textContent = fileName;
    if (sub)  sub.textContent  = stats;
  }

  function _setDropzoneError(message) {
    const dz   = document.getElementById('pdf-dropzone');
    const text = document.getElementById('dropzone-text');
    const sub  = document.getElementById('dropzone-sub');
    if (dz)   dz.style.borderColor = 'var(--color-error)';
    if (text) text.textContent = 'Upload failed';
    if (sub)  sub.textContent  = message;
  }

  // ── Main file handler (Phase 2) ──────────────────────────────
  async function _handleFileSelected(file) {
    if (!file) return;

    // Basic client-side type check before loading PDF.js
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      Toast.error('Please upload a PDF file.');
      return;
    }

    // Show progress overlay
    _showExtractionOverlay(file.name);

    let result;
    try {
      result = await PDFExtractor.extract(file, {
        onProgress: ({ page, total, percent }) => {
          _setExtractionProgress(page, total, percent);
        },
      });
    } catch (err) {
      _hideExtractionOverlay();
      _setDropzoneError('Extraction failed — please try again.');
      Toast.error('Unexpected error during extraction.');
      return;
    }

    _hideExtractionOverlay();

    if (!result.success) {
      _setDropzoneError(result.error);
      Toast.error(result.error, 7000);
      return;
    }

    // Show non-fatal warnings
    result.warnings.forEach(w => Toast.warning(w, 7000));

    // Update UI
    const stats = PDFExtractor.formatStats(result);
    _setDropzoneSuccess(file.name, stats);

    // Store in localStorage
    Store.setExtractedPDF(result);

    // Show debug panel
    _updateDebugPanel(result);

    // Phase 3: Enable the Generate Quiz button
    _enableGenerateButton();

    Toast.success(`Extracted ${result.wordCount.toLocaleString()} words from "${file.name}"`);
  }

  // ── Generate Quiz button state ────────────────────────────────
  function _enableGenerateButton() {
    const genBtn     = document.getElementById('generate-quiz-btn');
    const genTooltip = document.getElementById('generate-tooltip');
    if (genBtn) {
      genBtn.removeAttribute('disabled');
      genBtn.removeAttribute('aria-disabled');
      // Check if API key is set — show different tooltip if not
      const hasKey = !!Store.getApiKey();
      if (!hasKey && genTooltip) {
        genTooltip.style.display = '';
        genTooltip.innerHTML = `
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          No API key saved — add one in Settings first`;
      } else if (genTooltip) {
        genTooltip.style.display = 'none';
      }
    }
  }

  function _disableGenerateButton() {
    const genBtn = document.getElementById('generate-quiz-btn');
    if (genBtn) {
      genBtn.setAttribute('disabled', '');
      genBtn.setAttribute('aria-disabled', 'true');
    }
  }

  // ── Dropzone setup ───────────────────────────────────────────
  function _setupDropzone() {
    const dz = document.getElementById('pdf-dropzone');
    if (!dz) return;

    dz.addEventListener('dragover', (e) => {
      e.preventDefault();
      dz.classList.add('drag-over');
    });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (file) _handleFileSelected(file);
      else Toast.error('Please drop a PDF file.');
    });

    const fileInput = document.getElementById('pdf-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) _handleFileSelected(file);
      });
    }

    // Cancel button inside overlay
    document.getElementById('extraction-cancel-btn')?.addEventListener('click', () => {
      PDFExtractor.cancel();
      _hideExtractionOverlay();
      _resetDropzone();
      Toast.info('Extraction cancelled.');
    });
  }

  // ── Debug panel setup ────────────────────────────────────────
  function _setupDebugPanel() {
    document.getElementById('debug-toggle-btn')?.addEventListener('click', _toggleDebugPanel);
    document.getElementById('debug-copy-btn')?.addEventListener('click', _copyDebugText);
    document.getElementById('debug-clear-btn')?.addEventListener('click', _clearExtractedPDF);

    // Restore from localStorage if available
    const saved = Store.getExtractedPDF();
    if (saved) {
      _updateDebugPanel(saved);
      _setDropzoneSuccess(saved.fileName, PDFExtractor.formatStats(saved));
      _enableGenerateButton();
    }

    // Restore quiz result badge if a quiz was previously generated
    const quiz = Store.getGeneratedQuiz();
    if (quiz) {
      _showQuizReadyBanner(quiz);
    }
  }

  // ── Generation progress overlay ───────────────────────────────
  function _showGenerationOverlay(sourceFile) {
    const overlay = document.getElementById('generation-overlay');
    const fnEl    = document.getElementById('generation-filename');
    if (fnEl) fnEl.textContent = sourceFile;
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.classList.add('visible');
    }
    _setGenerationProgress(0, 'Preparing…');
  }

  function _hideGenerationOverlay() {
    const overlay = document.getElementById('generation-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.classList.add('hidden'), 400);
    }
  }

  function _setGenerationProgress(percent, statusText) {
    const bar   = document.getElementById('generation-progress-bar');
    const text  = document.getElementById('generation-progress-text');
    const pctEl = document.getElementById('generation-progress-pct');
    if (bar)   bar.style.width   = percent + '%';
    if (text)  text.textContent  = statusText || 'Working…';
    if (pctEl) pctEl.textContent = percent + '%';
  }

  // ── Quiz ready banner ─────────────────────────────────────────
  function _showQuizReadyBanner(quiz) {
    const banner  = document.getElementById('quiz-ready-banner');
    if (!banner) return;
    const countEl = banner.querySelector('[data-q-count]');
    const fileEl  = banner.querySelector('[data-q-file]');
    if (countEl) countEl.textContent = quiz.questions.length;
    if (fileEl)  fileEl.textContent  = quiz.sourceFile || '';
    banner.classList.remove('hidden');
  }

  function _hideQuizReadyBanner() {
    document.getElementById('quiz-ready-banner')?.classList.add('hidden');
  }

  // ── Main: Generate Quiz pipeline ─────────────────────────────
  async function _handleGenerateQuiz() {
    if (!navigator.onLine) {
      Toast.error('You are currently offline. Please connect to the internet to generate a quiz.');
      return;
    }

    const pdfData = Store.getExtractedPDF();
    if (!pdfData) {
      Toast.error('Please upload and extract a PDF first.');
      return;
    }
    const apiKey = Store.getApiKey();
    if (!apiKey) {
      Toast.error('No API key found. Please add your Gemini API key in Settings.');
      Router.navigate('settings');
      return;
    }

    _disableGenerateButton();
    _hideQuizReadyBanner();
    _showGenerationOverlay(pdfData.fileName);

    const result = await GeminiClient.generate({
      apiKey,
      text:       pdfData.text,
      sourceFile: pdfData.fileName,
      pageCount:  pdfData.pageCount,
      wordCount:  pdfData.wordCount,
      onProgress: ({ percent, status }) => _setGenerationProgress(percent, status),
    });

    _hideGenerationOverlay();
    _enableGenerateButton();

    if (!result.success) {
      Toast.error(result.error, 9000);
      return;
    }

    result.warnings?.forEach(w => Toast.warning(w, 6000));
    Store.setGeneratedQuiz(result.quiz);
    Store.clearExtractedPDF(); // Phase 6: Optimize storage by freeing the large string

    _showQuizReadyBanner(result.quiz);
    Toast.success(`✨ Quiz ready! ${result.quiz.questions.length} questions generated.`, 6000);
  }

  // ── Setup: Generate button & cancel ──────────────────────────
  function _setupGenerateButton() {
    document.getElementById('generate-quiz-btn')?.addEventListener('click', _handleGenerateQuiz);

    document.getElementById('generation-cancel-btn')?.addEventListener('click', () => {
      GeminiClient.cancel();
      _hideGenerationOverlay();
      _enableGenerateButton();
      Toast.info('Quiz generation cancelled.');
    });

    document.getElementById('quiz-ready-start-btn')?.addEventListener('click', () => {
      Router.navigate('quiz');
    });
  }

  // ── Install banner ───────────────────────────────────────────
  function _setupInstallBanner() {
    let deferredPrompt = null;
    const banner    = document.getElementById('install-banner');
    const installBtn = document.getElementById('install-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (banner) banner.classList.remove('hidden');
    });

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) {
          Toast.info('App is already installed or not available on this browser.');
          return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (banner) banner.classList.add('hidden');
        if (outcome === 'accepted') Toast.success('QuizPDF AI installed successfully!');
      });
    }

    window.addEventListener('appinstalled', () => {
      if (banner) banner.classList.add('hidden');
    });
  }

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    _renderRecentQuizzes();
    _setupDropzone();
    _setupGenerateButton();
    _setupInstallBanner();
    _setupDebugPanel();

    document.getElementById('start-sample-quiz-btn')?.addEventListener('click', () => {
      Router.navigate('quiz');
    });
  }

  return { init };
})();

window.HomePage = HomePage;
