/**
 * QUIZPDF AI — PDF Extractor
 * js/pdf-extractor.js
 *
 * Wraps PDF.js to extract text from uploaded PDF files.
 * Handles: valid PDFs, empty PDFs, scanned PDFs, large PDFs, corrupt files.
 */

const PDFExtractor = (() => {
  'use strict';

  // ── Configuration ────────────────────────────────────────────
  const PDFJS_VERSION   = '3.11.174';
  const WORKER_CDN      = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
  const MAX_SIZE_MB     = 50;
  const MAX_SIZE_BYTES  = MAX_SIZE_MB * 1024 * 1024;

  // Text density threshold — pages with fewer chars than this are flagged as possibly scanned
  const SCANNED_CHARS_PER_PAGE = 30;

  // ── Internal state ───────────────────────────────────────────
  let _abortController = null;
  let _isProcessing    = false;

  // ── Result shape ─────────────────────────────────────────────
  /**
   * @typedef {Object} ExtractionResult
   * @property {boolean}  success
   * @property {string}   text           - Full combined text
   * @property {string[]} pageTexts      - Per-page text array
   * @property {number}   pageCount
   * @property {number}   wordCount
   * @property {number}   charCount
   * @property {string[]} warnings       - Non-fatal warnings
   * @property {string}   [error]        - Set on failure
   * @property {string}   fileName
   * @property {number}   fileSizeMB
   * @property {boolean}  likelyScanned  - True if most pages have very little text
   * @property {number}   extractedAt    - timestamp
   */

  // ── Initialise PDF.js worker ─────────────────────────────────
  function _ensureWorker() {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js library is not loaded. Check your internet connection.');
    }
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN;
    }
  }

  // ── Validate file before loading ─────────────────────────────
  function _validateFile(file) {
    if (!file) throw new Error('No file provided.');
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('This file does not appear to be a PDF. Please upload a .pdf file.');
    }
    if (file.size === 0) {
      throw new Error('The file is empty (0 bytes). Please upload a valid PDF.');
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new Error(
        `This PDF is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). ` +
        `Maximum supported size is ${MAX_SIZE_MB} MB.`
      );
    }
  }

  // ── Extract text from a single page ─────────────────────────
  async function _extractPageText(page) {
    const textContent = await page.getTextContent();
    const strings = textContent.items.map(item => {
      // item can be TextItem or TextMarkedContent
      if (typeof item.str === 'string') return item.str;
      return '';
    });

    // Join with smart whitespace — preserve paragraph breaks
    let text = '';
    let prevY = null;
    textContent.items.forEach((item, i) => {
      if (typeof item.str !== 'string') return;
      const str = item.str;
      if (str.trim() === '') {
        text += ' ';
        return;
      }
      // Detect line-break by Y position shift
      if (prevY !== null && item.transform) {
        const curY = item.transform[5];
        const dy   = Math.abs(curY - prevY);
        if (dy > 5) text += '\n';
      }
      text += str;
      if (item.transform) prevY = item.transform[5];
    });

    return text.trim();
  }

  // ── Main extraction function ─────────────────────────────────
  /**
   * Extract text from a PDF File object.
   *
   * @param {File}     file
   * @param {Object}   [opts]
   * @param {Function} [opts.onProgress]   - Called with ({ page, total, percent })
   * @param {Function} [opts.onPageDone]   - Called with ({ pageNum, text, total })
   * @returns {Promise<ExtractionResult>}
   */
  async function extract(file, { onProgress, onPageDone } = {}) {
    if (_isProcessing) {
      cancel();
    }
    _isProcessing    = true;
    _abortController = new AbortController();
    const signal     = _abortController.signal;

    const result = {
      success:       false,
      text:          '',
      pageTexts:     [],
      pageCount:     0,
      wordCount:     0,
      charCount:     0,
      warnings:      [],
      error:         null,
      fileName:      file.name,
      fileSizeMB:    +(file.size / 1024 / 1024).toFixed(2),
      likelyScanned: false,
      extractedAt:   Date.now(),
    };

    try {
      // 1. Validate
      _validateFile(file);
      _ensureWorker();

      // 2. Read file as ArrayBuffer
      const arrayBuffer = await _readFileAsArrayBuffer(file, signal);
      if (signal.aborted) throw new DOMException('Extraction cancelled.', 'AbortError');

      // 3. Load PDF document
      let pdfDoc;
      try {
        pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer, verbosity: 0 }).promise;
      } catch (loadErr) {
        throw new Error(
          'Could not read this PDF. It may be corrupt, password-protected, or in an unsupported format.'
        );
      }
      if (signal.aborted) throw new DOMException('Extraction cancelled.', 'AbortError');

      result.pageCount = pdfDoc.numPages;

      if (result.pageCount === 0) {
        throw new Error('This PDF has no pages.');
      }

      // Warn about large documents
      if (result.pageCount > 100) {
        result.warnings.push(
          `Large document (${result.pageCount} pages). Extraction may take a while.`
        );
      }

      // 4. Extract page by page
      let lowTextPageCount = 0;
      const pageTexts = [];

      for (let i = 1; i <= result.pageCount; i++) {
        if (signal.aborted) throw new DOMException('Extraction cancelled.', 'AbortError');

        const page     = await pdfDoc.getPage(i);
        const pageText = await _extractPageText(page);
        page.cleanup();

        pageTexts.push(pageText);

        if (pageText.length < SCANNED_CHARS_PER_PAGE) {
          lowTextPageCount++;
        }

        const percent = Math.round((i / result.pageCount) * 100);
        onProgress?.({ page: i, total: result.pageCount, percent });
        onPageDone?.({ pageNum: i, text: pageText, total: result.pageCount });
      }

      // 5. Combine and analyse
      result.pageTexts = pageTexts;
      result.text      = pageTexts
        .map((t, i) => `--- Page ${i + 1} ---\n${t}`)
        .join('\n\n')
        .trim();

      result.charCount = result.text.replace(/---.*---\n/g, '').length;
      result.wordCount = result.text
        .replace(/---.*---/g, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;

      // 6. Detect scanned PDF
      const scannedRatio = lowTextPageCount / result.pageCount;
      result.likelyScanned = scannedRatio > 0.7;

      if (result.likelyScanned) {
        result.warnings.push(
          'This PDF appears to be a scanned document. Most pages have little or no selectable text. ' +
          'For best results, use a PDF with real text or run OCR on scanned pages before uploading.'
        );
      } else if (scannedRatio > 0.2) {
        result.warnings.push(
          `${lowTextPageCount} page(s) appear to be scanned or image-only. ` +
          'Text from those pages may be incomplete.'
        );
      }

      // 7. Empty check
      if (result.charCount < 10) {
        if (result.likelyScanned) {
          throw new Error(
            'No text could be extracted from this PDF. It appears to contain only scanned images. ' +
            'Please use a PDF with selectable text, or process it with OCR software first.'
          );
        }
        throw new Error(
          'This PDF appears to be empty — no text content was found. ' +
          'Please check the file and try again.'
        );
      }

      result.success = true;

    } catch (err) {
      if (err.name === 'AbortError') {
        result.error = 'Extraction was cancelled.';
      } else {
        result.error = err.message || 'An unexpected error occurred while reading the PDF.';
      }
    } finally {
      _isProcessing    = false;
      _abortController = null;
    }

    return result;
  }

  // ── Read file as ArrayBuffer ─────────────────────────────────
  function _readFileAsArrayBuffer(file, signal) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read the file.'));

      signal?.addEventListener('abort', () => {
        reader.abort();
        reject(new DOMException('Cancelled.', 'AbortError'));
      });

      reader.readAsArrayBuffer(file);
    });
  }

  // ── Cancel ongoing extraction ────────────────────────────────
  function cancel() {
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    _isProcessing = false;
  }

  // ── Utility: compute stats string ───────────────────────────
  function formatStats(result) {
    if (!result.success) return result.error;
    return [
      `${result.pageCount} page${result.pageCount !== 1 ? 's' : ''}`,
      `${result.wordCount.toLocaleString()} words`,
      `${result.charCount.toLocaleString()} characters`,
      `${result.fileSizeMB} MB`,
    ].join(' · ');
  }

  return { extract, cancel, formatStats };
})();

window.PDFExtractor = PDFExtractor;
