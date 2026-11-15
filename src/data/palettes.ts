import { LessonPhase, PhasePalette, RoutineIconType, SlidePresetId, WaveVariant } from '../types/curriculum';

export const CREAMY_WHITE = '#FAF6F0';

/**
 * Implicit phase-coded 3D paper-cut colour ramps inspired directly by the reference visuals.
 * Pupils learn what each phase colour signals without relying on tacky "Teacher Explanation" pills.
 */
export const PHASE_PALETTES: Record<LessonPhase, PhasePalette> = {
  starter: {
    phase: 'starter',
    name: 'Ocean Cobalt',
    pupilSignal: 'Retrieval Starter — Mini-Whiteboards out, recall from memory',
    creamyWhite: CREAMY_WHITE,
    darkInk: '#0F172A',
    mutedInk: '#475569',
    layers: ['#38BDF8', '#0284C7', '#0369A1', '#0C4A6E'],
    accent: '#0284C7',
    softSurface: '#F0F9FF',
    borderAccent: '#BAE6FD',
  },
  explanation: {
    phase: 'explanation',
    name: 'Deep Teal & Emerald',
    pupilSignal: 'Direct Explanation / Modelling — Eyes front, listen & dual-code',
    creamyWhite: CREAMY_WHITE,
    darkInk: '#062B23',
    mutedInk: '#3F625A',
    layers: ['#34D399', '#059669', '#065F46', '#042F2E'],
    accent: '#059669',
    softSurface: '#ECFDF5',
    borderAccent: '#A7F3D0',
  },
  guided: {
    phase: 'guided',
    name: 'Berry & Plum',
    pupilSignal: 'Guided Check / Turn & Talk — Think together & check understanding',
    creamyWhite: CREAMY_WHITE,
    darkInk: '#3B0722',
    mutedInk: '#7A3E59',
    layers: ['#FB7185', '#E11D48', '#9F1239', '#500724'],
    accent: '#BE123C',
    softSurface: '#FFF1F2',
    borderAccent: '#FECDD3',
  },
  task: {
    phase: 'task',
    name: 'Terracotta & Amber',
    pupilSignal: 'Active Pupil Task — Group work, books, unplugged or practical challenge',
    creamyWhite: CREAMY_WHITE,
    darkInk: '#2E1A0F',
    mutedInk: '#78503A',
    layers: ['#FBBF24', '#D97706', '#9A3412', '#5C2415'],
    accent: '#C2410C',
    softSurface: '#FFFBEB',
    borderAccent: '#FDE68A',
  },
  plenary: {
    phase: 'plenary',
    name: 'Deep Violet',
    pupilSignal: 'Synthesis & Exit Plenary — Connect back to big objectives',
    creamyWhite: CREAMY_WHITE,
    darkInk: '#1E1038',
    mutedInk: '#5B4B7A',
    layers: ['#A78BFA', '#7C3AED', '#5B21B6', '#2E1065'],
    accent: '#6D28D9',
    softSurface: '#F5F3FF',
    borderAccent: '#DDD6FE',
  },
};

export const ROUTINE_ICON_META: Record<
  RoutineIconType,
  { label: string; shortLabel: string; description: string; color: string }
> = {
  'write-in-books': {
    label: 'Write in Books',
    shortLabel: 'Books',
    description: 'Pupils record key notes or structured responses into exercise books',
    color: '#0369A1',
  },
  'mwb-question': {
    label: 'Mini-Whiteboard',
    shortLabel: 'MWB',
    description: 'Show-me board hinge check or retrieval response (3-2-1 show!)',
    color: '#BE123C',
  },
  'pair-discussion': {
    label: 'Turn & Talk / Group',
    shortLabel: 'Discuss',
    description: 'Structured pair or small-group discussion before cold call',
    color: '#059669',
  },
  'independent-task': {
    label: 'Active Task',
    shortLabel: 'Task',
    description: 'Independent or collaborative applied practice activity',
    color: '#B45309',
  },
  'key-vocab': {
    label: 'Key Vocabulary',
    shortLabel: 'Vocab',
    description: 'Tier 3 subject terminology spotlighted for accuracy',
    color: '#6D28D9',
  },
  'extension-challenge': {
    label: 'Stretch & Challenge',
    shortLabel: 'Stretch',
    description: 'Deeper reasoning or transfer prompt for pupils finishing early',
    color: '#0F766E',
  },
  'silent-think': {
    label: 'Silent Thinking Time',
    shortLabel: 'Think',
    description: 'Quiet individual processing time before sharing ideas',
    color: '#4338CA',
  },
};

export interface SlidePresetMeta {
  id: SlidePresetId;
  name: string;
  recommendedWave: WaveVariant;
  bestPhases: LessonPhase[];
  description: string;
}

