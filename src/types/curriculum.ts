export type StageId = 1 | 2 | 3 | 4;

export type LessonPhase =
  | 'starter'
  | 'explanation'
  | 'guided'
  | 'task'
  | 'plenary';

export type RoutineIconType =
  | 'write-in-books'
  | 'mwb-question'
  | 'pair-discussion'
  | 'independent-task'
  | 'key-vocab'
  | 'extension-challenge'
  | 'silent-think';

export type SlidePresetId =
  | 'lesson-title-page'
  | 'title-divider'
  | 'mwb-starter-quadrant'
  | 'split-concept-dual-code'
  | 'worked-example-steps'
  | 'hinge-check-mwb'
  | 'comparison-two-column'
  | 'process-timeline-flow'
  | 'active-task-scaffolds'
  | 'vocabulary-spotlight'
  | 'plenary-synthesis'
  | 'custom';

export type WaveVariant =
  | 'corner-cavern-tr'
  | 'corner-cavern-br'
  | 'vertical-scurve-left'
  | 'vertical-scurve-right'
  | 'top-bottom-strata'
  | 'island-cutout-right'
  | 'diagonal-surge'
  | 'bottom-undulation'
  | 'framed-halo'
  | 'dual-ribbon'
  | 'dark-canvas-left-paper'
  | 'dark-canvas-bottom-paper'
  | 'dark-halo-spotlight';

export interface PhasePalette {
  phase: LessonPhase;
  name: string;
  pupilSignal: string;
  creamyWhite: string;
  darkInk: string;
  mutedInk: string;
  /** Ordered from back/outer wave layer [0] to deepest/inner cavern or foreground [3] */
  layers: [string, string, string, string];
  accent: string;
  softSurface: string;
  borderAccent: string;
}

export interface ObjectiveItem {
  id: string;
  statement: string;
  bloomLevel: string;
  pedagogicalRationale: string;
}

export interface VocabItem {
  id: string;
  term: string;
  definition: string;
  etymologyOrTip: string;
}

export interface MisconceptionItem {
  id: string;
  misconception: string;
  correction: string;
}

export interface SequenceObjectives {
  know: ObjectiveItem[];
  do: ObjectiveItem[];
  understand: ObjectiveItem[];
  keyVocabulary: VocabItem[];
  misconceptions: MisconceptionItem[];
  prerequisiteKnowledge: string[];
  pedagogicalSummary: string;
}

export interface StarterQuadrant {
  id: 'q1' | 'q2' | 'q3' | 'q4';
  label: string;
  question: string;
  options?: [string, string, string, string];
  answer: string;
}

export type DualCodeIconId =
  | 'concept'
  | 'process'
  | 'network'
  | 'data'
  | 'question'
  | 'compare'
  | 'warning'
  | 'tip'
  | 'time'
  | 'target'
  | 'layers'
  | 'search'
  | 'code'
  | 'earth'
  | 'people'
  | 'check';

export interface SlideTextBlock {
  id: string;
  heading?: string;
  content: string;
  style?: 'card' | 'highlight' | 'step' | 'code' | 'list-item' | 'challenge';
  layer?: 'top' | 'bottom';
  routineIcon?: RoutineIconType;
  dualCodeIcon?: DualCodeIconId;
  column?: 'left' | 'right' | 'center';
}

export interface SlideMediaItem {
  id: string;
  type: 'image' | 'svg-diagram';
  title: string;
  url?: string;
  svgCode?: string;
  attribution?: string;
  caption?: string;
  cropFit: 'cover' | 'contain';
  frameShape: 'rounded-card' | 'organic-blob' | 'circle' | 'clean';
  placement?: 'fill-bottom-layer' | 'boxed-card';
}

export interface PaperCutLayer {
  id: string;
  d: string; // SVG path in 1920x1080 coordinate space
  color: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowBlur?: number;
  opacity?: number;
}

export interface BespokeCanvasElement {
  id: string;
  kind: 'text-card' | 'heading' | 'code-block' | 'diagram' | 'badge' | 'callout';
  x: number; // percentage 0..100
  y: number; // percentage 0..100
  w: number; // percentage 0..100
  h: number; // percentage 0..100
  heading?: string;
  content: string;
  svgCode?: string;
  routineIcon?: RoutineIconType;
  layer?: 'top' | 'bottom';
  tone?: 'creamy' | 'tinted' | 'dark' | 'accent';
}

export interface PedagogicalRationale {
  principle: string;
  cognitiveLoadNote: string;
  retrievalLink?: string;
}

export interface SlideBlueprint {
  id: string;
  slideNumber: number;
  title: string;
  phase: LessonPhase;
  presetId: SlidePresetId;
  allocatedMinutes: number;
  contentSummary: string;
  pupilActivity: string;
  routineIcons: RoutineIconType[];
  conceptsIntroducedHere: string[];
  pedagogicalRationale: PedagogicalRationale;
}

export interface SlideData {
  id: string;
  blueprintId: string;
  slideNumber: number;
  phase: LessonPhase;
  presetId: SlidePresetId;
  waveVariant: WaveVariant;
  invertWaveLayers?: boolean;
  title: string;
  lessonDate?: string;
  subtitle?: string;
  bigQuestion?: string;
  bodyBlocks: SlideTextBlock[];
  starterQuadrants?: StarterQuadrant[];
  routineIcons: RoutineIconType[];
  keyTermsStrip?: { term: string; definition: string }[];
  mediaItem?: SlideMediaItem;
  customCanvasElements?: BespokeCanvasElement[];
  customWaveLayers?: PaperCutLayer[];
  waveControlPoints?: { x: number; y: number }[];
  timerSeconds?: number;
  speakerNotes: string;
  pedagogicalBadges?: PedagogicalRationale;
}

export interface PlannedLesson {
  id: string;
  lessonNumber: number;
  title: string;
  durationMinutes: number;
  timeBudgetMinutes: number; // 85% of durationMinutes
  bufferMinutes: number; // 15% of durationMinutes
  summary: string;
  knowIds: string[];
  doIds: string[];
  understandIds: string[];
  starterRetrievalFocus: {
    q1LastLesson: string;
    q2LastWeek: string;
    q3EarlierTopic: string;
    q4Challenge: string;
  };
  activeTaskTypes: string[];
  pedagogicalRationale: string;
  stage3Approved: boolean;
  slidesBlueprint: SlideBlueprint[];
  slidesData: SlideData[];
}

export interface LessonSequence {
  id: string;
  folderId: string;
  title: string;
  subject: string;
  keyStage: string;
  lessonCount: number;
  defaultLessonMinutes: number;
  priorUnitSummary?: string;
  topicBrief: string;
  updatedAt: string;
  stage1Approved: boolean;
  stage2Approved: boolean;
  objectives: SequenceObjectives;
  lessons: PlannedLesson[];
}

export interface CurriculumFolder {
  id: string;
  name: string;
  keyStage: string;
  subject: string;
  color: string;
  createdAt: string;
}

export interface CurriculumWorkspace {
  folders: CurriculumFolder[];
  sequences: LessonSequence[];
}

export interface AppSettings {
  geminiApiKey: string;
  geminiModel: string;
  pexelsApiKey: string;
  pixabayApiKey: string;
  googleClientId: string;
  showPedagogicalCallouts: boolean;
}
