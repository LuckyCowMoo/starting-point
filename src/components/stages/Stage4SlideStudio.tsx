import React, { useState } from 'react';
import {
  AlertCircle,
  Download,
  Eye,
  EyeOff,
  FlipHorizontal2,
  Image as ImageIcon,
  Loader2,
  Lock,
  Palette,
  Play,
  Plus,
  Sparkles,
  StickyNote,
  LayoutTemplate,
  Layers,
  RotateCcw,
  Spline,
  Terminal,
  Timer,
  Trash2,
  Wand2,
} from 'lucide-react';
import {
  AppSettings,
  LessonPhase,
  LessonSequence,
  PlannedLesson,
  RoutineIconType,
  SlideData,
  SlidePresetId,
  WaveVariant,
} from '../../types/curriculum';
import {
  PHASE_PALETTES,
  ROUTINE_ICON_META,
  SLIDE_PRESETS,
  WAVE_VARIANT_LABELS,
} from '../../data/palettes';
import { SlideCanvas } from '../canvas/SlideCanvas';
import { SVG_DIAGRAM_TEMPLATES } from '../../data/svgDiagramLibrary';
import { RoutineBadgeIcon } from '../canvas/RoutineBadgeIcon';
import { MediaPickerModal } from '../media/MediaPickerModal';
import { SlideLayoutWaveModal, SlidePickerModalMode } from './SlideLayoutWaveModal';
import { PromptCopyPasteModal } from '../modals/PromptCopyPasteModal';
import {
  parseBespokeSlideResponse,
  parseStage4SlidesResponse,
  runBespokeSlideDesign,
  runStage4SlidesGeneration,
} from '../../services/geminiService';
import {
  buildBespokeSlidePrompt,
  buildStage4SlidesPrompt,
} from '../../services/pedagogyPrompts';

interface Stage4SlideStudioProps {
  sequence: LessonSequence;
  activeLessonId: string | null;
  settings: AppSettings;
  onSelectLesson: (lessonId: string) => void;
  onUpdateSequence: (updated: LessonSequence) => void;
  onLaunchPresenter: (lessonId: string, startSlideIndex: number) => void;
  onOpenExportModal: (lessonId: string) => void;
}

