import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock,
  Lightbulb,
  Loader2,
  Lock,
  Plus,
  Sparkles,
  Terminal,
  Trash2,
} from 'lucide-react';
import {
  AppSettings,
  LessonPhase,
  LessonSequence,
  PlannedLesson,
  RoutineIconType,
  SlideBlueprint,
  SlideData,
  SlidePresetId,
} from '../../types/curriculum';
import {
  PHASE_PALETTES,
  ROUTINE_ICON_META,
  SLIDE_PRESETS,
} from '../../data/palettes';
import {
  parseStage3BlueprintResponse,
  parseStage4SlidesResponse,
  runStage3BlueprintGeneration,
  runStage4SlidesGeneration,
} from '../../services/geminiService';
import {
  buildStage3BlueprintPrompt,
  buildStage4SlidesPrompt,
} from '../../services/pedagogyPrompts';
import { RoutineBadgeIcon } from '../canvas/RoutineBadgeIcon';
import { PromptCopyPasteModal } from '../modals/PromptCopyPasteModal';

interface Stage3BlueprintViewProps {
  sequence: LessonSequence;
  activeLessonId: string | null;
  settings: AppSettings;
  onSelectLesson: (lessonId: string) => void;
  onUpdateSequence: (updated: LessonSequence) => void;
  onOpenStage4Studio: (lessonId: string) => void;
}

