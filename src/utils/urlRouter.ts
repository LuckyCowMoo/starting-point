import { PlannedLesson } from '../types/curriculum';

export interface ParsedLessonLink {
  lessonId?: string;
  lessonNumber?: number;
  stage?: number;
  slideIndex?: number;
  portableLesson?: PlannedLesson | null;
  present?: boolean;
}

/**
 * Safely encode a lesson payload into a portable Base64 URL string
 */
export function encodeLessonData(lesson: PlannedLesson): string {
  try {
    const json = JSON.stringify(lesson);
    return btoa(unescape(encodeURIComponent(json)));
  } catch (err) {
    console.error('Failed to encode lesson data for link', err);
    return '';
  }
}

/**
 * Safely decode a lesson payload from a portable Base64 URL string
 */
export function decodeLessonData(raw: string): PlannedLesson | null {
  try {
    const json = decodeURIComponent(escape(atob(raw)));
    const parsed = JSON.parse(json) as PlannedLesson;
    if (parsed && parsed.title && Array.isArray(parsed.slidesData)) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn('Could not decode portable lesson payload from URL', err);
    return null;
  }
}

/**
 * Parse the current browser URL (hash and search params) for lesson deep links.
 * Supports:
 * - #lesson=lesson-1&stage=4&slide=2
 * - #lesson=1&stage=4
 * - ?lesson=lesson-1&stage=4
 * - #stage=4&data=<base64>
 */
export function parseLessonLink(): ParsedLessonLink {
  if (typeof window === 'undefined') return {};

  // Check hash first (preferred for GitHub Pages and client-side routers)
  let rawHash = window.location.hash.replace(/^#/, '').trim();
  let searchParams = new URLSearchParams(window.location.search);
  let hashParams = new URLSearchParams(rawHash);

  // Helper to get param from hash or search
  const getParam = (key: string): string | null => {
    return hashParams.get(key) || searchParams.get(key) || null;
  };

  const result: ParsedLessonLink = {};

  const lessonParam = getParam('lesson');
  if (lessonParam) {
    const trimmed = lessonParam.trim();
    result.lessonId = trimmed;

    // Direct number e.g. "2"
    const asNum = parseInt(trimmed, 10);
    if (!isNaN(asNum) && String(asNum) === trimmed) {
      result.lessonNumber = asNum;
    } else {
      // Extract number from patterns like "lesson-2", "lesson2", "l-2", "l2", "lesson-net-2"
      const matchNum = trimmed.match(/(?:lesson|l)[-_]?(?:[a-z]+[-_])?(\d+)/i) || trimmed.match(/(\d+)$/);
      if (matchNum && matchNum[1]) {
        result.lessonNumber = parseInt(matchNum[1], 10);
      }
    }
  }

  const stageParam = getParam('stage');
  if (stageParam) {
    const sNum = parseInt(stageParam, 10);
    if (!isNaN(sNum) && sNum >= 1 && sNum <= 4) {
      result.stage = sNum;
    }
  } else if (result.lessonId || result.lessonNumber) {
    // If opening a lesson link directly, default straight to Stage 4 (Slide Studio)
    result.stage = 4;
  }

  const slideParam = getParam('slide');
  if (slideParam) {
    const slNum = parseInt(slideParam, 10);
    if (!isNaN(slNum) && slNum >= 1) {
      result.slideIndex = slNum - 1; // Convert 1-based URL to 0-based internal index
    }
  }

  const presentParam = getParam('present');
  if (presentParam === 'true' || presentParam === '1') {
    result.present = true;
  }

  const dataParam = getParam('data');
  if (dataParam) {
    result.portableLesson = decodeLessonData(dataParam);
    if (result.portableLesson) {
      result.lessonId = result.portableLesson.id;
      result.lessonNumber = result.portableLesson.lessonNumber;
      if (!result.stage) result.stage = 4;
    }
  }

  return result;
}

/**
 * Generate a clean direct link to a specific lesson and slide
 */
export function createLessonDirectLink(
  lessonId: string,
  stage: number = 4,
  slideIndex?: number
): string {
  if (typeof window === 'undefined') return '';
  const base = `${window.location.origin}${window.location.pathname}`;
  let hash = `lesson=${encodeURIComponent(lessonId)}&stage=${stage}`;
  if (slideIndex !== undefined && slideIndex >= 0) {
    hash += `&slide=${slideIndex + 1}`;
  }
  return `${base}#${hash}`;
}

/**
 * Generate a self-contained portable link that includes the lesson contents
 */
export function createPortableLessonLink(lesson: PlannedLesson, slideIndex?: number): string {
  if (typeof window === 'undefined') return '';
  const base = `${window.location.origin}${window.location.pathname}`;
  const encoded = encodeLessonData(lesson);
  let hash = `stage=4&data=${encoded}`;
  if (slideIndex !== undefined && slideIndex >= 0) {
    hash += `&slide=${slideIndex + 1}`;
  }
  return `${base}#${hash}`;
}

/**
 * Update the browser URL address bar to reflect current lesson/stage/slide without reloading
 */
export function syncUrlHash(
  lessonId: string | null,
  stage: number,
  slideIndex?: number
) {
  if (typeof window === 'undefined') return;
  if (!lessonId) {
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    return;
  }

  let hash = `lesson=${encodeURIComponent(lessonId)}&stage=${stage}`;
  if (stage === 4 && slideIndex !== undefined && slideIndex >= 0) {
    hash += `&slide=${slideIndex + 1}`;
  }

  // Avoid unnecessary history replacement if already matching
  const targetHash = `#${hash}`;
  if (window.location.hash !== targetHash) {
    window.history.replaceState(null, '', targetHash);
  }
}