export const Stage4SlideStudio: React.FC<Stage4SlideStudioProps> = ({
  sequence,
  activeLessonId,
  settings,
  onSelectLesson,
  onUpdateSequence,
  onLaunchPresenter,
  onOpenExportModal,
}) => {
  const lesson =
    sequence.lessons.find((l) => l.id === activeLessonId) || sequence.lessons[0];

  const [selectedSlideIdx, setSelectedSlideIdx] = useState(0);
  const [inspectorTab, setInspectorTab] = useState<'edit' | 'ai'>('edit');
  const [previewAllAnswers, setPreviewAllAnswers] = useState(true);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [showWavePathEditor, setShowWavePathEditor] = useState(false);
  const [pickerModalMode, setPickerModalMode] =
    useState<SlidePickerModalMode | null>(null);
  const [promptModalTarget, setPromptModalTarget] = useState<
    'surgical' | 'bespoke' | null
  >(null);

  const [surgicalPrompt, setSurgicalPrompt] = useState('');
  const [bespokePrompt, setBespokePrompt] = useState('');
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!lesson || lesson.slidesData.length === 0) {
    return (
      <div className="max-w-3xl mx-auto mt-16 p-8 rounded-3xl bg-white border border-zinc-200 text-center space-y-3">
        <Lock className="mx-auto text-amber-600" size={32} />
        <h3 className="text-lg font-bold text-zinc-900">
          Generate or Approve Stage 3 Blueprint First
        </h3>
        <p className="text-sm text-zinc-600">
          Select a lesson with an approved Stage 3 Blueprint to open the Visual Slide Studio.
        </p>
      </div>
    );
  }

  const safeIdx = Math.min(selectedSlideIdx, lesson.slidesData.length - 1);
  const slide = lesson.slidesData[safeIdx];
  const palette = PHASE_PALETTES[slide.phase];

  const updateLesson = (patch: Partial<PlannedLesson>) => {
    onUpdateSequence({
      ...sequence,
      updatedAt: new Date().toISOString(),
      lessons: sequence.lessons.map((l) =>
        l.id === lesson.id ? { ...l, ...patch } : l
      ),
    });
  };

  const updateActiveSlide = (patch: Partial<SlideData>) => {
    updateLesson({
      slidesData: lesson.slidesData.map((s) =>
        s.id === slide.id ? { ...s, ...patch } : s
      ),
    });
  };

  const createSlideFromWizard = (
    presetId: SlidePresetId,
    waveVariant: WaveVariant,
    invertWaveLayers = false
  ) => {
    const newNum = lesson.slidesData.length + 1;
    const isStarter = presetId === 'mwb-starter-quadrant';
    const isTitle = presetId === 'lesson-title-page';
    const isVocabPreset =
      presetId === 'vocab-words-only' ||
      presetId === 'vocab-single-term-focus' ||
      presetId === 'vocabulary-spotlight';
    const coverTemplate = SVG_DIAGRAM_TEMPLATES[5] || SVG_DIAGRAM_TEMPLATES[0];
    const newSlide: SlideData = {
      id: `sl-manual-${Date.now()}`,
      blueprintId: '',
      slideNumber: newNum,
      phase: isStarter
        ? 'starter'
        : isTitle || isVocabPreset
        ? 'explanation'
        : 'task',
      presetId,
      waveVariant,
      invertWaveLayers,
      title: isTitle
        ? lesson.title
        : isStarter
        ? 'Starter'
        : presetId === 'vocab-single-term-focus'
        ? 'Key Term Focus'
        : isVocabPreset
        ? 'Key Vocabulary'
        : 'New Activity',
      lessonDate: isTitle
        ? new Date().toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : undefined,
      bigQuestion: isTitle ? lesson.summary : undefined,
      keyTermsStrip: isVocabPreset
        ? presetId === 'vocab-single-term-focus'
          ? [
              {
                term: 'Key Term',
                definition:
                  'Click on the slide to write a concise, pupil-friendly definition.',
              },
            ]
          : [
              {
                term: 'Term 1',
                definition:
                  presetId === 'vocab-words-only'
                    ? ''
                    : 'Click to enter crisp definition.',
              },
              {
                term: 'Term 2',
                definition:
                  presetId === 'vocab-words-only'
                    ? ''
                    : 'Click to enter crisp definition.',
              },
              {
                term: 'Term 3',
                definition:
                  presetId === 'vocab-words-only'
                    ? ''
                    : 'Click to enter crisp definition.',
              },
            ]
        : undefined,
      starterQuadrants: isStarter
        ? [
            {
              id: 'q1',
              label: '1',
              question: 'Question 1 prompt...',
              options: ['A. Choice A', 'B. Choice B', 'C. Choice C', 'D. Choice D'],
              answer: 'A — Choice A',
            },
            {
              id: 'q2',
              label: '2',
              question: 'Question 2 prompt...',
              options: ['A. Choice A', 'B. Choice B', 'C. Choice C', 'D. Choice D'],
              answer: 'B — Choice B',
            },
            {
              id: 'q3',
              label: '3',
              question: 'Question 3 prompt...',
              options: ['A. Choice A', 'B. Choice B', 'C. Choice C', 'D. Choice D'],
              answer: 'C — Choice C',
            },
            {
              id: 'q4',
              label: '4',
              question: 'Question 4 prompt...',
              options: ['A. Choice A', 'B. Choice B', 'C. Choice C', 'D. Choice D'],
              answer: 'D — Choice D',
            },
          ]
        : undefined,
      bodyBlocks:
        isStarter || isTitle
          ? []
          : isVocabPreset
          ? [
              { id: `vb-${Date.now()}-1`, content: '', dualCodeIcon: 'data' },
              { id: `vb-${Date.now()}-2`, content: '', dualCodeIcon: 'process' },
              { id: `vb-${Date.now()}-3`, content: '', dualCodeIcon: 'layers' },
            ]
          : [
              {
                id: `b-${Date.now()}`,
                heading: '',
                dualCodeIcon: 'concept',
                content: '• Click directly on the slide canvas to edit this text\n• Keep sentences short and readable',
                style: 'plain',
              },
            ],
      routineIcons: isStarter
        ? ['mwb-question']
        : isVocabPreset
        ? ['key-vocab', 'write-in-books']
        : ['pair-discussion', 'write-in-books'],
      mediaItem:
        isTitle && coverTemplate
          ? {
              id: `med-manual-${Date.now()}`,
              type: 'svg-diagram',
              svgCode: coverTemplate.svgCode,
              title: coverTemplate.title,
              attribution: 'Title Cover Visual',
              cropFit: 'cover',
              frameShape: 'clean',
              placement: 'fill-bottom-layer',
            }
          : undefined,
      timerSeconds: isTitle ? undefined : 300,
      speakerNotes: 'Add teacher guidance and expected answers here.',
    };
    updateLesson({ slidesData: [...lesson.slidesData, newSlide] });
    setSelectedSlideIdx(lesson.slidesData.length);
  };

  const handleDeleteSlide = (id: string) => {
    if (lesson.slidesData.length <= 1) return;
    const filtered = lesson.slidesData
      .filter((s) => s.id !== id)
      .map((s, idx) => ({ ...s, slideNumber: idx + 1 }));
    updateLesson({ slidesData: filtered });
    setSelectedSlideIdx(Math.max(0, safeIdx - 1));
  };

  const handleSurgicalSlideAi = async () => {
    if (!surgicalPrompt.trim()) return;
    setAiBusy('surgical');
    setError(null);
    try {
      const updatedList = await runStage4SlidesGeneration(
        settings.geminiApiKey,
        settings.geminiModel,
        sequence,
        lesson,
        slide.id,
        surgicalPrompt
      );
      updateLesson({ slidesData: updatedList });
      setSurgicalPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Single-slide update failed.');
    } finally {
      setAiBusy(null);
    }
  };

  const handleBespokeSlideAi = async () => {
    if (!bespokePrompt.trim()) return;
    setAiBusy('bespoke');
    setError(null);
    try {
      const bespoke = await runBespokeSlideDesign(
        settings.geminiApiKey,
        settings.geminiModel,
        sequence,
        lesson,
        slide,
        bespokePrompt
      );
      updateLesson({
        slidesData: lesson.slidesData.map((s) =>
          s.id === slide.id ? bespoke : s
        ),
      });
      setBespokePrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bespoke design failed.');
    } finally {
      setAiBusy(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Studio Top Bar */}
      <div className="px-5 py-2.5 border-b border-zinc-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto">
          {sequence.lessons
            .filter((l) => l.slidesData.length > 0)
            .map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  onSelectLesson(l.id);
                  setSelectedSlideIdx(0);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  l.id === lesson.id
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                L{l.lessonNumber}: {l.title}
              </button>
            ))}
        </div>

        <div className="flex items-center gap-2">
          {slide.presetId === 'mwb-starter-quadrant' && (
            <button
              onClick={() => setPreviewAllAnswers((v) => !v)}
              className="px-3 py-1.5 rounded-xl border border-zinc-200 bg-[#FAF6F0] text-xs font-semibold text-zinc-700 hover:bg-zinc-100 flex items-center gap-1.5"
            >
              {previewAllAnswers ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>
                {previewAllAnswers ? 'Answers Visible' : 'Answers Hidden'}
              </span>
            </button>
          )}
          <button
            onClick={() => onLaunchPresenter(lesson.id, safeIdx)}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 shadow-xs"
          >
            <Play size={14} /> Present Live
          </button>
          <button
            onClick={() => onOpenExportModal(lesson.id)}
            className="px-4 py-1.5 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-1.5"
          >
            <Download size={14} /> Export / Google Slides
          </button>
        </div>
      </div>

      {/* Main 3-Pane Studio */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Slide Filmstrip */}
        <div className="w-44 shrink-0 border-r border-zinc-200 bg-[#FAF6F0] overflow-y-auto p-2.5 space-y-2.5">
          {lesson.slidesData.map((s, idx) => {
            const p = PHASE_PALETTES[s.phase];
            const active = idx === safeIdx;
            return (
              <div
                key={s.id}
                onClick={() => setSelectedSlideIdx(idx)}
                className={`group cursor-pointer rounded-2xl p-1.5 border-2 transition ${
                  active
                    ? 'border-zinc-900 bg-white shadow-md'
                    : 'border-transparent hover:border-zinc-300 bg-white/60'
                }`}
              >
                <div className="flex items-center justify-between px-1.5 pb-1 text-[10px] font-bold">
                  <span className="flex items-center gap-1.5 text-zinc-700">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: p.accent }}
                    />
                    Slide {idx + 1}
                  </span>
                  {lesson.slidesData.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSlide(s.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-600"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                <div className="rounded-xl overflow-hidden border border-zinc-200">
                  <SlideCanvas slide={s} isThumbnail editorPreviewAllAnswers />
                </div>
              </div>
            );
          })}

          <button
            onClick={() => setPickerModalMode('new-slide-wizard')}
            className="w-full py-2.5 rounded-2xl border-2 border-dashed border-zinc-300 text-zinc-600 text-xs font-bold hover:border-emerald-500 hover:text-emerald-700 flex items-center justify-center gap-1.5 transition"
          >
            <Plus size={14} /> Add Slide
          </button>
        </div>

        {/* Center 16:9 Canvas Stage */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-zinc-200/60 p-5 flex flex-col items-center justify-start gap-3">
          {/* Quick Inline Canvas Toolbar */}
          <div className="w-full max-w-5xl flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-[11px] font-medium text-zinc-600">
              Click any slide text or visual slot on the canvas to edit directly
            </span>
            <div className="flex items-center gap-2">
              {slide.waveControlPoints && slide.waveControlPoints.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    updateActiveSlide({
                      waveControlPoints: undefined,
                      customWaveLayers: undefined,
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50 text-[11px] font-bold flex items-center gap-1 transition"
                >
                  <RotateCcw size={12} />
                  <span>Reset Wave</span>
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  updateActiveSlide({
                    invertWaveLayers: !slide.invertWaveLayers,
                  })
                }
                className={`px-3 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition ${
                  slide.invertWaveLayers
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                    : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                }`}
                title="Swap which side of the wave boundary is creamy white paper vs saturated colour"
              >
                <FlipHorizontal2 size={13} />
                <span>
                  {slide.invertWaveLayers
                    ? 'White / Colour: Flipped'
                    : 'Flip White / Colour'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowWavePathEditor((v) => !v)}
                className={`px-3 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition ${
                  showWavePathEditor
                    ? 'bg-amber-500 text-zinc-950 border-amber-600 shadow-xs'
                    : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <Spline size={13} />
                <span>
                  {showWavePathEditor ? 'Hide Wave Points' : 'Edit Wave Points'}
                </span>
              </button>
            </div>
          </div>

          {slide.teacherDesignNote && (
            <div className="w-full max-w-5xl rounded-2xl bg-amber-50 border-2 border-amber-300 px-4 py-3 flex flex-wrap items-start justify-between gap-3 text-xs text-amber-950 shadow-xs">
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <AlertCircle size={16} className="text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold uppercase tracking-wider text-[10px] text-amber-800 block">
                    AI Design Request for Teacher
                  </span>
                  <p className="mt-0.5 leading-relaxed font-medium">
                    {slide.teacherDesignNote}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setMediaOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 font-bold text-amber-900 hover:bg-amber-100 transition"
                >
                  Pick Image / SVG
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab('ai')}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700 transition"
                >
                  Open Bespoke AI
                </button>
                <button
                  type="button"
                  onClick={() => updateActiveSlide({ teacherDesignNote: undefined })}
                  className="px-2 py-1.5 rounded-lg text-amber-700 hover:bg-amber-200/60 font-semibold"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div className="w-full max-w-5xl rounded-3xl overflow-hidden slide-stage-shadow border border-zinc-300/80 bg-[#FAF6F0]">
            <SlideCanvas
              slide={slide}
              editorPreviewAllAnswers={previewAllAnswers}
              interactiveTimer={true}
              editable={true}
              showWavePathEditor={showWavePathEditor}
              onUpdateSlide={updateActiveSlide}
              onOpenMediaPicker={() => setMediaOpen(true)}
            />
          </div>

          {/* Teacher Speaker Notes & Phase Signal */}
          <div className="w-full max-w-4xl rounded-2xl bg-white border border-zinc-200 p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-bold text-zinc-800">
                <StickyNote size={14} className="text-amber-600" /> Teacher Speaker Notes
              </span>
              <span
                className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                style={{
                  backgroundColor: palette.softSurface,
                  color: palette.accent,
                }}
              >
                Implicit Phase Colour: {palette.name} ({palette.pupilSignal})
              </span>
            </div>
            <textarea
              value={slide.speakerNotes}
              rows={2}
              onChange={(e) =>
                updateActiveSlide({ speakerNotes: e.target.value })
              }
              className="w-full text-xs text-zinc-700 bg-[#FAF6F0] rounded-xl p-2.5 border border-zinc-200 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Right Inspector & AI Co-Pilot */}
        <aside className="w-76 shrink-0 border-l border-zinc-200 bg-white flex flex-col overflow-hidden">
          <div className="p-2 border-b border-zinc-200 grid grid-cols-2 gap-1 bg-[#FAF6F0]">
            <button
              onClick={() => setInspectorTab('edit')}
              className={`py-2 rounded-xl text-xs font-bold transition ${
                inspectorTab === 'edit'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Manual Editor
            </button>
            <button
              onClick={() => setInspectorTab('ai')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                inspectorTab === 'ai'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Sparkles size={13} /> AI Designer
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {inspectorTab === 'edit' ? (
              <>
                {/* Style & Phase Palette */}
                <div className="space-y-2.5">
                  <label className="font-bold text-zinc-500 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Palette size={12} /> Phase Colour & Paper-Cut Shape
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {(Object.keys(PHASE_PALETTES) as LessonPhase[]).map((ph) => {
                      const p = PHASE_PALETTES[ph];
                      const active = slide.phase === ph;
                      return (
                        <button
                          key={ph}
                          onClick={() => updateActiveSlide({ phase: ph })}
                          title={p.pupilSignal}
                          className={`py-2 rounded-xl border-2 flex flex-col items-center gap-1 text-[10px] font-bold capitalize transition ${
                            active
                              ? 'border-zinc-900 bg-zinc-50'
                              : 'border-zinc-200 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: p.accent }}
                          />
                          <span>{ph}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] font-semibold text-zinc-500">
                        Slide Preset
                      </span>
                      <button
                        type="button"
                        onClick={() => setPickerModalMode('change-preset')}
                        className="w-full mt-0.5 px-2.5 py-2 rounded-xl border border-zinc-300 bg-white hover:border-emerald-500 hover:bg-emerald-50/40 font-semibold text-left flex items-center justify-between gap-2 transition"
                      >
                        <span className="truncate flex items-center gap-1.5">
                          <LayoutTemplate size={13} className="text-emerald-600 shrink-0" />
                          <span>
                            {SLIDE_PRESETS.find((p) => p.id === slide.presetId)?.name ||
                              slide.presetId}
                          </span>
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold shrink-0">
                          Visual Picker
                        </span>
                      </button>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-zinc-500">
                        3D Paper-Cut Wave
                      </span>
                      <button
                        type="button"
                        onClick={() => setPickerModalMode('change-wave')}
                        className="w-full mt-0.5 px-2.5 py-2 rounded-xl border border-zinc-300 bg-white hover:border-emerald-500 hover:bg-emerald-50/40 font-semibold text-left flex items-center justify-between gap-2 transition"
                      >
                        <span className="truncate flex items-center gap-1.5">
                          <Layers size={13} className="text-sky-600 shrink-0" />
                          <span>
                            {WAVE_VARIANT_LABELS[slide.waveVariant] || slide.waveVariant}
                          </span>
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold shrink-0">
                          Visual Picker
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveSlide({
                            invertWaveLayers: !slide.invertWaveLayers,
                          })
                        }
                        className={`w-full mt-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center justify-between gap-2 transition ${
                          slide.invertWaveLayers
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <FlipHorizontal2 size={13} />
                          <span>Flip White / Colour</span>
                        </span>
                        <span className="text-[10px] opacity-80">
                          {slide.invertWaveLayers ? 'Flipped' : 'Default'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Slide Title */}
                <div className="space-y-2 border-t border-zinc-200 pt-3">
                  <label className="font-bold text-zinc-500 uppercase tracking-wider text-[10px]">
                    Slide Title
                  </label>
                  <input
                    value={slide.title}
                    onChange={(e) =>
                      updateActiveSlide({ title: e.target.value })
                    }
                    placeholder="Slide title"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 font-bold text-zinc-900"
                  />
                  {slide.presetId === 'title-divider' && (
                    <textarea
                      value={slide.bigQuestion || ''}
                      rows={2}
                      onChange={(e) =>
                        updateActiveSlide({ bigQuestion: e.target.value })
                      }
                      placeholder="Big Question..."
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 text-zinc-700"
                    />
                  )}
                </div>

                {/* Routine Icons & Timer */}
                <div className="space-y-2 border-t border-zinc-200 pt-3">
                  <label className="font-bold text-zinc-500 uppercase tracking-wider text-[10px]">
                    Routine Icons & On-Screen Timer
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(ROUTINE_ICON_META) as RoutineIconType[]).map(
                      (iconKey) => {
                        const active = slide.routineIcons.includes(iconKey);
                        return (
                          <button
                            key={iconKey}
                            onClick={() =>
                              updateActiveSlide({
                                routineIcons: active
                                  ? slide.routineIcons.filter((r) => r !== iconKey)
                                  : [...slide.routineIcons, iconKey],
                              })
                            }
                            className={`rounded-full transition ${
                              active
                                ? 'ring-2 ring-offset-1 ring-zinc-900'
                                : 'opacity-45 hover:opacity-85'
                            }`}
                          >
                            <RoutineBadgeIcon type={iconKey} compact />
                          </button>
                        );
                      }
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Timer size={14} className="text-zinc-500" />
                    <span className="font-semibold text-zinc-700">Timer (sec):</span>
                    <input
                      type="number"
                      min={0}
                      step={30}
                      value={slide.timerSeconds || 0}
                      onChange={(e) =>
                        updateActiveSlide({
                          timerSeconds: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-20 px-2 py-1 rounded-lg border border-zinc-300 font-mono"
                    />
                    {[0, 180, 300, 600].map((sec) => (
                      <button
                        key={sec}
                        onClick={() => updateActiveSlide({ timerSeconds: sec })}
                        className="px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 font-semibold"
                      >
                        {sec === 0 ? 'Off' : `${sec / 60}m`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visual Media Picker Trigger */}
                <div className="space-y-2 border-t border-zinc-200 pt-3">
                  <label className="font-bold text-zinc-500 uppercase tracking-wider text-[10px]">
                    Slide Visual / Diagram
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMediaOpen(true)}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#FAF6F0] border border-zinc-300 hover:border-emerald-500 font-bold text-zinc-800 flex items-center justify-center gap-1.5"
                    >
                      <ImageIcon size={14} />
                      <span>
                        {slide.mediaItem ? 'Change Photo / Diagram' : 'Add Photo / Diagram'}
                      </span>
                    </button>
                    {slide.mediaItem && (
                      <button
                        onClick={() => updateActiveSlide({ mediaItem: undefined })}
                        className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"
                        title="Remove media"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {slide.mediaItem && slide.mediaItem.type === 'image' && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-semibold text-zinc-500 mr-1">
                        Placement:
                      </span>
                      {(
                        [
                          { id: 'boxed-card', label: 'Boxed Frame' },
                          { id: 'fill-bottom-layer', label: 'Fill Bottom Layer' },
                        ] as const
                      ).map((opt) => {
                        const active =
                          (slide.mediaItem?.placement ?? 'boxed-card') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() =>
                              updateActiveSlide({
                                mediaItem: {
                                  ...slide.mediaItem!,
                                  placement: opt.id,
                                },
                              })
                            }
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                              active
                                ? 'bg-zinc-900 text-white border-zinc-900'
                                : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Vocabulary Terms Editor when a Vocabulary / Divider preset is active */}
                {(slide.presetId === 'vocab-words-only' ||
                  slide.presetId === 'vocab-single-term-focus' ||
                  slide.presetId === 'vocabulary-spotlight' ||
                  slide.presetId === 'title-divider' ||
                  slide.presetId === 'lesson-title-page') && (
                  <div className="space-y-2 border-t border-zinc-200 pt-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-zinc-500 uppercase tracking-wider text-[10px]">
                        Key Vocabulary Terms
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveSlide({
                            keyTermsStrip: [
                              ...(slide.keyTermsStrip || []),
                              { term: 'New Term', definition: '' },
                            ],
                          })
                        }
                        className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-0.5"
                      >
                        <Plus size={12} /> Add Term
                      </button>
                    </div>
                    {(slide.keyTermsStrip || []).map((kt, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-xl bg-[#FAF6F0] border border-zinc-200 space-y-1.5"
                      >
                        <div className="flex items-center gap-1.5">
                          <input
                            value={kt.term}
                            onChange={(e) =>
                              updateActiveSlide({
                                keyTermsStrip: slide.keyTermsStrip?.map((item, i) =>
                                  i === idx ? { ...item, term: e.target.value } : item
                                ),
                              })
                            }
                            placeholder="Key word..."
                            className="flex-1 font-bold bg-white px-2 py-1 rounded-lg border border-zinc-200"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateActiveSlide({
                                keyTermsStrip: slide.keyTermsStrip?.filter(
                                  (_, i) => i !== idx
                                ),
                              })
                            }
                            className="p-1 text-zinc-400 hover:text-rose-600"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        {slide.presetId !== 'vocab-words-only' && (
                          <textarea
                            value={kt.definition}
                            rows={2}
                            onChange={(e) =>
                              updateActiveSlide({
                                keyTermsStrip: slide.keyTermsStrip?.map((item, i) =>
                                  i === idx
                                    ? { ...item, definition: e.target.value }
                                    : item
                                ),
                              })
                            }
                            placeholder="Definition..."
                            className="w-full p-1.5 rounded-lg border border-zinc-200 bg-white resize-none"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Starter Quadrants OR Body Blocks Editor */}
                {slide.presetId === 'mwb-starter-quadrant' &&
                slide.starterQuadrants ? (
                  <div className="space-y-2.5 border-t border-zinc-200 pt-3">
                    <label className="font-bold text-zinc-500 uppercase tracking-wider text-[10px]">
                      4-Quadrant MWB Questions & Answers
                    </label>
                    {slide.starterQuadrants.map((q, idx) => (
                      <div
                        key={q.id}
                        className="p-2.5 rounded-xl bg-[#FAF6F0] border border-zinc-200 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-sky-700 text-white text-[11px] font-bold">
                            {idx + 1}
                          </span>
                          <button
                            onClick={() =>
                              updateActiveSlide({
                                starterQuadrants: slide.starterQuadrants?.map(
                                  (item, i) =>
                                    i === idx
                                      ? {
                                          ...item,
                                          options: item.options
                                            ? undefined
                                            : ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
                                        }
                                      : item
                                ),
                              })
                            }
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700"
                          >
                            {q.options ? 'Switch to Open Q' : '+ Add A/B/C/D Choices'}
                          </button>
                        </div>
                        <textarea
                          value={q.question}
                          rows={2}
                          onChange={(e) =>
                            updateActiveSlide({
                              starterQuadrants: slide.starterQuadrants?.map(
                                (item, i) =>
                                  i === idx
                                    ? { ...item, question: e.target.value }
                                    : item
                              ),
                            })
                          }
                          className="w-full p-1.5 rounded-lg border border-zinc-200 bg-white font-semibold"
                        />
                        {q.options && (
                          <div className="grid grid-cols-2 gap-1">
                            {q.options.map((opt, optIdx) => (
                              <div
                                key={optIdx}
                                className="flex items-center gap-1 rounded border border-zinc-200 bg-white px-1.5 py-0.5"
                              >
                                <span className="text-[10px] font-extrabold text-sky-700 shrink-0">
                                  {['A', 'B', 'C', 'D'][optIdx]}
                                </span>
                                <input
                                  value={opt}
                                  onChange={(e) => {
                                    const nextOpts = [...q.options!] as [
                                      string,
                                      string,
                                      string,
                                      string,
                                    ];
                                    nextOpts[optIdx] = e.target.value;
                                    updateActiveSlide({
                                      starterQuadrants: slide.starterQuadrants?.map(
                                        (item, i) =>
                                          i === idx ? { ...item, options: nextOpts } : item
                                      ),
                                    });
                                  }}
                                  className="w-full py-0.5 bg-transparent text-[10.5px] font-medium text-zinc-700 outline-none"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        <input
                          value={q.answer}
                          onChange={(e) =>
                            updateActiveSlide({
                              starterQuadrants: slide.starterQuadrants?.map(
                                (item, i) =>
                                  i === idx
                                    ? { ...item, answer: e.target.value }
                                    : item
                              ),
                            })
                          }
                          placeholder="Short answer (e.g. B — 1101)..."
                          className="w-full p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-950 font-semibold"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2.5 border-t border-zinc-200 pt-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-zinc-500 uppercase tracking-wider text-[10px]">
                        Content Blocks
                      </label>
                      <button
                        onClick={() =>
                          updateActiveSlide({
                            bodyBlocks: [
                              ...slide.bodyBlocks,
                              {
                                id: `blk-${Date.now()}`,
                                heading: 'New Point',
                                content: '• Crisp pupil-facing point...',
                                style: 'card',
                                layer: 'top',
                              },
                            ],
                          })
                        }
                        className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-0.5"
                      >
                        <Plus size={12} /> Add Block
                      </button>
                    </div>
                    {slide.bodyBlocks.map((b, idx) => (
                      <div
                        key={b.id}
                        className="p-2.5 rounded-xl bg-[#FAF6F0] border border-zinc-200 space-y-1.5"
                      >
                        <div className="flex items-center gap-1.5">
                          <input
                            value={b.heading || ''}
                            onChange={(e) =>
                              updateActiveSlide({
                                bodyBlocks: slide.bodyBlocks.map((item, i) =>
                                  i === idx
                                    ? { ...item, heading: e.target.value }
                                    : item
                                ),
                              })
                            }
                            placeholder="Optional heading (blank = clean)"
                            className="flex-1 font-bold bg-white px-2 py-1 rounded-lg border border-zinc-200"
                          />
                          <select
                            value={b.style || (slide.phase === 'explanation' ? 'plain' : 'card')}
                            onChange={(e) =>
                              updateActiveSlide({
                                bodyBlocks: slide.bodyBlocks.map((item, i) =>
                                  i === idx
                                    ? {
                                        ...item,
                                        style: e.target.value as 'plain' | 'card' | 'highlight' | 'step',
                                      }
                                    : item
                                ),
                              })
                            }
                            title="Block box style"
                            className="px-1.5 py-1 rounded-lg text-[10px] font-bold border border-zinc-300 bg-white text-zinc-700"
                          >
                            <option value="plain">Plain Text</option>
                            <option value="card">Boxed Card</option>
                            <option value="highlight">Highlight Box</option>
                            <option value="step">Step Card</option>
                          </select>
                          <button
                            onClick={() =>
                              updateActiveSlide({
                                bodyBlocks: slide.bodyBlocks.map((item, i) =>
                                  i === idx
                                    ? {
                                        ...item,
                                        layer: item.layer === 'bottom' ? 'top' : 'bottom',
                                      }
                                    : item
                                ),
                              })
                            }
                            title="Switch between Top Layer (Creamy White) and Bottom Layer (White Text)"
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition shrink-0 ${
                              b.layer === 'bottom'
                                ? 'bg-zinc-900 text-white border-zinc-900'
                                : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                            }`}
                          >
                            {b.layer === 'bottom' ? 'Bottom Layer' : 'Top Layer'}
                          </button>
                          <button
                            onClick={() =>
                              updateActiveSlide({
                                bodyBlocks: slide.bodyBlocks.filter(
                                  (_, i) => i !== idx
                                ),
                              })
                            }
                            className="p-1 text-zinc-400 hover:text-rose-600"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <textarea
                          value={b.content}
                          rows={3}
                          onChange={(e) =>
                            updateActiveSlide({
                              bodyBlocks: slide.bodyBlocks.map((item, i) =>
                                i === idx
                                  ? { ...item, content: e.target.value }
                                  : item
                              ),
                            })
                          }
                          className="w-full p-2 rounded-lg border border-zinc-200 bg-white resize-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* AI Surgical & Bespoke Designer Tab */
              <div className="space-y-5">
                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-[#FAF6F0] border border-zinc-200 space-y-2.5">
                  <h4 className="font-bold text-zinc-900 flex items-center gap-1.5">
                    <Sparkles size={15} className="text-emerald-600" />
                    Surgical Single-Slide Revision
                  </h4>
                  <p className="text-[11px] text-zinc-600">
                    Rewrites <strong>only Slide {slide.slideNumber}</strong> using full sequence context—no other slides are touched or re-billed.
                  </p>
                  <textarea
                    value={surgicalPrompt}
                    onChange={(e) => setSurgicalPrompt(e.target.value)}
                    rows={3}
                    placeholder="e.g. Turn this into a collaborative pair ranking debate with 3 concise rules and a stretch challenge..."
                    className="w-full p-2.5 rounded-xl border border-zinc-300 bg-white resize-none"
                  />
                  <button
                    onClick={() => void handleSurgicalSlideAi()}
                    disabled={aiBusy !== null || !surgicalPrompt.trim()}
                    className="w-full py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {aiBusy === 'surgical' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    <span>Revise Only This Slide</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptModalTarget('surgical')}
                    className="w-full py-2 rounded-xl border border-zinc-300 bg-white text-zinc-700 font-bold hover:bg-zinc-100 flex items-center justify-center gap-1.5"
                  >
                    <Terminal size={13} className="text-emerald-600" />
                    <span>Copy Prompt / Paste AI (No API Key)</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-violet-950 text-white space-y-2.5">
                  <h4 className="font-bold flex items-center gap-1.5 text-violet-200">
                    <Wand2 size={15} />
                    Design Unique Non-Template Slide
                  </h4>
                  <p className="text-[11px] text-violet-200/80 leading-relaxed">
                    Instructs Gemini with our custom SVG Paper-Cut & Spatial Layout toolkit to craft a bespoke 3D slide with custom curves, diagrams, and zero template limits.
                  </p>
                  <textarea
                    value={bespokePrompt}
                    onChange={(e) => setBespokePrompt(e.target.value)}
                    rows={4}
                    placeholder="e.g. Build a bespoke visual slide illustrating the 3 stages of a CPU Fetch-Decode-Execute cycle with custom SVG blocks and an organic bottom wave..."
                    className="w-full p-2.5 rounded-xl border border-violet-700 bg-white/10 text-white placeholder:text-violet-300/60 resize-none"
                  />
                  <button
                    onClick={() => void handleBespokeSlideAi()}
                    disabled={aiBusy !== null || !bespokePrompt.trim()}
                    className="w-full py-2.5 rounded-xl bg-violet-400 text-violet-950 font-bold hover:bg-violet-300 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {aiBusy === 'bespoke' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Wand2 size={14} />
                    )}
                    <span>Craft Bespoke Slide with AI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptModalTarget('bespoke')}
                    className="w-full py-2 rounded-xl bg-violet-900 border border-violet-700 text-violet-100 font-bold hover:bg-violet-800 flex items-center justify-center gap-1.5"
                  >
                    <Terminal size={13} className="text-violet-300" />
                    <span>Copy Bespoke Prompt / Paste AI</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <MediaPickerModal
        isOpen={mediaOpen}
        currentMedia={slide.mediaItem}
        pexelsApiKey={settings.pexelsApiKey}
        pixabayApiKey={settings.pixabayApiKey}
        onClose={() => setMediaOpen(false)}
        onSelectMedia={(media) =>
          updateActiveSlide({
            mediaItem:
              slide.presetId === 'lesson-title-page'
                ? {
                    ...media,
                    placement:
                      slide.mediaItem?.placement ?? 'fill-bottom-layer',
                    cropFit: 'cover',
                  }
                : media,
          })
        }
      />

      <SlideLayoutWaveModal
        isOpen={pickerModalMode !== null}
        mode={pickerModalMode || 'change-preset'}
        initialPresetId={slide.presetId}
        initialWaveVariant={slide.waveVariant}
        initialPhase={slide.phase}
        initialInvertWaveLayers={Boolean(slide.invertWaveLayers)}
        onClose={() => setPickerModalMode(null)}
        onSelectPresetOnly={(presetId, recommendedWave) => {
          updateActiveSlide({
            presetId,
            ...(recommendedWave && presetId === 'mwb-starter-quadrant'
              ? { waveVariant: recommendedWave, waveControlPoints: undefined }
              : {}),
          });
        }}
        onSelectWaveOnly={(waveVariant, invertWaveLayers) => {
          updateActiveSlide({
            waveVariant,
            ...(invertWaveLayers !== undefined ? { invertWaveLayers } : {}),
            customWaveLayers: undefined,
            waveControlPoints: undefined,
          });
        }}
        onCompleteNewSlide={createSlideFromWizard}
      />

      <PromptCopyPasteModal
        isOpen={promptModalTarget !== null}
        title={
          promptModalTarget === 'bespoke'
            ? `Slide ${slide.slideNumber}: Bespoke Designer Prompt / Paste JSON`
            : `Slide ${slide.slideNumber}: Surgical Revision Prompt / Paste JSON`
        }
        promptText={
          promptModalTarget === 'bespoke'
            ? buildBespokeSlidePrompt(
                sequence,
                lesson,
                slide,
                bespokePrompt.trim() ||
                  'Design an engaging bespoke two-layer visual slide for this concept.'
              )
            : buildStage4SlidesPrompt(
                sequence,
                lesson,
                slide.id,
                surgicalPrompt.trim() || 'Improve clarity and pupil engagement.'
              )
        }
        onClose={() => setPromptModalTarget(null)}
        onApplyResponse={(raw) => {
          if (promptModalTarget === 'bespoke') {
            const bespoke = parseBespokeSlideResponse(raw, slide);
            updateLesson({
              slidesData: lesson.slidesData.map((s) =>
                s.id === slide.id ? bespoke : s
              ),
            });
          } else {
            const updatedList = parseStage4SlidesResponse(raw, lesson, slide.id);
            updateLesson({ slidesData: updatedList });
          }
        }}
      />
    </div>
  );
};
