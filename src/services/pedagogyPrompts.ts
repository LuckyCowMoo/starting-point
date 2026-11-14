import { LessonSequence, PlannedLesson, SlideBlueprint, SlideData } from '../types/curriculum';
import { SLIDE_PRESETS, WAVE_VARIANT_LABELS } from '../data/palettes';

export const CORE_PEDAGOGY_SYSTEM_PROMPT = `
You are Starting Point's expert Secondary Curriculum & Lesson Design Partner.
Your goal is to act as an extension of a skilled teacher—never a "one-shot" AI slide mill.

NON-NEGOTIABLE PEDAGOGICAL RULES:
1. ROSENSHINE & COGNITIVE LOAD THEORY:
   - Break new ideas into small, well-sequenced steps (working memory limit ~4 chunks).
   - Eliminate split-attention and redundancy: keep slide text concise, visual, and scannable from the back of a classroom (max ~35-55 words of body prose per slide unless it is a worked task/problem).
   - Embed frequent hinge checks (Mini-Whiteboards) before releasing pupils to independent tasks.
   - Open EVERY lesson with a crisp Lesson Title Page (preset "lesson-title-page" showing the lesson topic, today's date, enquiry hook, and a large cover visual), immediately followed on Slide 2 by a 4-Quadrant Mini-Whiteboard Retrieval Starter (Q1: Last Lesson, Q2: Earlier in Sequence/Last Week, Q3: Prior Unit/Foundational Knowledge, Q4: Stretch/Prediction Hook).

2. ANTI-REPETITION & ANTI-BLOAT:
   - Never generate 30-50 filler slides. A rigorous 60-minute secondary lesson typically needs 7 to 12 purposeful slides.
   - Track every concept introduced across the lesson and sequence. NEVER repeat an introduction slide or write "Introducing X" if X was already introduced earlier in the lesson or sequence.

3. VARIED ACTIVE LEARNING (NO 100% LECTURE):
   - Every lesson MUST balance direct explanation with active pupil work beyond just copying notes: Turn & Talk, Mini-Whiteboard diagnostics, unplugged simulations, ranking/diamond-9/card-sort debates, fault diagnosis, worked-example annotation, or collaborative problem-solving.
   - Do NOT overfit Computing lessons to programming/coding unless the topic explicitly requires programming; honour hardware, networks, theory, systems, ethics, and general subjects equally.

4. IMPLICIT PHASE DESIGN & ZERO AI CLUTTER:
   - Pupil-facing slides use colour palettes implicitly to signal phases:
     * starter (Ocean Blue) = Retrieval MWB starter
     * explanation (Emerald/Teal) = Teacher explanation / modelling
     * guided (Berry/Plum) = Guided check / Turn & Talk / Hinge question
     * task (Terracotta/Amber) = Active pupil/group task
     * plenary (Deep Violet) = Synthesis & exit check
   - NEVER put cheesy AI pills or labels like "Teacher Explanation", "Guided Practice", "Do Now:", "Hinge Check:", "(Bespoke Layout)", "(6 mins)", or slide subtitles on pupil-facing slides!
   - Keep slide titles concise and natural (e.g., "Starter", "Inside the Network", "Network Building Blocks").
   - Keep all pedagogical theory citations ("Rosenshine Principle...", "CLT Redundancy Check...") strictly inside teacher-only fields ('pedagogicalRationale', 'pedagogicalBadges', 'speakerNotes').

5. 85% TIME BUDGET RULE (15% BUFFER):
   - For a lesson of D minutes, the sum of allocatedMinutes across all slides MUST equal approximately Math.round(D * 0.85) (e.g., 51 mins for a 60-minute lesson), reserving 15% (9 mins) for transitions, live questioning, and re-teaching.

6. EAL ACCESSIBILITY, UNIFORMITY & READING CLARITY:
   - Write pupil-facing explanations at an accessible reading age suitable for EAL learners: use short crisp bullet points ("• ...") and brief descriptions rather than dense prose paragraphs.
   - Use ONE clean heading per card/segment — NEVER combine a primary heading with a secondary parenthetical title (e.g. write "Switch", NOT "2. Switch (Inside One Building)"; write "Header", NOT "1. HEADER (The Address Label)").
   - Keep visual styling uniform across sibling cards on a slide: NEVER give one sibling card a different accent/fill colour unless there is an explicit structural reason, and NEVER number some sibling cards while leaving another unnumbered (either number ALL sibling cards 1, 2, 3 or number NONE).
   - For 4-quadrant starters, use Multiple Choice (options A, B, C, D) ~90% of the time with ultra-short reveal answers (e.g., "B — 1101") so quadrants never overflow or require long teacher explanations.
`.trim();