export const SLIDE_PRESETS: SlidePresetMeta[] = [
  {
    id: 'mwb-starter-quadrant',
    name: '4-Quadrant MWB Starter',
    recommendedWave: 'top-bottom-strata',
    bestPhases: ['starter'],
    description: '2x2 spaced retrieval grid on screen as pupils enter, with one-by-one answer highlight and starter timer.',
  },
  {
    id: 'lesson-title-page',
    name: 'Lesson Title Page',
    recommendedWave: 'vertical-scurve-right',
    bestPhases: ['explanation'],
    description: 'Opening slide shown right after the starter: lesson topic, today’s date, enquiry question, and hero cover image.',
  },
  {
    id: 'title-divider',
    name: 'Title & Big Question',
    recommendedWave: 'corner-cavern-tr',
    bestPhases: ['explanation'],
    description: 'Bold 3D cavern frame introducing a section heading, big question, and key terms.',
  },
  {
    id: 'split-concept-dual-code',
    name: 'Dual-Coded Split Concept',
    recommendedWave: 'vertical-scurve-right',
    bestPhases: ['explanation', 'guided'],
    description: 'Clean direct explanation (plain or emphasised cards) paired with a dedicated right-hand visual/diagram slot.',
  },
  {
    id: 'worked-example-steps',
    name: 'Worked Example (I Do / We Do)',
    recommendedWave: 'vertical-scurve-left',
    bestPhases: ['explanation', 'guided'],
    description: 'Sequential numbered steps minimizing split attention paired with a right-hand worked visual or diagram.',
  },
  {
    id: 'hinge-check-mwb',
    name: 'MWB Hinge Diagnostic',
    recommendedWave: 'framed-halo',
    bestPhases: ['guided'],
    description: 'High-contrast hinge question designed to surface a specific misconception quickly.',
  },
  {
    id: 'comparison-two-column',
    name: 'Contrast & Comparison',
    recommendedWave: 'dual-ribbon',
    bestPhases: ['explanation', 'guided', 'task'],
    description: 'Side-by-side comparison cards highlighting similarities and distinctions, with optional right-hand diagram.',
  },
  {
    id: 'process-timeline-flow',
    name: 'Process / Stage Flow',
    recommendedWave: 'bottom-undulation',
    bestPhases: ['explanation', 'task'],
    description: '3 to 4 connected sequential cards riding above a layered organic bottom wave or visual strip.',
  },
  {
    id: 'active-task-scaffolds',
    name: 'Active Task & Scaffolds',
    recommendedWave: 'corner-cavern-br',
    bestPhases: ['task'],
    description: 'Short focused pupil task steps (max 10 mins), scaffolds, stretch prompt, and live countdown timer.',
  },
  {
    id: 'vocab-words-only',
    name: 'Key Vocabulary (Words + Definition Space)',
    recommendedWave: 'vertical-scurve-right',
    bestPhases: ['explanation'],
    description: 'Start-of-lesson vocabulary list where pupils write key terms and leave blank lines to fill definitions after each topic.',
  },
  {
    id: 'vocab-single-term-focus',
    name: 'Single Vocabulary Term (Definition + Image)',
    recommendedWave: 'vertical-scurve-right',
    bestPhases: ['explanation', 'guided'],
    description: 'Mid-lesson spotlight on one key term and its definition for pupils to copy after discussing it, paired with a dual-coding image.',
  },
  {
    id: 'vocabulary-spotlight',
    name: 'Key Vocabulary & Definitions (Dual-Coded)',
    recommendedWave: 'vertical-scurve-right',
    bestPhases: ['explanation', 'guided'],
    description: 'Full dual-coded vocabulary list showing terms, crisp definitions, and paired visual slots upfront.',
  },
  {
    id: 'plenary-synthesis',
    name: 'Plenary & Exit Synthesis',
    recommendedWave: 'diagonal-surge',
    bestPhases: ['plenary'],
    description: 'Consolidates Know/Do/Understand takeaways and sets up next lesson retrieval.',
  },
  {
    id: 'custom',
    name: 'Bespoke AI-Designed Slide',
    recommendedWave: 'corner-cavern-tr',
    bestPhases: ['starter', 'explanation', 'guided', 'task', 'plenary'],
    description: 'Custom non-template layout & bespoke SVG diagrams/tables crafted for multi-step algorithms or visual progressions.',
  },
];

export const WAVE_VARIANT_LABELS: Record<WaveVariant, string> = {
  'corner-cavern-tr': 'Top-Right 3D Cavern',
  'corner-cavern-br': 'Bottom-Right Layered Cut',
  'vertical-scurve-left': 'Left S-Curve Spine',
  'vertical-scurve-right': 'Right S-Curve Showcase',
  'top-bottom-strata': 'Top & Bottom Strata',
  'island-cutout-right': 'Organic Island Cut-Out',
  'diagonal-surge': 'Diagonal Layered Surge',
  'bottom-undulation': 'Bottom Rolling Hills',
  'framed-halo': 'Central Paper-Cut Halo',
  'dual-ribbon': 'Balanced Dual Ribbons',
  'dark-canvas-left-paper': 'Coloured Canvas — Left Paper Island',
  'dark-canvas-bottom-paper': 'Coloured Canvas — Bottom Paper Sweep',
  'dark-halo-spotlight': 'Coloured Stage — Central White Island',
};