export const Stage3BlueprintView: React.FC<Stage3BlueprintViewProps> = ({
  sequence,
  activeLessonId,
  settings,
  onSelectLesson,
  onUpdateSequence,
  onOpenStage4Studio,
}) => {
  const [globalFeedback, setGlobalFeedback] = useState('');
  const [slideFeedback, setSlideFeedback] = useState<Record<string, string>>({});
  const [loadingTarget, setLoadingTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promptModalTarget, setPromptModalTarget] = useState<
    'blueprint-all' | 'stage4-all' | number | null
  >(null);

  if (!sequence.stage2Approved || sequence.lessons.length === 0) {
    return (
      <div className="max-w-3xl mx-auto mt-16 p-8 rounded-3xl bg-white border border-zinc-200 text-center space-y-3">
        <Lock className="mx-auto text-amber-600" size={32} />
        <h3 className="text-lg font-bold text-zinc-900">
          Stage 3 is Locked Until Stage 2 Sequence Progression Is Approved
        </h3>
        <p className="text-sm text-zinc-600">
          Approve your lesson-by-lesson progression in Stage 2 before building individual slide blueprints.
        </p>
      </div>
    );
  }

  const lesson =
    sequence.lessons.find((l) => l.id === activeLessonId) || sequence.lessons[0];

  const updateLesson = (patch: Partial<PlannedLesson>) => {
    onUpdateSequence({
      ...sequence,
      updatedAt: new Date().toISOString(),
      lessons: sequence.lessons.map((l) =>
        l.id === lesson.id ? { ...l, ...patch } : l
      ),
    });
  };

  const plannedTotal = lesson.slidesBlueprint.reduce(
    (sum, s) => sum + (s.allocatedMinutes || 0),
    0
  );
  const targetBudget = Math.round(lesson.durationMinutes * 0.85);
  const bufferMins = lesson.durationMinutes - targetBudget;
  const isOverBudget = plannedTotal > targetBudget;
  const pctUsed = Math.min(100, (plannedTotal / lesson.durationMinutes) * 100);

  const handleGenerateBlueprint = async (targetSlideNum?: number) => {
    const key = targetSlideNum ? `slide-${targetSlideNum}` : 'all';
    setLoadingTarget(key);
    setError(null);
    try {
      const fb = targetSlideNum
        ? slideFeedback[String(targetSlideNum)]
        : globalFeedback;
      const nextBlueprints = await runStage3BlueprintGeneration(
        settings.geminiApiKey,
        settings.geminiModel,
        sequence,
        lesson,
        targetSlideNum,
        fb?.trim() || undefined
      );
      updateLesson({ slidesBlueprint: nextBlueprints });
      if (targetSlideNum) {
        setSlideFeedback((prev) => ({ ...prev, [String(targetSlideNum)]: '' }));
      } else {
        setGlobalFeedback('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Blueprint generation failed.');
    } finally {
      setLoadingTarget(null);
    }
  };

  const buildLocalFallbackSlides = (bps: SlideBlueprint[]): SlideData[] =>
    bps.map((bp) => {
      const preset = SLIDE_PRESETS.find((p) => p.id === bp.presetId);
      const isStarter = bp.presetId === 'mwb-starter-quadrant';
      const isTitlePage = bp.presetId === 'lesson-title-page';
      return {
        id: `sl-${lesson.lessonNumber}-${bp.slideNumber}-${Date.now()}`,
        blueprintId: bp.id,
        slideNumber: bp.slideNumber,
        phase: bp.phase,
        presetId: bp.presetId,
        waveVariant: preset?.recommendedWave || 'corner-cavern-tr',
        title: bp.title,
        lessonDate: isTitlePage
          ? new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          : undefined,
        bigQuestion:
          bp.presetId === 'title-divider' || isTitlePage
            ? ''
            : undefined,
        bodyBlocks:
          isStarter || isTitlePage
            ? []
            : [
                {
                  id: `blk-${bp.id}-1`,
                  heading: '',
                  dualCodeIcon: 'concept',
                  content: '• Click directly on the slide to type concise pupil-facing points.',
                  style: bp.phase === 'explanation' ? 'plain' : 'card',
                },
              ],
        starterQuadrants: isStarter
          ? [
              {
                id: 'q1',
                label: '1',
                question: lesson.starterRetrievalFocus.q1LastLesson || 'Question 1...',
                options: ['A. Choice A', 'B. Choice B', 'C. Choice C', 'D. Choice D'],
                answer: 'A — Choice A',
              },
              {
                id: 'q2',
                label: '2',
                question: lesson.starterRetrievalFocus.q2LastWeek || 'Question 2...',
                options: ['A. Choice A', 'B. Choice B', 'C. Choice C', 'D. Choice D'],
                answer: 'B — Choice B',
              },
              {
                id: 'q3',
                label: '3',
                question: lesson.starterRetrievalFocus.q3EarlierTopic || 'Question 3...',
                options: ['A. Choice A', 'B. Choice B', 'C. Choice C', 'D. Choice D'],
                answer: 'C — Choice C',
              },
              {
                id: 'q4',
                label: '4',
                question: lesson.starterRetrievalFocus.q4Challenge || 'Question 4...',
                options: ['A. Choice A', 'B. Choice B', 'C. Choice C', 'D. Choice D'],
                answer: 'D — Choice D',
              },
            ]
          : undefined,
        routineIcons: bp.routineIcons,
        timerSeconds:
          bp.phase === 'starter' || bp.phase === 'task'
            ? bp.allocatedMinutes * 60
            : undefined,
        speakerNotes: `${bp.contentSummary}\nPupil task: ${bp.pupilActivity}`,
        pedagogicalBadges: bp.pedagogicalRationale,
      };
    });

  const handleApproveAndGenerateDeck = async (forceRegenerate = false) => {
    if (lesson.slidesData.length > 0 && !forceRegenerate) {
      updateLesson({ stage3Approved: true });
      onOpenStage4Studio(lesson.id);
      return;
    }

    if (!settings.geminiApiKey.trim()) {
      updateLesson({ stage3Approved: true });
      setPromptModalTarget('stage4-all');
      return;
    }

    setLoadingTarget('stage4');
    setError(null);
    try {
      const generatedSlides = await runStage4SlidesGeneration(
        settings.geminiApiKey,
        settings.geminiModel,
        sequence,
        lesson
      );
      updateLesson({
        stage3Approved: true,
        slidesData: generatedSlides,
      });
      onOpenStage4Studio(lesson.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Slide deck generation failed.'
      );
    } finally {
      setLoadingTarget(null);
    }
  };

  const updateSlideBp = (id: string, patch: Partial<SlideBlueprint>) => {
    updateLesson({
      slidesBlueprint: lesson.slidesBlueprint.map((s) =>
        s.id === id ? { ...s, ...patch } : s
      ),
    });
  };

  const addBlankSlideBp = () => {
    const num = lesson.slidesBlueprint.length + 1;
    const next: SlideBlueprint = {
      id: `bp-${lesson.lessonNumber}-${Date.now()}`,
      slideNumber: num,
      title: `Slide ${num}: New Activity`,
      phase: 'task',
      presetId: 'active-task-scaffolds',
      allocatedMinutes: 5,
      contentSummary: 'Key prompt or explanation...',
      pupilActivity: 'Structured pupil activity...',
      routineIcons: ['pair-discussion'],
      conceptsIntroducedHere: [],
      pedagogicalRationale: {
        principle: 'Active Processing',
        cognitiveLoadNote: 'Breaks up explanation with pupil application.',
      },
    };
    updateLesson({ slidesBlueprint: [...lesson.slidesBlueprint, next] });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Lesson Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {sequence.lessons.map((l) => (
          <button
            key={l.id}
            onClick={() => onSelectLesson(l.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold border transition ${
              l.id === lesson.id
                ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            L{l.lessonNumber}: {l.title}
          </button>
        ))}
        {sequence.lessons.length > 1 && (
          <button
            onClick={() => {
              if (
                window.confirm(
                  `Are you sure you want to delete Lesson ${lesson.lessonNumber}: "${lesson.title}"?`
                )
              ) {
                const filtered = sequence.lessons.filter((l) => l.id !== lesson.id);
                const renumbered = filtered.map((l, idx) => ({
                  ...l,
                  lessonNumber: idx + 1,
                }));
                onUpdateSequence({
                  ...sequence,
                  lessonCount: renumbered.length,
                  lessons: renumbered,
                  updatedAt: new Date().toISOString(),
                });
                if (renumbered[0]) {
                  onSelectLesson(renumbered[0].id);
                }
              }
            }}
            className="px-3 py-2 rounded-2xl text-xs font-semibold text-zinc-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition flex items-center gap-1.5"
            title={`Delete Lesson ${lesson.lessonNumber}`}
          >
            <Trash2 size={13} />
            <span>Delete Lesson</span>
          </button>
        )}
      </div>

      {/* 85% Time Budget & AI Planning Header */}
      <div className="rounded-3xl bg-white border border-zinc-200/90 shadow-xs p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900">
              Stage 3 of 4 • individual slide plan
            </span>
            <h2 className="text-xl font-display font-extrabold text-zinc-900 mt-1.5">
              Lesson {lesson.lessonNumber}: {lesson.title}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 bg-[#FAF6F0] px-3.5 py-2 rounded-xl border border-zinc-200 text-xs font-semibold">
              <Clock size={14} className="text-zinc-500" />
              <span>Total Lesson Time:</span>
              <input
                type="number"
                min={20}
                max={120}
                value={lesson.durationMinutes}
                onChange={(e) => {
                  const d = Math.max(20, Number(e.target.value) || 60);
                  const b = Math.round(d * 0.85);
                  updateLesson({
                    durationMinutes: d,
                    timeBudgetMinutes: b,
                    bufferMinutes: d - b,
                  });
                }}
                className="w-12 font-bold text-zinc-900 bg-transparent focus:outline-none"
              />
              <span>mins</span>
            </label>
          </div>
        </div>

        {/* Visual 85% Pacing Bar */}
        <div className="p-4 rounded-2xl bg-[#FAF6F0] border border-zinc-200/80 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-zinc-800">
              <span>
                Planned Slides: {plannedTotal} mins / {targetBudget} mins max target (85%)
              </span>
              {isOverBudget ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  <AlertTriangle size={12} /> Exceeds 85% budget by{' '}
                  {plannedTotal - targetBudget}m
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  <CheckCircle2 size={12} /> {bufferMins}m (15%) Transition &
                  Reteach Buffer Protected
                </span>
              )}
            </div>
            <span className="font-mono text-zinc-500">
              {lesson.slidesBlueprint.length} slides • {Math.round(pctUsed)}% of{' '}
              {lesson.durationMinutes}m
            </span>
          </div>

          {/* Stacked Phase Bar */}
          <div className="h-5 w-full rounded-xl bg-zinc-200/80 overflow-hidden flex relative">
            {lesson.slidesBlueprint.map((bp) => {
              const widthPct = (bp.allocatedMinutes / lesson.durationMinutes) * 100;
              const color = PHASE_PALETTES[bp.phase].accent;
              return (
                <div
                  key={bp.id}
                  title={`Slide ${bp.slideNumber}: ${bp.title} (${bp.allocatedMinutes}m)`}
                  style={{ width: `${widthPct}%`, backgroundColor: color }}
                  className="h-full border-r border-white/60 flex items-center justify-center text-[10px] font-bold text-white truncate px-1"
                >
                  {bp.allocatedMinutes >= 4 ? `S${bp.slideNumber}` : ''}
                </div>
              );
            })}
            {/* 85% Threshold Marker */}
            <div
              style={{ left: '85%' }}
              className="absolute top-0 bottom-0 w-0.5 bg-zinc-900 z-10"
              title="85% Pacing Limit (15% Contingency Buffer)"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-600 pt-0.5">
            {Object.values(PHASE_PALETTES).map((p) => (
              <span key={p.phase} className="inline-flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: p.accent }}
                />
                <strong className="capitalize">{p.phase}</strong>
              </span>
            ))}
          </div>
        </div>

        {/* AI Blueprint Generator Bar */}
        <div className="p-4 rounded-2xl bg-zinc-900 text-white flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <Sparkles size={18} className="text-amber-300 shrink-0" />
          <input
            type="text"
            value={globalFeedback}
            onChange={(e) => setGlobalFeedback(e.target.value)}
            placeholder="Steer this lesson blueprint (e.g. 'Include a 12-min unplugged card sort, keep to 8 crisp slides')..."
            className="flex-1 bg-white/10 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            onClick={() => void handleGenerateBlueprint()}
            disabled={loadingTarget !== null}
            className="px-4 py-2 rounded-xl bg-amber-400 text-zinc-950 font-bold text-sm hover:bg-amber-300 disabled:opacity-60 flex items-center justify-center gap-2 shrink-0 transition"
          >
            {loadingTarget === 'all' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            <span>
              {lesson.slidesBlueprint.length > 0
                ? 'Re-Plan Blueprint'
                : 'Generate Slide Blueprint'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPromptModalTarget('blueprint-all')}
            className="px-3.5 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 font-bold text-xs hover:bg-zinc-700 flex items-center gap-1.5 shrink-0 transition"
            title="Copy blueprint prompt & paste JSON response without an API key"
          >
            <Terminal size={14} className="text-amber-400" />
            <span>Copy Prompt / Paste AI</span>
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Slide-by-Slide Blueprint List */}
      <div className="space-y-4">
        {lesson.slidesBlueprint.map((bp, idx) => {
          const palette = PHASE_PALETTES[bp.phase];
          return (
            <div
              key={bp.id}
              className="rounded-3xl bg-white border border-zinc-200/90 shadow-xs overflow-hidden flex flex-col md:flex-row"
            >
              {/* Phase Color Accent Spine */}
              <div
                className="w-full md:w-3 shrink-0"
                style={{ backgroundColor: palette.accent }}
              />

              <div className="flex-1 p-5 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
                    <span
                      className="w-8 h-8 rounded-xl text-white font-mono text-xs font-extrabold flex items-center justify-center shrink-0"
                      style={{ backgroundColor: palette.accent }}
                    >
                      S{idx + 1}
                    </span>
                    <input
                      value={bp.title}
                      onChange={(e) =>
                        updateSlideBp(bp.id, { title: e.target.value })
                      }
                      className="flex-1 font-display font-bold text-base text-zinc-900 bg-transparent focus:outline-none focus:bg-[#FAF6F0] rounded-lg px-2 py-0.5"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* Phase Selector (implicitly sets palette) */}
                    <select
                      value={bp.phase}
                      onChange={(e) =>
                        updateSlideBp(bp.id, {
                          phase: e.target.value as LessonPhase,
                        })
                      }
                      className="px-2.5 py-1.5 rounded-xl border border-zinc-200 bg-[#FAF6F0] font-semibold capitalize"
                    >
                      <option value="starter">Starter (Ocean Blue)</option>
                      <option value="explanation">Explanation (Emerald)</option>
                      <option value="guided">Guided Check (Berry)</option>
                      <option value="task">Pupil Task (Terracotta)</option>
                      <option value="plenary">Plenary (Violet)</option>
                    </select>

                    {/* Preset Selector */}
                    <select
                      value={bp.presetId}
                      onChange={(e) =>
                        updateSlideBp(bp.id, {
                          presetId: e.target.value as SlidePresetId,
                        })
                      }
                      className="px-2.5 py-1.5 rounded-xl border border-zinc-200 bg-[#FAF6F0] font-semibold"
                    >
                      {SLIDE_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    {/* Minutes Stepper */}
                    <div className="flex items-center gap-1 bg-zinc-100 rounded-xl px-2 py-1 font-mono font-bold">
                      <button
                        onClick={() =>
                          updateSlideBp(bp.id, {
                            allocatedMinutes: Math.max(1, bp.allocatedMinutes - 1),
                          })
                        }
                        className="px-1.5 hover:text-zinc-950"
                      >
                        -
                      </button>
                      <span className="w-8 text-center">
                        {bp.allocatedMinutes}m
                      </span>
                      <button
                        onClick={() =>
                          updateSlideBp(bp.id, {
                            allocatedMinutes: bp.allocatedMinutes + 1,
                          })
                        }
                        className="px-1.5 hover:text-zinc-950"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() =>
                        updateLesson({
                          slidesBlueprint: lesson.slidesBlueprint.filter(
                            (s) => s.id !== bp.id
                          ),
                        })
                      }
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Delete Slide"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Content & Pupil Activity */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="p-3.5 rounded-2xl bg-[#FAF6F0] border border-zinc-200/70">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-zinc-500 block mb-1.5">
                      Planned Slide Content
                    </span>
                    <textarea
                      value={bp.contentSummary}
                      rows={Math.max(4, Math.min(12, Math.ceil((bp.contentSummary || '').length / 55)))}
                      onChange={(e) =>
                        updateSlideBp(bp.id, { contentSummary: e.target.value })
                      }
                      className="w-full min-h-[110px] bg-transparent text-zinc-800 text-sm leading-relaxed resize-y focus:outline-none"
                    />
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#FAF6F0] border border-zinc-200/70">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-zinc-500 block mb-1.5">
                      What Pupils Are Doing
                    </span>
                    <textarea
                      value={bp.pupilActivity}
                      rows={Math.max(4, Math.min(12, Math.ceil((bp.pupilActivity || '').length / 55)))}
                      onChange={(e) =>
                        updateSlideBp(bp.id, { pupilActivity: e.target.value })
                      }
                      className="w-full min-h-[110px] bg-transparent text-zinc-800 text-sm leading-relaxed resize-y focus:outline-none"
                    />
                  </div>
                </div>

                {/* Routine Icons Toggle Strip */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-zinc-500 mr-1">
                    Routines:
                  </span>
                  {(Object.keys(ROUTINE_ICON_META) as RoutineIconType[]).map(
                    (iconKey) => {
                      const active = bp.routineIcons.includes(iconKey);
                      return (
                        <button
                          key={iconKey}
                          onClick={() =>
                            updateSlideBp(bp.id, {
                              routineIcons: active
                                ? bp.routineIcons.filter((r) => r !== iconKey)
                                : [...bp.routineIcons, iconKey],
                            })
                          }
                          className={`transition rounded-full ${
                            active
                              ? 'ring-2 ring-offset-1 ring-zinc-800'
                              : 'opacity-45 hover:opacity-85'
                          }`}
                        >
                          <RoutineBadgeIcon type={iconKey} compact />
                        </button>
                      );
                    }
                  )}
                </div>

                {/* Teacher-Only Pedagogical Callout Badges (NEVER on pupil slides!) */}
                {settings.showPedagogicalCallouts && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-semibold">
                      <Lightbulb size={13} className="text-emerald-700" />
                      {bp.pedagogicalRationale.principle}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-violet-50 border border-violet-200 text-violet-900 text-[11px]">
                      <Brain size={13} className="text-violet-700" />
                      <strong>CLT:</strong>{' '}
                      {bp.pedagogicalRationale.cognitiveLoadNote}
                    </span>
                    {bp.pedagogicalRationale.retrievalLink && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-[11px]">
                        <strong>Retrieval:</strong>{' '}
                        {bp.pedagogicalRationale.retrievalLink}
                      </span>
                    )}
                    <span className="text-[10px] italic text-zinc-400 ml-auto">
                      Teacher blueprint only (hidden from pupils)
                    </span>
                  </div>
                )}

                {/* Per-Slide Surgical AI Revision */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={slideFeedback[String(bp.slideNumber)] || ''}
                    onChange={(e) =>
                      setSlideFeedback((prev) => ({
                        ...prev,
                        [String(bp.slideNumber)]: e.target.value,
                      }))
                    }
                    placeholder={`Surgical AI tweak for Slide ${bp.slideNumber}...`}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    onClick={() => void handleGenerateBlueprint(bp.slideNumber)}
                    disabled={
                      loadingTarget !== null ||
                      !(slideFeedback[String(bp.slideNumber)] || '').trim()
                    }
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 text-white text-xs font-bold hover:bg-zinc-950 disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {loadingTarget === `slide-${bp.slideNumber}` ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    <span>Revise Slide {bp.slideNumber}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptModalTarget(bp.slideNumber)}
                    className="px-2.5 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 text-xs font-bold hover:bg-zinc-100 flex items-center gap-1 transition"
                    title="Copy surgical prompt for this slide / paste AI JSON"
                  >
                    <Terminal size={12} className="text-amber-600" />
                    <span>Copy/Paste</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        <button
          onClick={addBlankSlideBp}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-zinc-300 text-zinc-600 text-xs font-bold hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50/30 flex items-center justify-center gap-1.5 transition"
        >
          <Plus size={15} /> Add Slide to Blueprint
        </button>
      </div>

      {/* Stage 3 Gate Footer */}
      {lesson.slidesBlueprint.length > 0 && (
        <div className="rounded-3xl bg-[#FAF6F0] border-2 border-amber-300 p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-zinc-900">
              Stage 3 Gate: Approve Blueprint to Build Stage 4 Slide Deck
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">
              {settings.geminiApiKey.trim()
                ? 'Uses your Gemini API key with full sequence context to write clean pupil-facing slides.'
                : 'No Gemini key set — clicking Approve opens the Copy Prompt / Paste AI modal so your LLM generates clean pupil-facing slides (never raw teacher notes).'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!settings.geminiApiKey.trim() && (
              <button
                type="button"
                onClick={() => {
                  const blanks = buildLocalFallbackSlides(lesson.slidesBlueprint);
                  updateLesson({ stage3Approved: true, slidesData: blanks });
                  onOpenStage4Studio(lesson.id);
                }}
                className="px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-600 text-xs font-semibold hover:bg-zinc-100 transition"
                title="Open blank editable slide frames without running Stage 4 AI"
              >
                Blank Frames Only
              </button>
            )}
            <button
              type="button"
              onClick={() => setPromptModalTarget('stage4-all')}
              className="px-3.5 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-800 text-xs font-bold hover:bg-zinc-100 flex items-center gap-1.5 transition"
            >
              <Terminal size={14} className="text-emerald-600" />
              <span>Copy Stage 4 Prompt / Paste Slides JSON</span>
            </button>
            {lesson.slidesData.length > 0 && (
              <button
                onClick={() => void handleApproveAndGenerateDeck(true)}
                disabled={loadingTarget !== null}
                className="px-4 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-700 text-xs font-bold hover:bg-zinc-50 flex items-center gap-1.5"
              >
                <Sparkles size={14} /> Regenerate All Slides from Blueprint
              </button>
            )}
            <button
              onClick={() => void handleApproveAndGenerateDeck(false)}
              disabled={loadingTarget !== null}
              className="px-6 py-3 rounded-2xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 shadow-md shadow-emerald-600/20 flex items-center gap-2 transition disabled:opacity-60"
            >
              {loadingTarget === 'stage4' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowRight size={16} />
              )}
              <span>
                {lesson.slidesData.length > 0
                  ? 'Open Stage 4 Slide Studio'
                  : 'Approve Blueprint & Build Slides'}
              </span>
            </button>
          </div>
        </div>
      )}

      <PromptCopyPasteModal
        isOpen={promptModalTarget !== null}
        title={
          promptModalTarget === 'stage4-all'
            ? `Stage 4: Copy Full Slide Deck Prompt / Paste Slides JSON (Lesson ${lesson.lessonNumber})`
            : promptModalTarget === 'blueprint-all'
            ? 'Stage 3: Copy Lesson Blueprint Prompt / Paste AI Response'
            : `Stage 3: Revise Slide ${promptModalTarget} Blueprint Prompt / Paste JSON`
        }
        promptText={
          promptModalTarget === 'stage4-all'
            ? buildStage4SlidesPrompt(sequence, lesson)
            : typeof promptModalTarget === 'number'
            ? buildStage3BlueprintPrompt(
                sequence,
                lesson,
                promptModalTarget,
                slideFeedback[String(promptModalTarget)]?.trim() || undefined
              )
            : buildStage3BlueprintPrompt(
                sequence,
                lesson,
                undefined,
                globalFeedback.trim() || undefined
              )
        }
        onClose={() => setPromptModalTarget(null)}
        onApplyResponse={(raw) => {
          if (promptModalTarget === 'stage4-all') {
            const slides = parseStage4SlidesResponse(raw, lesson);
            updateLesson({ stage3Approved: true, slidesData: slides });
            onOpenStage4Studio(lesson.id);
          } else {
            const nextBlueprints = parseStage3BlueprintResponse(raw);
            updateLesson({ slidesBlueprint: nextBlueprints });
          }
        }}
      />
    </div>
  );
};