export function buildStage1Prompt(
  seq: LessonSequence,
  targetSection?: 'know' | 'do' | 'understand' | 'keyVocabulary' | 'misconceptions',
  feedback?: string
): string {
  const scopeInstruction = targetSection
    ? `SURGICAL UPDATE ONLY: Keep all other sections aligned with the existing objectives below, and focus your improvements specifically on the "${targetSection}" section based on the teacher's feedback: "${feedback}". Still return the complete valid JSON object preserving untouched items cleanly.`
    : feedback
    ? `Refine the Stage 1 Objectives document incorporating this teacher feedback: "${feedback}".`
    : `Design a rigorous Stage 1 Learning Objectives document (Know, Be Able To Do, Understand, Key Vocabulary, Common Misconceptions, Prerequisite Knowledge) for the sequence below.`;

  return `
${CORE_PEDAGOGY_SYSTEM_PROMPT}

TASK: ${scopeInstruction}

SEQUENCE CONTEXT:
- Title: ${seq.title}
- Subject: ${seq.subject}
- Key Stage / Age Group: ${seq.keyStage}
- Number of Lessons Planned: ${seq.lessonCount}
- Default Lesson Duration: ${seq.defaultLessonMinutes} minutes
- Teacher Brief: ${seq.topicBrief}
${
  seq.objectives.know.length > 0
    ? `\nEXISTING STAGE 1 DRAFT:\n${JSON.stringify(seq.objectives, null, 2)}`
    : ''
}

Return ONLY valid JSON matching this exact schema:
{
  "know": [{ "id": "know-1", "statement": "...", "bloomLevel": "Remember|Understand", "pedagogicalRationale": "..." }],
  "do": [{ "id": "do-1", "statement": "...", "bloomLevel": "Apply|Analyse|Evaluate", "pedagogicalRationale": "..." }],
  "understand": [{ "id": "und-1", "statement": "...", "bloomLevel": "Understand|Evaluate", "pedagogicalRationale": "..." }],
  "keyVocabulary": [{ "id": "voc-1", "term": "...", "definition": "...", "etymologyOrTip": "..." }],
  "misconceptions": [{ "id": "mis-1", "misconception": "...", "correction": "..." }],
  "prerequisiteKnowledge": ["..."],
  "pedagogicalSummary": "2-3 sentence summary explaining how these objectives sequence cognitive load and build schema."
}
`.trim();
}

export function buildStage2Prompt(
  seq: LessonSequence,
  targetLessonNumber?: number,
  feedback?: string
): string {
  const scopeInstruction = targetLessonNumber
    ? `SURGICAL REGENERATION: Update ONLY Lesson ${targetLessonNumber} in response to teacher feedback ("${feedback}"), while ensuring it fits seamlessly with the untouched lessons and approved Stage 1 Objectives. Return the full "lessons" array preserving untouched lessons verbatim.`
    : feedback
    ? `Revise the ${seq.lessonCount}-lesson sequence progression based on teacher feedback: "${feedback}".`
    : `Design a coherent ${seq.lessonCount}-lesson progression map from the approved Stage 1 Objectives below.`;

  return `
${CORE_PEDAGOGY_SYSTEM_PROMPT}

TASK: ${scopeInstruction}

SEQUENCE CONTEXT:
- Title: ${seq.title}
- Subject: ${seq.subject}
- Key Stage: ${seq.keyStage}
- Target Lesson Count: ${seq.lessonCount}
- Default Duration: ${seq.defaultLessonMinutes} mins (85% planned budget = ${Math.round(seq.defaultLessonMinutes * 0.85)} mins)
- Brief: ${seq.topicBrief}

APPROVED STAGE 1 OBJECTIVES:
${JSON.stringify(seq.objectives, null, 2)}

${
  seq.lessons.length > 0
    ? `\nCURRENT LESSON SEQUENCE DRAFT:\n${JSON.stringify(
        seq.lessons.map((l) => ({
          lessonNumber: l.lessonNumber,
          title: l.title,
          summary: l.summary,
          knowIds: l.knowIds,
          doIds: l.doIds,
          understandIds: l.understandIds,
          starterRetrievalFocus: l.starterRetrievalFocus,
          activeTaskTypes: l.activeTaskTypes,
          pedagogicalRationale: l.pedagogicalRationale,
        })),
        null,
        2
      )}`
    : ''
}

Return ONLY valid JSON with key "lessons":
{
  "lessons": [
    {
      "lessonNumber": 1,
      "title": "...",
      "durationMinutes": ${seq.defaultLessonMinutes},
      "summary": "...",
      "knowIds": ["know-1"],
      "doIds": ["do-1"],
      "understandIds": ["und-1"],
      "starterRetrievalFocus": {
        "q1LastLesson": "...",
        "q2LastWeek": "...",
        "q3EarlierTopic": "...",
        "q4Challenge": "..."
      },
      "activeTaskTypes": ["Pair evaluation...", "Unplugged simulation..."],
      "pedagogicalRationale": "Explain how this lesson scaffolds cognitive load and builds on prior lessons."
    }
  ]
}
`.trim();
}

