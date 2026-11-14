import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Layers,
  LayoutTemplate,
  Sparkles,
  X,
} from 'lucide-react';
import {
  LessonPhase,
  SlideData,
  SlidePresetId,
  WaveVariant,
} from '../../types/curriculum';
import { FlipHorizontal2 } from 'lucide-react';
import {
  PHASE_PALETTES,
  SLIDE_PRESETS,
  WAVE_VARIANT_LABELS,
} from '../../data/palettes';
import { SVG_DIAGRAM_TEMPLATES } from '../../data/svgDiagramLibrary';
import { SlideCanvas } from '../canvas/SlideCanvas';

export type SlidePickerModalMode =
  | 'new-slide-wizard'
  | 'change-preset'
  | 'change-wave';

interface SlideLayoutWaveModalProps {
  isOpen: boolean;
  mode: SlidePickerModalMode;
  initialPresetId: SlidePresetId;
  initialWaveVariant: WaveVariant;
  initialPhase: LessonPhase;
  initialInvertWaveLayers?: boolean;
  onClose: () => void;
  onSelectPresetOnly?: (presetId: SlidePresetId, recommendedWave?: WaveVariant) => void;
  onSelectWaveOnly?: (waveVariant: WaveVariant, invertWaveLayers?: boolean) => void;
  onCompleteNewSlide?: (
    presetId: SlidePresetId,
    waveVariant: WaveVariant,
    invertWaveLayers?: boolean
  ) => void;
}

