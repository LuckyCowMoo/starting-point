import React, { useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Compass,
  Hammer,
  Lightbulb,
  Loader2,
  Lock,
  Plus,
  Sparkles,
  Terminal,
  Trash2,
  Unlock,
} from 'lucide-react';
import {
  AppSettings,
  LessonSequence,
  MisconceptionItem,
  ObjectiveItem,
  SequenceObjectives,
  VocabItem,
} from '../../types/curriculum';
import {
  parseStage1Response,
  runStage1Generation,
} from '../../services/geminiService';
import { buildStage1Prompt } from '../../services/pedagogyPrompts';
import { PromptCopyPasteModal } from '../modals/PromptCopyPasteModal';

interface Stage1ObjectivesViewProps {
  sequence: LessonSequence;
  settings: AppSettings;
  onUpdateSequence: (updated: LessonSequence) => void;
  onApproveAndProceed: () => void;
}

export const Stage1ObjectivesView: React.FC<Stage1ObjectivesViewProps> = ({
  sequence,
  settings,
  onUpdateSequence,
  onApproveAndProceed,
}) => {
  const [aiFeedback, setAiFeedback] = useState('');
  const [targetSection, setTargetSection] = useState<
    'all' | 'know' | 'do' | 'understand' | 'keyVocabulary' | 'misconceptions'
  >('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptModalOpen, setPromptModalOpen] = useState(false);

  const updateObjectives = (patch: Partial<SequenceObjectives>) => {
    onUpdateSequence({
      ...sequence,
      updatedAt: new Date().toISOString(),
      objectives: { ...sequence.objectives, ...patch },
    });
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextObjectives = await runStage1Generation(
        settings.geminiApiKey,
        settings.geminiModel,
        sequence,
        targetSection === 'all' ? undefined : targetSection,
        aiFeedback.trim() || undefined
      );
      onUpdateSequence({
        ...sequence,
        updatedAt: new Date().toISOString(),
        objectives: nextObjectives,
      });
      setAiFeedback('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const renderObjectiveList = (
    category: 'know' | 'do' | 'understand',
    title: string,
    subtitle: string,
    icon: React.ReactNode,
    accentClass: string
  ) => {
    const items = sequence.objectives[category];
    const addBlank = () => {
      const next: ObjectiveItem = {
        id: `${category}-${Date.now()}`,
        statement: 'New learning objective...',
        bloomLevel: category === 'know' ? 'Remember' : category === 'do' ? 'Apply' : 'Understand',
        pedagogicalRationale: 'Teacher added objective.',
      };
      updateObjectives({ [category]: [...items, next] });
    };

    const updateItem = (id: string, field: keyof ObjectiveItem, value: string) => {
      updateObjectives({
        [category]: items.map((item) =>
          item.id === id ? { ...item, [field]: value } : item
        ),
      });
    };

    const removeItem = (id: string) => {
      updateObjectives({
        [category]: items.filter((item) => item.id !== id),
      });
    };

    return (
      <div className="rounded-3xl bg-white border border-zinc-200/90 shadow-xs p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${accentClass}`}>{icon}</div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">{title}</h3>
              <p className="text-xs text-zinc-500">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={addBlank}
            className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            title={`Add ${title} item`}
          >
            <Plus size={15} />
          </button>
        </div>

        <div className="space-y-3">
          {items.length === 0 && (
            <p className="text-xs text-zinc-400 italic py-4 text-center">
              No items yet — click + or generate with AI above.
            </p>
          )}
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="p-3.5 rounded-2xl bg-[#FAF6F0] border border-zinc-200/70 space-y-2 group"
            >
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs font-bold text-zinc-400 mt-1">
                  {idx + 1}.
                </span>
                <textarea
                  value={item.statement}
                  onChange={(e) => updateItem(item.id, 'statement', e.target.value)}
                  rows={2}
                  className="flex-1 bg-transparent text-sm font-semibold text-zinc-800 resize-none focus:outline-none focus:bg-white focus:px-2 focus:py-1 rounded-lg"
                />
                <button
                  onClick={() => removeItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-600 transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {settings.showPedagogicalCallouts && item.pedagogicalRationale && (
                <div className="flex items-start gap-1.5 text-[11px] text-emerald-900 bg-emerald-50/90 border border-emerald-200/70 rounded-xl px-2.5 py-1.5">
                  <Lightbulb size={13} className="shrink-0 mt-0.5 text-emerald-700" />
                  <span>
                    <strong>Pedagogy ({item.bloomLevel}):</strong>{' '}
                    {item.pedagogicalRationale}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Sequence Metadata & AI Collaboration Bar */}
      <div className="rounded-3xl bg-white border border-zinc-200/90 shadow-xs p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-[280px] space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                Stage 1 of 4 • Objectives Contract
              </span>
              {sequence.stage1Approved ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white">
                  <CheckCircle2 size={12} /> Approved
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900">
                  <Lock size={12} /> Draft — Approve to Unlock Stage 2
                </span>
              )}
            </div>
            <input
              type="text"
              value={sequence.title}
              onChange={(e) =>
                onUpdateSequence({ ...sequence, title: e.target.value })
              }
              className="w-full text-2xl font-display font-extrabold text-zinc-900 bg-transparent focus:outline-none focus:bg-[#FAF6F0] rounded-xl px-2 -mx-2 py-0.5"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5 bg-[#FAF6F0] px-3 py-1.5 rounded-xl border border-zinc-200">
              <span className="text-zinc-500 font-semibold">Subject:</span>
              <input
                type="text"
                value={sequence.subject}
                onChange={(e) =>
                  onUpdateSequence({ ...sequence, subject: e.target.value })
                }
                className="w-24 bg-transparent font-bold text-zinc-800 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5 bg-[#FAF6F0] px-3 py-1.5 rounded-xl border border-zinc-200">
              <span className="text-zinc-500 font-semibold">Age / KS:</span>
              <input
                type="text"
                value={sequence.keyStage}
                onChange={(e) =>
                  onUpdateSequence({ ...sequence, keyStage: e.target.value })
                }
                className="w-24 bg-transparent font-bold text-zinc-800 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5 bg-[#FAF6F0] px-3 py-1.5 rounded-xl border border-zinc-200">
              <span className="text-zinc-500 font-semibold">Lessons:</span>
              <input
                type="number"
                min={1}
                max={20}
                value={sequence.lessonCount}
                onChange={(e) =>
                  onUpdateSequence({
                    ...sequence,
                    lessonCount: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                className="w-12 bg-transparent font-bold text-zinc-800 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5 bg-[#FAF6F0] px-3 py-1.5 rounded-xl border border-zinc-200">
              <span className="text-zinc-500 font-semibold">Mins/Lesson:</span>
              <input
                type="number"
                min={20}
                max={120}
                value={sequence.defaultLessonMinutes}
                onChange={(e) =>
                  onUpdateSequence({
                    ...sequence,
                    defaultLessonMinutes: Math.max(20, Number(e.target.value) || 60),
                  })
                }
                className="w-12 bg-transparent font-bold text-zinc-800 focus:outline-none"
              />
            </label>
          </div>
        </div>

        {/* Topic Brief */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
            Teacher Brief & Pedagogical Intent
          </label>
          <textarea
            value={sequence.topicBrief}
            onChange={(e) =>
              onUpdateSequence({ ...sequence, topicBrief: e.target.value })
            }
            rows={7}
            placeholder="Describe what pupils need to master, lesson allocation, practical tools or software tasks, excluded lessons/assessments, or curriculum spec links..."
            className="w-full min-h-[168px] p-3.5 rounded-2xl bg-[#FAF6F0] border border-zinc-200 text-sm leading-relaxed text-zinc-800 resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Collaborative AI Refinement Bar */}
        <div className="p-4 rounded-2xl bg-emerald-950 text-white flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Sparkles size={18} className="text-emerald-300" />
            <select
              value={targetSection}
              onChange={(e) =>
                setTargetSection(e.target.value as typeof targetSection)
              }
              className="bg-emerald-900 border border-emerald-700 text-xs font-semibold rounded-xl px-3 py-2 text-emerald-100 focus:outline-none"
            >
              <option value="all">Full Stage 1 Objectives</option>
              <option value="know">Surgical: Only "Know"</option>
              <option value="do">Surgical: Only "Be Able To Do"</option>
              <option value="understand">Surgical: Only "Understand"</option>
              <option value="keyVocabulary">Surgical: Only Key Vocabulary</option>
              <option value="misconceptions">Surgical: Only Misconceptions</option>
            </select>
          </div>

          <input
            type="text"
            value={aiFeedback}
            onChange={(e) => setAiFeedback(e.target.value)}
            placeholder="Give feedback or steer the AI (e.g. 'Add unplugged networking tasks, keep accessible for Year 8')..."
            className="flex-1 bg-white/10 border border-emerald-700/70 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-emerald-200/60 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />

          <button
            onClick={() => void handleGenerate()}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-emerald-400 text-emerald-950 font-bold text-sm hover:bg-emerald-300 disabled:opacity-60 flex items-center justify-center gap-2 shrink-0 transition"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            <span>
              {sequence.objectives.know.length > 0
                ? targetSection === 'all'
                  ? 'Refine Objectives'
                  : 'Surgical Update'
                : 'Draft Stage 1 with AI'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPromptModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 font-bold text-xs hover:bg-zinc-700 flex items-center gap-1.5 shrink-0 transition"
            title="Use any AI chat without an API key by copying the system prompt & pasting the response"
          >
            <Terminal size={14} className="text-emerald-400" />
            <span>Copy Prompt / Paste AI</span>
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Know / Do / Understand Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {renderObjectiveList(
          'know',
          'Know (Declarative)',
          'Core facts, hardware, concepts & definitions',
          <BookOpen size={18} />,
          'bg-sky-100 text-sky-800'
        )}
        {renderObjectiveList(
          'do',
          'Be Able To Do (Procedural)',
          'Practical, analytical & problem-solving skills',
          <Hammer size={18} />,
          'bg-amber-100 text-amber-800'
        )}
        {renderObjectiveList(
          'understand',
          'Understand (Conceptual)',
          'Deep threshold ideas & big-picture connections',
          <Compass size={18} />,
          'bg-violet-100 text-violet-800'
        )}
      </div>

      {/* Key Vocabulary & Common Misconceptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-3xl bg-white border border-zinc-200/90 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                Tier 3 Key Vocabulary
              </h3>
              <p className="text-xs text-zinc-500">
                Definitions + classroom analogies to pre-teach and revisit
              </p>
            </div>
            <button
              onClick={() => {
                const next: VocabItem = {
                  id: `voc-${Date.now()}`,
                  term: 'New Term',
                  definition: 'Clear age-appropriate definition...',
                  etymologyOrTip: 'Memorable analogy or tip...',
                };
                updateObjectives({
                  keyVocabulary: [...sequence.objectives.keyVocabulary, next],
                });
              }}
              className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            >
              <Plus size={15} />
            </button>
          </div>
          <div className="space-y-2.5">
            {sequence.objectives.keyVocabulary.map((v) => (
              <div
                key={v.id}
                className="p-3.5 rounded-2xl bg-[#FAF6F0] border border-zinc-200/70 space-y-1.5 group"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    value={v.term}
                    onChange={(e) =>
                      updateObjectives({
                        keyVocabulary: sequence.objectives.keyVocabulary.map((item) =>
                          item.id === v.id ? { ...item, term: e.target.value } : item
                        ),
                      })
                    }
                    className="font-bold text-sm text-emerald-900 bg-transparent focus:outline-none focus:bg-white rounded px-1"
                  />
                  <button
                    onClick={() =>
                      updateObjectives({
                        keyVocabulary: sequence.objectives.keyVocabulary.filter(
                          (item) => item.id !== v.id
                        ),
                      })
                    }
                    className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea
                  value={v.definition}
                  rows={2}
                  onChange={(e) =>
                    updateObjectives({
                      keyVocabulary: sequence.objectives.keyVocabulary.map((item) =>
                        item.id === v.id
                          ? { ...item, definition: e.target.value }
                          : item
                      ),
                    })
                  }
                  className="w-full text-xs text-zinc-700 bg-transparent resize-none focus:outline-none focus:bg-white rounded p-1"
                />
                <input
                  value={v.etymologyOrTip}
                  onChange={(e) =>
                    updateObjectives({
                      keyVocabulary: sequence.objectives.keyVocabulary.map((item) =>
                        item.id === v.id
                          ? { ...item, etymologyOrTip: e.target.value }
                          : item
                      ),
                    })
                  }
                  className="w-full text-[11px] text-amber-900 bg-amber-50/80 rounded-lg px-2 py-1 focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-zinc-200/90 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                Target Misconceptions & Hinge Corrections
              </h3>
              <p className="text-xs text-zinc-500">
                Misconceptions our MWB hinge questions will deliberately diagnose
              </p>
            </div>
            <button
              onClick={() => {
                const next: MisconceptionItem = {
                  id: `mis-${Date.now()}`,
                  misconception: 'Pupils often mistakenly believe...',
                  correction: 'Clarify using...',
                };
                updateObjectives({
                  misconceptions: [...sequence.objectives.misconceptions, next],
                });
              }}
              className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            >
              <Plus size={15} />
            </button>
          </div>
          <div className="space-y-2.5">
            {sequence.objectives.misconceptions.map((m) => (
              <div
                key={m.id}
                className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200/70 space-y-1.5 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <textarea
                    value={m.misconception}
                    rows={2}
                    onChange={(e) =>
                      updateObjectives({
                        misconceptions: sequence.objectives.misconceptions.map((item) =>
                          item.id === m.id
                            ? { ...item, misconception: e.target.value }
                            : item
                        ),
                      })
                    }
                    className="flex-1 text-xs font-semibold text-rose-950 bg-transparent resize-none focus:outline-none"
                  />
                  <button
                    onClick={() =>
                      updateObjectives({
                        misconceptions: sequence.objectives.misconceptions.filter(
                          (item) => item.id !== m.id
                        ),
                      })
                    }
                    className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea
                  value={m.correction}
                  rows={2}
                  onChange={(e) =>
                    updateObjectives({
                      misconceptions: sequence.objectives.misconceptions.map((item) =>
                        item.id === m.id
                          ? { ...item, correction: e.target.value }
                          : item
                      ),
                    })
                  }
                  className="w-full text-xs text-emerald-950 bg-white/80 rounded-xl p-2 border border-emerald-200/60 resize-none focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stage 1 Gate Footer */}
      <div className="rounded-3xl bg-[#FAF6F0] border-2 border-emerald-200 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm font-bold text-zinc-900">
            Stage 1 Gate: Confirm Sequence Objectives Before Planning Lessons
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">
            {sequence.objectives.pedagogicalSummary ||
              'Once you are happy with what pupils will Know, Do, and Understand, lock Stage 1 to design the lesson-by-lesson progression.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {sequence.stage1Approved && (
            <button
              onClick={() =>
                onUpdateSequence({ ...sequence, stage1Approved: false })
              }
              className="px-4 py-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-700 text-xs font-bold hover:bg-zinc-50 flex items-center gap-1.5"
            >
              <Unlock size={14} /> Unlock to Edit
            </button>
          )}
          <button
            onClick={onApproveAndProceed}
            className="px-6 py-3 rounded-2xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 shadow-md shadow-emerald-600/20 flex items-center gap-2 transition"
          >
            <CheckCircle2 size={17} />
            <span>
              {sequence.stage1Approved
                ? 'Proceed to Stage 2 Progression'
                : 'Approve Objectives & Unlock Stage 2'}
            </span>
          </button>
        </div>
      </div>
      <PromptCopyPasteModal
        isOpen={promptModalOpen}
        title="Stage 1: Copy Pedagogical Prompt / Paste AI Objectives"
        promptText={buildStage1Prompt(
          sequence,
          targetSection === 'all' ? undefined : targetSection,
          aiFeedback.trim() || undefined
        )}
        onClose={() => setPromptModalOpen(false)}
        onApplyResponse={(raw) => {
          const nextObjectives = parseStage1Response(raw);
          onUpdateSequence({
            ...sequence,
            objectives: nextObjectives,
            updatedAt: new Date().toISOString(),
          });
        }}
      />
    </div>
  );
};
