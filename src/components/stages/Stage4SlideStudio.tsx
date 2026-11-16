import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Download,
  Eye,
  EyeOff,
  FlipHorizontal2,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Palette,
  PanelLeftClose,
  PanelRightClose,
  Play,
  Check,
  Clock,
  Plus,
  Sparkles,
  StickyNote,
  LayoutTemplate,
  Layers,
  RotateCcw,
  Spline,
  Table as TableIcon,
  Terminal,
  Timer,
  Trash2,
  Type,
  Undo,
  Redo,
  Wand2,
  Bold,
  Italic,
  Underline,
} from 'lucide-react';
import {
  AppSettings,
  BespokeCanvasElement,
  LessonPhase,
  LessonSequence,
  PlannedLesson,
  RoutineIconType,
  SlideBlueprint,
  SlideData,
  SlideLineStyle,
  SlidePresetId,
  SlideRichLine,
  SlideTableData,
  SlideTextBlock,
  StarterQuadrantLayout,
  WaveVariant,
} from '../../types/curriculum';
import {
  CONSTANT_TEXT_COLORS,
  FONT_SIZE_PRESETS,
  convertRichLinesToBodyBlocks,
  getSlideRichLines,
  parseTextToRichLines,
  richLinesToUnifiedText,
} from '../../utils/richTextHelper';
import {
  PHASE_PALETTES,
  ROUTINE_ICON_META,
  SLIDE_PRESETS,
  WAVE_VARIANT_LABELS,
} from '../../data/palettes';
import {
  SlideCanvas,
  getQuadrantLayout,
  isMcOptionCorrect,
  isTfOptionCorrect,
} from '../canvas/SlideCanvas';
import { SVG_DIAGRAM_TEMPLATES } from '../../data/svgDiagramLibrary';
import { RoutineBadgeIcon } from '../canvas/RoutineBadgeIcon';
import { MediaPickerModal } from '../media/MediaPickerModal';
import { SlideLayoutWaveModal, SlidePickerModalMode } from './SlideLayoutWaveModal';
import { PromptCopyPasteModal } from '../modals/PromptCopyPasteModal';
import {
  parseBespokeSlideResponse,
  parseStage4InsertSlidesResponse,
  parseStage4SlidesResponse,
  runBespokeSlideDesign,
  runStage4InsertSlidesGeneration,
  runStage4SlidesGeneration,
} from '../../services/geminiService';
import {
  buildBespokeSlidePrompt,
  buildStage4InsertSlidesPrompt,
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
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [mediaTargetElementId, setMediaTargetElementId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'edit' | 'ai'>('edit');
  const [previewAllAnswers, setPreviewAllAnswers] = useState(true);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [showWavePathEditor, setShowWavePathEditor] = useState(false);
  const [pickerModalMode, setPickerModalMode] =
    useState<SlidePickerModalMode | null>(null);
  const [promptModalTarget, setPromptModalTarget] = useState<
    'surgical' | 'bespoke' | 'insert-deck' | null
  >(null);

  const [surgicalPrompt, setSurgicalPrompt] = useState('');
  const [bespokePrompt, setBespokePrompt] = useState('');
  const [deckInsertPrompt, setDeckInsertPrompt] = useState('');
  const [deckInsertPosition, setDeckInsertPosition] = useState<number | 'end'>('end');
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [tableRowsInput, setTableRowsInput] = useState(3);
  const [tableColsInput, setTableColsInput] = useState(3);
  const [tableHasHeader, setTableHasHeader] = useState(true);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resizable Side Panels (Left Slide Filmstrip & Right Inspector)
  const DEFAULT_LEFT_WIDTH = 180;
  const MIN_LEFT_WIDTH = 120;
  const MAX_LEFT_WIDTH = 500;

  const DEFAULT_RIGHT_WIDTH = 320;
  const MIN_RIGHT_WIDTH = 260;
  const MAX_RIGHT_WIDTH = 750;

  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('starting_point_studio_left_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_LEFT_WIDTH && parsed <= MAX_LEFT_WIDTH) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_LEFT_WIDTH;
  });

  const [rightPanelWidth, setRightPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('starting_point_studio_right_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_RIGHT_WIDTH && parsed <= MAX_RIGHT_WIDTH) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_RIGHT_WIDTH;
  });

  const [resizingSide, setResizingSide] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('starting_point_studio_left_width', String(leftPanelWidth));
    } catch {}
  }, [leftPanelWidth]);

  useEffect(() => {
    try {
      localStorage.setItem('starting_point_studio_right_width', String(rightPanelWidth));
    } catch {}
  }, [rightPanelWidth]);

  const handleLeftResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingSide('left');
    const startX = e.clientX;
    const startWidth = leftPanelWidth;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onPointerMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      const next = Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, Math.round(startWidth + delta)));
      setLeftPanelWidth(next);
    };

    const onPointerUp = () => {
      setResizingSide(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleRightResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingSide('right');
    const startX = e.clientX;
    const startWidth = rightPanelWidth;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onPointerMove = (ev: PointerEvent) => {
      const delta = startX - ev.clientX;
      const next = Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, Math.round(startWidth + delta)));
      setRightPanelWidth(next);
    };

    const onPointerUp = () => {
      setResizingSide(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const activeSlideIdForReset =
    lesson && lesson.slidesData.length > 0
      ? lesson.slidesData[Math.min(selectedSlideIdx, lesson.slidesData.length - 1)]?.id
      : undefined;

  useEffect(() => {
    setSelectedElementId(null);
    setSelectedElementIds([]);
  }, [activeSlideIdForReset]);

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

  const [historyPast, setHistoryPast] = useState<SlideData[][]>([]);
  const [historyFuture, setHistoryFuture] = useState<SlideData[][]>([]);
  const [hoveredImageTarget, setHoveredImageTarget] = useState<string | null>(null);
  const [pasteToast, setPasteToast] = useState<string | null>(null);
  const [isNotesCollapsed, setIsNotesCollapsed] = useState(false);

  const showPasteToast = (msg: string) => {
    setPasteToast(msg);
    window.setTimeout(() => setPasteToast(null), 2800);
  };

  const recordManualHistory = () => {
    if (!lesson) return;
    setHistoryPast((prev) => [...prev.slice(-30), lesson.slidesData]);
    setHistoryFuture([]);
  };

  const handleUndo = () => {
    if (historyPast.length === 0 || !lesson) return;
    const previous = historyPast[historyPast.length - 1];
    const newPast = historyPast.slice(0, -1);
    setHistoryPast(newPast);
    setHistoryFuture((prev) => [lesson.slidesData, ...prev]);
    onUpdateSequence({
      ...sequence,
      updatedAt: new Date().toISOString(),
      lessons: sequence.lessons.map((l) =>
        l.id === lesson.id ? { ...l, slidesData: previous } : l
      ),
    });
  };

  const handleRedo = () => {
    if (historyFuture.length === 0 || !lesson) return;
    const next = historyFuture[0];
    const newFuture = historyFuture.slice(1);
    setHistoryFuture(newFuture);
    setHistoryPast((prev) => [...prev, lesson.slidesData]);
    onUpdateSequence({
      ...sequence,
      updatedAt: new Date().toISOString(),
      lessons: sequence.lessons.map((l) =>
        l.id === lesson.id ? { ...l, slidesData: next } : l
      ),
    });
  };

  const applyPastedImage = (targetId: string, data: string, type: 'image' | 'svg') => {
    recordManualHistory();
    if (targetId.startsWith('quad-media-')) {
      const idx = parseInt(targetId.replace('quad-media-', ''), 10);
      const currentQuads = slide.starterQuadrants || [];
      if (currentQuads[idx]) {
        updateActiveSlide({
          starterQuadrants: currentQuads.map((q, i) =>
            i === idx
              ? {
                  ...q,
                  imageUrl: type === 'image' ? data : undefined,
                  svgCode: type === 'svg' ? data : undefined,
                }
              : q
          ),
        });
        showPasteToast(`Pasted image into Starter Quadrant ${idx + 1}!`);
      }
      return;
    } else if (targetId.startsWith('vocab-media-')) {
      const idx = parseInt(targetId.replace('vocab-media-', ''), 10);
      const currentTerms = slide.keyTermsStrip || [];
      if (currentTerms[idx]) {
        updateActiveSlide({
          keyTermsStrip: currentTerms.map((t, i) =>
            i === idx
              ? {
                  ...t,
                  imageUrl: type === 'image' ? data : undefined,
                  svgCode: type === 'svg' ? data : undefined,
                }
              : t
          ),
        });
      } else if (idx === 0) {
        updateActiveSlide({
          mediaItem: {
            id: `media-${Date.now()}`,
            type: type === 'svg' ? 'svg-diagram' : 'image',
            title: 'Pasted Image',
            url: type === 'image' ? data : undefined,
            svgCode: type === 'svg' ? data : undefined,
            cropFit: 'contain',
            frameShape: 'clean',
          },
        });
      }
      showPasteToast(`Pasted image into Vocabulary Term ${idx + 1}!`);
    } else if (
      targetId &&
      slide.customCanvasElements?.some((el) => el.id === targetId)
    ) {
      updateActiveSlide({
        customCanvasElements: slide.customCanvasElements.map((el) =>
          el.id === targetId
            ? {
                ...el,
                kind: type === 'svg' ? 'diagram' : 'image',
                svgCode: type === 'svg' ? data : undefined,
                imageUrl: type === 'image' ? data : undefined,
                heading: el.heading || 'Pasted Visual',
              }
            : el
        ),
      });
      showPasteToast('Pasted image into slide element!');
    } else if (
      targetId === 'slot-anchored-side-image' ||
      (slide.sideImageConfig && slide.sideImageConfig.side !== 'none') ||
      slide.mediaItem?.placement === 'anchor-right' ||
      slide.mediaItem?.placement === 'anchor-left'
    ) {
      const side =
        slide.sideImageConfig?.side && slide.sideImageConfig.side !== 'none'
          ? slide.sideImageConfig.side
          : slide.mediaItem?.placement === 'anchor-left'
          ? 'left'
          : 'right';
      updateActiveSlide({
        sideImageConfig: {
          side,
          widthPercent: slide.sideImageConfig?.widthPercent || 38,
          controlPoints: slide.sideImageConfig?.controlPoints,
        },
        mediaItem: {
          id: `media-${Date.now()}`,
          type: type === 'svg' ? 'svg-diagram' : 'image',
          title: 'Anchored Side Visual',
          url: type === 'image' ? data : undefined,
          svgCode: type === 'svg' ? data : undefined,
          cropFit: 'cover',
          frameShape: 'clean',
          placement: side === 'left' ? 'anchor-left' : 'anchor-right',
        },
      });
      showPasteToast('Pasted image into Anchored Side Visual!');
    } else {
      updateActiveSlide({
        hiddenElementIds: slide.hiddenElementIds?.filter((id) => id !== 'slot-media'),
        mediaItem: {
          id: `media-${Date.now()}`,
          type: type === 'svg' ? 'svg-diagram' : 'image',
          title: 'Pasted Image',
          url: type === 'image' ? data : undefined,
          svgCode: type === 'svg' ? data : undefined,
          cropFit: slide.presetId === 'lesson-title-page' ? 'cover' : 'contain',
          frameShape: 'clean',
          placement: slide.presetId === 'lesson-title-page' ? 'fill-bottom-layer' : 'boxed-card',
        },
      });
      showPasteToast('Pasted image into slide visual slot!');
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const tag = (activeEl?.tagName || '').toLowerCase();
      const isTextInput =
        activeEl &&
        (tag === 'input' || tag === 'textarea' || (activeEl as HTMLElement)?.isContentEditable);

      if (isTextInput && !hoveredImageTarget) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && hoveredImageTarget) {
        // Fallback for Ctrl+V directly reading navigator clipboard
        if (navigator.clipboard && navigator.clipboard.read) {
          navigator.clipboard
            .read()
            .then(async (clipboardItems) => {
              for (const item of clipboardItems) {
                const imageType = item.types.find((t) => t.startsWith('image/'));
                if (imageType) {
                  const blob = await item.getType(imageType);
                  const reader = new FileReader();
                  reader.onload = (loadEvt) => {
                    const dataUrl = loadEvt.target?.result as string;
                    if (dataUrl) {
                      applyPastedImage(hoveredImageTarget, dataUrl, 'image');
                    }
                  };
                  reader.readAsDataURL(blob);
                  e.preventDefault();
                  return;
                }
              }
            })
            .catch(() => {
              // Ignore clipboard read permission rejection; native paste event handles it
            });
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [historyPast, historyFuture, lesson?.slidesData, hoveredImageTarget]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      const tag = (activeEl?.tagName || '').toLowerCase();
      const isTextInput =
        activeEl &&
        (tag === 'input' || tag === 'textarea' || (activeEl as HTMLElement)?.isContentEditable);

      if (isTextInput && !hoveredImageTarget) {
        return;
      }

      const target =
        hoveredImageTarget ||
        (selectedElementId &&
        slide.customCanvasElements?.some(
          (el) => el.id === selectedElementId && (el.kind === 'image' || el.kind === 'diagram')
        )
          ? selectedElementId
          : null);

      if (!target) return;

      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.indexOf('image') !== -1) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onload = (loadEvt) => {
                const dataUrl = loadEvt.target?.result as string;
                if (dataUrl) {
                  applyPastedImage(target, dataUrl, 'image');
                }
              };
              reader.readAsDataURL(file);
              return;
            }
          }
        }
      }

      const text = e.clipboardData?.getData('text') || '';
      const trimmed = text.trim();
      if (/^<svg[\s>]/i.test(trimmed) && trimmed.endsWith('</svg>')) {
        e.preventDefault();
        applyPastedImage(target, trimmed, 'svg');
        return;
      }
      if (
        /^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed) ||
        /^https?:\/\/.+\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(trimmed)
      ) {
        e.preventDefault();
        applyPastedImage(target, trimmed, 'image');
        return;
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [hoveredImageTarget, selectedElementId, slide]);

  const handleDeleteCurrentLesson = () => {
    if (!lesson) return;
    if (
      !window.confirm(
        `Are you sure you want to delete Lesson ${lesson.lessonNumber}: "${lesson.title}"?`
      )
    ) {
      return;
    }
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
      setSelectedSlideIdx(0);
    }
  };

  const updateLesson = (patch: Partial<PlannedLesson>) => {
    onUpdateSequence({
      ...sequence,
      updatedAt: new Date().toISOString(),
      lessons: sequence.lessons.map((l) =>
        l.id === lesson.id ? { ...l, ...patch } : l
      ),
    });
  };

  const updateActiveSlide = (patch: Partial<SlideData>, isTransient = false) => {
    if (!lesson) return;
    if (!isTransient) {
      recordManualHistory();
    }
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

  const handleDeckInsertAi = async () => {
    if (!deckInsertPrompt.trim()) return;
    setAiBusy('insert-deck');
    setError(null);
    try {
      const targetAfter =
        deckInsertPosition === 'end'
          ? lesson.slidesData.length
          : Number(deckInsertPosition);

      const { insertAfter, newSlides } = await runStage4InsertSlidesGeneration(
        settings.geminiApiKey,
        settings.geminiModel,
        sequence,
        lesson,
        deckInsertPrompt.trim(),
        targetAfter
      );

      const insertIdx = Math.max(0, Math.min(lesson.slidesData.length, insertAfter));
      const updatedSlides = [
        ...lesson.slidesData.slice(0, insertIdx),
        ...newSlides,
        ...lesson.slidesData.slice(insertIdx),
      ].map((s, idx) => ({
        ...s,
        slideNumber: idx + 1,
      }));

      const newBlueprints: SlideBlueprint[] = newSlides.map((s) => ({
        id: s.blueprintId,
        slideNumber: s.slideNumber,
        title: s.title,
        phase: s.phase,
        presetId: s.presetId,
        allocatedMinutes: 3,
        contentSummary: s.unifiedText || s.title,
        pupilActivity: 'Pupil engagement on new concept',
        routineIcons: s.routineIcons,
        conceptsIntroducedHere: [],
        pedagogicalRationale: {
          principle: 'Rosenshine Small Steps',
          cognitiveLoadNote: 'Incremental slide insertion',
        },
      }));

      const updatedBlueprints = [
        ...lesson.slidesBlueprint.slice(0, insertIdx),
        ...newBlueprints,
        ...lesson.slidesBlueprint.slice(insertIdx),
      ].map((b, idx) => ({
        ...b,
        slideNumber: idx + 1,
      }));

      updateLesson({
        slidesData: updatedSlides,
        slidesBlueprint: updatedBlueprints,
      });
      setDeckInsertPrompt('');
      setSelectedSlideIdx(insertIdx);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to insert slides.');
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
          {sequence.lessons.length > 1 && (
            <button
              onClick={handleDeleteCurrentLesson}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition flex items-center gap-1 shrink-0"
              title={`Delete Lesson ${lesson.lessonNumber}`}
            >
              <Trash2 size={13} />
              <span className="hidden md:inline">Delete Lesson</span>
            </button>
          )}
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
      <div className={`flex-1 flex overflow-hidden relative ${resizingSide ? 'select-none' : ''}`}>
        {/* Left Slide Filmstrip */}
        <div
          style={{ width: `${leftPanelWidth}px` }}
          className="shrink-0 border-r border-zinc-200 bg-[#FAF6F0] overflow-y-auto p-2.5 space-y-2.5 relative"
        >
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
                <div className="rounded-xl overflow-hidden border border-zinc-200 pointer-events-none">
                  <SlideCanvas slide={s} isThumbnail editorPreviewAllAnswers />
                </div>
              </div>
            );
          })}

          <div className="space-y-2 pt-1">
            <button
              onClick={() => setPickerModalMode('new-slide-wizard')}
              className="w-full py-2 rounded-xl border-2 border-dashed border-zinc-300 text-zinc-600 text-xs font-bold hover:border-emerald-500 hover:text-emerald-700 flex items-center justify-center gap-1.5 transition bg-white/70"
            >
              <Plus size={13} /> Add Slide (Manual)
            </button>
            <button
              onClick={() => {
                setInspectorTab('ai');
              }}
              className="w-full py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-100 flex items-center justify-center gap-1.5 transition shadow-2xs"
            >
              <Sparkles size={13} className="text-amber-600" />
              <span>AI Insert Slides...</span>
            </button>
          </div>
        </div>

        {/* Left Resize Handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize slide filmstrip panel"
          onPointerDown={handleLeftResizeStart}
          onDoubleClick={() => setLeftPanelWidth(DEFAULT_LEFT_WIDTH)}
          className={`w-2.5 -ml-1.5 -mr-1 z-30 cursor-col-resize select-none shrink-0 group relative flex items-center justify-center transition-colors ${
            resizingSide === 'left' ? 'bg-emerald-500/30' : 'hover:bg-emerald-500/20'
          }`}
          title={`Drag to resize filmstrip (double-click to reset, default: ${DEFAULT_LEFT_WIDTH}px)`}
        >
          <div
            className={`w-1 rounded-full transition-all ${
              resizingSide === 'left'
                ? 'h-16 bg-emerald-600 scale-x-125 shadow-sm'
                : 'h-8 bg-zinc-300 group-hover:bg-emerald-500 group-hover:h-12'
            }`}
          />
          {resizingSide === 'left' && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-zinc-900 text-white text-[11px] font-bold shadow-lg pointer-events-none whitespace-nowrap z-50">
              {leftPanelWidth}px
            </span>
          )}
        </div>

        {/* Center 16:9 Canvas Stage */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-zinc-200/60 p-5 flex flex-col items-center justify-start gap-3">
          {/* Quick Inline Canvas Toolbar */}
          <div
            className={`w-full ${
              isNotesCollapsed ? 'max-w-[1600px] 2xl:max-w-[1720px]' : 'max-w-6xl 2xl:max-w-7xl'
            } flex flex-wrap items-center justify-between gap-2 px-1 transition-all duration-300`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Undo / Redo */}
              <div className="flex items-center gap-1 border-r border-zinc-300 pr-1.5 mr-0.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyPast.length === 0}
                  className="p-1.5 rounded-lg bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
                  title="Undo manual edit (Ctrl+Z)"
                >
                  <Undo size={13} />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={historyFuture.length === 0}
                  className="p-1.5 rounded-lg bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
                  title="Redo manual edit (Ctrl+Y)"
                >
                  <Redo size={13} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const existingCount = slide.customCanvasElements?.length || 0;
                  const newId = `ce-txt-${Date.now()}`;
                  const newEl: BespokeCanvasElement = {
                    id: newId,
                    kind: 'text',
                    x: 8 + (existingCount * 4) % 24,
                    y: 26 + (existingCount * 5) % 26,
                    w: 38,
                    h: 18,
                    heading: '',
                    content: '• Click to edit text on slide',
                    layer: 'top',
                    boxed: false,
                  };
                  updateActiveSlide({
                    customCanvasElements: [...(slide.customCanvasElements || []), newEl],
                  });
                  setSelectedElementId(newId);
                }}
                className="px-2.5 py-1 rounded-lg bg-white border border-zinc-300 text-zinc-800 hover:bg-emerald-50 hover:border-emerald-400 text-[11px] font-bold flex items-center gap-1.5 transition shadow-2xs"
                title="Add a freeform draggable text box onto the slide"
              >
                <Type size={12} className="text-emerald-700" />
                <span>+ Add Text</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const existingCount = slide.customCanvasElements?.length || 0;
                  const newId = `ce-img-${Date.now()}`;
                  const newEl: BespokeCanvasElement = {
                    id: newId,
                    kind: 'image',
                    x: 50 + (existingCount * 3) % 12,
                    y: 22 + (existingCount * 4) % 16,
                    w: 40,
                    h: 48,
                    heading: 'Slide Visual / Diagram',
                    content: '',
                    layer: 'bottom',
                    boxed: false,
                  };
                  updateActiveSlide({
                    customCanvasElements: [...(slide.customCanvasElements || []), newEl],
                  });
                  setSelectedElementId(newId);
                  setMediaTargetElementId(newId);
                  setMediaOpen(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-white border border-zinc-300 text-zinc-800 hover:bg-sky-50 hover:border-sky-400 text-[11px] font-bold flex items-center gap-1.5 transition shadow-2xs"
                title="Add an image or SVG diagram onto the slide"
              >
                <ImageIcon size={12} className="text-sky-700" />
                <span>+ Add Image / Diagram</span>
              </button>
              {(Object.keys(slide.elementLayouts || {}).length > 0 ||
                (slide.hiddenElementIds?.length || 0) > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    updateActiveSlide({
                      elementLayouts: undefined,
                      hiddenElementIds: undefined,
                    });
                    setSelectedElementId(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 text-[11px] font-bold flex items-center gap-1 transition shadow-2xs"
                  title="Restore preset default element positions and hidden items"
                >
                  <RotateCcw size={12} />
                  <span>Reset Positions</span>
                </button>
              )}

              {/* Anchor Side Image button group */}
              <div className="flex items-center gap-1 border-l border-zinc-300 pl-1.5 ml-0.5">
                <span className="text-[11px] font-bold text-zinc-600 hidden 2xl:inline-flex items-center gap-1">
                  <PanelRightClose size={12} className="text-zinc-500" /> Anchor Side:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    updateActiveSlide({
                      sideImageConfig: { side: 'none' },
                      mediaItem: slide.mediaItem
                        ? { ...slide.mediaItem, placement: 'boxed-card' }
                        : undefined,
                    });
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                    !slide.sideImageConfig || slide.sideImageConfig.side === 'none'
                      ? 'bg-zinc-800 text-white shadow-2xs'
                      : 'bg-white border border-zinc-300 text-zinc-600 hover:bg-zinc-50'
                  }`}
                  title="No side-anchored image"
                >
                  None
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateActiveSlide({
                      sideImageConfig: {
                        side: 'left',
                        widthPercent: slide.sideImageConfig?.widthPercent || 38,
                        controlPoints: slide.sideImageConfig?.controlPoints,
                      },
                      mediaItem: slide.mediaItem
                        ? { ...slide.mediaItem, placement: 'anchor-left', cropFit: 'cover' }
                        : {
                            id: `media-${Date.now()}`,
                            type: 'image',
                            title: 'Side Visual',
                            cropFit: 'cover',
                            frameShape: 'clean',
                            placement: 'anchor-left',
                          },
                    });
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                    slide.sideImageConfig?.side === 'left' || slide.mediaItem?.placement === 'anchor-left'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                  }`}
                  title="Anchor visual to left side with 3D paper-cut wave"
                >
                  <PanelLeftClose size={12} />
                  <span>Left</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateActiveSlide({
                      sideImageConfig: {
                        side: 'right',
                        widthPercent: slide.sideImageConfig?.widthPercent || 38,
                        controlPoints: slide.sideImageConfig?.controlPoints,
                      },
                      mediaItem: slide.mediaItem
                        ? { ...slide.mediaItem, placement: 'anchor-right', cropFit: 'cover' }
                        : {
                            id: `media-${Date.now()}`,
                            type: 'image',
                            title: 'Side Visual',
                            cropFit: 'cover',
                            frameShape: 'clean',
                            placement: 'anchor-right',
                          },
                    });
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                    slide.sideImageConfig?.side === 'right' || slide.mediaItem?.placement === 'anchor-right'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                  }`}
                  title="Anchor visual to right side with 3D paper-cut wave"
                >
                  <PanelRightClose size={12} />
                  <span>Right</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsNotesCollapsed((v) => !v)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition ${
                  isNotesCollapsed
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                    : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                }`}
                title={
                  isNotesCollapsed
                    ? 'Restore Speaker Notes view'
                    : 'Collapse Speaker Notes & Maximize Slide Canvas to fill space'
                }
              >
                {isNotesCollapsed ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                <span>{isNotesCollapsed ? 'Standard View' : 'Maximize Canvas'}</span>
              </button>

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
                  title="Reset background wave curve"
                >
                  <RotateCcw size={12} />
                  <span>Reset Wave</span>
                </button>
              )}

              {slide.sideImageConfig?.controlPoints && slide.sideImageConfig.controlPoints.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    updateActiveSlide({
                      sideImageConfig: {
                        ...slide.sideImageConfig!,
                        controlPoints: undefined,
                      },
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-white border border-sky-300 text-sky-800 hover:bg-sky-50 text-[11px] font-bold flex items-center gap-1 transition"
                  title="Reset side image paper-cut wave curve"
                >
                  <RotateCcw size={12} />
                  <span>Reset Image Wave</span>
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
            <div
              className={`w-full ${
                isNotesCollapsed ? 'max-w-[1600px] 2xl:max-w-[1720px]' : 'max-w-6xl 2xl:max-w-7xl'
              } rounded-2xl bg-amber-50 border-2 border-amber-300 px-4 py-3 flex flex-wrap items-start justify-between gap-3 text-xs text-amber-950 shadow-xs transition-all duration-300`}
            >
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
                  onClick={() => {
                    setMediaTargetElementId(null);
                    setMediaOpen(true);
                  }}
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

          {/* Dynamic Auto-Expanding Slide Canvas (fills available viewport space) */}
          <div
            className={`w-full ${
              isNotesCollapsed ? 'max-w-[1600px] 2xl:max-w-[1720px]' : 'max-w-6xl 2xl:max-w-7xl'
            } rounded-3xl overflow-hidden slide-stage-shadow border border-zinc-300/80 bg-[#FAF6F0] transition-all duration-300`}
          >
            <SlideCanvas
              slide={slide}
              editorPreviewAllAnswers={previewAllAnswers}
              interactiveTimer={true}
              editable={true}
              showWavePathEditor={showWavePathEditor}
              selectedElementId={selectedElementId}
              onSelectElement={(id) => {
                setSelectedElementId(id);
                setSelectedElementIds(id ? [id] : []);
              }}
              selectedElementIds={selectedElementIds}
              onSelectElements={(ids) => {
                setSelectedElementIds(ids);
                setSelectedElementId(ids[0] || null);
              }}
              onUpdateSlide={updateActiveSlide}
              onDragStartHistory={recordManualHistory}
              onOpenMediaPicker={(targetElId) => {
                setMediaTargetElementId(targetElId || null);
                setMediaOpen(true);
              }}
              hoveredImageTarget={hoveredImageTarget}
              onHoverImageTarget={setHoveredImageTarget}
            />
          </div>

          {/* Collapsible Teacher Speaker Notes & Phase Signal */}
          {isNotesCollapsed ? (
            <div
              className={`w-full ${
                isNotesCollapsed ? 'max-w-[1600px] 2xl:max-w-[1720px]' : 'max-w-6xl 2xl:max-w-7xl'
              } rounded-2xl bg-white border border-zinc-200 transition-all duration-300 p-2.5 px-4 flex items-center justify-between gap-3 text-xs shadow-2xs`}
            >
              <div
                className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                onClick={() => setIsNotesCollapsed(false)}
                title="Click to expand speaker notes"
              >
                <StickyNote size={14} className="text-amber-600 shrink-0" />
                <span className="font-bold text-zinc-800 shrink-0">Speaker Notes:</span>
                <span className="text-zinc-500 truncate italic">
                  {slide.speakerNotes ? slide.speakerNotes : 'No notes entered for this slide.'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold hidden md:inline-block"
                  style={{
                    backgroundColor: palette.softSurface,
                    color: palette.accent,
                  }}
                >
                  {palette.name} ({palette.pupilSignal})
                </span>
                <button
                  type="button"
                  onClick={() => setIsNotesCollapsed(false)}
                  className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs flex items-center gap-1 transition"
                  title="Expand speaker notes"
                >
                  <span>Expand</span>
                  <ChevronUp size={13} />
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`w-full ${
                isNotesCollapsed ? 'max-w-[1600px] 2xl:max-w-[1720px]' : 'max-w-6xl 2xl:max-w-7xl'
              } rounded-2xl bg-white border border-zinc-200 p-4 space-y-2 transition-all duration-300 shadow-2xs`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
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
                <button
                  type="button"
                  onClick={() => setIsNotesCollapsed(true)}
                  className="px-2.5 py-1 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 text-xs font-semibold flex items-center gap-1 transition"
                  title="Collapse speaker notes to enlarge slide canvas"
                >
                  <span>Collapse Notes</span>
                  <ChevronDown size={13} />
                </button>
              </div>
              <textarea
                value={slide.speakerNotes}
                rows={2}
                onChange={(e) =>
                  updateActiveSlide({ speakerNotes: e.target.value })
                }
                placeholder="Speaker notes and delivery reminders for this slide..."
                className="w-full text-xs text-zinc-700 bg-[#FAF6F0] rounded-xl p-2.5 border border-zinc-200 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}
        </div>

        {/* Right Resize Handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize inspector panel"
          onPointerDown={handleRightResizeStart}
          onDoubleClick={() => setRightPanelWidth(DEFAULT_RIGHT_WIDTH)}
          className={`w-2.5 -ml-1 -mr-1.5 z-30 cursor-col-resize select-none shrink-0 group relative flex items-center justify-center transition-colors ${
            resizingSide === 'right' ? 'bg-emerald-500/30' : 'hover:bg-emerald-500/20'
          }`}
          title={`Drag to resize inspector (double-click to reset, default: ${DEFAULT_RIGHT_WIDTH}px)`}
        >
          <div
            className={`w-1 rounded-full transition-all ${
              resizingSide === 'right'
                ? 'h-16 bg-emerald-600 scale-x-125 shadow-sm'
                : 'h-8 bg-zinc-300 group-hover:bg-emerald-500 group-hover:h-12'
            }`}
          />
          {resizingSide === 'right' && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-zinc-900 text-white text-[11px] font-bold shadow-lg pointer-events-none whitespace-nowrap z-50">
              {rightPanelWidth}px
            </span>
          )}
        </div>

        {/* Right Inspector & AI Co-Pilot */}
        <aside
          style={{ width: `${rightPanelWidth}px` }}
          className="shrink-0 border-l border-zinc-200 bg-white flex flex-col overflow-hidden relative"
        >
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

                {/* Side-Anchored Visual & Paper-Cut Wave */}
                <div className="space-y-2 border-t border-zinc-200 pt-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-zinc-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <PanelRightClose size={12} className="text-sky-600" /> Anchored Side Visual
                    </label>
                    <span className="text-[10px] text-zinc-500 font-medium">3D Paper-Cut Wave</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        updateActiveSlide({
                          sideImageConfig: { side: 'none' },
                          mediaItem: slide.mediaItem ? { ...slide.mediaItem, placement: 'boxed-card' } : undefined,
                        });
                      }}
                      className={`py-1.5 rounded-xl font-bold text-xs transition ${
                        !slide.sideImageConfig || slide.sideImageConfig.side === 'none'
                          ? 'bg-zinc-800 text-white shadow-xs'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      None
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateActiveSlide({
                          sideImageConfig: {
                            side: 'left',
                            widthPercent: slide.sideImageConfig?.widthPercent || 38,
                            controlPoints: slide.sideImageConfig?.controlPoints,
                          },
                          mediaItem: slide.mediaItem
                            ? { ...slide.mediaItem, placement: 'anchor-left', cropFit: 'cover' }
                            : {
                                id: `media-${Date.now()}`,
                                type: 'image',
                                title: 'Side Visual',
                                cropFit: 'cover',
                                frameShape: 'clean',
                                placement: 'anchor-left',
                              },
                        });
                      }}
                      className={`py-1.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1 ${
                        slide.sideImageConfig?.side === 'left' || slide.mediaItem?.placement === 'anchor-left'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      <PanelLeftClose size={12} /> Left
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateActiveSlide({
                          sideImageConfig: {
                            side: 'right',
                            widthPercent: slide.sideImageConfig?.widthPercent || 38,
                            controlPoints: slide.sideImageConfig?.controlPoints,
                          },
                          mediaItem: slide.mediaItem
                            ? { ...slide.mediaItem, placement: 'anchor-right', cropFit: 'cover' }
                            : {
                                id: `media-${Date.now()}`,
                                type: 'image',
                                title: 'Side Visual',
                                cropFit: 'cover',
                                frameShape: 'clean',
                                placement: 'anchor-right',
                              },
                        });
                      }}
                      className={`py-1.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1 ${
                        slide.sideImageConfig?.side === 'right' || slide.mediaItem?.placement === 'anchor-right'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      <PanelRightClose size={12} /> Right
                    </button>
                  </div>

                  {(slide.sideImageConfig?.side === 'left' ||
                    slide.sideImageConfig?.side === 'right' ||
                    slide.mediaItem?.placement === 'anchor-left' ||
                    slide.mediaItem?.placement === 'anchor-right') && (
                    <div className="space-y-2 pt-1 border-t border-zinc-100">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-zinc-600">Side Width:</span>
                        <span className="font-mono font-bold text-sky-700">
                          {slide.sideImageConfig?.widthPercent || 38}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={28}
                        max={48}
                        step={1}
                        value={slide.sideImageConfig?.widthPercent || 38}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateActiveSlide({
                            sideImageConfig: {
                              ...(slide.sideImageConfig || { side: 'right' }),
                              side: slide.sideImageConfig?.side || 'right',
                              widthPercent: val,
                              controlPoints: slide.sideImageConfig?.controlPoints,
                            },
                          });
                        }}
                        className="w-full accent-sky-600 cursor-pointer"
                      />

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setMediaTargetElementId('slot-anchored-side-image');
                            setMediaOpen(true);
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-sky-50 border border-sky-300 text-sky-800 hover:bg-sky-100 font-bold text-xs flex items-center justify-center gap-1 transition"
                        >
                          <ImageIcon size={12} /> Pick Image
                        </button>
                        {slide.sideImageConfig?.controlPoints && (
                          <button
                            type="button"
                            onClick={() => {
                              updateActiveSlide({
                                sideImageConfig: {
                                  ...slide.sideImageConfig!,
                                  controlPoints: undefined,
                                },
                              });
                            }}
                            className="px-2 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold text-xs flex items-center gap-1 transition"
                            title="Reset image wave curve"
                          >
                            <RotateCcw size={11} /> Reset Curve
                          </button>
                        )}
                      </div>

                      <p className="text-[10px] text-zinc-500 leading-tight">
                        Click <strong className="text-amber-700">Edit Wave Points</strong> in the toolbar above to drag and shape both the background wave (amber) and the image wave (cyan) independently.
                      </p>
                    </div>
                  )}
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
                </div>

                {/* Slide Date (Can be added/removed on any slide, especially Title Page) */}
                <div className="space-y-2 border-t border-zinc-200 pt-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-zinc-500 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <Clock size={12} className="text-zinc-600" />
                      Lesson Date
                    </label>
                    {slide.lessonDate ? (
                      <button
                        type="button"
                        onClick={() => updateActiveSlide({ lessonDate: undefined })}
                        className="text-[10px] font-bold text-rose-600 hover:underline flex items-center gap-0.5"
                        title="Remove date from slide"
                      >
                        <Trash2 size={11} /> Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveSlide({
                            lessonDate: new Date().toLocaleDateString('en-GB', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            }),
                          })
                        }
                        className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-0.5"
                      >
                        <Plus size={12} /> Add Date
                      </button>
                    )}
                  </div>
                  {slide.lessonDate && (
                    <input
                      value={slide.lessonDate}
                      onChange={(e) => updateActiveSlide({ lessonDate: e.target.value })}
                      placeholder="e.g. Thursday, 14 November 2026"
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 font-semibold text-zinc-800 text-xs bg-white"
                    />
                  )}
                </div>

                {/* Big Question / Enquiry Hook */}
                {(slide.presetId === 'title-divider' ||
                  slide.presetId === 'lesson-title-page' ||
                  Boolean(slide.bigQuestion)) && (
                  <div className="space-y-2 border-t border-zinc-200 pt-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-zinc-500 uppercase tracking-wider text-[10px]">
                        Today&apos;s Enquiry Question / Hook
                      </label>
                      {slide.bigQuestion ? (
                        <button
                          type="button"
                          onClick={() => updateActiveSlide({ bigQuestion: undefined })}
                          className="text-[10px] font-bold text-rose-600 hover:underline flex items-center gap-0.5"
                        >
                          <Trash2 size={11} /> Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            updateActiveSlide({
                              bigQuestion:
                                'How can a single computer network connect millions of users reliably?',
                            })
                          }
                          className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-0.5"
                        >
                          <Plus size={12} /> Add Hook
                        </button>
                      )}
                    </div>
                    {slide.bigQuestion && (
                      <textarea
                        value={slide.bigQuestion}
                        rows={2}
                        onChange={(e) => updateActiveSlide({ bigQuestion: e.target.value })}
                        placeholder="Add lesson hook / enquiry question..."
                        className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 text-zinc-700 text-xs bg-white"
                      />
                    )}
                  </div>
                )}

                {/* Slide Components & Table Creator */}
                <div className="space-y-2 border-t border-zinc-200 pt-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-zinc-500 uppercase tracking-wider text-[10px]">
                      Add Slide Components
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTablePickerOpen(!tablePickerOpen)}
                      className={`px-2.5 py-1.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                        tablePickerOpen
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-800'
                      }`}
                    >
                      <TableIcon size={13} className={tablePickerOpen ? 'text-white' : 'text-emerald-700'} />
                      <span>Table (X × Y)</span>
                    </button>

                    {!slide.bigQuestion && (
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveSlide({
                            bigQuestion:
                              'How does this concept solve our central engineering challenge?',
                          })
                        }
                        className="px-2.5 py-1.5 rounded-xl border bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-800 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Plus size={13} className="text-sky-700" />
                        <span>Enquiry Hook</span>
                      </button>
                    )}

                    {!slide.lessonDate && (
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveSlide({
                            lessonDate: new Date().toLocaleDateString('en-GB', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            }),
                          })
                        }
                        className="px-2.5 py-1.5 rounded-xl border bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-800 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Clock size={13} className="text-amber-700" />
                        <span>Lesson Date</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        updateActiveSlide({
                          keyTermsStrip: [
                            ...(slide.keyTermsStrip || []),
                            { term: 'New Key Term', definition: 'Clear pupil definition...' },
                          ],
                        })
                      }
                      className="px-2.5 py-1.5 rounded-xl border bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-800 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <Plus size={13} className="text-violet-700" />
                      <span>Key Term</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateActiveSlide({
                          bodyBlocks: [
                            ...slide.bodyBlocks,
                            {
                              id: `blk-${Date.now()}`,
                              heading: '',
                              content: '• Key pupil-facing teaching point...',
                              style: 'boxed',
                              layer: 'top',
                            },
                          ],
                        })
                      }
                      className="px-2.5 py-1.5 rounded-xl border bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-800 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <Plus size={13} className="text-emerald-700" />
                      <span>Boxed Card</span>
                    </button>
                  </div>

                  {/* Table Creator Popover / Inline Box */}
                  {tablePickerOpen && (
                    <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-300 space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-emerald-950 flex items-center gap-1.5">
                          <TableIcon size={14} className="text-emerald-700" />
                          Insert Table
                        </span>
                        <div className="flex gap-1">
                          {[
                            { r: 2, c: 2 },
                            { r: 3, c: 3 },
                            { r: 4, c: 3 },
                            { r: 5, c: 2 },
                          ].map((chip) => (
                            <button
                              key={`${chip.r}x${chip.c}`}
                              type="button"
                              onClick={() => {
                                setTableRowsInput(chip.r);
                                setTableColsInput(chip.c);
                              }}
                              className="px-1.5 py-0.5 rounded-md bg-white border border-emerald-200 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100"
                            >
                              {chip.r}×{chip.c}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-600">Rows (X)</label>
                          <div className="flex items-center border border-zinc-300 bg-white rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setTableRowsInput(Math.max(1, tableRowsInput - 1))}
                              className="px-2 py-1 text-xs font-bold text-zinc-600 hover:bg-zinc-100"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={tableRowsInput}
                              onChange={(e) =>
                                setTableRowsInput(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
                              }
                              className="w-full text-center text-xs font-bold py-1 border-x border-zinc-200 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setTableRowsInput(Math.min(10, tableRowsInput + 1))}
                              className="px-2 py-1 text-xs font-bold text-zinc-600 hover:bg-zinc-100"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-600">Columns (Y)</label>
                          <div className="flex items-center border border-zinc-300 bg-white rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setTableColsInput(Math.max(1, tableColsInput - 1))}
                              className="px-2 py-1 text-xs font-bold text-zinc-600 hover:bg-zinc-100"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={8}
                              value={tableColsInput}
                              onChange={(e) =>
                                setTableColsInput(Math.max(1, Math.min(8, Number(e.target.value) || 1)))
                              }
                              className="w-full text-center text-xs font-bold py-1 border-x border-zinc-200 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setTableColsInput(Math.min(8, tableColsInput + 1))}
                              className="px-2 py-1 text-xs font-bold text-zinc-600 hover:bg-zinc-100"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-emerald-950">
                        <input
                          type="checkbox"
                          checked={tableHasHeader}
                          onChange={(e) => setTableHasHeader(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Include Header Row</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          const r = Math.max(1, tableRowsInput);
                          const c = Math.max(1, tableColsInput);
                          const headers = tableHasHeader
                            ? Array.from({ length: c }, (_, i) => `Column ${i + 1}`)
                            : undefined;
                          const cells = Array.from({ length: r }, () => Array.from({ length: c }, () => ''));
                          const newTableEl: BespokeCanvasElement = {
                            id: `tbl-${Date.now()}`,
                            kind: 'table',
                            content: '',
                            x: 8,
                            y: 26,
                            w: 84,
                            h: 54,
                            layer: 'top',
                            tableData: {
                              rows: r,
                              cols: c,
                              headers,
                              cells,
                            },
                          };
                          updateActiveSlide({
                            customCanvasElements: [
                              ...(slide.customCanvasElements || []),
                              newTableEl,
                            ],
                          });
                          setTablePickerOpen(false);
                        }}
                        className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Plus size={14} />
                        <span>Insert {tableRowsInput} × {tableColsInput} Table</span>
                      </button>
                    </div>
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
                      onClick={() => {
                        setMediaTargetElementId(null);
                        setMediaOpen(true);
                      }}
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
                    {slide.starterQuadrants.map((q, idx) => {
                      const qLayout = getQuadrantLayout(q);
                      const isPic = qLayout === 'identify-picture-mc' || qLayout === 'identify-picture-open';
                      const isTf = qLayout === 'true-false';
                      const isMc = qLayout === 'multiple-choice' || qLayout === 'identify-picture-mc';

                      return (
                        <div
                          key={q.id}
                          className="p-2.5 rounded-xl bg-[#FAF6F0] border border-zinc-200 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-sky-700 text-white text-[11px] font-bold">
                              {idx + 1}
                            </span>
                            <select
                              value={qLayout}
                              onChange={(e) => {
                                const nextLayout = e.target.value as StarterQuadrantLayout;
                                const quads = slide.starterQuadrants || [];
                                let newOptions = q.options;
                                let newAnswer = q.answer;
                                if (nextLayout === 'true-false') {
                                  newOptions = ['True', 'False'];
                                  if (!newAnswer || (!newAnswer.toLowerCase().includes('true') && !newAnswer.toLowerCase().includes('false'))) {
                                    newAnswer = 'A — True';
                                  }
                                } else if (nextLayout === 'multiple-choice' || nextLayout === 'identify-picture-mc') {
                                  if (!newOptions || newOptions.length < 4 || (newOptions.length === 2 && newOptions[0].toLowerCase().includes('true'))) {
                                    newOptions = ['Option A', 'Option B', 'Option C', 'Option D'];
                                    newAnswer = 'A — Option A';
                                  }
                                } else if (nextLayout === 'open-ended' || nextLayout === 'identify-picture-open') {
                                  newOptions = undefined;
                                  if (newAnswer && newAnswer.match(/^[A-D]\s*[—:-]\s*/)) {
                                    newAnswer = newAnswer.replace(/^[A-D]\s*[—:-]\s*/, '');
                                  }
                                }
                                updateActiveSlide({
                                  starterQuadrants: quads.map((item, i) =>
                                    i === idx
                                      ? {
                                          ...item,
                                          layout: nextLayout,
                                          options: newOptions,
                                          answer: newAnswer,
                                        }
                                      : item
                                  ),
                                });
                              }}
                              className="text-[11px] font-bold px-2 py-0.5 rounded-md border border-zinc-300 bg-white text-zinc-700 outline-none"
                            >
                              <option value="multiple-choice">Multiple Choice (4)</option>
                              <option value="true-false">True / False</option>
                              <option value="identify-picture-mc">Picture + MC</option>
                              <option value="identify-picture-open">Picture + Open</option>
                              <option value="open-ended">Open Question (No MC)</option>
                            </select>
                          </div>

                          {/* Image controls for picture layouts */}
                          {isPic && (
                            <div className="flex items-center gap-2 p-1.5 rounded-lg bg-white border border-zinc-200">
                              {q.imageUrl || q.svgCode ? (
                                <>
                                  <div className="w-10 h-10 rounded border border-zinc-200 overflow-hidden shrink-0 flex items-center justify-center bg-zinc-50">
                                    {q.svgCode ? (
                                      <div
                                        className="w-full h-full p-0.5 [&>svg]:w-full [&>svg]:h-full object-contain"
                                        dangerouslySetInnerHTML={{ __html: q.svgCode }}
                                      />
                                    ) : (
                                      <img
                                        src={q.imageUrl}
                                        alt={q.question}
                                        className="w-full h-full object-contain"
                                      />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold text-zinc-600 truncate">Image attached</p>
                                    <p className="text-[9px] text-zinc-400">Ctrl+V on slide to replace</p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setMediaTargetElementId(`quad-media-${idx}`);
                                      setMediaOpen(true);
                                    }}
                                    className="text-[10px] font-bold px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                                  >
                                    Change
                                  </button>
                                  <button
                                    onClick={() =>
                                      updateActiveSlide({
                                        starterQuadrants: slide.starterQuadrants?.map((item, i) =>
                                          i === idx
                                            ? { ...item, imageUrl: undefined, svgCode: undefined }
                                            : item
                                        ),
                                      })
                                    }
                                    className="text-[10px] font-bold px-1.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600"
                                  >
                                    Remove
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => {
                                    setMediaTargetElementId(`quad-media-${idx}`);
                                    setMediaOpen(true);
                                  }}
                                  className="w-full py-1.5 px-2 rounded border border-dashed border-zinc-300 text-[11px] font-bold text-zinc-600 hover:text-emerald-700 hover:border-emerald-500 bg-zinc-50/50 flex items-center justify-center gap-1.5"
                                >
                                  <ImagePlus size={14} />
                                  <span>Choose or Paste Diagram / Picture</span>
                                </button>
                              )}
                            </div>
                          )}

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
                            placeholder="Question or statement..."
                            className="w-full p-1.5 rounded-lg border border-zinc-200 bg-white font-semibold text-xs"
                          />

                          {/* True / False Choice Toggles */}
                          {isTf && (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                {['True', 'False'].map((tfVal, tfIdx) => {
                                  const letter = tfIdx === 0 ? 'A' : 'B';
                                  const isSelected = isTfOptionCorrect(tfVal === 'True', q.answer);
                                  return (
                                    <button
                                      key={tfVal}
                                      type="button"
                                      onClick={() => {
                                        const cleanWhy = q.answer.includes('—')
                                          ? q.answer.replace(/^[A-B]\s*—\s*(?:True|False)\s*[—:]\s*/i, '')
                                          : '';
                                        const nextAns = cleanWhy
                                          ? `${letter} — ${tfVal} — ${cleanWhy}`
                                          : `${letter} — ${tfVal}`;
                                        updateActiveSlide({
                                          starterQuadrants: slide.starterQuadrants?.map((item, i) =>
                                            i === idx ? { ...item, answer: nextAns } : item
                                          ),
                                        });
                                      }}
                                      className={`flex-1 py-1 px-2.5 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                                        isSelected
                                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                          : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                                      }`}
                                    >
                                      <span>{letter}. {tfVal}</span>
                                      {isSelected && <Check size={12} strokeWidth={3} />}
                                    </button>
                                  );
                                })}
                              </div>
                              <input
                                value={q.answer.replace(/^[A-B]\s*—\s*(?:True|False)\s*[—:]\s*/i, '')}
                                onChange={(e) => {
                                  const isTrue = isTfOptionCorrect(true, q.answer);
                                  const prefix = isTrue ? 'A — True — ' : 'B — False — ';
                                  updateActiveSlide({
                                    starterQuadrants: slide.starterQuadrants?.map((item, i) =>
                                      i === idx ? { ...item, answer: `${prefix}${e.target.value}` } : item
                                    ),
                                  });
                                }}
                                placeholder="Why (optional explanation)..."
                                className="w-full p-1 rounded-md border border-zinc-200 bg-white text-[11px]"
                              />
                            </div>
                          )}

                          {/* Multiple Choice Options */}
                          {isMc && q.options && (
                            <div className="grid grid-cols-2 gap-1">
                              {q.options.slice(0, 4).map((opt, optIdx) => {
                                const letter = ['A', 'B', 'C', 'D'][optIdx];
                                const isCorrect = isMcOptionCorrect(opt, optIdx, q.answer);
                                return (
                                  <div
                                    key={optIdx}
                                    className={`flex items-center gap-1 rounded border px-1.5 py-0.5 ${
                                      isCorrect
                                        ? 'bg-emerald-50 border-emerald-400'
                                        : 'bg-white border-zinc-200'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      title={`Mark ${letter} as correct answer`}
                                      onClick={() => {
                                        updateActiveSlide({
                                          starterQuadrants: slide.starterQuadrants?.map((item, i) =>
                                            i === idx
                                              ? { ...item, answer: `${letter} — ${opt.replace(/^[A-D][\s.):\-]+/i, '')}` }
                                              : item
                                          ),
                                        });
                                      }}
                                      className={`text-[10px] font-extrabold shrink-0 hover:underline cursor-pointer ${
                                        isCorrect ? 'text-emerald-700' : 'text-sky-700'
                                      }`}
                                    >
                                      {letter}.
                                    </button>
                                    <input
                                      value={opt.replace(/^[A-D][\s.):\-]+/i, '')}
                                      onChange={(e) => {
                                        const nextOpts = [...(q.options || [])];
                                        nextOpts[optIdx] = `${letter}. ${e.target.value}`;
                                        updateActiveSlide({
                                          starterQuadrants: slide.starterQuadrants?.map((item, i) =>
                                            i === idx
                                              ? {
                                                  ...item,
                                                  options: nextOpts,
                                                  answer: isCorrect
                                                    ? `${letter} — ${e.target.value}`
                                                    : item.answer,
                                                }
                                              : item
                                          ),
                                        });
                                      }}
                                      className="w-full py-0.5 bg-transparent text-[10.5px] font-medium text-zinc-700 outline-none"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Reveal Answer / Model Answer Input */}
                          {!isTf && (
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
                              placeholder={isMc ? 'Correct answer (e.g. B — 1101)...' : 'Model answer for whiteboard reveal...'}
                              className="w-full p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-950 font-semibold text-xs"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3.5 border-t border-zinc-200 pt-3">
                    <div className="flex items-center justify-between">
                      <label className="font-extrabold text-zinc-700 text-xs flex items-center gap-1.5">
                        <Type size={14} className="text-emerald-700" />
                        <span>Unified Slide Text & Formatting</span>
                      </label>
                      <span className="text-[10px] text-zinc-500 font-medium">
                        1 line = 1 style item
                      </span>
                    </div>

                    {/* Unified Text Area */}
                    <textarea
                      value={slide.unifiedText ?? richLinesToUnifiedText(getSlideRichLines(slide))}
                      rows={6}
                      onChange={(e) => {
                        const newText = e.target.value;
                        const currentRichLines = getSlideRichLines(slide);
                        const newRichLines = parseTextToRichLines(newText, currentRichLines);
                        const titleLine = newRichLines.find((l) => l.style === 'title') || newRichLines[0];
                        const firstTitle = titleLine?.text || '';
                        const newBodyBlocks = convertRichLinesToBodyBlocks(newRichLines);
                        updateActiveSlide({
                          unifiedText: newText,
                          richLines: newRichLines,
                          title: firstTitle || slide.title,
                          bodyBlocks: newBodyBlocks,
                        });
                      }}
                      placeholder="Type all slide text in one area...&#10;Line 1: Topic Title&#10;Line 2: Subheading or Section&#10;• Bullet point explanation&#10;Key Point: One punchy sentence"
                      className="w-full p-2.5 rounded-xl border border-zinc-300 bg-white text-zinc-900 font-medium text-xs leading-relaxed resize-y shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />

                    {/* Per-Line Styling Controls List Directly Beneath */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Per-Line Style, Size & Color Inspector
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {getSlideRichLines(slide).length} {getSlideRichLines(slide).length === 1 ? 'line' : 'lines'}
                        </span>
                      </div>

                      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                        {getSlideRichLines(slide).map((line, idx) => {
                          const currentRichLines = getSlideRichLines(slide);
                          const snippet = line.text.trim()
                            ? line.text.trim().split(/\s+/).slice(0, 5).join(' ') +
                              (line.text.trim().split(/\s+/).length > 5 ? '…' : '')
                            : '(Empty line)';

                          return (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl bg-[#FAF6F0] border border-zinc-200 hover:border-zinc-300 shadow-2xs space-y-2 transition-all"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span className="px-1.5 py-0.5 rounded-md bg-white border border-zinc-200 text-zinc-700 font-mono font-bold text-[10px] shrink-0">
                                    L{idx + 1}
                                  </span>
                                  <span
                                    title={line.text}
                                    className="text-[11px] font-bold text-zinc-800 truncate"
                                  >
                                    {line.text.trim() ? `"${snippet}"` : <span className="text-zinc-400 italic">(Blank line)</span>}
                                  </span>
                                </div>

                                {/* Style Selector Dropdown */}
                                <select
                                  value={line.style || (idx === 0 ? 'title' : 'normal')}
                                  onChange={(e) => {
                                    const nextStyle = e.target.value as SlideLineStyle;
                                    const nextLines = [...currentRichLines];
                                    nextLines[idx] = { ...line, style: nextStyle };
                                    const nextTitle =
                                      nextLines.find((l) => l.style === 'title')?.text ||
                                      (nextStyle === 'title' ? line.text : slide.title);
                                    updateActiveSlide({
                                      richLines: nextLines,
                                      unifiedText: richLinesToUnifiedText(nextLines),
                                      title: nextTitle,
                                      bodyBlocks: convertRichLinesToBodyBlocks(nextLines),
                                    });
                                  }}
                                  className="text-[10.5px] font-bold px-2 py-1 rounded-lg border border-zinc-300 bg-white text-zinc-800 outline-none shrink-0"
                                >
                                  <option value="title">Title</option>
                                  <option value="heading-1">Heading 1</option>
                                  <option value="heading-2">Heading 2</option>
                                  <option value="heading-3">Heading 3</option>
                                  <option value="normal">Normal Text</option>
                                  <option value="callout">Callout Box</option>
                                  <option value="code">Code Block</option>
                                </select>
                              </div>

                              {/* Format controls row: Size, B, I, U, and Colors */}
                              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-200/70">
                                {/* Font Size Selector */}
                                <select
                                  value={line.fontSize || ''}
                                  onChange={(e) => {
                                    const nextSize = e.target.value ? Number(e.target.value) : undefined;
                                    const nextLines = [...currentRichLines];
                                    nextLines[idx] = { ...line, fontSize: nextSize };
                                    updateActiveSlide({
                                      richLines: nextLines,
                                      bodyBlocks: convertRichLinesToBodyBlocks(nextLines),
                                    });
                                  }}
                                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md border border-zinc-300 bg-white text-zinc-700 outline-none"
                                >
                                  <option value="">Auto Size</option>
                                  <option value="18">18px (Fine)</option>
                                  <option value="22">22px (Body)</option>
                                  <option value="26">26px (Large)</option>
                                  <option value="30">30px (Subheading)</option>
                                  <option value="36">36px (Section H2)</option>
                                  <option value="44">44px (Major H1)</option>
                                  <option value="52">52px (Title)</option>
                                  <option value="60">60px (Hero Display)</option>
                                </select>

                                {/* Bold / Italic / Underline Toggles */}
                                <div className="flex items-center rounded-md border border-zinc-300 bg-white overflow-hidden shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextLines = [...currentRichLines];
                                      nextLines[idx] = { ...line, isBold: !line.isBold };
                                      updateActiveSlide({
                                        richLines: nextLines,
                                        bodyBlocks: convertRichLinesToBodyBlocks(nextLines),
                                      });
                                    }}
                                    className={`px-1.5 py-0.5 text-[11px] font-bold transition ${
                                      line.isBold ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                                    }`}
                                    title="Toggle Bold"
                                  >
                                    <Bold size={11} strokeWidth={3} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextLines = [...currentRichLines];
                                      nextLines[idx] = { ...line, isItalic: !line.isItalic };
                                      updateActiveSlide({
                                        richLines: nextLines,
                                        bodyBlocks: convertRichLinesToBodyBlocks(nextLines),
                                      });
                                    }}
                                    className={`px-1.5 py-0.5 text-[11px] italic transition border-l border-zinc-200 ${
                                      line.isItalic ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                                    }`}
                                    title="Toggle Italic"
                                  >
                                    <Italic size={11} strokeWidth={2.5} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextLines = [...currentRichLines];
                                      nextLines[idx] = { ...line, isUnderline: !line.isUnderline };
                                      updateActiveSlide({
                                        richLines: nextLines,
                                        bodyBlocks: convertRichLinesToBodyBlocks(nextLines),
                                      });
                                    }}
                                    className={`px-1.5 py-0.5 text-[11px] underline transition border-l border-zinc-200 ${
                                      line.isUnderline ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                                    }`}
                                    title="Toggle Underline"
                                  >
                                    <Underline size={11} strokeWidth={2.5} />
                                  </button>
                                </div>

                                {/* Color Swatches */}
                                <div className="flex items-center gap-1 ml-auto">
                                  {/* Theme Accent Color Swatch */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextLines = [...currentRichLines];
                                      nextLines[idx] = { ...line, color: palette.accent };
                                      updateActiveSlide({ richLines: nextLines });
                                    }}
                                    style={{ backgroundColor: palette.accent }}
                                    className={`w-4 h-4 rounded-full border border-black/15 transition ${
                                      line.color === palette.accent ? 'ring-2 ring-offset-1 ring-zinc-800 scale-110' : 'hover:scale-105'
                                    }`}
                                    title={`Theme Accent (${palette.accent})`}
                                  />

                                  {/* Constant Colors */}
                                  {CONSTANT_TEXT_COLORS.slice(0, 6).map((c) => (
                                    <button
                                      key={c.hex}
                                      type="button"
                                      onClick={() => {
                                        const nextLines = [...currentRichLines];
                                        nextLines[idx] = { ...line, color: c.hex };
                                        updateActiveSlide({ richLines: nextLines });
                                      }}
                                      style={{ backgroundColor: c.hex }}
                                      className={`w-4 h-4 rounded-full border border-black/15 transition ${
                                        line.color === c.hex ? 'ring-2 ring-offset-1 ring-zinc-800 scale-110' : 'hover:scale-105'
                                      }`}
                                      title={`${c.label} (${c.hex})`}
                                    />
                                  ))}

                                  {/* Auto/Reset Swatch */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextLines = [...currentRichLines];
                                      nextLines[idx] = { ...line, color: undefined };
                                      updateActiveSlide({ richLines: nextLines });
                                    }}
                                    className={`px-1 py-0.5 rounded text-[9px] font-bold border transition ${
                                      !line.color
                                        ? 'bg-zinc-300 text-zinc-900 border-zinc-400 font-extrabold'
                                        : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-100'
                                    }`}
                                    title="Reset to default automatic color"
                                  >
                                    Auto
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
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

                {/* AI Slide Deck Steer & Insert */}
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-xs text-amber-950 flex items-center gap-1.5">
                      <Sparkles size={15} className="text-amber-600" />
                      <span>AI Insert Slides &amp; Steer Deck</span>
                    </h4>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300/50">
                      Preserves Existing Slides
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-snug">
                    Type instructions like <strong className="text-zinc-800">&quot;Add 2 slides for binary conversion after slide 3&quot;</strong> or specify an insertion point below:
                  </p>
                  <textarea
                    value={deckInsertPrompt}
                    onChange={(e) => setDeckInsertPrompt(e.target.value)}
                    rows={2}
                    placeholder='e.g. "Add 2 slides for binary conversion worked examples after slide 3"'
                    className="w-full p-2.5 rounded-xl border border-zinc-300 bg-white text-xs text-zinc-900 placeholder:text-zinc-400 resize-none shadow-2xs focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-zinc-600 shrink-0">Insert Position:</span>
                    <select
                      value={deckInsertPosition}
                      onChange={(e) =>
                        setDeckInsertPosition(
                          e.target.value === 'end' ? 'end' : Number(e.target.value)
                        )
                      }
                      className="text-xs font-semibold px-2 py-1 rounded-lg border border-zinc-300 bg-white text-zinc-800 flex-1 outline-none"
                    >
                      <option value="end">
                        At End of Lesson (After Slide {lesson.slidesData.length})
                      </option>
                      <option value={0}>At Very Beginning (Before Slide 1)</option>
                      {lesson.slidesData.map((s, idx) => (
                        <option key={s.id} value={idx + 1}>
                          After Slide {idx + 1} ({s.title.slice(0, 24)}...)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <button
                      onClick={() => void handleDeckInsertAi()}
                      disabled={aiBusy !== null || !deckInsertPrompt.trim()}
                      className="w-full py-2 rounded-xl bg-amber-500 text-zinc-950 font-extrabold text-xs hover:bg-amber-400 disabled:opacity-50 flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                    >
                      {aiBusy === 'insert-deck' ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                      <span>Generate &amp; Insert Slides</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPromptModalTarget('insert-deck')}
                      className="w-full py-1.5 rounded-xl border border-zinc-300 bg-white text-zinc-700 text-xs font-bold hover:bg-zinc-100 flex items-center justify-center gap-1.5 transition"
                    >
                      <Terminal size={12} className="text-amber-600" />
                      <span>Copy Prompt / Paste AI (No API Key)</span>
                    </button>
                  </div>
                </div>

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
        currentMedia={
          mediaTargetElementId?.startsWith('quad-media-')
            ? (() => {
                const idx = parseInt(mediaTargetElementId.replace('quad-media-', ''), 10);
                const q = slide.starterQuadrants?.[idx];
                if (!q) return slide.mediaItem;
                return {
                  id: `quad-${idx}`,
                  type: q.svgCode ? 'svg-diagram' : 'image',
                  title: q.question,
                  url: q.imageUrl,
                  svgCode: q.svgCode,
                  cropFit: 'contain',
                  frameShape: 'clean',
                };
              })()
            : mediaTargetElementId?.startsWith('vocab-media-')
            ? (() => {
                const idx = parseInt(mediaTargetElementId.replace('vocab-media-', ''), 10);
                const t = slide.keyTermsStrip?.[idx];
                if (!t) return slide.mediaItem;
                return {
                  id: `vocab-${idx}`,
                  type: t.svgCode ? 'svg-diagram' : 'image',
                  title: t.term,
                  url: t.imageUrl,
                  svgCode: t.svgCode,
                  cropFit: 'contain',
                  frameShape: 'clean',
                };
              })()
            : mediaTargetElementId
            ? (() => {
                const targetEl = slide.customCanvasElements?.find(
                  (el) => el.id === mediaTargetElementId
                );
                if (!targetEl) return undefined;
                return {
                  id: targetEl.id,
                  type: targetEl.svgCode ? 'svg-diagram' : 'image',
                  title: targetEl.heading || 'Visual',
                  url: targetEl.imageUrl,
                  svgCode: targetEl.svgCode,
                  cropFit: targetEl.cropFit || (targetEl.svgCode ? 'contain' : 'cover'),
                  frameShape: 'clean',
                };
              })()
            : slide.mediaItem
        }
        pexelsApiKey={settings.pexelsApiKey}
        pixabayApiKey={settings.pixabayApiKey}
        onClose={() => {
          setMediaOpen(false);
          setMediaTargetElementId(null);
        }}
        onSelectMedia={(media) => {
          if (mediaTargetElementId?.startsWith('quad-media-')) {
            const idx = parseInt(mediaTargetElementId.replace('quad-media-', ''), 10);
            const currentQuads = slide.starterQuadrants || [];
            if (currentQuads[idx]) {
              updateActiveSlide({
                starterQuadrants: currentQuads.map((q, i) =>
                  i === idx
                    ? {
                        ...q,
                        imageUrl: media.type === 'image' ? media.url : undefined,
                        svgCode: media.type === 'svg-diagram' ? media.svgCode : undefined,
                      }
                    : q
                ),
              });
            }
            setMediaTargetElementId(null);
            setMediaOpen(false);
            return;
          }
          if (mediaTargetElementId?.startsWith('vocab-media-')) {
            const idx = parseInt(mediaTargetElementId.replace('vocab-media-', ''), 10);
            const currentTerms = slide.keyTermsStrip || [];
            if (currentTerms[idx]) {
              updateActiveSlide({
                keyTermsStrip: currentTerms.map((t, i) =>
                  i === idx
                    ? {
                        ...t,
                        imageUrl: media.type === 'image' ? media.url : undefined,
                        svgCode: media.type === 'svg-diagram' ? media.svgCode : undefined,
                      }
                    : t
                ),
              });
            } else if (idx === 0) {
              updateActiveSlide({
                mediaItem: media,
              });
            }
            setMediaTargetElementId(null);
            return;
          }

          if (
            mediaTargetElementId === 'slot-anchored-side-image' ||
            (slide.sideImageConfig && slide.sideImageConfig.side !== 'none') ||
            slide.mediaItem?.placement === 'anchor-right' ||
            slide.mediaItem?.placement === 'anchor-left'
          ) {
            const side =
              slide.sideImageConfig?.side && slide.sideImageConfig.side !== 'none'
                ? slide.sideImageConfig.side
                : slide.mediaItem?.placement === 'anchor-left'
                ? 'left'
                : 'right';
            updateActiveSlide({
              sideImageConfig: {
                side,
                widthPercent: slide.sideImageConfig?.widthPercent || 38,
                controlPoints: slide.sideImageConfig?.controlPoints,
              },
              mediaItem: {
                ...media,
                cropFit: 'cover',
                placement: side === 'left' ? 'anchor-left' : 'anchor-right',
              },
            });
            setMediaTargetElementId(null);
            return;
          }

          if (
            mediaTargetElementId &&
            slide.customCanvasElements?.some((el) => el.id === mediaTargetElementId)
          ) {
            updateActiveSlide({
              customCanvasElements: slide.customCanvasElements.map((el) =>
                el.id === mediaTargetElementId
                  ? {
                      ...el,
                      kind: media.type === 'svg-diagram' ? 'diagram' : 'image',
                      svgCode: media.type === 'svg-diagram' ? media.svgCode : undefined,
                      imageUrl: media.type === 'image' ? media.url : undefined,
                      cropFit: media.cropFit,
                      heading: media.title,
                    }
                  : el
              ),
            });
            setMediaTargetElementId(null);
            return;
          }

          updateActiveSlide({
            hiddenElementIds: slide.hiddenElementIds?.filter(
              (id) => id !== 'slot-media'
            ),
            mediaItem:
              slide.presetId === 'lesson-title-page'
                ? {
                    ...media,
                    placement: slide.mediaItem?.placement ?? 'fill-bottom-layer',
                    cropFit: 'cover',
                  }
                : media,
          });
          setMediaTargetElementId(null);
        }}
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
            elementLayouts: undefined,
            hiddenElementIds: undefined,
            ...(recommendedWave && presetId === 'mwb-starter-quadrant'
              ? { waveVariant: recommendedWave, waveControlPoints: undefined }
              : {}),
          });
          setSelectedElementId(null);
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
          promptModalTarget === 'insert-deck'
            ? `Insert Slides into Deck: Prompt / Paste JSON`
            : promptModalTarget === 'bespoke'
            ? `Slide ${slide.slideNumber}: Bespoke Designer Prompt / Paste JSON`
            : `Slide ${slide.slideNumber}: Surgical Revision Prompt / Paste JSON`
        }
        promptText={
          promptModalTarget === 'insert-deck'
            ? buildStage4InsertSlidesPrompt(
                sequence,
                lesson,
                deckInsertPrompt.trim() || 'Add 2 slides for this concept',
                deckInsertPosition === 'end'
                  ? lesson.slidesData.length
                  : Number(deckInsertPosition)
              )
            : promptModalTarget === 'bespoke'
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
          if (promptModalTarget === 'insert-deck') {
            const targetAfter =
              deckInsertPosition === 'end'
                ? lesson.slidesData.length
                : Number(deckInsertPosition);
            const { insertAfter, newSlides } = parseStage4InsertSlidesResponse(
              raw,
              lesson,
              targetAfter
            );
            const insertIdx = Math.max(0, Math.min(lesson.slidesData.length, insertAfter));
            const updatedSlides = [
              ...lesson.slidesData.slice(0, insertIdx),
              ...newSlides,
              ...lesson.slidesData.slice(insertIdx),
            ].map((s, idx) => ({
              ...s,
              slideNumber: idx + 1,
            }));
            const newBlueprints: SlideBlueprint[] = newSlides.map((s) => ({
              id: s.blueprintId,
              slideNumber: s.slideNumber,
              title: s.title,
              phase: s.phase,
              presetId: s.presetId,
              allocatedMinutes: 3,
              contentSummary: s.unifiedText || s.title,
              pupilActivity: 'Pupil engagement on new concept',
              routineIcons: s.routineIcons,
              conceptsIntroducedHere: [],
              pedagogicalRationale: {
                principle: 'Rosenshine Small Steps',
                cognitiveLoadNote: 'Incremental slide insertion',
              },
            }));
            const updatedBlueprints = [
              ...lesson.slidesBlueprint.slice(0, insertIdx),
              ...newBlueprints,
              ...lesson.slidesBlueprint.slice(insertIdx),
            ].map((b, idx) => ({
              ...b,
              slideNumber: idx + 1,
            }));
            updateLesson({
              slidesData: updatedSlides,
              slidesBlueprint: updatedBlueprints,
            });
            setDeckInsertPrompt('');
            setSelectedSlideIdx(insertIdx);
          } else if (promptModalTarget === 'bespoke') {
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

      {/* Toast Notification for Clipboard Image Paste */}
      {pasteToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-zinc-700 text-xs font-bold flex items-center gap-2 animate-reveal-pop">
          <ClipboardPaste size={15} className="text-emerald-400" />
          <span>{pasteToast}</span>
        </div>
      )}
    </div>
  );
};
