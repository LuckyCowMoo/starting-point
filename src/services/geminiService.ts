import {
  BespokeCanvasElement,
  LessonSequence,
  PaperCutLayer,
  PlannedLesson,
  RoutineIconType,
  SequenceObjectives,
  SlideBlueprint,
  SlideData,
} from '../types/curriculum';
import { PHASE_PALETTES, SLIDE_PRESETS } from '../data/palettes';
import {
  buildBespokeSlidePrompt,
  buildStage1Prompt,
  buildStage2Prompt,
  buildStage3BlueprintPrompt,
  buildStage4SlidesPrompt,
} from './pedagogyPrompts';

interface GeminiCallOptions {
  apiKey: string;
  model: string;
  prompt: string;
  temperature?: number;
}

async function callGeminiJson<T>({
  apiKey,
  model,
  prompt,
  temperature = 0.35,
}: GeminiCallOptions): Promise<T> {
  if (!apiKey.trim()) {
    throw new Error(
      'No Gemini API key configured. Open Settings (top right) to enter your personal Gemini API key.'
    );
  }

  const cleanModel = model.trim() || 'gemini-2.5-pro';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    cleanModel
  )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errText.slice(0, 260)}`);
  }

  const data = await response.json();
  const rawText: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('Gemini returned an empty response. Try again or check your model name.');
  }

  // Strip accidental markdown fences if any
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  return JSON.parse(cleaned) as T;
}

export async function runStage1Generation(
  apiKey: string,
  model: string,
  sequence: LessonSequence,
  targetSection?: 'know' | 'do' | 'understand' | 'keyVocabulary' | 'misconceptions',
  feedback?: string
): Promise<SequenceObjectives> {
  const prompt = buildStage1Prompt(sequence, targetSection, feedback);
  return callGeminiJson<SequenceObjectives>({ apiKey, model, prompt, temperature: 0.35 });
}

export async function runStage2Generation(
  apiKey: string,
  model: string,
  sequence: LessonSequence,
  targetLessonNumber?: number,
  feedback?: string
): Promise<PlannedLesson[]> {
  const prompt = buildStage2Prompt(sequence, targetLessonNumber, feedback);
  const res = await callGeminiJson<{ lessons: Partial<PlannedLesson>[] }>({
    apiKey,
    model,
    prompt,
    temperature: 0.4,
  });

  return (res.lessons || []).map((raw, index) => {
    const num = raw.lessonNumber ?? index + 1;
    const existing = sequence.lessons.find((l) => l.lessonNumber === num);
    const duration = raw.durationMinutes ?? sequence.defaultLessonMinutes ?? 60;
    const budget = Math.round(duration * 0.85);

    // Preserve Stage 3/4 work on untouched lessons during surgical update
    if (targetLessonNumber && num !== targetLessonNumber && existing) {
      return existing;
    }

    return {
      id: existing?.id || `lesson-${Date.now()}-${num}`,
      lessonNumber: num,
      title: raw.title || `Lesson ${num}`,
      durationMinutes: duration,
      timeBudgetMinutes: budget,
      bufferMinutes: duration - budget,
      summary: raw.summary || '',
      knowIds: raw.knowIds || [],
      doIds: raw.doIds || [],
      understandIds: raw.understandIds || [],
      starterRetrievalFocus: raw.starterRetrievalFocus || {
        q1LastLesson: 'Review key definition from previous lesson.',
        q2LastWeek: 'Recall earlier sequence concept.',
        q3EarlierTopic: 'Connect to foundational topic.',
        q4Challenge: 'Predict outcome of today’s scenario.',
      },
      activeTaskTypes: raw.activeTaskTypes || [],
      pedagogicalRationale: raw.pedagogicalRationale || '',
      stage3Approved: existing?.stage3Approved ?? false,
      slidesBlueprint: existing?.slidesBlueprint ?? [],
      slidesData: existing?.slidesData ?? [],
    };
  });
}

export async function runStage3BlueprintGeneration(
  apiKey: string,
  model: string,
  sequence: LessonSequence,
  lesson: PlannedLesson,
  targetSlideNumber?: number,
  feedback?: string
): Promise<SlideBlueprint[]> {
  const prompt = buildStage3BlueprintPrompt(sequence, lesson, targetSlideNumber, feedback);
  const res = await callGeminiJson<{ slidesBlueprint: Partial<SlideBlueprint>[] }>({
    apiKey,
    model,
    prompt,
    temperature: 0.35,
  });

  return (res.slidesBlueprint || []).map((bp, idx) => {
    const existing = lesson.slidesBlueprint[idx];
    return {
      id: existing?.id || `bp-${lesson.lessonNumber}-${idx + 1}-${Date.now()}`,
      slideNumber: bp.slideNumber ?? idx + 1,
      title: bp.title || `Slide ${idx + 1}`,
      phase: bp.phase || 'explanation',
      presetId: bp.presetId || 'split-concept-dual-code',
      allocatedMinutes: Math.max(1, Math.round(bp.allocatedMinutes ?? 5)),
      contentSummary: bp.contentSummary || '',
      pupilActivity: bp.pupilActivity || '',
      routineIcons: (bp.routineIcons as RoutineIconType[]) || [],
      conceptsIntroducedHere: bp.conceptsIntroducedHere || [],
      pedagogicalRationale: bp.pedagogicalRationale || {
        principle: 'Rosenshine Small Steps',
        cognitiveLoadNote: 'Focused single concept per slide.',
      },
    };
  });
}

export async function runStage4SlidesGeneration(
  apiKey: string,
  model: string,
  sequence: LessonSequence,
  lesson: PlannedLesson,
  targetSlideId?: string,
  feedback?: string
): Promise<SlideData[]> {
  const prompt = buildStage4SlidesPrompt(sequence, lesson, targetSlideId, feedback);
  const res = await callGeminiJson<{ slides: Partial<SlideData>[] }>({
    apiKey,
    model,
    prompt,
    temperature: 0.4,
  });

  const normalized = (res.slides || []).map((s, idx) => {
    const bp =
      lesson.slidesBlueprint.find((b) => b.id === s.blueprintId) ||
      lesson.slidesBlueprint.find((b) => b.slideNumber === s.slideNumber) ||
      lesson.slidesBlueprint[idx];
    const existing = targetSlideId
      ? lesson.slidesData.find((es) => es.id === targetSlideId)
      : lesson.slidesData[idx];

    // Strip blueprint prefixes like "Hinge Check:", "Task 1:", "Plenary:", "Activity:"
    let cleanTitle = (s.title || bp?.title || `Slide ${idx + 1}`).trim();
    cleanTitle = cleanTitle.replace(
      /^(Hinge Check|Check|Task \d+|Task|Plenary|Starter|Exit Ticket|Activity \d+|Activity)\s*[:\-–—]\s*/i,
      ''
    );

    // Let Stage 4 upgrade bad blueprint presets (e.g. vocab-single-term-focus with >1 terms -> vocabulary-spotlight)
    let chosenPreset = s.presetId || bp?.presetId || 'split-concept-dual-code';
    const termCount = s.keyTermsStrip?.length || s.bodyBlocks?.length || 0;
    if (chosenPreset === 'vocab-single-term-focus' && termCount > 1) {
      chosenPreset = 'vocabulary-spotlight';
    } else if (
      (chosenPreset === 'vocabulary-spotlight' || chosenPreset === 'vocab-words-only') &&
      termCount === 1
    ) {
      chosenPreset = 'vocab-single-term-focus';
    }

    const preset = SLIDE_PRESETS.find((p) => p.id === chosenPreset);

    // Ensure all sequential steps (Step 1, Step 2, etc.) stay on the SAME layer ('top')
    const hasSequentialSteps = (s.bodyBlocks || []).some(
      (b) =>
        b.style === 'step' ||
        /^(Step\s*\d+|\d+[\.\)])/i.test(b.heading || '') ||
        /^(Step\s*\d+|\d+[\.\)])/i.test(b.content.trim())
    );

    const cleanedBlocks = (s.bodyBlocks || []).map((b) => {
      const isStep =
        b.style === 'step' ||
        /^(Step\s*\d+|\d+[\.\)])/i.test(b.heading || '') ||
        /^(Step\s*\d+|\d+[\.\)])/i.test(b.content.trim());
      if (hasSequentialSteps && isStep && b.layer === 'bottom') {
        return { ...b, layer: 'top' as const };
      }
      return b;
    });

    return {
      id: existing?.id || `sl-${lesson.lessonNumber}-${idx + 1}-${Date.now()}`,
      blueprintId: bp?.id || s.blueprintId || `bp-${idx + 1}`,
      slideNumber: s.slideNumber ?? bp?.slideNumber ?? idx + 1,
      phase: s.phase || bp?.phase || 'explanation',
      presetId: chosenPreset,
      waveVariant: s.waveVariant || preset?.recommendedWave || 'corner-cavern-tr',
      title: cleanTitle,
      subtitle: s.subtitle,
      bigQuestion: s.bigQuestion,
      bodyBlocks: cleanedBlocks,
      starterQuadrants: s.starterQuadrants,
      keyTermsStrip: s.keyTermsStrip,
      routineIcons: s.routineIcons || bp?.routineIcons || [],
      mediaItem: existing?.mediaItem,
      timerSeconds: s.timerSeconds,
      speakerNotes: s.speakerNotes || '',
      pedagogicalBadges: bp?.pedagogicalRationale,
    } as SlideData;
  });

  if (targetSlideId && normalized.length > 0) {
    return lesson.slidesData.map((sl) => (sl.id === targetSlideId ? normalized[0] : sl));
  }
  return normalized;
}

export async function runBespokeSlideDesign(
  apiKey: string,
  model: string,
  sequence: LessonSequence,
  lesson: PlannedLesson,
  slide: SlideData,
  customRequest: string
): Promise<SlideData> {
  const prompt = buildBespokeSlidePrompt(sequence, lesson, slide, customRequest);
  const res = await callGeminiJson<{
    title: string;
    subtitle?: string;
    phase: SlideData['phase'];
    routineIcons: RoutineIconType[];
    timerSeconds?: number;
    speakerNotes: string;
    customWaveLayers: PaperCutLayer[];
    customCanvasElements: BespokeCanvasElement[];
  }>({
    apiKey,
    model,
    prompt,
    temperature: 0.55,
  });

  const palette = PHASE_PALETTES[res.phase || slide.phase];
  // Ensure layers use crisp palette fallback colors if missing
  const safeLayers = (res.customWaveLayers || []).map((layer, idx) => ({
    ...layer,
    id: layer.id || `cw-${idx}`,
    color: layer.color || palette.layers[idx % palette.layers.length],
  }));

  return {
    ...slide,
    presetId: 'custom',
    phase: res.phase || slide.phase,
    title: res.title || slide.title,
    subtitle: res.subtitle ?? slide.subtitle,
    routineIcons: res.routineIcons || slide.routineIcons,
    timerSeconds: res.timerSeconds ?? slide.timerSeconds,
    speakerNotes: res.speakerNotes || slide.speakerNotes,
    customWaveLayers: safeLayers,
    customCanvasElements: res.customCanvasElements || [],
  };
}

export function extractJsonFromLlmResponse<T>(rawText: string): T {
  const cleaned = rawText
    .replace(/^\uFEFF/, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;
  if (firstBrace >= 0 && firstBracket >= 0) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else {
    startIdx = Math.max(firstBrace, firstBracket);
  }

  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const endIdx = Math.max(lastBrace, lastBracket);

  const slice =
    startIdx >= 0 && endIdx >= startIdx
      ? cleaned.slice(startIdx, endIdx + 1)
      : cleaned;

  return JSON.parse(slice) as T;
}

export function parseStage1Response(rawText: string): SequenceObjectives {
  const parsed = extractJsonFromLlmResponse<Partial<SequenceObjectives>>(rawText);
  return {
    know: Array.isArray(parsed.know) ? parsed.know : [],
    do: Array.isArray(parsed.do) ? parsed.do : [],
    understand: Array.isArray(parsed.understand) ? parsed.understand : [],
    keyVocabulary: Array.isArray(parsed.keyVocabulary) ? parsed.keyVocabulary : [],
    misconceptions: Array.isArray(parsed.misconceptions) ? parsed.misconceptions : [],
    prerequisiteKnowledge: Array.isArray(parsed.prerequisiteKnowledge)
      ? parsed.prerequisiteKnowledge
      : [],
    pedagogicalSummary: parsed.pedagogicalSummary || '',
  };
}

export function parseStage2Response(
  rawText: string,
  sequence: LessonSequence
): PlannedLesson[] {
  const res = extractJsonFromLlmResponse<
    { lessons?: Partial<PlannedLesson>[] } | Partial<PlannedLesson>[]
  >(rawText);
  const rawLessons = Array.isArray(res) ? res : res.lessons || [];
  if (rawLessons.length === 0) {
    throw new Error('JSON response did not contain a non-empty "lessons" array.');
  }

  return rawLessons.map((l, idx) => {
    const existing = sequence.lessons[idx];
    const durationMinutes =
      l.durationMinutes || existing?.durationMinutes || sequence.defaultLessonMinutes;
    const timeBudgetMinutes = Math.round(durationMinutes * 0.85);
    const bufferMinutes = durationMinutes - timeBudgetMinutes;
    return {
      id: existing?.id || `lesson-${Date.now()}-${idx + 1}`,
      lessonNumber: l.lessonNumber || idx + 1,
      title: l.title || existing?.title || `Lesson ${idx + 1}`,
      durationMinutes,
      timeBudgetMinutes,
      bufferMinutes,
      summary: l.summary || existing?.summary || '',
      knowIds: l.knowIds || [],
      doIds: l.doIds || [],
      understandIds: l.understandIds || [],
      starterRetrievalFocus: l.starterRetrievalFocus || {
        q1LastLesson: '',
        q2LastWeek: '',
        q3EarlierTopic: '',
        q4Challenge: '',
      },
      activeTaskTypes: l.activeTaskTypes || [],
      pedagogicalRationale: l.pedagogicalRationale || '',
      stage3Approved: existing?.stage3Approved ?? false,
      slidesBlueprint: existing?.slidesBlueprint || [],
      slidesData: existing?.slidesData || [],
    };
  });
}

export function parseStage3BlueprintResponse(rawText: string): SlideBlueprint[] {
  const res = extractJsonFromLlmResponse<
    { slidesBlueprint?: Partial<SlideBlueprint>[] } | Partial<SlideBlueprint>[]
  >(rawText);
  const rawList = Array.isArray(res) ? res : res.slidesBlueprint || [];
  if (rawList.length === 0) {
    throw new Error('JSON response did not contain a non-empty "slidesBlueprint" array.');
  }

  return rawList.map((bp, idx) => ({
    id: bp.id || `bp-${Date.now()}-${idx + 1}`,
    slideNumber: bp.slideNumber || idx + 1,
    title: bp.title || `Slide ${idx + 1}`,
    phase: bp.phase || 'explanation',
    presetId: bp.presetId || 'split-concept-dual-code',
    allocatedMinutes: Math.max(1, Number(bp.allocatedMinutes) || 5),
    contentSummary: bp.contentSummary || '',
    pupilActivity: bp.pupilActivity || '',
    routineIcons: bp.routineIcons || ['write-in-books'],
    conceptsIntroducedHere: bp.conceptsIntroducedHere || [],
    pedagogicalRationale: bp.pedagogicalRationale || {
      principle: 'Rosenshine Small Steps',
      cognitiveLoadNote: 'Chunked core content',
    },
  }));
}

const GENERIC_HEADINGS_REGEX = /^(?:key concept|core concept|concept|activity focus|pupil activity|teacher explanation|explanation|summary|overview|main point|lesson content|key takeaway|key idea)[:.\s]*$/i;

function cleanStarterQuestionPrefix(q: string): string {
  return (q || '')
    .replace(
      /^(?:from\s+(?:your\s+)?(?:previous|prior)\s+unit(?:\s+on\s+[^:]+)?|from\s+ks[1-5][^:]*|prior\s+unit|lesson\s+\d+|last\s+(?:lesson|week))\s*[:\-—]\s*/i,
      ''
    )
    .replace(/^([a-z])/, (m) => m.toUpperCase())
    .trim();
}

export function parseStage4SlidesResponse(
  rawText: string,
  lesson: PlannedLesson,
  targetSlideId?: string
): SlideData[] {
  const res = extractJsonFromLlmResponse<
    { slides?: Partial<SlideData>[] } | Partial<SlideData>[]
  >(rawText);
  const incoming = Array.isArray(res) ? res : res.slides || [];
  if (incoming.length === 0) {
    throw new Error('JSON response did not contain a non-empty "slides" array.');
  }

  const normalizedIncoming: SlideData[] = incoming.map((s, idx) => {
    const bp =
      lesson.slidesBlueprint.find((b) => b.id === s.blueprintId) ||
      lesson.slidesBlueprint.find((b) => b.slideNumber === s.slideNumber) ||
      lesson.slidesBlueprint[idx];
    const presetId = s.presetId || bp?.presetId || 'split-concept-dual-code';
    const phase = s.phase || bp?.phase || 'explanation';
    const preset = SLIDE_PRESETS.find((p) => p.id === presetId);
    const waveVariant =
      s.waveVariant ||
      preset?.recommendedWave ||
      (presetId === 'mwb-starter-quadrant'
        ? 'top-bottom-strata'
        : presetId === 'lesson-title-page'
        ? 'vertical-scurve-right'
        : 'corner-cavern-tr');

    const cleanedBlocks = (s.bodyBlocks || []).map((b) => ({
      ...b,
      style: b.style === 'card' ? 'plain' : b.style || 'plain',
      heading:
        b.heading && !GENERIC_HEADINGS_REGEX.test(b.heading.trim())
          ? b.heading
          : '',
    }));

    const cleanedQuads = s.starterQuadrants?.map((q, qIdx) => ({
      ...q,
      label: String(qIdx + 1),
      question: cleanStarterQuestionPrefix(q.question),
    }));

    const palette = PHASE_PALETTES[phase];
    const safeCustomLayers = s.customWaveLayers?.map((layer, lIdx) => ({
      ...layer,
      id: layer.id || `cw-${lIdx}`,
      color: layer.color || palette.layers[lIdx % palette.layers.length],
    }));

    return {
      id: targetSlideId && idx === 0 ? targetSlideId : s.id || `slide-${Date.now()}-${idx + 1}`,
      blueprintId: bp?.id || s.blueprintId || `bp-${idx + 1}`,
      slideNumber: targetSlideId ? s.slideNumber || bp?.slideNumber || idx + 1 : idx + 1,
      phase,
      presetId,
      waveVariant,
      invertWaveLayers: s.invertWaveLayers,
      title: s.title || bp?.title || `Slide ${idx + 1}`,
      lessonDate: s.lessonDate,
      bigQuestion: s.bigQuestion,
      bodyBlocks: cleanedBlocks,
      starterQuadrants: cleanedQuads,
      keyTermsStrip: s.keyTermsStrip,
      mediaItem: s.mediaItem,
      customCanvasElements: s.customCanvasElements,
      customWaveLayers: safeCustomLayers,
      routineIcons: s.routineIcons || bp?.routineIcons || ['write-in-books'],
      timerSeconds: s.timerSeconds,
      speakerNotes: s.speakerNotes || '',
      teacherDesignNote: s.teacherDesignNote,
      pedagogicalBadges: bp?.pedagogicalRationale,
    };
  });

  if (targetSlideId && normalizedIncoming.length > 0) {
    return lesson.slidesData.map((existing) =>
      existing.id === targetSlideId ? normalizedIncoming[0] : existing
    );
  }
  return normalizedIncoming;
}

export function parseBespokeSlideResponse(
  rawText: string,
  slide: SlideData
): SlideData {
  const res = extractJsonFromLlmResponse<{
    title?: string;
    phase?: SlideData['phase'];
    routineIcons?: SlideData['routineIcons'];
    timerSeconds?: number;
    speakerNotes?: string;
    customWaveLayers?: PaperCutLayer[];
    customCanvasElements?: BespokeCanvasElement[];
  }>(rawText);

  const palette = PHASE_PALETTES[res.phase || slide.phase];
  const safeLayers = (res.customWaveLayers || []).map((layer, idx) => ({
    ...layer,
    id: layer.id || `cw-${idx}`,
    color: layer.color || palette.layers[idx % palette.layers.length],
  }));

  return {
    ...slide,
    presetId: 'custom',
    phase: res.phase || slide.phase,
    title: res.title || slide.title,
    routineIcons: res.routineIcons || slide.routineIcons,
    timerSeconds: res.timerSeconds ?? slide.timerSeconds,
    speakerNotes: res.speakerNotes || slide.speakerNotes,
    customWaveLayers: safeLayers,
    customCanvasElements: res.customCanvasElements || [],
  };
}