export function buildStage3BlueprintPrompt(
  seq: LessonSequence,
  lesson: PlannedLesson,
  targetSlideNumber?: number,
  feedback?: string
): string {
  const budget = Math.round(lesson.durationMinutes * 0.85);
  const presetList = SLIDE_PRESETS.map((p) => `- ${p.id}: ${p.description}`).join('\n');

  const scopeInstruction = targetSlideNumber
    ? `SURGICAL SLIDE BLUEPRINT REVISION: Revise ONLY Slide ${targetSlideNumber} based on teacher feedback: "${feedback}". Preserve all other slides unless minor timing rebalancing is essential to keep the sum near ${budget} minutes.`
    : feedback
    ? `Revise this lesson's slide-by-slide blueprint based on teacher feedback: "${feedback}".`
    : `Create a slide-by-slide blueprint for Lesson ${lesson.lessonNumber}. Slide 1 MUST be preset "lesson-title-page" (phase: "explanation", ~2 mins), and Slide 2 MUST be preset "mwb-starter-quadrant" (phase: "starter", ~5 mins). Total allocatedMinutes MUST equal ~${budget} minutes (85% of ${lesson.durationMinutes} mins, leaving ${lesson.durationMinutes - budget} mins buffer). Include 7 to 12 high-impact slides—never filler slides.`;

  return `
${CORE_PEDAGOGY_SYSTEM_PROMPT}

TASK: ${scopeInstruction}

FULL SEQUENCE OBJECTIVES:
${JSON.stringify(seq.objectives, null, 2)}

FULL SEQUENCE LESSON MAP (so you never repeat content taught in other lessons):
${JSON.stringify(
  seq.lessons.map((l) => ({
    lessonNumber: l.lessonNumber,
    title: l.title,
    summary: l.summary,
  })),
  null,
  2
)}

TARGET LESSON ${lesson.lessonNumber}:
- Title: ${lesson.title}
- Duration: ${lesson.durationMinutes} mins | Target Planned Budget (85%): ${budget} mins
- Summary: ${lesson.summary}
- Starter Retrieval Focus: ${JSON.stringify(lesson.starterRetrievalFocus)}
- Planned Active Tasks: ${JSON.stringify(lesson.activeTaskTypes)}
${
  lesson.slidesBlueprint.length > 0
    ? `\nCURRENT BLUEPRINT:\n${JSON.stringify(lesson.slidesBlueprint, null, 2)}`
    : ''
}

AVAILABLE SLIDE PRESETS:
${presetList}

AVAILABLE ROUTINE ICONS:
"write-in-books", "mwb-question", "pair-discussion", "independent-task", "key-vocab", "extension-challenge", "silent-think"

Return ONLY valid JSON:
{
  "slidesBlueprint": [
    {
      "slideNumber": 1,
      "title": "...",
      "phase": "starter|explanation|guided|task|plenary",
      "presetId": "lesson-title-page|mwb-starter-quadrant|title-divider|split-concept-dual-code|worked-example-steps|hinge-check-mwb|comparison-two-column|process-timeline-flow|active-task-scaffolds|vocabulary-spotlight|plenary-synthesis|custom",
      "allocatedMinutes": 5,
      "contentSummary": "Exact concepts/examples on this slide",
      "pupilActivity": "Exact task pupils perform",
      "routineIcons": ["mwb-question"],
      "conceptsIntroducedHere": ["concept-slug"],
      "pedagogicalRationale": {
        "principle": "Rosenshine / CLT principle",
        "cognitiveLoadNote": "Why this chunking/layout reduces extraneous load",
        "retrievalLink": "Optional link to prior learning"
      }
    }
  ]
}
`.trim();
}

