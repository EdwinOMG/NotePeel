type ExtractedNoteLike = {
  status?: string | null;
  raw_text?: string | null;
  structured_text?: string | null;
  error_message?: string | null;
};

const stripHtml = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>|<\/div>|<\/h[1-6]>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const getExtractedText = (note: ExtractedNoteLike) =>
  stripHtml(note.raw_text?.trim() || note.structured_text?.trim() || '');

export const hasAnyExtractedText = (note: ExtractedNoteLike) =>
  getExtractedText(note).length > 0;

export const isExtractionLikelyIncomplete = (note: ExtractedNoteLike) => {
  const text = getExtractedText(note);
  if (!text) return false;

  const words = text.match(/\b[\w'-]+\b/g) || [];
  return words.length < 18 && text.length < 120;
};

/**
 * Rewrites hardcoded dark colors baked into stored note HTML so they're
 * readable on dark backgrounds. No-op in light mode.
 */
export const prepareContentForDisplay = (html: string, darkMode: boolean): string => {
  if (!darkMode) return html;
  return html
    .replace(/color:\s*#3[Ee]2723/g, 'color: #FF9800')  // header text: dark brown → amber
    .replace(/color:\s*#5[Dd]4037/g, 'color: #A8A29E'); // diagram text: dark brown → warm gray
};

export const getUploadFeedback = (note: ExtractedNoteLike) => {
  const hasText = hasAnyExtractedText(note);

  if (note.status === 'failed' && !hasText) {
    return {
      kind: 'failed' as const,
      message: 'Text extraction failed — see details in the note.',
      timeoutMs: 5000,
    };
  }

  if (note.status === 'failed' && hasText) {
    return {
      kind: 'warning' as const,
      message: 'We recovered some text, but processing also reported an error. Please review this note carefully.',
      timeoutMs: 5000,
    };
  }

  if (!hasText) {
    return {
      kind: 'warning' as const,
      message: 'We couldn\'t extract any text from this image. Try uploading a clearer photo.',
      timeoutMs: 5000,
    };
  }

  if (isExtractionLikelyIncomplete(note)) {
    return {
      kind: 'warning' as const,
      message: 'We extracted some text, but it looks incomplete. Please review it before relying on it.',
      timeoutMs: 5000,
    };
  }

  return {
    kind: 'success' as const,
    message: '🐵 Note peeled successfully!',
    timeoutMs: 3000,
  };
};
