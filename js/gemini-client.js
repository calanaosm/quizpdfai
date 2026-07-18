/**
 * QUIZPDF AI — Gemini API Client (Phase 3)
 * js/gemini-client.js
 *
 * Handles: API key validation, Test Connection, text chunking,
 * structured quiz generation, response parsing & validation.
 */

const GeminiClient = (() => {
  'use strict';

  // ── Constants ────────────────────────────────────────────────
  const MODEL = 'gemini-2.5-flash';
  const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
  const ENDPOINT = `${API_BASE}/${MODEL}:generateContent`;

  // Max characters to send per chunk (keep well under token limits)
  const CHUNK_MAX_CHARS = 12_000;
  // Minimum questions to accept from a single chunk response
  const MIN_QUESTIONS_PER_CHUNK = 1;
  // Max questions per chunk request
  const QUESTIONS_PER_CHUNK = 10;
  // Max total questions in final quiz
  const MAX_TOTAL_QUESTIONS = 40;

  // ── State ────────────────────────────────────────────────────
  let _abortController = null;
  let _isGenerating = false;

  // ── Question Schema ──────────────────────────────────────────
  /**
   * @typedef {Object} QuizQuestion
   * @property {string}   text        - Question text
   * @property {string[]} choices     - Exactly 4 answer choices
   * @property {number}   correct     - Index of correct choice (0–3)
   * @property {number}   confidence  - 0.0–1.0 confidence score
   * @property {string}   explanation - Why the correct answer is right
   */

  /**
   * @typedef {Object} GeneratedQuiz
   * @property {QuizQuestion[]} questions
   * @property {string}         sourceFile
   * @property {number}         pageCount
   * @property {number}         wordCount
   * @property {number}         chunksUsed
   * @property {number}         generatedAt
   */

  // ── Prompt builder ───────────────────────────────────────────
  function _buildPrompt(chunkText, chunkIndex, totalChunks) {
    const context = totalChunks > 1
      ? `This is chunk ${chunkIndex + 1} of ${totalChunks} from a larger document.`
      : 'This is the complete document text.';

    return `You are an expert educational quiz generator. ${context}

Generate exactly ${QUESTIONS_PER_CHUNK} multiple-choice quiz questions from the following text.
If the text is too short for ${QUESTIONS_PER_CHUNK} questions, generate as many as possible (minimum 1).

Rules:
- Each question must have EXACTLY 4 answer choices
- Choices must be labelled in the "choices" array (no A/B/C/D prefixes — just the text)
- "correct" must be the 0-based index (0, 1, 2, or 3) of the correct choice
- "confidence" must be a decimal between 0.0 and 1.0
- "explanation" should be 1–2 sentences explaining why the answer is correct
- Questions should test real comprehension, not trivial memorization
- Avoid trick questions or ambiguous wording
- Do NOT repeat questions from other chunks

CRITICAL: Respond with ONLY valid JSON. No markdown, no code blocks, no extra text.

Required JSON format:
{
  "questions": [
    {
      "text": "What is the main purpose of X?",
      "choices": ["Option one", "Option two", "Option three", "Option four"],
      "correct": 0,
      "confidence": 0.95,
      "explanation": "Option one is correct because..."
    }
  ]
}

TEXT TO ANALYZE:
---
${chunkText}
---`;
  }

  // ── Text chunking ────────────────────────────────────────────
  /**
   * Split text into chunks respecting page boundaries where possible.
   * @param {string} text
   * @returns {string[]}
   */
  function _chunkText(text) {
    if (text.length <= CHUNK_MAX_CHARS) return [text];

    const chunks = [];
    // Split on page markers if present (from Phase 2 extraction)
    const pageMarkerRegex = /(?=--- Page \d+ ---)/g;
    const pages = text.split(pageMarkerRegex).filter(Boolean);

    let current = '';
    for (const page of pages) {
      if ((current + page).length > CHUNK_MAX_CHARS && current.length > 0) {
        chunks.push(current.trim());
        current = page;
      } else {
        current += '\n' + page;
      }
    }
    if (current.trim()) chunks.push(current.trim());

    // If no page markers, fall back to hard character split at sentence boundaries
    if (chunks.length === 0) {
      let pos = 0;
      while (pos < text.length) {
        let end = Math.min(pos + CHUNK_MAX_CHARS, text.length);
        // Try to break at a sentence boundary
        if (end < text.length) {
          const breakAt = text.lastIndexOf('. ', end);
          if (breakAt > pos + CHUNK_MAX_CHARS / 2) end = breakAt + 1;
        }
        chunks.push(text.slice(pos, end).trim());
        pos = end;
      }
    }

    return chunks.filter(c => c.length > 50); // skip chunks that are too small
  }

  // ── Single Gemini API call ───────────────────────────────────
  async function _callGemini(apiKey, prompt, signal) {
    const url = `${ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 8192,
        // Request JSON output
        responseMimeType: 'application/json',
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const msg = errBody?.error?.message || `HTTP ${response.status}`;

      if (response.status === 400) throw new Error(`Invalid request: ${msg}`);
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid API key. Please check your Gemini API key in Settings.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      if (response.status >= 500) {
        throw new Error('Gemini service is temporarily unavailable. Please try again later.');
      }
      throw new Error(`Gemini API error: ${msg}`);
    }

    return response.json();
  }

  // ── Extract text from Gemini response ───────────────────────
  function _extractResponseText(geminiResponse) {
    const candidate = geminiResponse?.candidates?.[0];
    if (!candidate) throw new Error('Gemini returned no candidates.');

    const finishReason = candidate.finishReason;
    if (finishReason === 'SAFETY') {
      throw new Error('The content was blocked by Gemini safety filters.');
    }
    if (finishReason === 'RECITATION') {
      throw new Error('Gemini refused to process this content due to recitation policy.');
    }

    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned an empty response.');
    return text;
  }

  // ── Parse & validate JSON response ──────────────────────────
  function _parseChunkResponse(rawText) {
    let json;
    // Try direct parse first
    try {
      json = JSON.parse(rawText);
    } catch {
      // Strip markdown code fences if present
      const stripped = rawText
        .replace(/^```(?:json)?\s*/im, '')
        .replace(/\s*```$/m, '')
        .trim();
      try {
        json = JSON.parse(stripped);
      } catch {
        // Try to extract JSON object from the text
        const match = rawText.match(/\{[\s\S]*\}/);
        if (match) {
          try { json = JSON.parse(match[0]); }
          catch { throw new Error('Could not parse Gemini response as JSON.'); }
        } else {
          throw new Error('Gemini response does not contain valid JSON.');
        }
      }
    }

    if (!json || !Array.isArray(json.questions)) {
      throw new Error('Gemini response is missing the "questions" array.');
    }

    return json.questions;
  }

  // ── Validate a single question object ───────────────────────
  function _validateQuestion(q, index) {
    const errors = [];

    if (typeof q.text !== 'string' || q.text.trim().length < 5) {
      errors.push(`Question ${index + 1}: "text" must be a non-empty string.`);
    }
    if (!Array.isArray(q.choices) || q.choices.length !== 4) {
      errors.push(`Question ${index + 1}: "choices" must be an array of exactly 4 strings.`);
    } else if (!q.choices.every(c => typeof c === 'string' && c.trim().length > 0)) {
      errors.push(`Question ${index + 1}: all choices must be non-empty strings.`);
    }
    if (typeof q.correct !== 'number' || q.correct < 0 || q.correct > 3 || !Number.isInteger(q.correct)) {
      errors.push(`Question ${index + 1}: "correct" must be an integer 0–3.`);
    }
    if (typeof q.confidence !== 'number' || q.confidence < 0 || q.confidence > 1) {
      // Auto-fix: clamp it
      q.confidence = Math.min(1, Math.max(0, Number(q.confidence) || 0.5));
    }
    if (typeof q.explanation !== 'string' || q.explanation.trim().length < 3) {
      q.explanation = q.explanation?.trim() || 'No explanation provided.';
    }

    return errors;
  }

  // ── Deduplicate questions by similarity ─────────────────────
  function _deduplicateQuestions(questions) {
    const seen = new Set();
    return questions.filter(q => {
      // Normalise: lowercase, strip punctuation
      const key = q.text.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ── Test Connection ──────────────────────────────────────────
  /**
   * Send a minimal request to verify the API key works.
   * @param {string} apiKey
   * @returns {Promise<{ success: boolean, error?: string, model?: string }>}
   */
  async function testConnection(apiKey) {
    if (!apiKey) return { success: false, error: 'No API key provided.' };

    try {
      const url = `${ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
      const payload = {
        contents: [{ parts: [{ text: 'Reply with exactly: {"ok":true}' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 20 },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 400) {
          const msg = err?.error?.message || '';
          // 400 with API_KEY_INVALID is still an auth failure
          if (msg.toLowerCase().includes('api key')) {
            return { success: false, error: 'Invalid API key.' };
          }
          // 400 but got a response means key is valid, model just refused
          return { success: true, model: MODEL };
        }
        if (response.status === 401 || response.status === 403) {
          return { success: false, error: 'Invalid or unauthorized API key.' };
        }
        return { success: false, error: `HTTP ${response.status}` };
      }

      return { success: true, model: MODEL };

    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        return { success: false, error: 'Connection timed out. Check your internet.' };
      }
      return { success: false, error: err.message || 'Network error.' };
    }
  }

  // ── Main: Generate Quiz ──────────────────────────────────────
  /**
   * Generate a structured quiz from extracted PDF text.
   *
   * @param {Object} opts
   * @param {string}   opts.apiKey
   * @param {string}   opts.text       - Full extracted text from PDFExtractor
   * @param {string}   opts.sourceFile - Original PDF filename
   * @param {number}   opts.pageCount
   * @param {number}   opts.wordCount
   * @param {Function} [opts.onProgress] - Called with ({ chunk, totalChunks, percent, status })
   * @returns {Promise<{ success: boolean, quiz?: GeneratedQuiz, error?: string, warnings?: string[] }>}
   */
  async function generate({ apiKey, text, sourceFile, pageCount, wordCount, onProgress }) {
    if (_isGenerating) cancel();
    _isGenerating = true;
    _abortController = new AbortController();
    const signal = _abortController.signal;

    const warnings = [];
    let allQuestions = [];

    try {
      if (!apiKey) throw new Error('No API key found. Please add your Gemini API key in Settings.');
      if (!text || text.trim().length < 100) {
        throw new Error('Not enough text to generate a quiz. Please upload a PDF with more content.');
      }

      // 1. Split text into chunks
      const chunks = _chunkText(text);
      const totalChunks = chunks.length;

      onProgress?.({ chunk: 0, totalChunks, percent: 0, status: `Preparing ${totalChunks} chunk${totalChunks > 1 ? 's' : ''}…` });

      // 2. Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        if (signal.aborted) throw new DOMException('Cancelled.', 'AbortError');

        const statusText = totalChunks > 1
          ? `Sending chunk ${i + 1} of ${totalChunks} to Gemini…`
          : 'Generating quiz with Gemini…';

        onProgress?.({
          chunk: i + 1,
          totalChunks,
          percent: Math.round(((i) / totalChunks) * 90), // reserve last 10% for finalise
          status: statusText,
        });

        // Call Gemini
        const prompt = _buildPrompt(chunks[i], i, totalChunks);
        const response = await _callGemini(apiKey, prompt, signal);

        if (signal.aborted) throw new DOMException('Cancelled.', 'AbortError');

        const rawText = _extractResponseText(response);
        let chunkQs;

        try {
          chunkQs = _parseChunkResponse(rawText);
        } catch (parseErr) {
          warnings.push(`Chunk ${i + 1}: ${parseErr.message} — skipping.`);
          console.warn(`[GeminiClient] Chunk ${i + 1} parse error:`, parseErr.message, '\nRaw:', rawText);
          continue;
        }

        // Validate each question in this chunk
        const validQs = [];
        for (let j = 0; j < chunkQs.length; j++) {
          const errs = _validateQuestion(chunkQs[j], j);
          if (errs.length > 0) {
            warnings.push(...errs);
            console.warn(`[GeminiClient] Invalid question skipped:`, errs);
          } else {
            validQs.push(chunkQs[j]);
          }
        }

        if (validQs.length < MIN_QUESTIONS_PER_CHUNK && totalChunks === 1) {
          throw new Error('Gemini returned no valid questions. The PDF content may not be suitable for quiz generation.');
        }

        allQuestions = allQuestions.concat(validQs);
      }

      // 3. Post-process: deduplicate, trim, shuffle
      onProgress?.({ chunk: totalChunks, totalChunks, percent: 92, status: 'Finalising quiz…' });

      allQuestions = _deduplicateQuestions(allQuestions);

      if (allQuestions.length === 0) {
        throw new Error(
          'No valid questions could be generated. ' +
          'This may happen with very technical, image-heavy, or poorly formatted PDFs.'
        );
      }

      // Cap at maximum
      if (allQuestions.length > MAX_TOTAL_QUESTIONS) {
        allQuestions = allQuestions.slice(0, MAX_TOTAL_QUESTIONS);
        warnings.push(`Quiz capped at ${MAX_TOTAL_QUESTIONS} questions.`);
      }

      onProgress?.({ chunk: totalChunks, totalChunks, percent: 100, status: `Quiz ready — ${allQuestions.length} questions` });

      /** @type {GeneratedQuiz} */
      const quiz = {
        questions: allQuestions,
        sourceFile,
        pageCount,
        wordCount,
        chunksUsed: chunks.length,
        generatedAt: Date.now(),
      };

      return { success: true, quiz, warnings };

    } catch (err) {
      if (err.name === 'AbortError') {
        return { success: false, error: 'Quiz generation was cancelled.' };
      }
      return { success: false, error: err.message || 'An unexpected error occurred.' };
    } finally {
      _isGenerating = false;
      _abortController = null;
    }
  }

  // ── Cancel ongoing generation ────────────────────────────────
  function cancel() {
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    _isGenerating = false;
  }

  function isGenerating() { return _isGenerating; }

  return { generate, testConnection, cancel, isGenerating };
})();

window.GeminiClient = GeminiClient;