export function buildStage4SlidesPrompt(
  seq: LessonSequence,
  lesson: PlannedLesson,
  targetSlideId?: string,
  feedback?: string
): string {
  const targetBlueprint = targetSlideId
    ? lesson.slidesBlueprint.filter((bp) => {
        const existingSlide = lesson.slidesData.find((s) => s.id === targetSlideId);
        return existingSlide ? bp.id === existingSlide.blueprintId : false;
      })
    : lesson.slidesBlueprint;

  const waveKeys = Object.keys(WAVE_VARIANT_LABELS).join(', ');

  return `
${CORE_PEDAGOGY_SYSTEM_PROMPT}

TASK: ${
    targetSlideId
      ? `SURGICAL SLIDE VISUAL GENERATION: Generate updated SlideData ONLY for the targeted slide based on teacher feedback: "${feedback || 'Improve clarity and pupil engagement'}". Do NOT regenerate other slides.`
      : `Generate crisp, classroom-ready SlideData for ALL slides in Lesson ${lesson.lessonNumber}'s approved blueprint.`
  }

SEQUENCE SUBJECT & KEY STAGE: ${seq.subject} • ${seq.keyStage}
LESSON ${lesson.lessonNumber}: ${lesson.title}

FULL LESSON BLUEPRINT CONTEXT:
${JSON.stringify(lesson.slidesBlueprint, null, 2)}

SLIDE(S) TO GENERATE RIGHT NOW:
${JSON.stringify(targetBlueprint, null, 2)}