export function buildDummySlideForPreview(
  presetId: SlidePresetId,
  waveVariant: WaveVariant,
  phase: LessonPhase,
  invertWaveLayers = false
): SlideData {
  const sampleSvg = SVG_DIAGRAM_TEMPLATES[0];
  const coverSvg = SVG_DIAGRAM_TEMPLATES[5] || sampleSvg;
  const todayStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const base: SlideData = {
    id: `preview-${presetId}-${waveVariant}`,
    blueprintId: 'preview-bp',
    slideNumber: 1,
    phase,
    presetId,
    waveVariant,
    invertWaveLayers,
    title: 'Lorem Ipsum Dolor Sit Amet',
    lessonDate: todayStr,
    bigQuestion:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod tempor?',
    bodyBlocks: [
      {
        id: 'prev-b1',
        heading: 'Core Concept Overview',
        dualCodeIcon: 'concept',
        content:
          '• Lorem ipsum dolor sit amet, consectetur adipiscing elit\n• Ut enim ad minim veniam quis nostrud exercitation\n• Duis aute irure dolor in reprehenderit in voluptate',
        layer: 'top',
      },
      {
        id: 'prev-b2',
        heading: 'Key Classroom Takeaway',
        dualCodeIcon: 'check',
        style: 'highlight',
        content:
          '• Sed do eiusmod tempor incididunt ut labore et dolore\n• Excepteur sint occaecat cupidatat non proident sunt',
        layer: 'top',
      },
    ],
    routineIcons: ['write-in-books'],
    speakerNotes: '',
  };

  if (presetId === 'lesson-title-page') {
    return {
      ...base,
      title: 'Lorem Ipsum Lesson Topic Title',
      keyTermsStrip: [
        { term: 'Lorem Ipsum', definition: 'Core concept' },
        { term: 'Consectetur', definition: 'Supporting term' },
        { term: 'Adipiscing', definition: 'Process model' },
      ],
      mediaItem: coverSvg
        ? {
            id: 'prev-media',
            type: 'svg-diagram',
            svgCode: coverSvg.svgCode,
            title: coverSvg.title,
            attribution: 'Cover Visual',
            cropFit: 'cover',
            frameShape: 'clean',
            placement: 'fill-bottom-layer',
          }
        : undefined,
    };
  }

  if (presetId === 'title-divider') {
    return {
      ...base,
      title: 'Consectetur Adipiscing Elit',
      keyTermsStrip: [
        { term: 'Lorem Ipsum', definition: 'Dolor sit amet consectetur adipiscing.' },
        { term: 'Sed Eiusmod', definition: 'Tempor incididunt ut labore et dolore.' },
        { term: 'Minim Veniam', definition: 'Quis nostrud exercitation ullamco.' },
      ],
    };
  }

  if (presetId === 'mwb-starter-quadrant') {
    return {
      ...base,
      title: 'Starter Quiz',
      waveVariant,
      starterQuadrants: [
        {
          id: 'q1',
          label: '1',
          question: 'Lorem ipsum dolor sit amet, consectetur elit?',
          options: ['A. Dolore', 'B. Magna', 'C. Aliqua', 'D. Enim'],
          answer: 'B. Magna',
        },
        {
          id: 'q2',
          label: '2',
          question: 'Sed do eiusmod tempor incididunt ut labore?',
          options: ['A. Veniam', 'B. Nostrud', 'C. Laboris', 'D. Ullamco'],
          answer: 'C. Laboris',
        },
        {
          id: 'q3',
          label: '3',
          question: 'Duis aute irure dolor in reprehenderit?',
          options: ['A. Cillum', 'B. Fugiat', 'C. Pariatur', 'D. Voluptate'],
          answer: 'A. Cillum',
        },
        {
          id: 'q4',
          label: '4',
          question: 'Excepteur sint occaecat cupidatat non proident?',
          options: ['A. Sunt', 'B. Culpa', 'C. Officia', 'D. Mollit'],
          answer: 'D. Mollit',
        },
      ],
    };
  }

  if (presetId === 'comparison-two-column') {
    return {
      ...base,
      title: 'Comparison: Alpha vs Beta',
      bodyBlocks: [
        {
          id: 'cmp-l',
          heading: 'Model Alpha',
          dualCodeIcon: 'compare',
          column: 'left',
          content:
            '• Lorem ipsum dolor sit amet elit\n• Tempor incididunt ut labore magna\n• Ut enim ad minim veniam',
        },
        {
          id: 'cmp-r',
          heading: 'Model Beta',
          dualCodeIcon: 'layers',
          column: 'right',
          content:
            '• Duis aute irure dolor in velit\n• Excepteur sint occaecat cupidatat\n• Mollit anim id est laborum',
        },
      ],
    };
  }

  if (presetId === 'process-timeline-flow') {
    return {
      ...base,
      title: 'Step-by-Step Sequence Flow',
      bodyBlocks: [
        {
          id: 'step-1',
          heading: 'Step One',
          dualCodeIcon: 'process',
          content: 'Lorem ipsum dolor sit amet consectetur.',
        },
        {
          id: 'step-2',
          heading: 'Step Two',
          dualCodeIcon: 'network',
          content: 'Sed do eiusmod tempor incididunt labore.',
        },
        {
          id: 'step-3',
          heading: 'Step Three',
          dualCodeIcon: 'target',
          content: 'Ut enim ad minim veniam exercitation.',
        },
        {
          id: 'step-4',
          heading: 'Step Four',
          dualCodeIcon: 'check',
          content: 'Duis aute irure dolor in voluptate velit.',
        },
      ],
    };
  }

  if (
    presetId === 'split-concept-dual-code' ||
    presetId === 'worked-example-steps'
  ) {
    return {
      ...base,
      title:
        presetId === 'worked-example-steps'
          ? 'Worked Example: Step-by-Step Model'
          : 'Core Concept Explanation',
      mediaItem: sampleSvg
        ? {
            id: 'prev-dual',
            type: 'svg-diagram',
            svgCode: sampleSvg.svgCode,
            title: sampleSvg.title,
            attribution: 'Dual-Coding Diagram',
            cropFit: 'contain',
            frameShape: 'rounded-card',
            placement: 'boxed-card',
          }
        : undefined,
    };
  }

  return base;
}

