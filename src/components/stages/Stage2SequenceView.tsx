import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Lock,
  Plus,
  Sparkles,
  Terminal,
  Trash2,
  Users,
} from 'lucide-react';
import {
  AppSettings,
  LessonSequence,
  PlannedLesson,
} from '../../types/curriculum';
import {
  parseStage2Response,
  runStage2Generation,
} from '../../services/geminiService';
import { buildStage2Prompt } from '../../services/pedagogyPrompts';
import { PromptCopyPasteModal } from '../modals/PromptCopyPasteModal';

interface Stage2SequenceViewProps {
  sequence: LessonSequence;
  settings: AppSettings;
  onUpdateSequence: (updated: LessonSequence) => void;
  onOpenLessonStage3: (lessonId: string) => void;
  onApproveAndProceed: () => void;
}

export const Stage2SequenceView: React.FC<Stage2SequenceViewProps> = ({
  sequence,
  settings,
  onUpdateSequence,
  onOpenLessonStage3,
  onApproveAndProceed,
}) => {
  const [globalFeedback, setGlobalFeedback] = useState('');
  const [lessonFeedback, setLessonFeedback] = useState<Record<number, string>>({});
  const [loadingLesson, setLoadingLesson] = useState<number | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promptTargetLesson, setPromptTargetLesson] = useState<
    number | 'all' | null
  >(null);

  const handleDeleteLesson = (lessonId: string) => {
    const l = sequence.lessons.find((item) => item.id === lessonId);
    if (!l) return;
    if (
      !window.confirm(
        `Are you sure you want to delete Lesson ${l.lessonNumber}: "${l.title}"?`
      )
    ) {
      return;
    }
    const filtered = sequence.lessons.filter((item) => item.id !== lessonId);
    const renumbered = filtered.map((item, idx) => ({
      ...item,
      lessonNumber: idx + 1,
    }));
    onUpdateSequence({
      ...sequence,
      lessonCount: renumbered.length,
      lessons: renumbered,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddLesson = () => {
    const nextNum = sequence.lessons.length + 1;
    const newLesson: PlannedLesson = {
      id: `lesson-${Date.now()}`,
      lessonNumber: nextNum,
      title: `Lesson ${nextNum}`,
      durationMinutes: sequence.defaultLessonMinutes || 60,
      timeBudgetMinutes: Math.round((sequence.defaultLessonMinutes || 60) * 0.85),
      bufferMinutes: Math.round((sequence.defaultLessonMinutes || 60) * 0.15),
      summary: '',
      knowIds: [],
      doIds: [],
      understandIds: [],
      starterRetrievalFocus: {
        q1LastLesson: '',
        q2LastWeek: '',
        q3EarlierTopic: '',
        q4Challenge: '',
      },
      activeTaskTypes: [],
      pedagogicalRationale: '',
      stage3Approved: false,
      slidesBlueprint: [],
      slidesData: [],
    };
    onUpdateSequence({
      ...sequence,
      lessonCount: nextNum,
      lessons: [...sequence.lessons, newLesson],
      updatedAt: new Date().toISOString(),
    });
  };

  const handleGenerateAll = async () => {
    setLoadingLesson('all');
    setError(null);
    try {
      const nextLessons = await runStage2Generation(
        settings.geminiApiKey,
        settings.geminiModel,
        sequence,
        undefined,
        globalFeedback.trim() || undefined
      );
      onUpdateSequence({
        ...sequence,
        updatedAt: new Date().toISOString(),
        lessons: nextLessons,
      });
      setGlobalFeedback('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sequence generation failed.');
    } finally {
      setLoadingLesson(null);
    }
  };

  const handleSurgicalLessonRefine = async (lessonNumber: number) => {
    const fb = lessonFeedback[lessonNumber] || '';
    if (!fb.trim()) return;
    setLoadingLesson(lessonNumber);
    setError(null);
    try {
      const nextLessons = await runStage2Generation(
        settings.geminiApiKey,
        settings.geminiModel,
        sequence,
        lessonNumber,
        fb
      );
      onUpdateSequence({
        ...sequence,
        updatedAt: new Date().toISOString(),
        lessons: nextLessons,
      });
      setLessonFeedback((prev) => ({ ...prev, [lessonNumber]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lesson refinement failed.');
    } finally {
      setLoadingLesson(null);
    }
  };

  const updateLessonField = (
    lessonId: string,
    patch: Partial<PlannedLesson>
  ) => {
    onUpdateSequence({
      ...sequence,
      lessons: sequence.lessons.map((l) =>
        l.id === lessonId ? { ...l, ...patch } : l
      ),
    });
  };

  if (!sequence.stage1Approved) {
    return (
      <div className="max-w-3xl mx-auto mt-16 p-8 rounded-3xl bg-white border border-zinc-200 text-center space-y-3">
        <Lock className="mx-auto text-amber-600" size={32} />
        <h3 className="text-lg font-bold text-zinc-900">
          Stage 2 is Locked Until Stage 1 Objectives Are Approved
        </h3>
        <p className="text-sm text-zinc-600">
          Starting Point never builds lessons blindly. Review and approve your Know / Do / Understand objectives in Stage 1 first.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Top Control Header */}
      <div className="rounded-3xl bg-white border border-zinc-200/90 shadow-xs p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-sky-100 text-sky-800">
              Stage 2 of 4 • {sequence.lessonCount}-Lesson Sequence Architecture
            </span>
            <h2 className="text-xl font-display font-extrabold text-zinc-900 mt-1.5">
              {sequence.title} — Progression & Spaced Retrieval Map
            </h2>
          </div>
          {sequence.stage2Approved && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white">
              <CheckCircle2 size={14} /> Sequence Approved
            </span>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-sky-950 text-white flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <Sparkles size={18} className="text-sky-300 shrink-0" />
          <input
            type="text"
            value={globalFeedback}
            onChange={(e) => setGlobalFeedback(e.target.value)}
            placeholder="Describe adjustments across the sequence (e.g. 'Spend 2 lessons on packet switching, ensure Lesson 3 has group debate')..."
            className="flex-1 bg-white/10 border border-sky-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-sky-200/60 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <button
            onClick={() => void handleGenerateAll()}
            disabled={loadingLesson !== null}
            className="px-4 py-2 rounded-xl bg-sky-400 text-sky-950 font-bold text-sm hover:bg-sky-300 disabled:opacity-60 flex items-center justify-center gap-2 shrink-0 transition"
          >
            {loadingLesson === 'all' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            <span>
              {sequence.lessons.length > 0
                ? 'Rebalance Sequence Map'
                : `Plan ${sequence.lessonCount} Lessons with AI`}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPromptTargetLesson('all')}
            className="px-3.5 py-2 rounded-xl bg-sky-900 border border-sky-700 text-sky-100 font-bold text-xs hover:bg-sky-800 flex items-center gap-1.5 shrink-0 transition"
            title="Copy prompt & paste response without an API key"
          >
            <Terminal size={14} className="text-sky-300" />
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

      {/* Lesson Progression Cards */}
      <div className="space-y-4">
        {sequence.lessons.map((lesson) => (
          <div
            key={lesson.id}
            className="rounded-3xl bg-white border border-zinc-200/90 shadow-xs p-6 space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-[260px]">
                <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white font-display font-extrabold flex items-center justify-center shrink-0">
                  L{lesson.lessonNumber}
                </div>
                <div className="flex-1">
                  <input
                    value={lesson.title}
                    onChange={(e) =>
                      updateLessonField(lesson.id, { title: e.target.value })
                    }
                    className="w-full text-lg font-display font-bold text-zinc-900 bg-transparent focus:outline-none focus:bg-[#FAF6F0] rounded-lg px-1.5 -mx-1.5"
                  />
                  {lesson.slidesBlueprint.length > 0 && (
                    <div className="mt-1 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                        {lesson.slidesBlueprint.length} slides planned
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenLessonStage3(lesson.id)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 flex items-center gap-1.5 transition"
                >
                  <span>Plan Lesson {lesson.lessonNumber} Slides</span>
                  <ArrowRight size={14} />
                </button>
                {sequence.lessons.length > 1 && (
                  <button
                    onClick={() => handleDeleteLesson(lesson.id)}
                    className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                    title={`Delete Lesson ${lesson.lessonNumber}`}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            <textarea
              value={lesson.summary}
              rows={5}
              onChange={(e) =>
                updateLessonField(lesson.id, { summary: e.target.value })
              }
              placeholder="Overall lesson description..."
              className="w-full min-h-[120px] p-3.5 rounded-2xl bg-[#FAF6F0] border border-zinc-200/70 text-sm leading-relaxed text-zinc-800 resize-y focus:outline-none focus:ring-2 focus:ring-sky-500"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Retrieval Starter */}
              <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200/80 space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-sky-900">
                  Starter
                </p>
                <div className="space-y-2">
                  {(
                    [
                      ['q1LastLesson', '1'],
                      ['q2LastWeek', '2'],
                      ['q3EarlierTopic', '3'],
                      ['q4Challenge', '4'],
                    ] as [keyof PlannedLesson['starterRetrievalFocus'], string][]
                  ).map(([key, numLabel]) => (
                    <div key={key} className="flex items-start gap-2">
                      <span className="font-mono text-xs font-bold text-sky-700 mt-2 shrink-0 w-4">
                        {numLabel}.
                      </span>
                      <textarea
                        value={lesson.starterRetrievalFocus[key]}
                        rows={2}
                        onChange={(e) =>
                          updateLessonField(lesson.id, {
                            starterRetrievalFocus: {
                              ...lesson.starterRetrievalFocus,
                              [key]: e.target.value,
                            },
                          })
                        }
                        className="flex-1 text-xs text-sky-950 bg-white/70 border border-sky-200/70 rounded-xl px-2.5 py-1.5 leading-relaxed resize-y focus:outline-none focus:bg-white focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Pupil Activities */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <Users size={13} /> Activity
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      updateLessonField(lesson.id, {
                        activeTaskTypes: [
                          ...lesson.activeTaskTypes,
                          '15 mins — New pupil activity...',
                        ],
                      })
                    }
                    className="p-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 transition"
                    title="Add activity"
                  >
                    <Plus size={13} />
                  </button>
                </div>
                <div className="space-y-2">
                  {lesson.activeTaskTypes.length === 0 && (
                    <p className="text-xs text-amber-800/70 italic py-2">
                      No activity set yet — click + to add one.
                    </p>
                  )}
                  {lesson.activeTaskTypes.map((task, idx) => (
                    <div key={idx} className="flex items-start gap-2 group">
                      <textarea
                        value={task}
                        rows={2}
                        onChange={(e) =>
                          updateLessonField(lesson.id, {
                            activeTaskTypes: lesson.activeTaskTypes.map((item, i) =>
                              i === idx ? e.target.value : item
                            ),
                          })
                        }
                        className="flex-1 text-xs text-amber-950 bg-white/75 border border-amber-200/80 rounded-xl px-2.5 py-1.5 leading-relaxed resize-y focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateLessonField(lesson.id, {
                            activeTaskTypes: lesson.activeTaskTypes.filter(
                              (_, i) => i !== idx
                            ),
                          })
                        }
                        className="mt-1.5 p-1 text-amber-700/60 hover:text-rose-600 transition"
                        title="Remove activity"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {settings.showPedagogicalCallouts && lesson.pedagogicalRationale && (
              <div className="flex items-start gap-2 text-xs text-emerald-950 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2.5">
                <Lightbulb size={15} className="shrink-0 mt-0.5 text-emerald-700" />
                <span>
                  <strong>Sequence Pedagogy:</strong> {lesson.pedagogicalRationale}
                </span>
              </div>
            )}

            {/* Surgical Single-Lesson AI Refine */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={lessonFeedback[lesson.lessonNumber] || ''}
                onChange={(e) =>
                  setLessonFeedback((prev) => ({
                    ...prev,
                    [lesson.lessonNumber]: e.target.value,
                  }))
                }
                placeholder={`Refine ONLY Lesson ${lesson.lessonNumber} (keeps other lessons untouched)...`}
                className="flex-1 px-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                onClick={() => void handleSurgicalLessonRefine(lesson.lessonNumber)}
                disabled={
                  loadingLesson !== null ||
                  !(lessonFeedback[lesson.lessonNumber] || '').trim()
                }
                className="px-3.5 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 disabled:opacity-40 flex items-center gap-1.5"
              >
                {loadingLesson === lesson.lessonNumber ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} />
                )}
                <span>Revise Lesson {lesson.lessonNumber}</span>
              </button>
              <button
                type="button"
                onClick={() => setPromptTargetLesson(lesson.lessonNumber)}
                title="Copy surgical prompt for this lesson / paste AI JSON"
                className="px-2.5 py-1.5 rounded-xl border border-zinc-200 bg-[#FAF6F0] text-zinc-700 text-xs font-bold hover:bg-zinc-100 flex items-center gap-1 transition"
              >
                <Terminal size={12} className="text-sky-600" />
                <span>Copy/Paste</span>
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={handleAddLesson}
          className="w-full py-3.5 rounded-3xl border-2 border-dashed border-zinc-300 text-zinc-600 font-bold text-xs hover:border-zinc-500 hover:text-zinc-900 hover:bg-white transition flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          <span>Add Lesson to Sequence</span>
        </button>
      </div>

      {/* Stage 2 Gate */}
      {sequence.lessons.length > 0 && (
        <div className="rounded-3xl bg-[#FAF6F0] border-2 border-sky-200 p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-zinc-900">
              Stage 2 Gate: Approve Sequence Progression to Unlock Individual Lesson Blueprints
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">
              Each lesson now tracks its retrieval links and active learning routines without overlap.
            </p>
          </div>
          <button
            onClick={onApproveAndProceed}
            className="px-6 py-3 rounded-2xl bg-sky-600 text-white font-bold text-sm hover:bg-sky-700 shadow-md shadow-sky-600/20 flex items-center gap-2 transition"
          >
            <CheckCircle2 size={17} />
            <span>
              {sequence.stage2Approved
                ? 'Open Lesson Blueprint (Stage 3)'
                : 'Approve Progression & Unlock Stage 3'}
            </span>
          </button>
        </div>
      )}

      <PromptCopyPasteModal
        isOpen={promptTargetLesson !== null}
        title={
          promptTargetLesson === 'all'
            ? 'Stage 2: Copy Lesson Progression Prompt / Paste AI Response'
            : `Stage 2: Revise Lesson ${promptTargetLesson} Prompt / Paste Response`
        }
        promptText={buildStage2Prompt(
          sequence,
          promptTargetLesson === 'all' ? undefined : promptTargetLesson ?? undefined,
          promptTargetLesson === 'all'
            ? globalFeedback.trim() || undefined
            : promptTargetLesson
            ? lessonFeedback[promptTargetLesson]?.trim() || undefined
            : undefined
        )}
        onClose={() => setPromptTargetLesson(null)}
        onApplyResponse={(raw) => {
          const nextLessons = parseStage2Response(raw, sequence);
          onUpdateSequence({
            ...sequence,
            updatedAt: new Date().toISOString(),
            lessons: nextLessons,
          });
        }}
      />
    </div>
  );
};