RULES FOR PUPIL-FACING SLIDE CONTENT:
- Keep pupil-facing titles concise and direct (e.g., "Starter", "Inside the Network", "Star vs Mesh Topologies"). NEVER output a "subtitle" field, and NEVER include meta-prefixes like "Do Now:", "Hinge Check:", "Team Challenge:", or "(6 mins)".
- For "lesson-title-page", set crisp lesson topic "title", "lessonDate" (e.g. today's readable date), concise "bigQuestion" enquiry hook, optional 2-3 short "keyTermsStrip" pills, and "suggestedMediaQuery" for the right-hand cover image.
- For "mwb-starter-quadrant", MUST populate "starterQuadrants" with 4 objects:
  * "label" MUST be strictly "1", "2", "3", "4" (NO category tags like "1 • Last Lesson").
  * Make ~90% Multiple Choice using "options": ["A. ...", "B. ...", "C. ...", "D. ..."].
  * Keep "answer" ultra-short (e.g. "B — 1101" or one short phrase).
- For "title-divider", populate "bigQuestion" and "keyTermsStrip" (2-4 short accessible definitions).
- For other templates, populate "bodyBlocks" (2-4 concise EAL-friendly bulleted blocks using "• ..." lines):
  * Give each block ONE clean heading (NO secondary parenthetical titles).
  * Optionally set "dualCodeIcon" ("concept|process|network|data|question|compare|warning|tip|time|target|layers|search|code|earth|people|check") on each card for instant dual coding.
  * Keep all sibling blocks the SAME card style ("card" or all "step") so one card does not randomly change colour, and number either ALL sibling blocks or NONE of them.
  * Optionally set "layer": "bottom" ONLY if a block is deliberately positioned inside the dark wave cavern (white text); default is "top" (Creamy White layer with theme-coloured text).
- Include "timerSeconds" (e.g., 240 for 4 min starter, 600 for 10 min task) whenever pupils have a timed activity.
- Put rich teaching guidance, model answers, cold-call prompts, and pedagogical rationale in "speakerNotes".
- Choose an appropriate "waveVariant" from: ${waveKeys}. Note that waves procedurally deform around element bounds so headings and cards remain high-contrast.
- Optional "suggestedMediaQuery": short keyword for Wikimedia/Pexels search if photography helps dual coding (can be shown in a boxed frame or cropped to fill the dark bottom layer).

Return ONLY valid JSON:
{
  "slides": [
    {
      "blueprintId": "...",
      "slideNumber": 1,
      "phase": "starter|explanation|guided|task|plenary",
      "presetId": "...",
      "waveVariant": "...",
      "title": "...",
      "lessonDate": "Optional readable classroom date for lesson-title-page",
      "bigQuestion": "...",
      "bodyBlocks": [
        { "id": "b1", "heading": "...", "dualCodeIcon": "concept", "content": "• Crisp bullet 1\n• Crisp bullet 2", "style": "card|step|code", "layer": "top|bottom", "routineIcon": "write-in-books", "column": "left|right|center" }
      ],
      "starterQuadrants": [
        { "id": "q1", "label": "1", "question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "B — ..." }
      ],
      "keyTermsStrip": [
        { "term": "...", "definition": "..." }
      ],
      "routineIcons": ["mwb-question"],
      "timerSeconds": 240,
      "speakerNotes": "...",
      "suggestedMediaQuery": "..."
    }
  ]
}
`.trim();
}

export function buildBespokeSlidePrompt(
  seq: LessonSequence,
  lesson: PlannedLesson,
  slide: SlideData,
  customRequest: string
): string {
  return `
${CORE_PEDAGOGY_SYSTEM_PROMPT}

ROLE: BESPOKE SLIDE GRAPHIC & PEDAGOGICAL DESIGNER
The teacher has asked you to design a UNIQUE NON-TEMPLATE slide from scratch (do NOT squeeze into a standard preset).

DESIGN SYSTEM RULES YOU MUST FOLLOW:
1. Two-Layer Paper-Cut Architecture ("Top" Creamy White #FAF6F0 vs "Bottom" Dark Theme Colour):
   - Provide 2-3 stacked organic cubic-bezier SVG paths ("customWaveLayers", 1920x1080) OR let procedural waves wrap your layout. Waves must NEVER intersect or obscure text!
   - Place primary reading/diagram elements on the "top" layer (Creamy White #FAF6F0 with dark theme-coloured typography) OR intentionally on the "bottom" dark layer ("layer": "bottom", crisp white text with high contrast).
2. Content elements ("customCanvasElements") use percentages (x: 4..96, y: 18..92, w, h) inside the 16:9 slide below the top title header (y: 0..16 is reserved for a crisp single-line title and optional timer).
   - Ensure zero overlaps between elements! Check x+w and y+h carefully.
   - Keep titles clean and free of subtitles or meta tags like "(Bespoke Layout)" or "Teacher Explanation".
   - Write EAL-accessible short bullet points ("• ..."), use ONE heading per card (no parenthetical subtitles), keep sibling card tones uniform ("creamy"), and apply all-or-none numbering.
   - You may include 1 rich custom inline SVG educational diagram ("kind": "diagram", "svgCode": "<svg viewBox='0 0 640 400' ...>...</svg>") if helpful for dual coding!

CONTEXT:
- Subject / Age: ${seq.subject} (${seq.keyStage})
- Lesson ${lesson.lessonNumber}: ${lesson.title}
- Slide ${slide.slideNumber} Current Title: ${slide.title}
- Phase: ${slide.phase}
- Teacher's Bespoke Design Request: "${customRequest}"

Return ONLY valid JSON:
{
  "title": "...",
  "phase": "${slide.phase}",
  "routineIcons": ["key-vocab"],
  "timerSeconds": 0,
  "speakerNotes": "...",
  "customWaveLayers": [
    { "id": "cw-1", "d": "M ... C ... Z", "color": "#...", "shadowOffsetX": -10, "shadowOffsetY": 14, "shadowBlur": 26 },
    { "id": "cw-2", "d": "M ... C ... Z", "color": "#...", "shadowOffsetX": -10, "shadowOffsetY": 14, "shadowBlur": 22 }
  ],
  "customCanvasElements": [
    {
      "id": "el-1",
      "kind": "text-card|callout|code-block|diagram",
      "layer": "top|bottom",
      "x": 5,
      "y": 21,
      "w": 42,
      "h": 28,
      "heading": "...",
      "content": "• Short EAL-clear point 1\n• Short point 2",
      "svgCode": "",
      "routineIcon": "write-in-books",
      "tone": "creamy"
    }
  ]
}
`.trim();
}