export const SlideLayoutWaveModal: React.FC<SlideLayoutWaveModalProps> = ({
  isOpen,
  mode,
  initialPresetId,
  initialWaveVariant,
  initialPhase,
  initialInvertWaveLayers = false,
  onClose,
  onSelectPresetOnly,
  onSelectWaveOnly,
  onCompleteNewSlide,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [chosenPreset, setChosenPreset] =
    useState<SlidePresetId>(initialPresetId);
  const [chosenWave, setChosenWave] =
    useState<WaveVariant>(initialWaveVariant);
  const [previewPhase, setPreviewPhase] = useState<LessonPhase>(initialPhase);
  const [invertWave, setInvertWave] = useState<boolean>(initialInvertWaveLayers);

  useEffect(() => {
    if (!isOpen) return;
    setChosenPreset(initialPresetId);
    setChosenWave(initialWaveVariant);
    setPreviewPhase(initialPhase);
    setInvertWave(initialInvertWaveLayers);
    setStep(mode === 'change-wave' ? 2 : 1);
  }, [
    isOpen,
    mode,
    initialPresetId,
    initialWaveVariant,
    initialPhase,
    initialInvertWaveLayers,
  ]);

  if (!isOpen) return null;

  const isWizard = mode === 'new-slide-wizard';
  const showingPresetGrid = mode === 'change-preset' || (isWizard && step === 1);
  const waveEntries = Object.entries(WAVE_VARIANT_LABELS) as [
    WaveVariant,
    string,
  ][];

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[1440px] h-[90vh] bg-[#FAF6F0] rounded-3xl border border-zinc-200 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-6 py-4 bg-white border-b border-zinc-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            {isWizard && step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <ArrowLeft size={14} />
                <span>Back to Presets</span>
              </button>
            )}
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              {showingPresetGrid ? (
                <LayoutTemplate size={20} />
              ) : (
                <Layers size={20} />
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-zinc-900">
                {isWizard
                  ? step === 1
                    ? 'Add New Slide — Step 1 of 2: Choose Slide Preset'
                    : 'Add New Slide — Step 2 of 2: Choose 3D Paper-Cut Wave'
                  : mode === 'change-preset'
                  ? 'Choose Slide Preset Layout'
                  : 'Choose 3D Paper-Cut Wave'}
              </h2>
              <p className="text-xs text-zinc-500">
                {showingPresetGrid
                  ? 'Asset zone wireframe layouts (without background waves). Click any layout to choose where slide elements sit.'
                  : 'Coloured 3D paper-cut waves positioned underneath your chosen asset layout. Flip sides anytime or pick a majority-coloured canvas.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Stepper pill when in New Slide Wizard */}
            {isWizard && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6F0] border border-zinc-200 text-xs font-bold">
                <span
                  className={`px-2 py-0.5 rounded-lg ${
                    step === 1
                      ? 'bg-emerald-600 text-white'
                      : 'text-emerald-700'
                  }`}
                >
                  1. Preset
                </span>
                <ArrowRight size={13} className="text-zinc-400" />
                <span
                  className={`px-2 py-0.5 rounded-lg ${
                    step === 2
                      ? 'bg-emerald-600 text-white'
                      : 'text-zinc-500'
                  }`}
                >
                  2. 3D Wave
                </span>
              </div>
            )}

            {/* Flip White / Colour button on Wave step */}
            {!showingPresetGrid && (
              <button
                type="button"
                onClick={() => setInvertWave((v) => !v)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                  invertWave
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                    : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                }`}
                title="Swap creamy white paper and coloured depth across all wave shapes"
              >
                <FlipHorizontal2 size={14} />
                <span>Flip White / Colour</span>
              </button>
            )}

            {/* Quick Phase Palette Switcher for Preview */}
            <div className="hidden lg:flex items-center gap-1 bg-zinc-100 p-1 rounded-xl">
              {(['starter', 'explanation', 'guided', 'task', 'plenary'] as LessonPhase[]).map(
                (ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => setPreviewPhase(ph)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition ${
                      previewPhase === ph
                        ? 'bg-white text-zinc-900 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: PHASE_PALETTES[ph].accent }}
                    />
                    <span className="capitalize">{ph}</span>
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Visual Cards Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {showingPresetGrid ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {SLIDE_PRESETS.filter((p) => p.id !== 'custom').map((preset) => {
                const isSelected = chosenPreset === preset.id;
                const previewSlide = buildDummySlideForPreview(
                  preset.id,
                  preset.recommendedWave,
                  previewPhase
                );
                const selectPreset = () => {
                  setChosenPreset(preset.id);
                  if (isWizard) {
                    setChosenWave(preset.recommendedWave);
                    setStep(2);
                  } else {
                    onSelectPresetOnly?.(preset.id, preset.recommendedWave);
                    onClose();
                  }
                };
                return (
                  <div
                    key={preset.id}
                    role="button"
                    tabIndex={0}
                    onClick={selectPreset}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectPreset();
                      }
                    }}
                    className={`group cursor-pointer text-left rounded-2xl bg-white border-2 p-3 shadow-xs transition-all hover:shadow-lg flex flex-col gap-3 ${
                      isSelected
                        ? 'border-emerald-600 ring-4 ring-emerald-500/15'
                        : 'border-zinc-200 hover:border-emerald-400'
                    }`}
                  >
                    <div className="w-full rounded-xl overflow-hidden border border-zinc-200 relative pointer-events-none">
                      <SlideCanvas
                        slide={previewSlide}
                        isThumbnail
                        hideWaveBackground
                        editorPreviewAllAnswers
                        interactiveTimer={false}
                      />
                      <div className="absolute inset-0 bg-emerald-950/0 group-hover:bg-emerald-950/10 transition flex items-end justify-end p-2.5">
                        <span className="opacity-0 group-hover:opacity-100 transition px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-md flex items-center gap-1">
                          {isWizard ? (
                            <>
                              <span>Next: Pick Wave</span>
                              <ArrowRight size={13} />
                            </>
                          ) : (
                            <>
                              <Check size={13} />
                              <span>Use Preset</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="px-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-extrabold text-zinc-900">
                          {preset.name}
                        </h3>
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {waveEntries.map(([variantKey, variantLabel]) => {
                const isSelected = chosenWave === variantKey;
                const previewSlide = buildDummySlideForPreview(
                  chosenPreset,
                  variantKey,
                  previewPhase,
                  invertWave
                );
                const selectWave = () => {
                  setChosenWave(variantKey);
                  if (isWizard) {
                    onCompleteNewSlide?.(chosenPreset, variantKey, invertWave);
                    onClose();
                  } else {
                    onSelectWaveOnly?.(variantKey, invertWave);
                    onClose();
                  }
                };
                return (
                  <div
                    key={variantKey}
                    role="button"
                    tabIndex={0}
                    onClick={selectWave}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectWave();
                      }
                    }}
                    className={`group cursor-pointer text-left rounded-2xl bg-white border-2 p-3 shadow-xs transition-all hover:shadow-lg flex flex-col gap-3 ${
                      isSelected
                        ? 'border-emerald-600 ring-4 ring-emerald-500/15'
                        : 'border-zinc-200 hover:border-emerald-400'
                    }`}
                  >
                    <div className="w-full rounded-xl overflow-hidden border border-zinc-200 relative pointer-events-none">
                      <SlideCanvas
                        slide={previewSlide}
                        isThumbnail
                        editorPreviewAllAnswers
                        interactiveTimer={false}
                      />
                      <div className="absolute inset-0 bg-emerald-950/0 group-hover:bg-emerald-950/10 transition flex items-end justify-end p-2.5">
                        <span className="opacity-0 group-hover:opacity-100 transition px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-md flex items-center gap-1">
                          <Sparkles size={13} />
                          <span>{isWizard ? 'Create Slide' : 'Apply Wave'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="px-1 flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-extrabold text-zinc-900">
                          {variantLabel}
                        </h3>
                        <p className="text-[11px] text-zinc-500 font-mono">
                          {variantKey}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Selected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
