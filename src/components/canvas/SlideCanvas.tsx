import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Clock,
  Code2,
  Database,
  Globe,
  GripHorizontal,
  HelpCircle,
  ImagePlus,
  Layers,
  Lightbulb,
  LucideIcon,
  Move,
  Network,
  PenLine,
  Plus,
  Scale,
  Search,
  Sparkles,
  Square,
  Table as TableIcon,
  Target,
  Trash2,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import { calculateSnapping, DistanceGuide, SnapBox, SnapGuideLine } from './snapGuides';
import {
  BespokeCanvasElement,
  DualCodeIconId,
  ElementBoxOverride,
  PhasePalette,
  SlideData,
  SlideLineStyle,
  SlideMediaItem,
  SlideRichLine,
  SlideTableData,
  SlideTextBlock,
  StarterQuadrant,
  StarterQuadrantLayout,
} from '../../types/curriculum';
import { SlideTable } from './SlideTable';
import { getSlideRichLines, richLinesToUnifiedText } from '../../utils/richTextHelper';
import { PHASE_PALETTES } from '../../data/palettes';
import { PaperCutRenderer } from './PaperCutRenderer';
import {
  SideAnchoredImageWave,
  getDefaultSideImageControlPoints,
} from './SideAnchoredImageWave';
import {
  computeConformingPaperCut,
  estimateSlideObstacles,
  isSlideRegionDark,
  Point,
  smoothClosedSpline,
  smoothSplineSegment,
} from './paperCutPresets';
import { SlideTimerWidget } from './SlideTimerWidget';
import { RoutineBadgeIcon } from './RoutineBadgeIcon';

export const DUAL_CODE_ICON_CATALOG: {
  id: DualCodeIconId;
  label: string;
  Icon: LucideIcon;
}[] = [
  { id: 'concept', label: 'Key Idea', Icon: Lightbulb },
  { id: 'process', label: 'Process', Icon: Workflow },
  { id: 'network', label: 'Connection', Icon: Network },
  { id: 'data', label: 'Data', Icon: Database },
  { id: 'question', label: 'Question', Icon: HelpCircle },
  { id: 'compare', label: 'Compare', Icon: Scale },
  { id: 'warning', label: 'Misconception', Icon: AlertTriangle },
  { id: 'tip', label: 'Tip', Icon: Sparkles },
  { id: 'time', label: 'Timing', Icon: Clock },
  { id: 'target', label: 'Goal', Icon: Target },
  { id: 'layers', label: 'Layers', Icon: Layers },
  { id: 'search', label: 'Investigate', Icon: Search },
  { id: 'code', label: 'Code / Rule', Icon: Code2 },
  { id: 'earth', label: 'Real World', Icon: Globe },
  { id: 'people', label: 'Collaboration', Icon: Users },
  { id: 'check', label: 'Success', Icon: CheckCircle2 },
];

export function getDualCodeIconMeta(id?: DualCodeIconId) {
  return DUAL_CODE_ICON_CATALOG.find((item) => item.id === id) || null;
}

export function isMcOptionCorrect(
  opt: string,
  optIdx: number,
  answer: string
): boolean {
  const letter = String.fromCharCode(65 + optIdx);
  const trimmed = (answer || '').trim();
  if (!trimmed) return false;
  const letterMatch = trimmed.match(/^([A-D])(?:[\s.):—\-]+|$)/i);
  if (letterMatch) {
    return letterMatch[1].toUpperCase() === letter;
  }
  const cleanOpt = opt.replace(/^[A-D][\s.):\-]+/i, '').trim().toLowerCase();
  const cleanAns = trimmed.toLowerCase();
  return Boolean(cleanOpt && (cleanAns === cleanOpt || cleanAns.includes(cleanOpt)));
}

export function isTfOptionCorrect(isTrue: boolean, answer: string): boolean {
  const trimmed = (answer || '').trim().toLowerCase();
  if (!trimmed) return false;
  if (isTrue) {
    return trimmed.startsWith('a') || trimmed.startsWith('true') || trimmed.includes('true');
  } else {
    return trimmed.startsWith('b') || trimmed.startsWith('false') || trimmed.includes('false');
  }
}

export function stripStarterMetaPrefix(question: string): string {
  return (question || '')
    .replace(
      /^(?:from\s+(?:your\s+)?(?:previous|prior)\s+unit(?:\s+on\s+[^:]+)?|from\s+ks[1-5][^:]*|prior\s+unit|lesson\s+\d+|last\s+(?:lesson|week))\s*[:\-—]\s*/i,
      ''
    )
    .replace(/^([a-z])/, (m) => m.toUpperCase())
    .trim();
}

export function getQuadrantLayout(q: StarterQuadrant): StarterQuadrantLayout {
  if (q.layout) return q.layout;
  const isTf =
    q.options &&
    q.options.length === 2 &&
    (q.options[0].toLowerCase().trim() === 'true' ||
      q.options[0].toLowerCase().trim() === 'false' ||
      q.options[1].toLowerCase().trim() === 'false' ||
      q.options[1].toLowerCase().trim() === 'true');
  if (isTf) return 'true-false';
  const hasImg = Boolean(q.imageUrl || q.svgCode);
  if (hasImg) {
    return q.options && q.options.length > 0 ? 'identify-picture-mc' : 'identify-picture-open';
  }
  if (q.options && q.options.length > 0) {
    return 'multiple-choice';
  }
  return 'open-ended';
}

const GENERIC_META_HEADINGS = new Set([
  'key concept',
  'core concept',
  'concept',
  'activity focus',
  'pupil activity',
  'teacher explanation',
  'explanation',
  'summary',
  'overview',
  'main point',
  'lesson content',
  'key takeaway',
  'key idea',
]);

export function isGenericMetaHeading(heading?: string): boolean {
  if (!heading) return true;
  const normalized = heading.trim().toLowerCase().replace(/[:.]+$/, '');
  return normalized.length === 0 || GENERIC_META_HEADINGS.has(normalized);
}

interface SlideCanvasProps {
  slide: SlideData;
  isThumbnail?: boolean;
  hideWaveBackground?: boolean;
  starterRevealedCount?: number;
  editorPreviewAllAnswers?: boolean;
  interactiveTimer?: boolean;
  editable?: boolean;
  showWavePathEditor?: boolean;
  selectedElementId?: string | null;
  onSelectElement?: (id: string | null) => void;
  selectedElementIds?: string[];
  onSelectElements?: (ids: string[]) => void;
  onUpdateSlide?: (patch: Partial<SlideData>, isTransient?: boolean) => void;
  onDragStartHistory?: () => void;
  onOpenMediaPicker?: (targetElementId?: string) => void;
  hoveredImageTarget?: string | null;
  onHoverImageTarget?: (targetId: string | null) => void;
}

interface InlineEditableProps {
  value: string;
  editable?: boolean;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  onCommit: (next: string) => void;
}

const InlineEditableText: React.FC<InlineEditableProps> = ({
  value,
  editable = true,
  multiline = false,
  placeholder = 'Click to edit...',
  className = '',
  style,
  onCommit,
}) => {
  const elRef = useRef<HTMLSpanElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const initialValueRef = useRef(value);

  // Sync DOM with external value when NOT actively focused
  useEffect(() => {
    if (elRef.current && document.activeElement !== elRef.current) {
      elRef.current.innerText = value || '';
      initialValueRef.current = value || '';
    }
  }, [value]);

  if (!editable) {
    return (
      <span className={className} style={style}>
        {value || placeholder}
      </span>
    );
  }

  const handleFocus = () => {
    setIsFocused(true);
    initialValueRef.current = elRef.current?.innerText ?? value ?? '';
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!elRef.current) return;
    const current = elRef.current.innerText.trim();
    if (current !== initialValueRef.current) {
      initialValueRef.current = current;
      onCommit(current);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      elRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (elRef.current) {
        elRef.current.innerText = initialValueRef.current;
        elRef.current.blur();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLSpanElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const isEmpty = !value && !isFocused;

  return (
    <span
      ref={elRef}
      contentEditable={editable ? 'plaintext-only' : false}
      suppressContentEditableWarning
      data-no-drag="true"
      data-editable-text="true"
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onPointerDown={(e) => {
        // Prevent slot drag initiation so user can position caret and highlight text
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      title="Click to edit text directly on slide"
      className={`${className} outline-none transition-[box-shadow,background-color] rounded-lg ${
        isFocused
          ? 'ring-2 ring-amber-400/90 bg-amber-400/10'
          : 'hover:ring-2 hover:ring-dashed hover:ring-amber-400/60 hover:bg-amber-400/5 cursor-text'
      } ${isEmpty ? 'opacity-40 italic' : ''}`}
      style={{
        ...style,
        display: multiline ? 'block' : 'inline-block',
        minWidth: '28px',
        wordBreak: 'break-word',
        whiteSpace: multiline ? 'pre-wrap' : 'normal',
      }}
    >
      {value || (isEmpty ? placeholder : '')}
    </span>
  );
};

interface DualCodeBadgeControlProps {
  iconId?: DualCodeIconId;
  accentColor: string;
  onDarkSurface?: boolean;
  editable?: boolean;
  onChangeIcon?: (next?: DualCodeIconId) => void;
}

const DualCodeBadgeControl: React.FC<DualCodeBadgeControlProps> = ({
  iconId,
  accentColor,
  onDarkSurface = false,
  editable = false,
  onChangeIcon,
}) => {
  const [open, setOpen] = useState(false);
  const meta = getDualCodeIconMeta(iconId);

  if (!meta && !editable) return null;

  return (
    <div
      className="relative shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      {meta ? (
        <button
          type="button"
          onClick={() => editable && setOpen((v) => !v)}
          title={editable ? `Dual-coding icon: ${meta.label} (click to change)` : meta.label}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition ${
            editable ? 'cursor-pointer hover:scale-105 shadow-md' : 'cursor-default'
          }`}
          style={{
            backgroundColor: onDarkSurface ? 'rgba(255,255,255,0.16)' : '#FFFFFF',
            borderColor: onDarkSurface ? 'rgba(255,255,255,0.38)' : `${accentColor}45`,
            color: onDarkSurface ? '#FFFFFF' : accentColor,
          }}
        >
          <meta.Icon size={28} strokeWidth={2.3} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="Choose a Dual-Coding Icon for this card"
          className={`w-11 h-11 rounded-2xl border-2 border-dashed flex items-center justify-center transition opacity-55 hover:opacity-100 ${
            onDarkSurface
              ? 'border-white/50 text-white/80 hover:bg-white/15'
              : 'border-zinc-400 text-zinc-500 hover:bg-white'
          }`}
        >
          <Sparkles size={20} />
        </button>
      )}

      {editable && open && onChangeIcon && (
        <div
          className="absolute left-0 top-14 z-50 w-[330px] p-3.5 rounded-2xl bg-white text-zinc-900 border-2 border-zinc-200 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[18px] font-extrabold text-zinc-800">
              Dual-Coding Icon
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500"
            >
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {DUAL_CODE_ICON_CATALOG.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChangeIcon(item.id);
                  setOpen(false);
                }}
                className={`p-2 rounded-xl border flex flex-col items-center gap-1 text-center transition ${
                  iconId === item.id
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                <item.Icon size={22} />
                <span className="text-[12px] leading-tight truncate w-full">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
          {iconId && (
            <button
              type="button"
              onClick={() => {
                onChangeIcon(undefined);
                setOpen(false);
              }}
              className="mt-2.5 w-full py-1.5 rounded-xl bg-zinc-100 hover:bg-rose-50 text-zinc-600 hover:text-rose-700 text-[15px] font-bold"
            >
              Remove Icon
            </button>
          )}
        </div>
      )}
    </div>
  );
};

type DragMode = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface ComponentDragSession {
  primarySlotId: string;
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  originBoxes: Record<string, ElementBoxOverride>;
  allCandidateBoxes: SnapBox[];
  minDeltaPx: number;
  moved: boolean;
}

const RESIZE_HANDLES: {
  dir: Exclude<DragMode, 'move'>;
  style: React.CSSProperties;
}[] = [
  { dir: 'nw', style: { left: -12, top: -12, cursor: 'nwse-resize' } },
  { dir: 'n', style: { left: '50%', top: -12, transform: 'translateX(-50%)', cursor: 'ns-resize' } },
  { dir: 'ne', style: { right: -12, top: -12, cursor: 'nesw-resize' } },
  { dir: 'e', style: { right: -12, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' } },
  { dir: 'se', style: { right: -12, bottom: -12, cursor: 'nwse-resize' } },
  { dir: 's', style: { left: '50%', bottom: -12, transform: 'translateX(-50%)', cursor: 'ns-resize' } },
  { dir: 'sw', style: { left: -12, bottom: -12, cursor: 'nesw-resize' } },
  { dir: 'w', style: { left: -12, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' } },
];

interface InteractiveSlotProps {
  id: string;
  override?: ElementBoxOverride;
  editable: boolean;
  isSelected: boolean;
  showSingleToolbar?: boolean;
  isBoxed?: boolean;
  isBottomLayer?: boolean;
  showBoxToggle?: boolean;
  showLayerToggle?: boolean;
  stretchHeight?: boolean;
  className?: string;
  onSelect: (isCtrl: boolean) => void;
  onStartDrag: (
    e: React.PointerEvent,
    slotEl: HTMLElement,
    mode: DragMode,
    minDeltaPx: number
  ) => void;
  onToggleBoxed?: () => void;
  onToggleLayer?: () => void;
  onDelete?: () => void;
  extraActions?: React.ReactNode;
  children: React.ReactNode;
}

const InteractiveSlot: React.FC<InteractiveSlotProps> = ({
  id,
  override,
  editable,
  isSelected,
  showSingleToolbar = true,
  isBoxed = false,
  isBottomLayer = false,
  showBoxToggle = false,
  showLayerToggle = false,
  stretchHeight = false,
  className = '',
  onSelect,
  onStartDrag,
  onToggleBoxed,
  onToggleLayer,
  onDelete,
  extraActions,
  children,
}) => {
  const slotRef = useRef<HTMLDivElement>(null);

  const absStyle: React.CSSProperties | undefined = override
    ? {
        position: 'absolute',
        left: override.x,
        top: override.y,
        width: override.w,
        ...(stretchHeight ? { height: override.h } : { minHeight: override.h }),
        zIndex: isSelected ? 48 : 32,
      }
    : undefined;

  if (!editable) {
    return (
      <div
        data-slot-id={id}
        style={absStyle}
        className={`${override ? 'pointer-events-auto flex flex-col' : ''} ${className}`}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={slotRef}
      data-slot-id={id}
      style={absStyle}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        const isCtrl = e.ctrlKey || e.metaKey;
        if (
          target.closest(
            'input, textarea, select, button, [data-no-drag], [contenteditable], [data-editable-text]'
          )
        ) {
          e.stopPropagation();
          onSelect(isCtrl);
          return;
        }
        e.stopPropagation();
        onSelect(isCtrl);
        if (slotRef.current) {
          onStartDrag(e, slotRef.current, 'move', 6);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      className={`group/slot ${override ? '' : 'relative'} transition-shadow pointer-events-auto flex flex-col ${
        isSelected
          ? 'ring-3 ring-sky-500 rounded-2xl shadow-lg bg-sky-50/10'
          : 'hover:ring-2 hover:ring-sky-400/70 rounded-2xl'
      } ${className}`}
    >
      {children}

      {/* PowerPoint / Google Slides Action Toolbar above selected component (shown if single element selected) */}
      {isSelected && showSingleToolbar && (
        <div
          data-no-drag="true"
      data-editable-text="true"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="absolute -top-12 left-0 z-50 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900/95 text-white shadow-2xl border border-zinc-700 whitespace-nowrap animate-fade-in"
        >
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (slotRef.current) {
                onStartDrag(e, slotRef.current, 'move', 0);
              }
            }}
            title="Drag anywhere on the slide"
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[18px] font-bold cursor-grab active:cursor-grabbing"
          >
            <GripHorizontal size={20} />
            <span>Move</span>
          </button>

          {showBoxToggle && onToggleBoxed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleBoxed();
              }}
              title="Toggle optional background box around text"
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[17px] font-bold transition ${
                isBoxed
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
              }`}
            >
              <Square size={17} />
              <span>{isBoxed ? 'Boxed' : 'Unboxed'}</span>
            </button>
          )}

          {showLayerToggle && onToggleLayer && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLayer();
              }}
              title="Switch ink for light sheet vs dark wave surface"
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[17px] font-bold transition ${
                isBottomLayer
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
              }`}
            >
              <Layers size={17} />
              <span>{isBottomLayer ? 'White Ink' : 'Dark Ink'}</span>
            </button>
          )}

          {extraActions}

          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Remove component from slide"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white text-[17px] font-bold transition"
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
      )}

      {/* 8 PowerPoint-style Resize Handles when selected (single element only) */}
      {isSelected &&
        showSingleToolbar &&
        RESIZE_HANDLES.map((h) => (
          <div
            key={h.dir}
            data-no-drag="true"
      data-editable-text="true"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (slotRef.current) {
                onStartDrag(e, slotRef.current, h.dir, 0);
              }
            }}
            style={h.style}
            title="Drag to resize"
            className="absolute z-50 w-6 h-6 rounded-full bg-white border-4 border-sky-600 shadow-lg hover:scale-125 transition-transform"
          />
        ))}
    </div>
  );
};

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  isThumbnail = false,
  hideWaveBackground = false,
  starterRevealedCount = 0,
  editorPreviewAllAnswers = false,
  interactiveTimer = true,
  editable = false,
  showWavePathEditor = false,
  selectedElementId: controlledSelectedId,
  onSelectElement,
  selectedElementIds: controlledSelectedIds,
  onSelectElements,
  onUpdateSlide,
  onDragStartHistory,
  onOpenMediaPicker,
  hoveredImageTarget,
  onHoverImageTarget,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasBoxRef = useRef<HTMLDivElement>(null);
  const svgOverlayRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  const [draggingPts, setDraggingPts] = useState<Point[] | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [sideImgDraggingPts, setSideImgDraggingPts] = useState<Point[] | null>(null);
  const [sideImgDragIdx, setSideImgDragIdx] = useState<number | null>(null);
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  const [compDrag, setCompDrag] = useState<ComponentDragSession | null>(null);
  const lastDraggedAtRef = useRef(0);
  const [activeGuides, setActiveGuides] = useState<SnapGuideLine[]>([]);
  const [activeDistanceGuides, setActiveDistanceGuides] = useState<DistanceGuide[]>([]);
  const [isShiftHeld, setIsShiftHeld] = useState(false);

  // Marquee selection state
  const [marqueeBox, setMarqueeBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const marqueeStartRef = useRef<{
    clientX: number;
    clientY: number;
    canvasX: number;
    canvasY: number;
    ctrl: boolean;
  } | null>(null);

  const selectedIds = useMemo(() => {
    if (controlledSelectedIds !== undefined) return controlledSelectedIds;
    if (internalSelectedIds.length > 1) return internalSelectedIds;
    if (controlledSelectedId !== undefined) {
      return controlledSelectedId ? [controlledSelectedId] : [];
    }
    return internalSelectedIds;
  }, [controlledSelectedIds, controlledSelectedId, internalSelectedIds]);

  const setSelectedIds = (nextOrFn: string[] | ((prev: string[]) => string[])) => {
    setInternalSelectedIds((prev) => {
      const next = typeof nextOrFn === 'function' ? nextOrFn(prev) : nextOrFn;
      onSelectElements?.(next);
      if (next.length <= 1) {
        onSelectElement?.(next[0] || null);
      }
      return next;
    });
  };

  const handleSelectSlot = (slotId: string, isCtrl: boolean) => {
    if (isCtrl) {
      setSelectedIds((prev) =>
        prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]
      );
    } else {
      setSelectedIds((prev) => {
        if (prev.includes(slotId) && prev.length > 1) {
          return prev;
        }
        return [slotId];
      });
    }
  };

  const canEditComponents = editable && !isThumbnail && !hideWaveBackground;

  const palette = PHASE_PALETTES[slide.phase];
  const invert = Boolean(slide.invertWaveLayers);
  const isStarter = slide.presetId === 'mwb-starter-quadrant';
  const isLeftSpine = slide.waveVariant === 'vertical-scurve-left';
  const isTitlePage = slide.presetId === 'lesson-title-page';
  const isHaloVariant =
    slide.waveVariant === 'framed-halo' ||
    slide.waveVariant === 'dark-halo-spotlight';

  // Lesson title page defaults its cover visual to cropped bottom-layer fill inside the wave
  const effectiveMedia: SlideMediaItem | undefined = useMemo(() => {
    if (!slide.mediaItem) return undefined;
    if (isTitlePage && !slide.mediaItem.placement) {
      return {
        ...slide.mediaItem,
        placement: 'fill-bottom-layer',
        cropFit: slide.mediaItem.cropFit || 'cover',
      };
    }
    return slide.mediaItem;
  }, [slide.mediaItem, isTitlePage]);

  const hasFullBottomImage = effectiveMedia?.placement === 'fill-bottom-layer';

  const effectiveSideConfig = useMemo(() => {
    if (
      slide.sideImageConfig &&
      (slide.sideImageConfig.side === 'left' || slide.sideImageConfig.side === 'right')
    ) {
      return {
        side: slide.sideImageConfig.side,
        widthPercent: slide.sideImageConfig.widthPercent || 38,
        controlPoints: slide.sideImageConfig.controlPoints,
      };
    }
    if (slide.mediaItem?.placement === 'anchor-right') {
      return {
        side: 'right' as const,
        widthPercent: slide.sideImageConfig?.widthPercent || 38,
        controlPoints: slide.sideImageConfig?.controlPoints,
      };
    }
    if (slide.mediaItem?.placement === 'anchor-left') {
      return {
        side: 'left' as const,
        widthPercent: slide.sideImageConfig?.widthPercent || 38,
        controlPoints: slide.sideImageConfig?.controlPoints,
      };
    }
    return null;
  }, [slide.sideImageConfig, slide.mediaItem?.placement]);

  const activeSideImgPts = useMemo(() => {
    if (!effectiveSideConfig) return [];
    if (sideImgDraggingPts) return sideImgDraggingPts;
    if (
      effectiveSideConfig.controlPoints &&
      effectiveSideConfig.controlPoints.length >= 3
    ) {
      return effectiveSideConfig.controlPoints;
    }
    return getDefaultSideImageControlPoints(
      effectiveSideConfig.side,
      effectiveSideConfig.widthPercent || 38
    );
  }, [effectiveSideConfig, sideImgDraggingPts]);

  const headerOnDark =
    !hideWaveBackground && isSlideRegionDark(slide.waveVariant, 'header', invert);
  const topOnDark =
    !hideWaveBackground && isSlideRegionDark(slide.waveVariant, 'top', invert);
  const bottomOnDark =
    !hideWaveBackground && isSlideRegionDark(slide.waveVariant, 'bottom', invert);

  const slideForWaves = useMemo(
    () => (effectiveMedia !== slide.mediaItem ? { ...slide, mediaItem: effectiveMedia } : slide),
    [slide, effectiveMedia]
  );

  const obstacles = useMemo(
    () => estimateSlideObstacles(slideForWaves),
    [slideForWaves]
  );
  const activeControlPoints = draggingPts ?? slide.waveControlPoints;

  const computedPaper = useMemo(
    () =>
      computeConformingPaperCut(
        slide.waveVariant,
        palette,
        obstacles,
        slide.customWaveLayers,
        activeControlPoints,
        invert
      ),
    [
      slide.waveVariant,
      palette,
      obstacles,
      slide.customWaveLayers,
      activeControlPoints,
      invert,
    ]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateScale = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) setScale(rect.width / 1920);
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Drag handler for SVG wave path control points (allows dragging flush to or beyond slide edges)
  useEffect(() => {
    if (dragIdx === null) return;
    const snapEdge = (val: number, max: number) => {
      if (Math.abs(val) <= 14) return 0;
      if (Math.abs(val - max) <= 14) return max;
      return val;
    };
    const onMove = (e: PointerEvent) => {
      const svg = svgOverlayRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const rawX = ((e.clientX - rect.left) / rect.width) * 1920;
      const rawY = ((e.clientY - rect.top) / rect.height) * 1080;
      const canvasX = snapEdge(Math.max(-140, Math.min(2060, rawX)), 1920);
      const canvasY = snapEdge(Math.max(-140, Math.min(1220, rawY)), 1080);
      setDraggingPts((prev) => {
        const base = prev ?? computedPaper.controlPoints;
        return base.map((p, i) => (i === dragIdx ? { x: canvasX, y: canvasY } : p));
      });
    };

    const onUp = () => {
      setDragIdx(null);
      setDraggingPts((prev) => {
        if (prev && onUpdateSlide) {
          onUpdateSlide({ waveControlPoints: prev });
        }
        return null;
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragIdx, computedPaper.controlPoints, onUpdateSlide]);

  // Drag handler for Side Image Paper-Cut Wave control points
  useEffect(() => {
    if (sideImgDragIdx === null || !effectiveSideConfig) return;
    const snapEdge = (val: number, max: number) => {
      if (Math.abs(val) <= 14) return 0;
      if (Math.abs(val - max) <= 14) return max;
      return val;
    };
    const onMove = (e: PointerEvent) => {
      const svg = svgOverlayRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const rawX = ((e.clientX - rect.left) / rect.width) * 1920;
      const rawY = ((e.clientY - rect.top) / rect.height) * 1080;
      const canvasX = snapEdge(Math.max(-140, Math.min(2060, rawX)), 1920);
      const canvasY = snapEdge(Math.max(-140, Math.min(1220, rawY)), 1080);
      setSideImgDraggingPts((prev) => {
        const base = prev ?? activeSideImgPts;
        return base.map((p, i) => (i === sideImgDragIdx ? { x: canvasX, y: canvasY } : p));
      });
    };

    const onUp = () => {
      setSideImgDragIdx(null);
      setSideImgDraggingPts((prev) => {
        if (prev && onUpdateSlide) {
          onUpdateSlide({
            sideImageConfig: {
              ...(slide.sideImageConfig || { side: effectiveSideConfig.side }),
              side: effectiveSideConfig.side,
              widthPercent: effectiveSideConfig.widthPercent || 38,
              controlPoints: prev,
            },
          });
        }
        return null;
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [sideImgDragIdx, effectiveSideConfig, activeSideImgPts, onUpdateSlide, slide.sideImageConfig]);

  const latestSlideRef = useRef(slide);
  const latestUpdateRef = useRef(onUpdateSlide);
  const latestDragHistoryRef = useRef(onDragStartHistory);
  latestSlideRef.current = slide;
  latestUpdateRef.current = onUpdateSlide;
  latestDragHistoryRef.current = onDragStartHistory;

  const activeSelectedId = selectedIds[0] || null;
  const setSelectedId = (id: string | null) => {
    setSelectedIds(id ? [id] : []);
  };

  const deleteSlots = (slotIds: string[]) => {
    const cur = latestSlideRef.current;
    const upd = latestUpdateRef.current;
    if (!upd || slotIds.length === 0) return;

    const nextLayouts = cur.elementLayouts ? { ...cur.elementLayouts } : {};
    slotIds.forEach((id) => delete nextLayouts[id]);

    const nextHidden = new Set(cur.hiddenElementIds || []);
    let nextBodyBlocks = cur.bodyBlocks;
    let nextCustomEls = cur.customCanvasElements;
    let clearMedia = false;

    slotIds.forEach((id) => {
      if (id === 'slot-media') {
        clearMedia = true;
        nextHidden.add('slot-media');
      } else if (cur.bodyBlocks.some((b) => b.id === id)) {
        nextBodyBlocks = nextBodyBlocks.filter((b) => b.id !== id);
      } else if (cur.customCanvasElements?.some((el) => el.id === id)) {
        nextCustomEls = nextCustomEls?.filter((el) => el.id !== id);
      } else {
        nextHidden.add(id);
      }
    });

    upd({
      bodyBlocks: nextBodyBlocks,
      customCanvasElements: nextCustomEls,
      elementLayouts: nextLayouts,
      hiddenElementIds: Array.from(nextHidden),
      ...(clearMedia ? { mediaItem: undefined } : {}),
    });

    setSelectedIds([]);
  };

  const deleteSlot = (slotId: string) => {
    deleteSlots([slotId]);
  };

  useEffect(() => {
    if (!canEditComponents || selectedIds.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      deleteSlots(selectedIds);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canEditComponents, selectedIds]);

  // Track shift key globally for user awareness (holding shift disables snapping)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const measureSlotBox = (slotId: string): ElementBoxOverride | null => {
    const canvas = canvasBoxRef.current;
    if (!canvas) return null;
    const slotEl = canvas.querySelector<HTMLElement>(`[data-slot-id="${slotId}"]`);
    if (!slotEl) return null;
    const cRect = canvas.getBoundingClientRect();
    const sRect = slotEl.getBoundingClientRect();
    const s = scale || 1;
    return {
      x: Math.round((sRect.left - cRect.left) / s),
      y: Math.round((sRect.top - cRect.top) / s),
      w: Math.max(140, Math.round(sRect.width / s)),
      h: Math.max(56, Math.round(sRect.height / s)),
    };
  };

  const getCandidateSnapBoxes = (excludedIds: Set<string>): SnapBox[] => {
    const result: SnapBox[] = [];
    const canvas = canvasBoxRef.current;
    if (!canvas) return result;
    const cRect = canvas.getBoundingClientRect();
    if (!cRect.width || !cRect.height) return result;

    const hiddenSetLocal = new Set(latestSlideRef.current.hiddenElementIds || []);

    // 1. From elementLayouts
    if (latestSlideRef.current.elementLayouts) {
      for (const [id, box] of Object.entries(latestSlideRef.current.elementLayouts)) {
        if (!excludedIds.has(id) && !hiddenSetLocal.has(id)) {
          result.push({
            id,
            x: box.x,
            y: box.y,
            w: box.w,
            h: box.h,
          });
        }
      }
    }

    // 2. From DOM for un-overridden slots
    const slotElements = canvas.querySelectorAll<HTMLElement>('[data-slot-id]');
    slotElements.forEach((el) => {
      const slotId = el.getAttribute('data-slot-id');
      if (!slotId || excludedIds.has(slotId) || hiddenSetLocal.has(slotId)) return;
      if (result.some((b) => b.id === slotId)) return;

      const sRect = el.getBoundingClientRect();
      const x = Math.round(((sRect.left - cRect.left) / cRect.width) * 1920);
      const y = Math.round(((sRect.top - cRect.top) / cRect.height) * 1080);
      const w = Math.round((sRect.width / cRect.width) * 1920);
      const h = Math.round((sRect.height / cRect.height) * 1080);

      if (w > 30 && h > 20) {
        result.push({ id: slotId, x, y, w, h });
      }
    });

    return result;
  };

  const handleStartSlotDrag = (
    slotId: string,
    e: React.PointerEvent,
    slotEl: HTMLElement,
    mode: DragMode,
    minDeltaPx: number,
    defaults?: { layer?: 'top' | 'bottom'; boxed?: boolean }
  ) => {
    const canvasEl = canvasBoxRef.current;
    if (!canvasEl || !latestUpdateRef.current) return;
    const canvasRect = canvasEl.getBoundingClientRect();
    if (!canvasRect.width || !canvasRect.height) return;

    // Determine target slot IDs to drag together
    const targetSlotIds = selectedIds.includes(slotId) ? selectedIds : [slotId];
    if (!selectedIds.includes(slotId)) {
      setSelectedIds([slotId]);
    }

    const originBoxes: Record<string, ElementBoxOverride> = {};

    targetSlotIds.forEach((id) => {
      const existing = latestSlideRef.current.elementLayouts?.[id];
      if (existing) {
        originBoxes[id] = { ...existing };
      } else {
        const el = canvasEl.querySelector<HTMLElement>(`[data-slot-id="${id}"]`) || slotEl;
        const elRect = el.getBoundingClientRect();
        originBoxes[id] = {
          x: Math.round(((elRect.left - canvasRect.left) / canvasRect.width) * 1920),
          y: Math.round(((elRect.top - canvasRect.top) / canvasRect.height) * 1080),
          w: Math.max(120, Math.round((elRect.width / canvasRect.width) * 1920)),
          h: Math.max(54, Math.round((elRect.height / canvasRect.height) * 1080)),
          layer: defaults?.layer,
          boxed: defaults?.boxed,
        };
      }
    });

    const candidateBoxes = getCandidateSnapBoxes(new Set(targetSlotIds));

    setCompDrag({
      primarySlotId: slotId,
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originBoxes,
      allCandidateBoxes: candidateBoxes,
      minDeltaPx,
      moved: false,
    });
  };

  useEffect(() => {
    if (!compDrag) return;
    let moved = compDrag.moved;
    const session = compDrag;

    const onMove = (e: PointerEvent) => {
      const canvasEl = canvasBoxRef.current;
      const upd = latestUpdateRef.current;
      const cur = latestSlideRef.current;
      if (!canvasEl || !upd) return;

      setIsShiftHeld(e.shiftKey);

      const dxScreen = e.clientX - session.startClientX;
      const dyScreen = e.clientY - session.startClientY;

      if (!moved) {
        if (Math.hypot(dxScreen, dyScreen) < session.minDeltaPx) return;
        moved = true;
        lastDraggedAtRef.current = Date.now();
        latestDragHistoryRef.current?.();
      } else {
        lastDraggedAtRef.current = Date.now();
      }

      const rect = canvasEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const rawDx = (dxScreen / rect.width) * 1920;
      const rawDy = (dyScreen / rect.height) * 1080;

      const primaryOrigin = session.originBoxes[session.primarySlotId];
      if (!primaryOrigin) return;

      if (session.mode === 'move') {
        // Calculate unconstrained target box for primary element
        const unconstrainedPrimaryBox: SnapBox = {
          id: session.primarySlotId,
          x: primaryOrigin.x + rawDx,
          y: primaryOrigin.y + rawDy,
          w: primaryOrigin.w,
          h: primaryOrigin.h,
        };

        // Snapping calculation against candidates & canvas center landmarks
        const snapResult = calculateSnapping(
          unconstrainedPrimaryBox,
          session.allCandidateBoxes,
          8, // 8px threshold
          e.shiftKey // Holding Shift disables snapping
        );

        setActiveGuides(snapResult.guides);
        setActiveDistanceGuides(snapResult.distanceGuides);

        // Derive synchronized delta for all selected items
        const deltaX = snapResult.snappedX - primaryOrigin.x;
        const deltaY = snapResult.snappedY - primaryOrigin.y;

        const nextLayouts = { ...(cur.elementLayouts || {}) };
        const updatedCustomEls = cur.customCanvasElements
          ? [...cur.customCanvasElements]
          : undefined;

        for (const [id, o] of Object.entries(session.originBoxes)) {
          const nextX = Math.max(-100, Math.min(1900, Math.round(o.x + deltaX)));
          const nextY = Math.max(-100, Math.min(1060, Math.round(o.y + deltaY)));
          const nextBox: ElementBoxOverride = {
            ...o,
            x: nextX,
            y: nextY,
            w: o.w,
            h: o.h,
          };
          nextLayouts[id] = nextBox;

          if (updatedCustomEls) {
            const idx = updatedCustomEls.findIndex((el) => el.id === id);
            if (idx !== -1) {
              updatedCustomEls[idx] = {
                ...updatedCustomEls[idx],
                x: Number(((nextBox.x / 1920) * 100).toFixed(2)),
                y: Number(((nextBox.y / 1080) * 100).toFixed(2)),
              };
            }
          }
        }

        upd(
          {
            elementLayouts: nextLayouts,
            ...(updatedCustomEls ? { customCanvasElements: updatedCustomEls } : {}),
          },
          true
        );
      } else {
        // Resize mode for primary selected element
        setActiveGuides([]);
        setActiveDistanceGuides([]);
        const MIN_W = 110;
        const MIN_H = 52;
        let nextX = primaryOrigin.x;
        let nextY = primaryOrigin.y;
        let nextW = primaryOrigin.w;
        let nextH = primaryOrigin.h;

        if (session.mode.includes('e')) {
          nextW = Math.max(MIN_W, Math.round(primaryOrigin.w + rawDx));
        }
        if (session.mode.includes('s')) {
          nextH = Math.max(MIN_H, Math.round(primaryOrigin.h + rawDy));
        }
        if (session.mode.includes('w')) {
          const maxShift = primaryOrigin.w - MIN_W;
          const clampedDx = Math.min(rawDx, maxShift);
          nextX = Math.round(primaryOrigin.x + clampedDx);
          nextW = Math.round(primaryOrigin.w - clampedDx);
        }
        if (session.mode.includes('n')) {
          const maxShift = primaryOrigin.h - MIN_H;
          const clampedDy = Math.min(rawDy, maxShift);
          nextY = Math.round(primaryOrigin.y + clampedDy);
          nextH = Math.round(primaryOrigin.h - clampedDy);
        }

        const nextBox: ElementBoxOverride = {
          ...primaryOrigin,
          x: nextX,
          y: nextY,
          w: Math.min(1920, nextW),
          h: Math.min(1080, nextH),
        };

        const hasCustomEl = cur.customCanvasElements?.some(
          (el) => el.id === session.primarySlotId
        );
        if (hasCustomEl && cur.customCanvasElements) {
          upd(
            {
              elementLayouts: {
                ...(cur.elementLayouts || {}),
                [session.primarySlotId]: nextBox,
              },
              customCanvasElements: cur.customCanvasElements.map((el) =>
                el.id === session.primarySlotId
                  ? {
                      ...el,
                      x: Number(((nextBox.x / 1920) * 100).toFixed(2)),
                      y: Number(((nextBox.y / 1080) * 100).toFixed(2)),
                      w: Number(((nextBox.w / 1920) * 100).toFixed(2)),
                      h: Number(((nextBox.h / 1080) * 100).toFixed(2)),
                    }
                  : el
              ),
            },
            true
          );
        } else {
          upd(
            {
              elementLayouts: {
                ...(cur.elementLayouts || {}),
                [session.primarySlotId]: nextBox,
              },
            },
            true
          );
        }
      }
    };

    const onUp = () => {
      if (moved) {
        lastDraggedAtRef.current = Date.now();
      }
      setActiveGuides([]);
      setActiveDistanceGuides([]);
      setCompDrag(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [compDrag]);

  // Marquee drag selection effect on slide canvas background
  useEffect(() => {
    if (!canEditComponents) return;

    const onPointerMove = (e: PointerEvent) => {
      const start = marqueeStartRef.current;
      if (!start) return;
      const canvas = canvasBoxRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const curCanvasX = Math.max(0, Math.min(1920, ((e.clientX - rect.left) / rect.width) * 1920));
      const curCanvasY = Math.max(0, Math.min(1080, ((e.clientY - rect.top) / rect.height) * 1080));

      const dx = Math.abs(e.clientX - start.clientX);
      const dy = Math.abs(e.clientY - start.clientY);
      if (dx < 6 && dy < 6 && !marqueeBox) return;

      const boxX = Math.min(start.canvasX, curCanvasX);
      const boxY = Math.min(start.canvasY, curCanvasY);
      const boxW = Math.max(4, Math.abs(curCanvasX - start.canvasX));
      const boxH = Math.max(4, Math.abs(curCanvasY - start.canvasY));
      setMarqueeBox({ x: boxX, y: boxY, w: boxW, h: boxH });

      // Determine all selectable elements intersecting marquee
      const slotElements = canvas.querySelectorAll<HTMLElement>('[data-slot-id]');
      const intersectingIds: string[] = [];

      slotElements.forEach((el) => {
        const slotId = el.getAttribute('data-slot-id');
        if (!slotId || slotId.includes('-overlay')) return;
        const elRect = el.getBoundingClientRect();
        const elX = ((elRect.left - rect.left) / rect.width) * 1920;
        const elY = ((elRect.top - rect.top) / rect.height) * 1080;
        const elW = (elRect.width / rect.width) * 1920;
        const elH = (elRect.height / rect.height) * 1080;

        const intersects =
          boxX <= elX + elW &&
          boxX + boxW >= elX &&
          boxY <= elY + elH &&
          boxY + boxH >= elY;

        if (intersects) {
          intersectingIds.push(slotId);
        }
      });

      if (start.ctrl) {
        setSelectedIds((prev) => Array.from(new Set([...prev, ...intersectingIds])));
      } else {
        setSelectedIds(intersectingIds);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const start = marqueeStartRef.current;
      if (start) {
        const dx = Math.abs(e.clientX - start.clientX);
        const dy = Math.abs(e.clientY - start.clientY);
        if (dx < 5 && dy < 5 && !start.ctrl) {
          setSelectedIds([]);
        }
      }
      marqueeStartRef.current = null;
      setMarqueeBox(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [canEditComponents, marqueeBox]);

  const updateBlock = (blockId: string, patch: Partial<SlideTextBlock>) => {
    if (!onUpdateSlide) return;
    onUpdateSlide({
      bodyBlocks: slide.bodyBlocks.map((b) =>
        b.id === blockId ? { ...b, ...patch } : b
      ),
    });
  };

  const neutralAccent = hideWaveBackground ? '#334155' : palette.accent;
  const neutralDark = hideWaveBackground ? '#0F172A' : palette.darkInk;
  const neutralBorder = hideWaveBackground ? '#CBD5E1' : palette.borderAccent;
  const hiddenSet = new Set(slide.hiddenElementIds || []);
  const movedOverlays: React.ReactNode[] = [];

  const updateSlotLayout = (slotId: string, patch: Partial<ElementBoxOverride>) => {
    const upd = latestUpdateRef.current;
    const cur = latestSlideRef.current;
    if (!upd) return;
    const prev = cur.elementLayouts?.[slotId];
    const measured = prev ? null : measureSlotBox(slotId);
    const nextLayouts = {
      ...(cur.elementLayouts || {}),
      [slotId]: {
        x: prev?.x ?? measured?.x ?? 120,
        y: prev?.y ?? measured?.y ?? 160,
        w: prev?.w ?? measured?.w ?? 640,
        h: prev?.h ?? measured?.h ?? 180,
        ...prev,
        ...patch,
      },
    };
    upd({ elementLayouts: nextLayouts });
  };

  // Multi-selection bounding box and alignment helpers
  const getSlotBox = (slotId: string): ElementBoxOverride | null => {
    const existing = slide.elementLayouts?.[slotId];
    if (existing) return existing;
    return measureSlotBox(slotId);
  };

  const groupBBox = useMemo(() => {
    if (selectedIds.length <= 1) return null;
    const boxes = selectedIds
      .map((id) => getSlotBox(id))
      .filter((b): b is ElementBoxOverride => Boolean(b));
    if (boxes.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    boxes.forEach((b) => {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    });
    return {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
    };
  }, [selectedIds, slide.elementLayouts]);

  const alignSelectedLeft = () => {
    if (selectedIds.length < 2 || !onUpdateSlide) return;
    const items = selectedIds
      .map((id) => ({ id, box: getSlotBox(id) }))
      .filter((i): i is { id: string; box: ElementBoxOverride } => Boolean(i.box));
    if (items.length < 2) return;
    const minX = Math.min(...items.map((i) => i.box.x));
    const nextLayouts = { ...(slide.elementLayouts || {}) };
    items.forEach((item) => {
      nextLayouts[item.id] = { ...item.box, x: minX };
    });
    onUpdateSlide({ elementLayouts: nextLayouts });
  };

  const alignSelectedCenter = () => {
    if (selectedIds.length < 2 || !onUpdateSlide) return;
    const items = selectedIds
      .map((id) => ({ id, box: getSlotBox(id) }))
      .filter((i): i is { id: string; box: ElementBoxOverride } => Boolean(i.box));
    if (items.length < 2) return;
    const avgCenter = Math.round(
      items.reduce((sum, i) => sum + i.box.x + i.box.w / 2, 0) / items.length
    );
    const nextLayouts = { ...(slide.elementLayouts || {}) };
    items.forEach((item) => {
      nextLayouts[item.id] = { ...item.box, x: Math.round(avgCenter - item.box.w / 2) };
    });
    onUpdateSlide({ elementLayouts: nextLayouts });
  };

  const alignSelectedTop = () => {
    if (selectedIds.length < 2 || !onUpdateSlide) return;
    const items = selectedIds
      .map((id) => ({ id, box: getSlotBox(id) }))
      .filter((i): i is { id: string; box: ElementBoxOverride } => Boolean(i.box));
    if (items.length < 2) return;
    const minY = Math.min(...items.map((i) => i.box.y));
    const nextLayouts = { ...(slide.elementLayouts || {}) };
    items.forEach((item) => {
      nextLayouts[item.id] = { ...item.box, y: minY };
    });
    onUpdateSlide({ elementLayouts: nextLayouts });
  };

  const distributeSelectedHorizontally = () => {
    if (selectedIds.length < 3 || !onUpdateSlide) return;
    const items = selectedIds
      .map((id) => ({ id, box: getSlotBox(id) }))
      .filter((i): i is { id: string; box: ElementBoxOverride } => Boolean(i.box));
    if (items.length < 3) return;
    items.sort((a, b) => a.box.x - b.box.x);
    const first = items[0];
    const last = items[items.length - 1];
    const totalSpan = last.box.x + last.box.w - first.box.x;
    const totalItemsW = items.reduce((sum, i) => sum + i.box.w, 0);
    const gap = Math.max(12, Math.round((totalSpan - totalItemsW) / (items.length - 1)));
    const nextLayouts = { ...(slide.elementLayouts || {}) };
    let curX = first.box.x;
    items.forEach((item) => {
      nextLayouts[item.id] = { ...item.box, x: curX };
      curX += item.box.w + gap;
    });
    onUpdateSlide({ elementLayouts: nextLayouts });
  };

  interface PlaceSlotOptions {
    className?: string;
    showBoxToggle?: boolean;
    showLayerToggle?: boolean;
    isBoxed?: boolean;
    isBottomLayer?: boolean;
    stretchHeight?: boolean;
    preserveGridCell?: boolean;
    onToggleBoxed?: () => void;
    onToggleLayer?: () => void;
    onDelete?: () => void;
    extraActions?: React.ReactNode;
  }

  const placeSlot = (
    slotId: string,
    content: React.ReactNode,
    opts: PlaceSlotOptions = {}
  ): React.ReactNode => {
    if (hiddenSet.has(slotId)) {
      return opts.preserveGridCell ? (
        <div key={slotId} className="min-h-0 pointer-events-none" />
      ) : null;
    }

    const override = slide.elementLayouts?.[slotId];
    const isBottom =
      opts.isBottomLayer !== undefined
        ? opts.isBottomLayer
        : override?.layer === 'bottom';
    const isBoxed =
      opts.isBoxed !== undefined ? opts.isBoxed : Boolean(override?.boxed);
    const isSlotSelected = canEditComponents && selectedIds.includes(slotId);

    const wrapped = (
      <InteractiveSlot
        key={slotId}
        id={slotId}
        override={override}
        editable={canEditComponents}
        isSelected={isSlotSelected}
        showSingleToolbar={selectedIds.length <= 1}
        isBoxed={isBoxed}
        isBottomLayer={isBottom}
        showBoxToggle={opts.showBoxToggle}
        showLayerToggle={opts.showLayerToggle}
        stretchHeight={opts.stretchHeight}
        className={opts.className}
        onSelect={(isCtrl) => handleSelectSlot(slotId, isCtrl)}
        onStartDrag={(e, slotEl, mode, minDelta) =>
          handleStartSlotDrag(slotId, e, slotEl, mode, minDelta, {
            layer: isBottom ? 'bottom' : 'top',
            boxed: isBoxed,
          })
        }
        onToggleBoxed={
          opts.onToggleBoxed ||
          (() => updateSlotLayout(slotId, { boxed: !isBoxed }))
        }
        onToggleLayer={
          opts.onToggleLayer ||
          (() => updateSlotLayout(slotId, { layer: isBottom ? 'top' : 'bottom' }))
        }
        onDelete={opts.onDelete || (() => deleteSlot(slotId))}
        extraActions={opts.extraActions}
      >
        {content}
      </InteractiveSlot>
    );

    if (override) {
      movedOverlays.push(wrapped);
      return opts.preserveGridCell ? (
        <div key={`${slotId}-spacer`} className="min-h-0 pointer-events-none" />
      ) : null;
    }

    return wrapped;
  };

  const renderBulletOrProse = (
    text: string,
    textColor: string,
    fontSizeClass = 'text-[31px]',
    onDark = false,
    onCommit?: (next: string) => void
  ) => {
    // 1. Misconception vs Rule callout
    if (/WRONG[:\s]/i.test(text) && /CORRECT[:\s]/i.test(text)) {
      const parts = text.split(/(?=CORRECT[:\s])/i);
      const wrongPart = parts[0]?.replace(/^•\s*/, '').trim() || '';
      const correctPart = parts[1]?.replace(/^•\s*/, '').trim() || '';
      return (
        <div className="grid grid-cols-2 gap-4 my-2">
          <div className="p-4.5 rounded-2xl bg-rose-50/95 border-2 border-rose-300 text-rose-950 space-y-2 shadow-xs">
            <div className="text-[17px] font-black uppercase tracking-wider text-rose-700 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
              Misconception / Non-Example
            </div>
            <p className="text-[26px] leading-snug font-bold font-mono whitespace-pre-line">
              <InlineEditableText
                value={wrongPart}
                editable={editable && !isThumbnail && Boolean(onCommit)}
                multiline
                className="text-[26px] leading-snug font-bold font-mono block w-full text-rose-950"
                onCommit={(next) => onCommit?.(`${next}\n${correctPart}`)}
              />
            </p>
          </div>
          <div className="p-4.5 rounded-2xl bg-emerald-50/95 border-2 border-emerald-300 text-emerald-950 space-y-2 shadow-xs">
            <div className="text-[17px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              Correct Method / Rule
            </div>
            <p className="text-[26px] leading-snug font-bold font-mono whitespace-pre-line">
              <InlineEditableText
                value={correctPart}
                editable={editable && !isThumbnail && Boolean(onCommit)}
                multiline
                className="text-[26px] leading-snug font-bold font-mono block w-full text-emerald-950"
                onCommit={(next) => onCommit?.(`${wrongPart}\n${next}`)}
              />
            </p>
          </div>
        </div>
      );
    }

    const lines = text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);

    const hasBullets =
      lines.length > 1 || lines[0]?.startsWith('•') || lines[0]?.startsWith('-');

    if (hasBullets) {
      return (
        <div className="space-y-3">
          <ul className="space-y-3">
            {lines.map((line, i) => {
              const clean = line.replace(/^[•\-*]\s*/, '');
              return (
                <li key={i} className="flex items-start gap-3.5">
                  <span
                    className="w-3 h-3 rounded-full mt-[15px] shrink-0"
                    style={{
                      backgroundColor: onDark ? '#FFFFFF' : neutralAccent,
                      opacity: onDark ? 0.92 : 0.85,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <InlineEditableText
                      value={clean}
                      editable={editable && !isThumbnail && Boolean(onCommit)}
                      multiline={false}
                      className={`${fontSizeClass} leading-[1.4] font-medium block w-full`}
                      style={{ color: textColor }}
                      onCommit={(next) => {
                        if (!onCommit) return;
                        const updated = [...lines];
                        if (!next.trim()) {
                          updated.splice(i, 1);
                        } else {
                          updated[i] = `• ${next.trim()}`;
                        }
                        onCommit(updated.join('\n'));
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {editable && onCommit && !isThumbnail && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const updated = [
                  ...lines.map((l) => (l.startsWith('•') ? l : `• ${l}`)),
                  '• New point',
                ];
                onCommit(updated.join('\n'));
              }}
              className="opacity-0 group-hover/slot:opacity-60 hover:!opacity-100 text-[18px] font-bold text-sky-600 dark:text-sky-300 flex items-center gap-1.5 transition py-1 px-2.5 rounded-xl hover:bg-sky-500/10 cursor-pointer"
            >
              <span>+ Add bullet point</span>
            </button>
          )}
        </div>
      );
    }

    // Prose / single paragraph
    return (
      <div className="min-w-0 flex-1">
        <InlineEditableText
          value={text}
          editable={editable && !isThumbnail && Boolean(onCommit)}
          multiline
          className={`${fontSizeClass} leading-[1.42] font-medium block w-full`}
          style={{ color: textColor }}
          onCommit={(next) => onCommit?.(next)}
        />
      </div>
    );
  };

  const renderMediaFrame = (
    media?: SlideMediaItem,
    sizeClass = 'w-full h-full',
    requiredSlotLabel?: string,
    slotOnDark = bottomOnDark,
    slotId = 'slot-media',
    wrapInSlot = true
  ) => {
    const canPick = Boolean(editable && onOpenMediaPicker && !isThumbnail);

    // In Step 1 Preset Picker (wireframe view), explicitly highlight where intended images live
    if (hideWaveBackground) {
      if (!media && !requiredSlotLabel) return null;
      return (
        <div
          className={`${sizeClass} rounded-3xl border-4 border-dashed border-sky-400 bg-sky-50/75 text-sky-900 flex flex-col items-center justify-center p-8 text-center shadow-inner`}
        >
          <div className="w-20 h-20 rounded-3xl bg-sky-100 border-2 border-sky-300 text-sky-700 flex items-center justify-center mb-4">
            <ImagePlus size={44} />
          </div>
          <p className="text-[28px] font-extrabold uppercase tracking-wider text-sky-900 leading-tight">
            {requiredSlotLabel || 'Intended Image Area'}
          </p>
          <p className="mt-2 text-[22px] font-semibold text-sky-700">
            Visual / Diagram Slot
          </p>
        </div>
      );
    }

    if (hiddenSet.has(slotId)) return null;
    if (effectiveSideConfig) return null;

    let inner: React.ReactNode = null;
    if (!media || media.placement === 'fill-bottom-layer') {
      if (!requiredSlotLabel) return null;

      inner = (
        <button
          type="button"
          disabled={!canPick}
          onMouseEnter={() => {
            if (canPick) onHoverImageTarget?.(slotId);
          }}
          onMouseLeave={() => {
            if (canPick) onHoverImageTarget?.(null);
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (canPick) onOpenMediaPicker?.(slotId);
          }}
          className={`relative group ${sizeClass} rounded-3xl border-4 border-dashed flex flex-col items-center justify-center p-10 text-center transition ${
            slotOnDark
              ? canPick
                ? 'cursor-pointer border-white/70 bg-white/18 hover:bg-white/28 text-white shadow-2xl backdrop-blur-xs'
                : 'cursor-default border-white/35 bg-white/10 text-white/80'
              : canPick
              ? 'cursor-pointer border-zinc-400/70 bg-white/80 hover:bg-white text-zinc-700 shadow-lg'
              : 'cursor-default border-zinc-300 bg-white/60 text-zinc-600'
          }`}
        >
          {canPick && (
            <div className="absolute top-4 right-4 bg-zinc-900/90 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg border border-white/20 opacity-0 group-hover:opacity-100 transition animate-fade-in pointer-events-none z-10">
              <ClipboardPaste size={14} className="text-emerald-400" />
              <span>Press Ctrl+V to paste image</span>
            </div>
          )}
          <div
            className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-5 shadow-md ${
              slotOnDark ? 'bg-white/20' : 'bg-slate-200/80 text-slate-700'
            }`}
          >
            <ImagePlus size={48} />
          </div>
          <p className="text-[34px] font-extrabold leading-tight">
            {requiredSlotLabel}
          </p>
          {canPick && (
            <p className="mt-3 text-[24px] font-medium opacity-90 max-w-md">
              Click to choose • Press Ctrl+V to paste
            </p>
          )}
        </button>
      );
    } else {
      inner = (
        <div
          onMouseEnter={() => {
            if (canPick) onHoverImageTarget?.(slotId);
          }}
          onMouseLeave={() => {
            if (canPick) onHoverImageTarget?.(null);
          }}
          onClick={(e) => {
            if (canPick) {
              e.stopPropagation();
              onOpenMediaPicker?.(slotId);
            }
          }}
          title={canPick ? 'Click to change visual or press Ctrl+V to paste new image' : undefined}
          className={`relative group rounded-3xl overflow-hidden shadow-2xl bg-white border-4 border-white/90 flex flex-col w-full h-full flex-1 ${
            canPick ? 'cursor-pointer transition' : ''
          }`}
        >
          {canPick && (
            <div className="absolute top-3 right-3 bg-zinc-900/85 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
              <ClipboardPaste size={13} className="text-emerald-400" />
              <span>Ctrl+V to replace</span>
            </div>
          )}
          {media.type === 'svg-diagram' && media.svgCode ? (
            <div
              className="flex-1 w-full h-full flex items-center justify-center p-5 bg-white overflow-hidden"
              dangerouslySetInnerHTML={{ __html: media.svgCode }}
            />
          ) : (
            <img
              src={media.url || ''}
              alt={media.title}
              className={`w-full h-full ${
                media.cropFit === 'contain' ? 'object-contain bg-white' : 'object-cover'
              }`}
            />
          )}
        </div>
      );
    }

    if (!wrapInSlot) return inner;
    const isMoved = Boolean(slide.elementLayouts?.[slotId]);
    return placeSlot(slotId, inner, {
      stretchHeight: true,
      className: isMoved ? '' : sizeClass,
      extraActions: canPick ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMediaPicker?.();
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[17px] font-bold"
        >
          <ImagePlus size={16} />
          <span>Change Visual</span>
        </button>
      ) : undefined,
    });
  };

  const renderCard = (b: SlideTextBlock, index: number, isTimeline = false) => {
    const override = slide.elementLayouts?.[b.id];
    const effectiveLayer = override?.layer ?? b.layer ?? 'top';
    const onDark = effectiveLayer === 'bottom' ? bottomOnDark : topOnDark;
    const isCode = b.style === 'code';
    const isBoxed =
      override?.boxed !== undefined ? override.boxed : b.style === 'boxed';
    const isHighlight = !isBoxed && (b.style === 'highlight' || b.style === 'challenge');
    const showStepBadge = isTimeline || b.style === 'step';

    const textColor = isCode ? '#A7F3D0' : onDark ? '#FFFFFF' : neutralDark;
    const headingColor = isCode ? '#34D399' : onDark ? '#FFFFFF' : neutralAccent;
    const cleanHeading =
      b.heading && !isGenericMetaHeading(b.heading) ? b.heading : '';

    const containerClasses = isBoxed
      ? `rounded-3xl p-7 transition-all border-2 shadow-lg ${
          onDark
            ? 'bg-white/14 backdrop-blur-md border-white/30'
            : 'bg-white/95 backdrop-blur-xs'
        }`
      : isCode
      ? 'rounded-2xl p-6 bg-zinc-950 text-emerald-300 font-mono border border-zinc-800 shadow-lg'
      : hideWaveBackground
      ? 'rounded-2xl p-5 border-2 border-dashed border-slate-300 bg-white/65'
      : isHighlight
      ? 'border-l-[8px] pl-6 py-1.5 transition-all'
      : 'px-2 py-1.5 transition-all';

    const cardContent = (
      <div
        className={`${containerClasses} space-y-2.5`}
        style={{
          borderColor: isBoxed
            ? onDark
              ? 'rgba(255,255,255,0.28)'
              : neutralBorder
            : undefined,
          borderTopColor: isBoxed
            ? onDark
              ? 'rgba(255,255,255,0.28)'
              : neutralBorder
            : undefined,
          borderRightColor: isBoxed
            ? onDark
              ? 'rgba(255,255,255,0.28)'
              : neutralBorder
            : undefined,
          borderBottomColor: isBoxed
            ? onDark
              ? 'rgba(255,255,255,0.28)'
              : neutralBorder
            : undefined,
          borderLeftColor: isHighlight
            ? onDark
              ? '#FFFFFF'
              : neutralAccent
            : isBoxed
            ? onDark
              ? 'rgba(255,255,255,0.28)'
              : neutralBorder
            : undefined,
        }}
      >
        {(showStepBadge ||
          cleanHeading ||
          b.dualCodeIcon ||
          (canEditComponents && activeSelectedId === b.id)) && (
          <div className="flex items-center gap-4 min-w-0">
            {showStepBadge && (
              <span
                className="w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-[26px] shrink-0"
                style={{
                  backgroundColor: onDark ? '#FFFFFF' : neutralAccent,
                  color: onDark ? palette.layers[3] : '#FFFFFF',
                }}
              >
                {index + 1}
              </span>
            )}
            {(b.dualCodeIcon || (canEditComponents && activeSelectedId === b.id)) && (
              <DualCodeBadgeControl
                iconId={b.dualCodeIcon}
                accentColor={neutralAccent}
                onDarkSurface={onDark}
                editable={editable && !isThumbnail}
                onChangeIcon={(nextIcon) =>
                  updateBlock(b.id, { dualCodeIcon: nextIcon })
                }
              />
            )}
            {cleanHeading ? (
              <h3
                className="text-[36px] font-extrabold leading-tight flex-1"
                style={{ color: headingColor }}
              >
                <InlineEditableText
                  value={cleanHeading}
                  editable={editable && !isThumbnail}
                  onCommit={(next) => updateBlock(b.id, { heading: next })}
                />
              </h3>
            ) : canEditComponents ? (
              <h3
                className={`text-[28px] font-bold leading-tight transition-opacity ${
                  activeSelectedId === b.id
                    ? 'opacity-65'
                    : 'opacity-0 group-hover/slot:opacity-55'
                }`}
                style={{ color: headingColor }}
              >
                <InlineEditableText
                  value=""
                  placeholder="+ Add heading"
                  editable={editable}
                  onCommit={(next) => updateBlock(b.id, { heading: next })}
                />
              </h3>
            ) : null}
          </div>
        )}

        {renderBulletOrProse(
          b.content,
          textColor,
          isTimeline ? 'text-[29px]' : 'text-[32px]',
          onDark,
          (next) => updateBlock(b.id, { content: next })
        )}
      </div>
    );

    return placeSlot(b.id, cardContent, {
      showBoxToggle: true,
      showLayerToggle: true,
      isBoxed,
      isBottomLayer: effectiveLayer === 'bottom',
      onToggleBoxed: () => {
        const nextBoxed = !isBoxed;
        updateBlock(b.id, { style: nextBoxed ? 'boxed' : 'plain' });
        if (override) updateSlotLayout(b.id, { boxed: nextBoxed });
      },
      onToggleLayer: () => {
        const nextLayer = effectiveLayer === 'bottom' ? 'top' : 'bottom';
        updateBlock(b.id, { layer: nextLayer });
        if (override) updateSlotLayout(b.id, { layer: nextLayer });
      },
    });
  };

  const renderHeader = () => {
    const headerPad =
      slide.waveVariant === 'dark-halo-spotlight'
        ? 'px-[220px] pt-12'
        : isHaloVariant
        ? 'px-[210px] pt-[74px]'
        : isLeftSpine
        ? 'pl-[470px] pr-20 pt-9'
        : 'px-20 pt-9';

    const titleOverride = slide.elementLayouts?.['slot-title'];
    const titleOnDark = titleOverride?.layer
      ? titleOverride.layer === 'bottom'
      : headerOnDark;
    const titleBoxed = Boolean(titleOverride?.boxed);

    const hasControls =
      (!isTitlePage && Boolean(slide.routineIcons && slide.routineIcons.length > 0)) ||
      Boolean(slide.timerSeconds && slide.timerSeconds > 0);
    const controlsOverride = slide.elementLayouts?.['slot-controls'];
    const controlsOnDark = controlsOverride?.layer
      ? controlsOverride.layer === 'bottom'
      : headerOnDark;

    const titleRichLine = slide.richLines?.find(
      (l, idx) =>
        l.style === 'title' ||
        (idx === 0 && !slide.richLines?.some((x) => x.style === 'title'))
    );

    return (
      <div className={`relative z-20 flex items-start justify-between ${headerPad}`}>
        {placeSlot(
          'slot-title',
          <div
            className={
              titleBoxed
                ? `rounded-3xl px-7 py-3.5 border-2 shadow-lg ${
                    titleOnDark
                      ? 'bg-white/14 backdrop-blur-md border-white/30'
                      : 'bg-white/95'
                  }`
                : hideWaveBackground
                ? 'rounded-2xl px-4 py-1.5 border-2 border-dashed border-slate-300 bg-white/55'
                : ''
            }
            style={
              titleBoxed && !titleOnDark
                ? {
                    borderColor: neutralBorder,
                    borderTopColor: neutralBorder,
                    borderRightColor: neutralBorder,
                    borderBottomColor: neutralBorder,
                    borderLeftColor: neutralBorder,
                  }
                : undefined
            }
          >
            <h1
              className={`font-extrabold tracking-tight leading-[1.08] ${
                isStarter ? 'text-[52px]' : 'text-[60px]'
              }`}
              style={{
                color: titleRichLine?.color || (titleOnDark ? '#FFFFFF' : neutralDark),
                fontSize: titleRichLine?.fontSize ? `${titleRichLine.fontSize}px` : undefined,
                fontWeight: titleRichLine?.isBold !== undefined ? (titleRichLine.isBold ? 900 : 500) : undefined,
                fontStyle: titleRichLine?.isItalic ? 'italic' : undefined,
                textDecoration: titleRichLine?.isUnderline ? 'underline' : undefined,
              }}
            >
              <InlineEditableText
                value={slide.title}
                editable={editable && !isThumbnail}
                onCommit={(next) => {
                  const currentLines = getSlideRichLines(slide);
                  const titleIdx = currentLines.findIndex(
                    (l, idx) => l.style === 'title' || idx === 0
                  );
                  const updatedLines = [...currentLines];
                  if (titleIdx >= 0) {
                    updatedLines[titleIdx] = { ...updatedLines[titleIdx], text: next };
                  } else {
                    updatedLines.unshift({ text: next, style: 'title' });
                  }
                  onUpdateSlide?.({
                    title: next,
                    richLines: updatedLines,
                    unifiedText: richLinesToUnifiedText(updatedLines),
                  });
                }}
              />
            </h1>
          </div>,
          {
            className: titleOverride ? '' : 'max-w-[1100px] min-w-0',
            showBoxToggle: true,
            showLayerToggle: true,
            isBoxed: titleBoxed,
            isBottomLayer: titleOnDark,
          }
        )}

        {hasControls &&
          placeSlot(
            'slot-controls',
            <div className="flex items-center gap-4">
              {!isTitlePage && slide.routineIcons && slide.routineIcons.length > 0 && (
                <div className="flex items-center gap-2.5">
                  {slide.routineIcons.slice(0, 3).map((ri) => (
                    <RoutineBadgeIcon
                      key={ri}
                      type={ri}
                      monochromeCorner
                      onDark={controlsOnDark}
                    />
                  ))}
                </div>
              )}

              {slide.timerSeconds && slide.timerSeconds > 0 && (
                <SlideTimerWidget
                  initialSeconds={slide.timerSeconds}
                  accentColor={neutralAccent}
                  interactive={interactiveTimer && !isThumbnail}
                />
              )}
            </div>,
            {
              className: controlsOverride ? '' : 'shrink-0 ml-auto pl-6',
              showBoxToggle: false,
              showLayerToggle: true,
              isBottomLayer: controlsOnDark,
            }
          )}
      </div>
    );
  };

  const renderLessonTitlePage = (p: PhasePalette) => {
    const todayFallback = new Date().toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const dateValue = slide.lessonDate || todayFallback;
    const isCoverFilledInWave =
      !hideWaveBackground &&
      Boolean(effectiveMedia) &&
      effectiveMedia?.placement === 'fill-bottom-layer';

    const dateOverride = slide.elementLayouts?.['slot-date'];
    const dateOnDark = dateOverride?.layer ? dateOverride.layer === 'bottom' : topOnDark;
    const dateBoxed = Boolean(dateOverride?.boxed);

    const titleOverride = slide.elementLayouts?.['slot-title'];
    const titleOnDark = titleOverride?.layer
      ? titleOverride.layer === 'bottom'
      : topOnDark;
    const titleBoxed = Boolean(titleOverride?.boxed);

    const bigQOverride = slide.elementLayouts?.['slot-big-question'];
    const bigQOnDark = bigQOverride?.layer ? bigQOverride.layer === 'bottom' : topOnDark;
    const bigQBoxed = Boolean(bigQOverride?.boxed);

    const termsOverride = slide.elementLayouts?.['slot-terms-inline'];
    const termsOnDark = termsOverride?.layer
      ? termsOverride.layer === 'bottom'
      : topOnDark;
    const termsBoxed = Boolean(termsOverride?.boxed);

    return (
      <div className="relative z-20 h-full flex flex-row items-stretch px-20 py-14 gap-12">
        {/* Left Top Sheet: Clean Date & Huge Topic Title (and optional hook if explicitly set) */}
        <div
          className={`flex-1 flex flex-col justify-center gap-9 py-2 ${
            isLeftSpine ? 'pl-[380px]' : ''
          }`}
        >
          <div className="space-y-7 max-w-[840px]">
            {slide.lessonDate ? (
              placeSlot(
                'slot-date',
                <div
                  className={
                    dateBoxed
                      ? `inline-flex items-center gap-3 px-6 py-2.5 rounded-full text-[27px] font-bold border-2 shadow-sm ${
                          dateOnDark ? 'bg-white/15 text-white border-white/30' : 'bg-white'
                        }`
                      : hideWaveBackground
                      ? 'inline-flex items-center gap-3 px-5 py-2 rounded-full text-[27px] font-bold border-2 border-dashed border-slate-300 bg-white/60'
                      : 'inline-flex items-center gap-3 text-[28px] font-extrabold'
                  }
                  style={
                    dateOnDark
                      ? { color: '#FFFFFF' }
                      : dateBoxed
                      ? {
                          borderColor: neutralBorder,
                          borderTopColor: neutralBorder,
                          borderRightColor: neutralBorder,
                          borderBottomColor: neutralBorder,
                          borderLeftColor: neutralBorder,
                          color: neutralAccent,
                        }
                      : { color: neutralAccent }
                  }
                >
                  <Clock size={26} />
                  <InlineEditableText
                    value={dateValue}
                    editable={editable && !isThumbnail}
                    onCommit={(next) => onUpdateSlide?.({ lessonDate: next })}
                  />
                </div>,
                {
                  className: 'self-start',
                  showBoxToggle: true,
                  showLayerToggle: true,
                  isBoxed: dateBoxed,
                  isBottomLayer: dateOnDark,
                }
              )
            ) : editable && !isThumbnail ? (
              <button
                type="button"
                onClick={() => onUpdateSlide?.({ lessonDate: todayFallback })}
                className="self-start inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full text-[24px] font-bold border-2 border-dashed border-zinc-400 bg-white/80 hover:bg-white text-zinc-700 hover:text-emerald-700 hover:border-emerald-500 shadow-sm transition"
                title="Add current date to title page"
              >
                <Plus size={22} />
                <span>+ Add Date</span>
              </button>
            ) : null}

            {placeSlot(
              'slot-title',
              <div
                className={
                  titleBoxed
                    ? `rounded-3xl p-6 border-2 shadow-lg ${
                        titleOnDark
                          ? 'bg-white/14 backdrop-blur-md border-white/30'
                          : 'bg-white/95'
                      }`
                    : hideWaveBackground
                    ? 'rounded-2xl p-4 border-2 border-dashed border-slate-300 bg-white/55'
                    : ''
                }
                style={
                  titleBoxed && !titleOnDark
                    ? {
                        borderColor: neutralBorder,
                        borderTopColor: neutralBorder,
                        borderRightColor: neutralBorder,
                        borderBottomColor: neutralBorder,
                        borderLeftColor: neutralBorder,
                      }
                    : undefined
                }
              >
                <h1
                  className="text-[74px] font-extrabold leading-[1.05] tracking-tight"
                  style={{ color: titleOnDark ? '#FFFFFF' : neutralDark }}
                >
                  <InlineEditableText
                    value={slide.title}
                    editable={editable && !isThumbnail}
                    onCommit={(next) => onUpdateSlide?.({ title: next })}
                  />
                </h1>
              </div>,
              {
                showBoxToggle: true,
                showLayerToggle: true,
                isBoxed: titleBoxed,
                isBottomLayer: titleOnDark,
              }
            )}

            {Boolean(slide.bigQuestion) &&
              placeSlot(
                'slot-big-question',
                <div
                  className={
                    bigQBoxed
                      ? `p-8 rounded-3xl border-2 shadow-lg ${
                          bigQOnDark
                            ? 'bg-white/14 backdrop-blur-md border-white/30'
                            : 'bg-white/95'
                        }`
                      : hideWaveBackground
                      ? 'p-6 rounded-2xl border-2 border-dashed border-slate-300 border-l-[10px] bg-white/65'
                      : 'border-l-[9px] pl-6 py-1'
                  }
                  style={
                    bigQBoxed
                      ? {
                          borderColor: bigQOnDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                          borderTopColor: bigQOnDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                          borderRightColor: bigQOnDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                          borderBottomColor: bigQOnDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                          borderLeftColor: bigQOnDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                        }
                      : { borderLeftColor: bigQOnDark ? '#FFFFFF' : neutralAccent }
                  }
                >
                  <div
                    className="text-[22px] font-extrabold uppercase tracking-wider mb-2"
                    style={{ color: bigQOnDark ? '#FFFFFF' : neutralAccent }}
                  >
                    Today&apos;s Enquiry
                  </div>
                  <p
                    className="text-[36px] font-bold leading-snug"
                    style={{ color: bigQOnDark ? '#FFFFFF' : neutralDark }}
                  >
                    <InlineEditableText
                      value={slide.bigQuestion || ''}
                      placeholder="Add lesson hook / enquiry question..."
                      editable={editable && !isThumbnail}
                      multiline
                      onCommit={(next) => onUpdateSlide?.({ bigQuestion: next })}
                    />
                  </p>
                </div>,
                {
                  showBoxToggle: true,
                  showLayerToggle: true,
                  isBoxed: bigQBoxed,
                  isBottomLayer: bigQOnDark,
                }
              )}
          </div>
        </div>

        {/* Right Cover Area: Cropped inside bottom coloured wave by default; wireframe image zone shown in Step 1 picker */}
        <div className="w-[770px] shrink-0 flex items-center justify-center py-4">
          {hideWaveBackground ? (
            renderMediaFrame(
              effectiveMedia,
              'w-full h-[820px]',
              'Intended Cover Image Area',
              false,
              'slot-media',
              false
            )
          ) : isCoverFilledInWave ? (
            editable && !isThumbnail ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenMediaPicker?.();
                }}
                title="Cover image is cropped into the bottom coloured wave — click to change"
                className="w-full h-[840px] rounded-3xl flex items-end justify-end p-6 group cursor-pointer hover:bg-black/15 transition border-2 border-transparent hover:border-white/50"
              >
                <span className="opacity-0 group-hover:opacity-100 transition inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-zinc-950/80 text-white text-[22px] font-bold shadow-xl backdrop-blur-md">
                  <ImagePlus size={24} />
                  <span>Change Cover Image</span>
                </span>
              </button>
            ) : null
          ) : effectiveMedia && effectiveMedia.placement === 'boxed-card' ? (
            renderMediaFrame(
              effectiveMedia,
              'w-full h-[820px]',
              'Lesson Cover Visual',
              bottomOnDark,
              'slot-media',
              true
            )
          ) : (
            renderMediaFrame(
              undefined,
              'w-full h-[820px]',
              'Lesson Cover Visual',
              bottomOnDark,
              'slot-media',
              true
            )
          )}
        </div>
      </div>
    );
  };

  const renderPresetContent = (p: PhasePalette) => {
    const contentPad =
      slide.waveVariant === 'dark-halo-spotlight'
        ? 'px-[220px] py-8'
        : isHaloVariant
        ? 'px-[210px] pt-6 pb-[86px]'
        : isLeftSpine
        ? 'pl-[470px] pr-20 py-8'
        : 'px-20 py-8';

    if (isTitlePage) {
      return renderLessonTitlePage(p);
    }

    if (slide.presetId === 'custom') {
      return <div className="relative z-20 flex-1 pointer-events-none" />;
    }

    if (slide.tableData) {
      return (
        <div className={`relative z-20 flex-1 flex flex-col justify-center min-h-0 ${contentPad}`}>
          <div className="w-full max-w-[1560px] mx-auto h-[600px] flex items-center justify-center">
            <SlideTable
              tableData={slide.tableData}
              onDark={topOnDark}
              neutralBorder={neutralBorder}
              neutralAccent={neutralAccent}
              neutralDark={neutralDark}
              palette={p}
              editable={editable && !isThumbnail}
              isThumbnail={isThumbnail}
              heading={slide.title}
              onUpdateHeading={(nextH) => onUpdateSlide?.({ title: nextH })}
              onUpdateTable={(nextT) => onUpdateSlide?.({ tableData: nextT })}
              InlineEditable={InlineEditableText}
            />
          </div>
        </div>
      );
    }

    if (slide.presetId === 'mwb-starter-quadrant') {
      const quads = slide.starterQuadrants || [];

      const handleSetQuadrantLayout = (idx: number, nextLayout: StarterQuadrantLayout) => {
        const target = quads[idx];
        if (!target) return;

        let newOptions = target.options;
        let newAnswer = target.answer;

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

        const updated = quads.map((item, i) =>
          i === idx
            ? {
                ...item,
                layout: nextLayout,
                options: newOptions,
                answer: newAnswer,
              }
            : item
        );

        onUpdateSlide?.({ starterQuadrants: updated });
      };

      return (
        <div
          className={`relative z-20 flex-1 flex flex-col pt-6 min-h-0 overflow-hidden ${
            isHaloVariant
              ? 'px-[165px] pb-[115px]'
              : 'px-20 pb-[130px]'
          }`}
        >
          <div className="grid grid-cols-2 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-x-10 gap-y-6 flex-1 min-h-0">
            {quads.slice(0, 4).map((q, idx) => {
              const slotId = `slot-quad-${idx}`;
              const quadOverride = slide.elementLayouts?.[slotId];
              const quadOnDark = quadOverride?.layer
                ? quadOverride.layer === 'bottom'
                : topOnDark;
              const quadBoxed = quadOverride?.boxed !== undefined ? quadOverride.boxed : true;
              const revealed = editorPreviewAllAnswers || idx < starterRevealedCount;
              const cleanQuestion = stripStarterMetaPrefix(q.question);
              const qLen = cleanQuestion.length;
              const layout = getQuadrantLayout(q);
              const isPictureLayout = layout === 'identify-picture-mc' || layout === 'identify-picture-open';
              const isTfLayout = layout === 'true-false';
              const isOpenLayout = layout === 'open-ended';

              const qTextClass =
                isPictureLayout
                  ? qLen > 80
                    ? 'text-[21px] leading-[1.2]'
                    : 'text-[24px] leading-[1.22]'
                  : qLen > 125
                  ? 'text-[23px] leading-[1.18]'
                  : qLen > 85
                  ? 'text-[26px] leading-[1.2]'
                  : 'text-[29px] leading-[1.22]';

              const hasMcOptions = Boolean(q.options && q.options.length > 0);
              const maxOptLen = hasMcOptions
                ? Math.max(...q.options!.map((o) => o.length))
                : 0;
              const optTextClass =
                isPictureLayout
                  ? 'text-[19px] leading-tight py-1.5 px-3'
                  : maxOptLen > 34
                  ? 'text-[20px] leading-tight py-1.5 px-3'
                  : 'text-[23px] leading-snug py-2 px-3.5';

              // Header of quadrant: number badge, question text, and layout switch select
              const quadrantHeader = (
                <div className="flex items-start justify-between gap-3 shrink-0">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span
                      className="w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-[25px] shrink-0"
                      style={{
                        backgroundColor: quadOnDark ? '#FFFFFF' : neutralAccent,
                        color: quadOnDark ? palette.layers[3] : '#FFFFFF',
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`${qTextClass} font-bold`}
                        style={{ color: quadOnDark ? '#FFFFFF' : neutralDark }}
                      >
                        <InlineEditableText
                          value={cleanQuestion}
                          editable={editable && !isThumbnail}
                          multiline
                          onCommit={(next) =>
                            onUpdateSlide?.({
                              starterQuadrants: quads.map((item) =>
                                item.id === q.id ? { ...item, question: next } : item
                              ),
                            })
                          }
                        />
                      </p>
                    </div>
                  </div>

                  {editable && !isThumbnail && (
                    <select
                      value={layout}
                      data-no-drag="true"
                      title="Change quadrant layout"
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSetQuadrantLayout(idx, e.target.value as StarterQuadrantLayout);
                      }}
                      className="shrink-0 text-[12px] font-bold py-1 px-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-300 shadow-xs outline-none cursor-pointer"
                    >
                      <option value="multiple-choice">Multiple Choice</option>
                      <option value="true-false">True / False</option>
                      <option value="identify-picture-mc">Picture + MC</option>
                      <option value="identify-picture-open">Picture + Open</option>
                      <option value="open-ended">Open Question</option>
                    </select>
                  )}
                </div>
              );

              // Multiple-Choice Grid
              const renderMcGrid = (colCount = 2, extraLeftPadding = 'pl-[52px]') => (
                <div
                  className={`grid ${
                    colCount === 1 ? 'grid-cols-1 gap-y-1.5' : 'grid-cols-2 gap-x-3 gap-y-1.5'
                  } ${extraLeftPadding} flex-1 min-h-0 content-center`}
                >
                  {(q.options || ['Option A', 'Option B', 'Option C', 'Option D']).slice(0, 4).map((opt, oi) => {
                    const letter = String.fromCharCode(65 + oi);
                    const cleanOptText = opt.replace(/^[A-D][\s.):\-]+/i, '');
                    const isCorrect = isMcOptionCorrect(opt, oi, q.answer);

                    let pillClass = quadOnDark
                      ? 'text-white hover:bg-white/10'
                      : 'text-zinc-900 hover:bg-black/5';
                    let badgeClass = '';
                    let badgeStyle: React.CSSProperties = {
                      color: quadOnDark ? '#FFFFFF' : neutralAccent,
                    };

                    if (revealed) {
                      if (isCorrect) {
                        pillClass =
                          'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/30';
                        badgeClass = 'bg-white/20 text-white px-2 py-0.5 rounded-lg';
                        badgeStyle = { color: '#FFFFFF' };
                      } else {
                        pillClass = quadOnDark
                          ? 'text-white/35 opacity-40'
                          : 'text-zinc-400 opacity-45';
                        badgeStyle = {
                          color: quadOnDark ? 'rgba(255,255,255,0.4)' : '#94A3B8',
                        };
                      }
                    }

                    return (
                      <div
                        key={oi}
                        className={`rounded-xl font-bold flex items-center gap-2 min-h-0 overflow-hidden transition-all ${optTextClass} ${pillClass}`}
                      >
                        <button
                          type="button"
                          disabled={!editable || isThumbnail}
                          title={
                            editable && !isThumbnail
                              ? `Click to mark ${letter} as correct answer`
                              : undefined
                          }
                          onClick={(e) => {
                            if (editable && !isThumbnail) {
                              e.stopPropagation();
                              onUpdateSlide?.({
                                starterQuadrants: quads.map((item) =>
                                  item.id === q.id
                                    ? { ...item, answer: `${letter} — ${cleanOptText}` }
                                    : item
                                ),
                              });
                            }
                          }}
                          className={`shrink-0 font-extrabold ${badgeClass} ${
                            editable && !isThumbnail
                              ? 'cursor-pointer hover:underline'
                              : 'cursor-default'
                          }`}
                          style={badgeStyle}
                        >
                          {letter}.
                        </button>
                        <span className="flex-1 min-w-0 line-clamp-2">
                          <InlineEditableText
                            value={cleanOptText}
                            editable={editable && !isThumbnail}
                            onCommit={(next) => {
                              const updated = (q.options || []).map((o, k) =>
                                k === oi ? `${letter}. ${next}` : o
                              );
                              onUpdateSlide?.({
                                starterQuadrants: quads.map((item) =>
                                  item.id === q.id
                                    ? {
                                        ...item,
                                        options: updated,
                                        answer: isCorrect
                                          ? `${letter} — ${next}`
                                          : item.answer,
                                      }
                                    : item
                                ),
                              });
                            }}
                          />
                        </span>
                        {revealed && isCorrect && (
                          <Check size={22} strokeWidth={3} className="shrink-0 text-white" />
                        )}
                      </div>
                    );
                  })}
                </div>
              );

              // True / False Chooser
              const renderTfChoices = () => (
                <div className="flex flex-col gap-2 pl-[52px] flex-1 justify-center min-h-0">
                  <div className="flex items-center gap-4">
                    {['True', 'False'].map((tfVal, tfIdx) => {
                      const isThisTrue = tfVal === 'True';
                      const isCorrect = isTfOptionCorrect(isThisTrue, q.answer);
                      const letter = tfIdx === 0 ? 'A' : 'B';

                      let btnClass = quadOnDark
                        ? 'bg-white/10 text-white hover:bg-white/20 border-white/20'
                        : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 border-zinc-200';

                      if (revealed) {
                        if (isCorrect) {
                          btnClass =
                            'bg-emerald-600 text-white border-emerald-500 shadow-md ring-2 ring-emerald-400/40';
                        } else {
                          btnClass = quadOnDark
                            ? 'bg-white/5 text-white/30 border-transparent opacity-40'
                            : 'bg-zinc-100/60 text-zinc-400 border-transparent opacity-40';
                        }
                      }

                      return (
                        <button
                          key={tfVal}
                          type="button"
                          disabled={!editable || isThumbnail}
                          title={
                            editable && !isThumbnail
                              ? `Click to set ${tfVal} as correct answer`
                              : undefined
                          }
                          onClick={(e) => {
                            if (editable && !isThumbnail) {
                              e.stopPropagation();
                              onUpdateSlide?.({
                                starterQuadrants: quads.map((item) =>
                                  item.id === q.id
                                    ? { ...item, answer: `${letter} — ${tfVal}` }
                                    : item
                                ),
                              });
                            }
                          }}
                          className={`flex-1 py-3 px-5 rounded-2xl border-2 font-black text-[25px] flex items-center justify-center gap-3 transition ${btnClass} ${
                            editable && !isThumbnail ? 'cursor-pointer' : 'cursor-default'
                          }`}
                        >
                          <span className="opacity-70 text-[20px] font-bold">{letter}.</span>
                          <span>{tfVal}</span>
                          {revealed && isCorrect && (
                            <Check size={26} strokeWidth={3.5} className="text-white shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {revealed && q.answer && q.answer.includes('—') && (
                    <div className="rounded-xl px-4 py-2 bg-emerald-50 text-emerald-950 border border-emerald-200 text-[18px] font-bold flex items-center gap-2">
                      <span className="text-emerald-700">Why:</span>
                      <InlineEditableText
                        value={q.answer.replace(/^[A-B]\s*—\s*(?:True|False)\s*[—:]\s*/i, '')}
                        editable={editable && !isThumbnail}
                        onCommit={(next) => {
                          const isTrue = isTfOptionCorrect(true, q.answer);
                          const prefix = isTrue ? 'A — True — ' : 'B — False — ';
                          onUpdateSlide?.({
                            starterQuadrants: quads.map((item) =>
                              item.id === q.id ? { ...item, answer: `${prefix}${next}` } : item
                            ),
                          });
                        }}
                      />
                    </div>
                  )}
                </div>
              );

              // Open-ended Whiteboard Space / Reveal Banner
              const renderOpenEnded = (extraLeftPadding = 'pl-[52px]') => (
                <div className={`flex flex-col flex-1 justify-center min-h-0 ${extraLeftPadding}`}>
                  {revealed ? (
                    <div className="rounded-2xl bg-emerald-600 text-white px-5 py-3 shadow-md flex items-center gap-3">
                      <Check size={28} strokeWidth={3} className="shrink-0 text-white" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[12px] uppercase font-bold tracking-wider text-emerald-100 block">
                          Model Answer
                        </span>
                        <p className="text-[24px] font-black leading-tight text-white">
                          <InlineEditableText
                            value={q.answer}
                            editable={editable && !isThumbnail}
                            multiline
                            onCommit={(next) =>
                              onUpdateSlide?.({
                                starterQuadrants: quads.map((item) =>
                                  item.id === q.id ? { ...item, answer: next } : item
                                ),
                              })
                            }
                          />
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full min-h-[78px] rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50/70 flex items-center justify-center gap-3 px-5 py-3 text-zinc-500">
                      <PenLine size={24} className="text-zinc-400" />
                      <span className="text-[21px] font-bold">Write response on Mini-Whiteboard</span>
                    </div>
                  )}
                </div>
              );

              // Image Box for Identify-Picture Layouts
              const renderPictureBox = () => (
                <div
                  data-slot-id={`quad-media-${idx}`}
                  className={`w-[220px] shrink-0 h-full max-h-[220px] rounded-2xl border-2 overflow-hidden relative flex flex-col items-center justify-center cursor-pointer group transition ${
                    q.imageUrl || q.svgCode
                      ? 'bg-white border-zinc-200 hover:border-emerald-500 shadow-xs'
                      : 'bg-zinc-100/90 border-dashed border-zinc-300 hover:border-emerald-500 hover:bg-zinc-50'
                  }`}
                  onMouseEnter={() => {
                    if (editable && !isThumbnail) onHoverImageTarget?.(`quad-media-${idx}`);
                  }}
                  onMouseLeave={() => {
                    if (editable && !isThumbnail) onHoverImageTarget?.(null);
                  }}
                  onClick={(e) => {
                    if (editable && !isThumbnail) {
                      e.stopPropagation();
                      onOpenMediaPicker?.(`quad-media-${idx}`);
                    }
                  }}
                >
                  {q.svgCode ? (
                    <div
                      className="w-full h-full p-2 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-h-[190px] [&>svg]:object-contain"
                      dangerouslySetInnerHTML={{ __html: q.svgCode }}
                    />
                  ) : q.imageUrl ? (
                    <img
                      src={q.imageUrl}
                      alt={cleanQuestion}
                      className="w-full h-full object-contain p-1.5 rounded-xl"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 p-3 text-center text-zinc-500 group-hover:text-emerald-700">
                      <ImagePlus size={36} className="text-zinc-400 group-hover:text-emerald-600 transition" />
                      <span className="text-[14px] font-bold leading-tight">
                        {editable && !isThumbnail ? 'Click or Ctrl+V' : 'Visual Diagram'}
                      </span>
                      <span className="text-[11px] font-medium text-zinc-400">
                        Diagram / Picture
                      </span>
                    </div>
                  )}

                  {editable && !isThumbnail && (q.imageUrl || q.svgCode) && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-zinc-900/90 text-white px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-md transition">
                      <ImagePlus size={12} />
                      <span>Change</span>
                    </div>
                  )}
                </div>
              );

              const quadNode = (
                <div
                  className={`flex flex-col justify-between gap-2.5 min-h-0 h-full overflow-hidden ${
                    quadBoxed
                      ? `rounded-3xl border-2 px-6 py-4 shadow-md ${
                          quadOnDark
                            ? 'bg-white/14 backdrop-blur-md border-white/30'
                            : 'bg-white/95'
                        }`
                      : hideWaveBackground
                      ? 'rounded-2xl border-2 border-dashed border-slate-300 px-5 py-3.5 bg-white/60'
                      : 'px-2 py-2'
                  }`}
                  style={
                    quadBoxed && !quadOnDark
                      ? {
                          borderColor: neutralBorder,
                          borderTopColor: neutralBorder,
                          borderRightColor: neutralBorder,
                          borderBottomColor: neutralBorder,
                          borderLeftColor: neutralBorder,
                        }
                      : undefined
                  }
                >
                  {isPictureLayout ? (
                    <div className="flex items-stretch gap-4 flex-1 min-h-0">
                      {renderPictureBox()}
                      <div className="flex-1 flex flex-col justify-between gap-2 min-w-0 min-h-0">
                        {quadrantHeader}
                        {layout === 'identify-picture-mc'
                          ? renderMcGrid(2, 'pl-0')
                          : renderOpenEnded('pl-0')}
                      </div>
                    </div>
                  ) : (
                    <>
                      {quadrantHeader}
                      {isTfLayout
                        ? renderTfChoices()
                        : isOpenLayout
                        ? renderOpenEnded()
                        : renderMcGrid()}
                    </>
                  )}
                </div>
              );

              return placeSlot(slotId, quadNode, {
                preserveGridCell: true,
                showBoxToggle: true,
                showLayerToggle: true,
                isBoxed: quadBoxed,
                isBottomLayer: quadOnDark,
                className: quadOverride ? '' : 'h-full min-h-0',
              });
            })}
          </div>
        </div>
      );
    }

    if (slide.presetId === 'title-divider') {
      const titleOverride = slide.elementLayouts?.['slot-title'];
      const titleOnDark = titleOverride?.layer
        ? titleOverride.layer === 'bottom'
        : topOnDark;
      const titleBoxed = Boolean(titleOverride?.boxed);

      const bigQOverride = slide.elementLayouts?.['slot-big-question'];
      const bigQOnDark = bigQOverride?.layer ? bigQOverride.layer === 'bottom' : topOnDark;
      const bigQBoxed = Boolean(bigQOverride?.boxed);

      return (
        <div
          className={`relative z-20 flex-1 flex flex-col justify-between pb-16 pt-10 ${
            isHaloVariant ? 'px-[165px]' : 'px-20'
          }`}
        >
          <div className="max-w-[980px] space-y-8">
            {placeSlot(
              'slot-title',
              <div
                className={
                  titleBoxed
                    ? `rounded-3xl p-6 border-2 shadow-lg ${
                        titleOnDark
                          ? 'bg-white/14 backdrop-blur-md border-white/30'
                          : 'bg-white/95'
                      }`
                    : hideWaveBackground
                    ? 'rounded-2xl p-4 border-2 border-dashed border-slate-300 bg-white/55'
                    : ''
                }
                style={
                  titleBoxed && !titleOnDark
                    ? {
                        borderColor: neutralBorder,
                        borderTopColor: neutralBorder,
                        borderRightColor: neutralBorder,
                        borderBottomColor: neutralBorder,
                        borderLeftColor: neutralBorder,
                      }
                    : undefined
                }
              >
                <h1
                  className="text-[74px] font-extrabold leading-[1.06] tracking-tight"
                  style={{ color: titleOnDark ? '#FFFFFF' : neutralDark }}
                >
                  <InlineEditableText
                    value={slide.title}
                    editable={editable && !isThumbnail}
                    onCommit={(next) => onUpdateSlide?.({ title: next })}
                  />
                </h1>
              </div>,
              {
                showBoxToggle: true,
                showLayerToggle: true,
                isBoxed: titleBoxed,
                isBottomLayer: titleOnDark,
              }
            )}

            {(slide.bigQuestion || (editable && !isThumbnail)) &&
              placeSlot(
                'slot-big-question',
                <div
                  className={
                    bigQBoxed
                      ? `p-8 rounded-3xl border-2 shadow-md ${
                          bigQOnDark
                            ? 'bg-white/14 backdrop-blur-md border-white/30'
                            : 'bg-white/92'
                        }`
                      : hideWaveBackground
                      ? 'p-6 rounded-2xl border-2 border-dashed border-slate-300 border-l-[10px] bg-white/65'
                      : 'border-l-[10px] pl-7 py-1'
                  }
                  style={
                    bigQBoxed
                      ? {
                          borderColor: bigQOnDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                          borderTopColor: bigQOnDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                          borderRightColor: bigQOnDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                          borderBottomColor: bigQOnDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                          borderLeftColor: bigQOnDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                        }
                      : { borderLeftColor: bigQOnDark ? '#FFFFFF' : neutralAccent }
                  }
                >
                  <p
                    className="text-[42px] font-bold leading-snug"
                    style={{ color: bigQOnDark ? '#FFFFFF' : neutralDark }}
                  >
                    <InlineEditableText
                      value={slide.bigQuestion || ''}
                      placeholder="Add big question..."
                      editable={editable && !isThumbnail}
                      multiline
                      onCommit={(next) => onUpdateSlide?.({ bigQuestion: next })}
                    />
                  </p>
                </div>,
                {
                  showBoxToggle: true,
                  showLayerToggle: true,
                  isBoxed: bigQBoxed,
                  isBottomLayer: bigQOnDark,
                }
              )}
          </div>

          {slide.keyTermsStrip && slide.keyTermsStrip.length > 0 && (
            <div className="grid grid-cols-3 gap-8 max-w-[1520px]">
              {slide.keyTermsStrip.map((kt, i) => {
                const slotId = `slot-term-${i}`;
                const termOverride = slide.elementLayouts?.[slotId];
                const termOnDark = termOverride?.layer
                  ? termOverride.layer === 'bottom'
                  : topOnDark;
                const termBoxed = Boolean(termOverride?.boxed);

                return placeSlot(
                  slotId,
                  <div
                    className={
                      termBoxed
                        ? `rounded-3xl border-2 p-6 shadow-md ${
                            termOnDark ? 'bg-white/15 border-white/30' : 'bg-white/95'
                          }`
                        : hideWaveBackground
                        ? 'rounded-2xl border-2 border-dashed border-slate-300 p-5 bg-white/60'
                        : 'border-t-4 pt-4'
                    }
                    style={
                      termBoxed
                        ? termOnDark
                          ? undefined
                          : {
                              borderColor: neutralBorder,
                              borderTopColor: neutralBorder,
                              borderRightColor: neutralBorder,
                              borderBottomColor: neutralBorder,
                              borderLeftColor: neutralBorder,
                            }
                        : !hideWaveBackground
                        ? { borderTopColor: termOnDark ? '#FFFFFF' : neutralAccent }
                        : undefined
                    }
                  >
                    <div
                      className="text-[31px] font-extrabold mb-1.5"
                      style={{ color: termOnDark ? '#FFFFFF' : neutralAccent }}
                    >
                      <InlineEditableText
                        value={kt.term}
                        editable={editable && !isThumbnail}
                        onCommit={(next) =>
                          onUpdateSlide?.({
                            keyTermsStrip: slide.keyTermsStrip?.map((item, idx) =>
                              idx === i ? { ...item, term: next } : item
                            ),
                          })
                        }
                      />
                    </div>
                    <div
                      className="text-[26px] leading-snug"
                      style={{
                        color: termOnDark ? 'rgba(255,255,255,0.88)' : p.mutedInk,
                      }}
                    >
                      <InlineEditableText
                        value={kt.definition}
                        editable={editable && !isThumbnail}
                        multiline
                        onCommit={(next) =>
                          onUpdateSlide?.({
                            keyTermsStrip: slide.keyTermsStrip?.map((item, idx) =>
                              idx === i ? { ...item, definition: next } : item
                            ),
                          })
                        }
                      />
                    </div>
                  </div>,
                  {
                    preserveGridCell: true,
                    showBoxToggle: true,
                    showLayerToggle: true,
                    isBoxed: termBoxed,
                    isBottomLayer: termOnDark,
                  }
                );
              })}
            </div>
          )}
        </div>
      );
    }

    if (
      slide.presetId === 'vocab-words-only' ||
      slide.presetId === 'vocab-single-term-focus' ||
      slide.presetId === 'vocabulary-spotlight'
    ) {
      const terms =
        slide.keyTermsStrip && slide.keyTermsStrip.length > 0
          ? slide.keyTermsStrip
          : slide.bodyBlocks.map((b) => ({
              term: b.heading || 'Key Term',
              definition: b.content.replace(/^[•\-*]\s*/gm, ''),
            }));

      if (slide.presetId === 'vocab-single-term-focus') {
        const focus = terms[0] || { term: slide.title, definition: '' };
        const noteBlocks = slide.keyTermsStrip?.length
          ? slide.bodyBlocks
          : slide.bodyBlocks.slice(1);
        const focusOverride = slide.elementLayouts?.['slot-vocab-focus'];
        const focusOnDark = focusOverride?.layer
          ? focusOverride.layer === 'bottom'
          : topOnDark;
        const focusBoxed = Boolean(focusOverride?.boxed);

        return (
          <div className={`relative z-20 flex-1 flex items-center gap-14 min-h-0 ${contentPad}`}>
            {/* Left Column: Prominent Visual Frame (Matching Image 2) */}
            <div className="w-[520px] shrink-0 flex items-center justify-center">
              <div
                onMouseEnter={() => {
                  if (editable && !isThumbnail) onHoverImageTarget?.('vocab-media-0');
                }}
                onMouseLeave={() => {
                  if (editable && !isThumbnail) onHoverImageTarget?.(null);
                }}
                className="w-full h-[520px] rounded-3xl border-2 border-zinc-900 bg-white shadow-md overflow-hidden flex items-center justify-center p-6 relative cursor-pointer group hover:border-emerald-600 transition"
                onClick={() => {
                  if (editable && !isThumbnail && onOpenMediaPicker) {
                    onOpenMediaPicker('vocab-media-0');
                  }
                }}
              >
                {effectiveMedia?.url || (focus as any).imageUrl ? (
                  <img
                    src={effectiveMedia?.url || (focus as any).imageUrl}
                    alt={focus.term}
                    className="w-full h-full object-contain"
                  />
                ) : effectiveMedia?.svgCode || (focus as any).svgCode ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: effectiveMedia?.svgCode || (focus as any).svgCode || '',
                    }}
                    className="w-full h-full p-4 flex items-center justify-center"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4 text-center p-4">
                    <DualCodeBadgeControl
                      iconId={slide.bodyBlocks[0]?.dualCodeIcon || 'concept'}
                      accentColor={neutralAccent}
                      onDarkSurface={false}
                      editable={false}
                    />
                    <span className="text-sm font-semibold text-zinc-500 group-hover:text-emerald-700">
                      Click or press Ctrl+V to add visual
                    </span>
                  </div>
                )}
                {editable && !isThumbnail && (
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 bg-zinc-900/90 text-white px-3 py-1.5 rounded-xl transition text-xs font-bold flex items-center gap-1.5 shadow-md pointer-events-none z-10 border border-white/20">
                    <ClipboardPaste size={14} className="text-emerald-400" />
                    <span>Press Ctrl+V to paste image</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Term & Definition (Matching Image 2) */}
            <div className="flex-1 flex flex-col justify-center gap-6 min-w-0">
              {placeSlot(
                'slot-vocab-focus',
                <div
                  className={
                    focusBoxed
                      ? `rounded-3xl p-10 border-2 shadow-lg space-y-6 ${
                          focusOnDark
                            ? 'bg-white/14 backdrop-blur-md border-white/30'
                            : 'bg-white/95'
                        }`
                      : hideWaveBackground
                      ? 'rounded-2xl p-8 border-2 border-dashed border-slate-300 bg-white/65 space-y-5'
                      : 'border-l-[10px] pl-8 py-3 space-y-5'
                  }
                  style={
                    focusBoxed
                      ? {
                          borderColor: focusOnDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                          borderTopColor: focusOnDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                          borderRightColor: focusOnDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                          borderBottomColor: focusOnDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                          borderLeftColor: focusOnDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                        }
                      : !hideWaveBackground
                      ? { borderLeftColor: focusOnDark ? '#FFFFFF' : neutralAccent }
                      : undefined
                  }
                >
                  <h2
                    className="text-[58px] font-extrabold leading-tight tracking-tight"
                    style={{ color: focusOnDark ? '#FFFFFF' : neutralDark }}
                  >
                    <InlineEditableText
                      value={focus.term ? `${focus.term}:` : ''}
                      editable={editable && !isThumbnail}
                      onCommit={(next) => {
                        const clean = next.replace(/:$/, '').trim();
                        if (slide.keyTermsStrip?.length) {
                          onUpdateSlide?.({
                            keyTermsStrip: slide.keyTermsStrip.map((t, idx) =>
                              idx === 0 ? { ...t, term: clean } : t
                            ),
                          });
                        } else if (slide.bodyBlocks[0]) {
                          updateBlock(slide.bodyBlocks[0].id, { heading: clean });
                        }
                      }}
                    />
                  </h2>
                  <p
                    className="text-[36px] leading-[1.42] font-medium"
                    style={{ color: focusOnDark ? 'rgba(255,255,255,0.95)' : neutralDark }}
                  >
                    <InlineEditableText
                      value={focus.definition}
                      placeholder="Add clear definition for pupils to write..."
                      editable={editable && !isThumbnail}
                      multiline
                      onCommit={(next) => {
                        if (slide.keyTermsStrip?.length) {
                          onUpdateSlide?.({
                            keyTermsStrip: slide.keyTermsStrip.map((t, idx) =>
                              idx === 0 ? { ...t, definition: next } : t
                            ),
                          });
                        } else if (slide.bodyBlocks[0]) {
                          updateBlock(slide.bodyBlocks[0].id, { content: next });
                        }
                      }}
                    />
                  </p>
                </div>,
                {
                  showBoxToggle: true,
                  showLayerToggle: true,
                  isBoxed: focusBoxed,
                  isBottomLayer: focusOnDark,
                }
              )}
              {noteBlocks.map((b, i) => renderCard(b, i))}
            </div>
          </div>
        );
      }

      const isWordsOnly = slide.presetId === 'vocab-words-only';
      const displayTerms = terms.slice(0, 4);
      const colCount = Math.max(1, Math.min(4, displayTerms.length));

      return (
        <div className={`relative z-20 flex-1 flex flex-col justify-center min-h-0 ${contentPad}`}>
          <div
            className="grid gap-8 w-full max-w-[1720px] mx-auto items-stretch"
            style={{
              gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
            }}
          >
            {displayTerms.map((kt, i) => {
              const slotId = `slot-vocab-${i}`;
              const rowOverride = slide.elementLayouts?.[slotId];
              const cardOnDark = rowOverride?.layer ? rowOverride.layer === 'bottom' : topOnDark;
              const cardBoxed = rowOverride?.boxed !== undefined ? rowOverride.boxed : false;
              const termImage = (kt as any).imageUrl || (i === 0 && effectiveMedia?.url);
              const termSvg = (kt as any).svgCode || (i === 0 && effectiveMedia?.svgCode);

              const innerCard = (
                <div className="flex flex-col h-full space-y-4">
                  {/* Top Image Box (Matching Image 1: Framed Container With Dual-Coding Visual) */}
                  <div
                    onMouseEnter={() => {
                      if (editable && !isThumbnail) onHoverImageTarget?.(`vocab-media-${i}`);
                    }}
                    onMouseLeave={() => {
                      if (editable && !isThumbnail) onHoverImageTarget?.(null);
                    }}
                    className="w-full h-[280px] rounded-2xl border-2 border-zinc-900 bg-white shadow-sm overflow-hidden flex items-center justify-center p-3 relative cursor-pointer group hover:border-emerald-600 transition"
                    onClick={() => {
                      if (editable && !isThumbnail && onOpenMediaPicker) {
                        onOpenMediaPicker(`vocab-media-${i}`);
                      }
                    }}
                    title="Click or press Ctrl+V to add visual for this term"
                  >
                    {termImage ? (
                      <img
                        src={termImage}
                        alt={kt.term}
                        className="w-full h-full object-contain"
                      />
                    ) : termSvg ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: termSvg }}
                        className="w-full h-full p-2 flex items-center justify-center"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 text-center p-2">
                        <DualCodeBadgeControl
                          iconId={slide.bodyBlocks[i]?.dualCodeIcon || 'concept'}
                          accentColor={neutralAccent}
                          onDarkSurface={false}
                          editable={false}
                        />
                        <span className="text-xs font-semibold text-zinc-500 group-hover:text-emerald-700">
                          Click or Ctrl+V to add image
                        </span>
                      </div>
                    )}
                    {editable && !isThumbnail && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-zinc-900/90 text-white px-2.5 py-1 rounded-xl transition text-[11px] font-bold flex items-center gap-1 shadow-md pointer-events-none z-10 border border-white/20">
                        <ClipboardPaste size={12} className="text-emerald-400" />
                        <span>Ctrl+V to paste</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Term & Definition Area (Matching Image 1: Bold Term - Definition) */}
                  <div className="flex-1 text-center px-1">
                    <p
                      className="text-[25px] leading-snug font-medium"
                      style={{ color: cardOnDark ? '#FFFFFF' : neutralDark }}
                    >
                      <strong
                        className="font-extrabold mr-1.5"
                        style={{ color: cardOnDark ? '#FFFFFF' : neutralAccent }}
                      >
                        <InlineEditableText
                          value={kt.term}
                          editable={editable && !isThumbnail}
                          onCommit={(next) => {
                            if (slide.keyTermsStrip?.length) {
                              onUpdateSlide?.({
                                keyTermsStrip: slide.keyTermsStrip.map((item, idx) =>
                                  idx === i ? { ...item, term: next } : item
                                ),
                              });
                            } else if (slide.bodyBlocks[i]) {
                              updateBlock(slide.bodyBlocks[i].id, { heading: next });
                            }
                          }}
                        />
                      </strong>
                      {!isWordsOnly && (
                        <span>
                          –{' '}
                          <InlineEditableText
                            value={kt.definition}
                            editable={editable && !isThumbnail}
                            multiline
                            onCommit={(next) => {
                              if (slide.keyTermsStrip?.length) {
                                onUpdateSlide?.({
                                  keyTermsStrip: slide.keyTermsStrip.map((item, idx) =>
                                    idx === i ? { ...item, definition: next } : item
                                  ),
                                });
                              } else if (slide.bodyBlocks[i]) {
                                updateBlock(slide.bodyBlocks[i].id, { content: next });
                              }
                            }}
                          />
                        </span>
                      )}
                    </p>
                    {isWordsOnly && (
                      <div
                        className={`mt-4 border-b-2 border-dashed h-8 w-4/5 mx-auto ${
                          cardOnDark ? 'border-white/40' : 'border-zinc-400/80'
                        }`}
                      />
                    )}
                  </div>
                </div>
              );

              return placeSlot(slotId, innerCard, {
                showBoxToggle: true,
                showLayerToggle: true,
                isBoxed: cardBoxed,
                isBottomLayer: cardOnDark,
              });
            })}
          </div>
        </div>
      );
    }

    if (slide.presetId === 'comparison-two-column') {
      const leftBlocks = slide.bodyBlocks.filter((b) => b.column !== 'right');
      const rightBlocks = slide.bodyBlocks.filter((b) => b.column === 'right');

      return (
        <div
          className={`relative z-20 flex-1 grid ${
            effectiveMedia && !hasFullBottomImage ? 'grid-cols-12' : 'grid-cols-2'
          } gap-8 min-h-0 ${contentPad}`}
        >
          <div
            className={`${
              effectiveMedia && !hasFullBottomImage ? 'col-span-4' : ''
            } space-y-6`}
          >
            {leftBlocks.map((b, i) => renderCard(b, i))}
          </div>

          <div
            className={`${
              effectiveMedia && !hasFullBottomImage ? 'col-span-4' : ''
            } space-y-6`}
          >
            {rightBlocks.map((b, i) => renderCard(b, i))}
          </div>

          {effectiveMedia && !hasFullBottomImage && (
            <div className="col-span-4 flex items-center">
              {renderMediaFrame(effectiveMedia, 'w-full h-[640px]', undefined, bottomOnDark)}
            </div>
          )}
        </div>
      );
    }

    if (slide.presetId === 'process-timeline-flow') {
      return (
        <div className={`relative z-20 flex-1 flex flex-col justify-center gap-8 min-h-0 ${contentPad}`}>
          <div
            className="grid gap-6"
            style={{
              gridTemplateColumns: `repeat(${Math.max(
                1,
                Math.min(4, slide.bodyBlocks.length)
              )}, minmax(0, 1fr))`,
            }}
          >
            {slide.bodyBlocks.map((b, i) => renderCard(b, i, true))}
          </div>

          {effectiveMedia && !hasFullBottomImage && (
            <div className="h-[250px] max-w-4xl">
              {renderMediaFrame(effectiveMedia, 'w-full h-full', undefined, bottomOnDark)}
            </div>
          )}
        </div>
      );
    }

    // Ensure sequential steps (Step 1, Step 2, 1., 2., etc.) stay on the SAME layer ('top')
    const hasSequentialSteps = slide.bodyBlocks.some(
      (b) =>
        b.style === 'step' ||
        /^(Step\s*\d+|\d+[\.\)])/i.test(b.heading || '') ||
        /^(Step\s*\d+|\d+[\.\)])/i.test(b.content.trim())
    );

    const normalizedBlocks = hasSequentialSteps
      ? slide.bodyBlocks.map((b) => {
          const isStep =
            b.style === 'step' ||
            /^(Step\s*\d+|\d+[\.\)])/i.test(b.heading || '') ||
            /^(Step\s*\d+|\d+[\.\)])/i.test(b.content.trim());
          if (isStep && b.layer === 'bottom') {
            return { ...b, layer: 'top' as const };
          }
          return b;
        })
      : slide.bodyBlocks;

    const topBlocks = normalizedBlocks.filter((b) => b.layer !== 'bottom');
    const bottomBlocks = normalizedBlocks.filter((b) => b.layer === 'bottom');
    const isDualCodingLayout =
      slide.presetId === 'split-concept-dual-code' ||
      slide.presetId === 'worked-example-steps';
    const hasBoxedMedia =
      Boolean(effectiveMedia) && effectiveMedia?.placement !== 'fill-bottom-layer';
    const showRightColumn =
      !effectiveSideConfig &&
      (bottomBlocks.length > 0 || hasBoxedMedia || hasFullBottomImage || isDualCodingLayout);
    const leftRenderBlocks =
      (isDualCodingLayout || effectiveSideConfig) && (hasBoxedMedia || !bottomBlocks.length)
        ? normalizedBlocks
        : topBlocks;

    const hasCustomRichLines = Boolean(slide.richLines && slide.richLines.length > 0);

    const renderRichLines = (lines: SlideRichLine[]) => {
      const bodyLines = lines.filter((l, idx) => !(idx === 0 && l.style === 'title'));

      if (bodyLines.length === 0) {
        if (canEditComponents) {
          return (
            <div className="p-7 rounded-3xl border-2 border-dashed border-zinc-300 text-zinc-400 font-bold text-2xl flex items-center justify-center">
              + Type slide explanation or bullet points in the right sidebar
            </div>
          );
        }
        return null;
      }

      return (
        <div className="space-y-4">
          {bodyLines.map((line) => {
            const idx = lines.findIndex((l) => l === line);
            const style = line.style || 'normal';
            const isCallout = style === 'callout';
            const isCode = style === 'code';
            const isTitle = style === 'title';
            const isH1 = style === 'heading-1';
            const isH2 = style === 'heading-2';
            const isH3 = style === 'heading-3';

            const defaultFontSize = isTitle
              ? 50
              : isH1
              ? 42
              : isH2
              ? 34
              : isH3
              ? 28
              : isCallout
              ? 28
              : 26;

            const fontSize = line.fontSize || defaultFontSize;

            const defaultColor = topOnDark
              ? '#FFFFFF'
              : isTitle
              ? neutralDark
              : isH1 || isH2 || isH3
              ? neutralAccent
              : isCallout
              ? neutralDark
              : isCode
              ? '#34D399'
              : neutralDark;

            const color = line.color || defaultColor;

            const handleCommit = (nextText: string) => {
              const nextLines = [...lines];
              nextLines[idx] = { ...line, text: nextText };
              onUpdateSlide?.({
                richLines: nextLines,
                unifiedText: richLinesToUnifiedText(nextLines),
              });
            };

            if (isCallout) {
              return (
                <div
                  key={idx}
                  className="rounded-3xl p-6 border-2 shadow-sm transition-all"
                  style={{
                    backgroundColor: topOnDark
                      ? 'rgba(255,255,255,0.14)'
                      : 'rgba(240, 253, 244, 0.95)',
                    borderColor: topOnDark
                      ? 'rgba(255,255,255,0.32)'
                      : palette.borderAccent,
                  }}
                >
                  <div
                    style={{
                      fontSize: `${fontSize}px`,
                      color,
                      fontWeight: line.isBold !== undefined ? (line.isBold ? 800 : 500) : 700,
                      fontStyle: line.isItalic ? 'italic' : 'normal',
                      textDecoration: line.isUnderline ? 'underline' : 'none',
                      lineHeight: 1.25,
                    }}
                  >
                    <InlineEditableText
                      value={line.text}
                      editable={editable && !isThumbnail}
                      multiline
                      onCommit={handleCommit}
                    />
                  </div>
                </div>
              );
            }

            if (isCode) {
              return (
                <div
                  key={idx}
                  className="rounded-2xl p-5 bg-zinc-950 font-mono border border-zinc-800 shadow-lg text-emerald-300"
                >
                  <div
                    style={{
                      fontSize: `${fontSize}px`,
                      color,
                      fontWeight: line.isBold ? 700 : 400,
                      fontStyle: line.isItalic ? 'italic' : 'normal',
                      textDecoration: line.isUnderline ? 'underline' : 'none',
                      lineHeight: 1.35,
                    }}
                  >
                    <InlineEditableText
                      value={line.text}
                      editable={editable && !isThumbnail}
                      multiline
                      onCommit={handleCommit}
                    />
                  </div>
                </div>
              );
            }

            const isBullet =
              style === 'normal' &&
              (line.text.startsWith('•') || line.text.startsWith('-'));

            return (
              <div
                key={idx}
                className={`flex items-start ${isBullet ? 'gap-4' : ''}`}
              >
                {isBullet && (
                  <span
                    className="inline-block rounded-full shrink-0 mt-3.5"
                    style={{
                      width: `${Math.max(9, Math.round(fontSize * 0.32))}px`,
                      height: `${Math.max(9, Math.round(fontSize * 0.32))}px`,
                      backgroundColor: color,
                    }}
                  />
                )}
                <div
                  className="flex-1 min-w-0"
                  style={{
                    fontSize: `${fontSize}px`,
                    color,
                    fontWeight:
                      line.isBold !== undefined
                        ? line.isBold
                          ? 800
                          : 400
                        : isTitle || isH1
                        ? 800
                        : isH2 || isH3
                        ? 700
                        : 500,
                    fontStyle: line.isItalic ? 'italic' : 'normal',
                    textDecoration: line.isUnderline ? 'underline' : 'none',
                    lineHeight: isTitle ? 1.1 : isH1 || isH2 ? 1.2 : 1.35,
                    letterSpacing: isTitle ? '-0.02em' : 'normal',
                  }}
                >
                  <InlineEditableText
                    value={line.text}
                    editable={editable && !isThumbnail}
                    multiline
                    onCommit={handleCommit}
                  />
                </div>
              </div>
            );
          })}
        </div>
      );
    };

    return (
      <div
        className={`relative z-20 flex-1 flex gap-10 min-h-0 ${contentPad} ${
          effectiveSideConfig?.side === 'right'
            ? 'max-w-[1140px] pr-6'
            : effectiveSideConfig?.side === 'left'
            ? 'ml-[740px] pl-6 max-w-[1180px]'
            : ''
        }`}
      >
        {/* Main Content Zone */}
        <div
          className={`flex flex-col justify-center gap-5 ${
            showRightColumn
              ? 'w-[840px] shrink-0'
              : effectiveSideConfig
              ? 'w-full max-w-[1120px]'
              : 'flex-1 max-w-[1160px]'
          }`}
        >
          {hasCustomRichLines
            ? placeSlot(
                'slot-rich-lines',
                renderRichLines(slide.richLines!),
                {
                  showBoxToggle: true,
                  showLayerToggle: true,
                  isBoxed: false,
                  isBottomLayer: topOnDark,
                }
              )
            : leftRenderBlocks.map((b, i) => renderCard(b, i))}
        </div>

        {/* Right Zone: Designated Dual-Coding Visual Area or Bottom-Layer Cards */}
        {showRightColumn && (
          <div className="flex-1 flex flex-col justify-center gap-6 min-w-0">
            {!(isDualCodingLayout && (hasBoxedMedia || !bottomBlocks.length)) &&
              bottomBlocks.map((b, i) => renderCard(b, i))}

            {!hasFullBottomImage && (isDualCodingLayout || hasBoxedMedia) && (
              <div className="h-[670px] w-full flex items-center justify-center">
                {renderMediaFrame(
                  effectiveMedia,
                  'w-full h-full',
                  isDualCodingLayout ? 'Dual-Coding Visual Slot' : undefined,
                  bottomOnDark
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCustomElementsOverlay = () => {
    const els = slide.customCanvasElements;
    if (!els || els.length === 0) return null;

    return els.map((el) => {
      if (hiddenSet.has(el.id)) return null;

      const override = slide.elementLayouts?.[el.id];
      const boxOverride: ElementBoxOverride = override || {
        x: Math.round((el.x / 100) * 1920),
        y: Math.round((el.y / 100) * 1080),
        w: Math.max(180, Math.round((el.w / 100) * 1920)),
        h: Math.max(64, Math.round((el.h / 100) * 1080)),
        layer: el.layer || 'top',
        boxed: el.boxed,
      };

      const effectiveLayer = boxOverride.layer ?? el.layer ?? 'top';
      const onDark = effectiveLayer === 'bottom' ? bottomOnDark : topOnDark;
      const isMedia = el.kind === 'image' || el.kind === 'diagram' || Boolean(el.svgCode);
      const isBoxed =
        override?.boxed !== undefined
          ? override.boxed
          : el.boxed !== undefined
          ? el.boxed
          : false;
      const isSelectedEl = canEditComponents && selectedIds.includes(el.id);

      const updateCustomEl = (patch: Partial<BespokeCanvasElement>) => {
        onUpdateSlide?.({
          customCanvasElements: slide.customCanvasElements?.map((c) =>
            c.id === el.id ? { ...c, ...patch } : c
          ),
        });
      };

      let node: React.ReactNode;
      if (el.kind === 'table' || el.tableData) {
        const tData: SlideTableData = el.tableData || {
          rows: 3,
          cols: 3,
          headers: ['Column 1', 'Column 2', 'Column 3'],
          cells: [
            ['', '', ''],
            ['', '', ''],
            ['', '', ''],
          ],
        };
        node = (
          <SlideTable
            tableData={tData}
            onDark={onDark}
            neutralBorder={neutralBorder}
            neutralAccent={neutralAccent}
            neutralDark={neutralDark}
            palette={palette}
            editable={editable && !isThumbnail}
            isThumbnail={isThumbnail}
            heading={el.heading}
            onUpdateHeading={(nextH) => updateCustomEl({ heading: nextH })}
            onUpdateTable={(nextT) => updateCustomEl({ tableData: nextT })}
            InlineEditable={InlineEditableText}
          />
        );
      } else if (el.kind === 'image') {
        node = el.imageUrl ? (
          <div
            onMouseEnter={() => {
              if (editable && !isThumbnail) onHoverImageTarget?.(el.id);
            }}
            onMouseLeave={() => {
              if (editable && !isThumbnail) onHoverImageTarget?.(null);
            }}
            className="group relative w-full h-full rounded-3xl overflow-hidden shadow-2xl border-4 border-white/90 bg-white"
          >
            <img
              src={el.imageUrl}
              alt={el.heading || 'Slide visual'}
              className={`w-full h-full ${
                el.cropFit === 'contain' ? 'object-contain bg-white' : 'object-cover'
              }`}
            />
            {editable && !isThumbnail && (
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 bg-zinc-900/90 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg border border-white/20 transition pointer-events-none z-10">
                <ClipboardPaste size={13} className="text-emerald-400" />
                <span>Ctrl+V to replace</span>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={!editable || isThumbnail}
            onMouseEnter={() => {
              if (editable && !isThumbnail) onHoverImageTarget?.(el.id);
            }}
            onMouseLeave={() => {
              if (editable && !isThumbnail) onHoverImageTarget?.(null);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (editable && !isThumbnail) onOpenMediaPicker?.(el.id);
            }}
            className={`group relative w-full h-full rounded-3xl border-4 border-dashed flex flex-col items-center justify-center p-6 text-center transition ${
              onDark
                ? 'border-white/65 bg-white/15 hover:bg-white/25 text-white'
                : 'border-slate-400/75 bg-white/75 hover:bg-white text-slate-700'
            }`}
          >
            {editable && !isThumbnail && (
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 bg-zinc-900/90 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg border border-white/20 transition pointer-events-none animate-fade-in z-10">
                <ClipboardPaste size={14} className="text-emerald-400" />
                <span>Press Ctrl+V to paste image</span>
              </div>
            )}
            <ImagePlus size={44} className="mb-3 opacity-85" />
            <span className="text-[28px] font-extrabold leading-tight">
              {el.heading || 'Choose Image or Diagram'}
            </span>
            <span className="mt-1.5 text-[21px] font-medium opacity-80">
              Click to choose • Press Ctrl+V to paste
            </span>
          </button>
        );
      } else if (el.svgCode) {
        node = (
          <div
            className={`w-full h-full flex items-center justify-center p-4 ${
              hideWaveBackground
                ? 'rounded-2xl border-2 border-dashed border-sky-400 bg-sky-50/70'
                : isBoxed
                ? 'rounded-3xl bg-white/95 border-2 shadow-lg'
                : 'rounded-3xl bg-white/92 shadow-md'
            }`}
            style={
              isBoxed
                ? {
                    borderColor: neutralBorder,
                    borderTopColor: neutralBorder,
                    borderRightColor: neutralBorder,
                    borderBottomColor: neutralBorder,
                    borderLeftColor: neutralBorder,
                  }
                : undefined
            }
            dangerouslySetInnerHTML={{ __html: el.svgCode }}
          />
        );
      } else {
        const cleanHeading =
          el.heading && !isGenericMetaHeading(el.heading) ? el.heading : '';
        node = (
          <div
            className={`w-full h-full overflow-hidden flex flex-col gap-2 ${
              isBoxed
                ? `rounded-3xl p-6 border-2 shadow-lg ${
                    onDark
                      ? 'bg-white/14 backdrop-blur-md border-white/30'
                      : 'bg-white/95'
                  }`
                : hideWaveBackground
                ? 'rounded-2xl p-5 border-2 border-dashed border-slate-300 bg-white/65'
                : 'px-3 py-2'
            }`}
            style={
              isBoxed
                ? {
                    borderColor: onDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                    borderTopColor: onDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                    borderRightColor: onDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                    borderBottomColor: onDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                    borderLeftColor: onDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
                  }
                : undefined
            }
          >
            {(cleanHeading || isSelectedEl) && (
              <div className="flex items-center gap-3 min-w-0">
                {(el.dualCodeIcon || isSelectedEl) && (
                  <DualCodeBadgeControl
                    iconId={el.dualCodeIcon}
                    accentColor={neutralAccent}
                    onDarkSurface={onDark}
                    editable={editable && !isThumbnail}
                    onChangeIcon={(nextIcon) =>
                      updateCustomEl({ dualCodeIcon: nextIcon })
                    }
                  />
                )}
                {cleanHeading ? (
                  <h4
                    className="text-[35px] font-extrabold leading-tight flex-1"
                    style={{ color: onDark ? '#FFFFFF' : neutralAccent }}
                  >
                    <InlineEditableText
                      value={cleanHeading}
                      editable={editable && !isThumbnail}
                      onCommit={(next) => updateCustomEl({ heading: next })}
                    />
                  </h4>
                ) : (
                  <h4
                    className="text-[28px] font-bold leading-tight opacity-60 flex-1"
                    style={{ color: onDark ? '#FFFFFF' : neutralAccent }}
                  >
                    <InlineEditableText
                      value=""
                      placeholder="+ Add heading"
                      editable={editable && !isThumbnail}
                      onCommit={(next) => updateCustomEl({ heading: next })}
                    />
                  </h4>
                )}
              </div>
            )}
            <div className="min-h-0 flex-1">
              {renderBulletOrProse(
                el.content || '',
                onDark ? '#FFFFFF' : neutralDark,
                'text-[31px]',
                onDark,
                (next) => updateCustomEl({ content: next })
              )}
            </div>
          </div>
        );
      }

      return (
        <InteractiveSlot
          key={el.id}
          id={el.id}
          override={boxOverride}
          editable={canEditComponents}
          isSelected={isSelectedEl}
          showSingleToolbar={selectedIds.length <= 1}
          isBoxed={isBoxed}
          isBottomLayer={effectiveLayer === 'bottom'}
          showBoxToggle={!isMedia || el.kind === 'diagram'}
          showLayerToggle={!isMedia}
          stretchHeight
          onSelect={(isCtrl) => handleSelectSlot(el.id, isCtrl)}
          onStartDrag={(e, slotEl, mode, minDelta) =>
            handleStartSlotDrag(el.id, e, slotEl, mode, minDelta, boxOverride)
          }
          onToggleBoxed={() => {
            const nextBoxed = !isBoxed;
            updateCustomEl({ boxed: nextBoxed });
            if (override) updateSlotLayout(el.id, { boxed: nextBoxed });
          }}
          onToggleLayer={() => {
            const nextLayer = effectiveLayer === 'bottom' ? 'top' : 'bottom';
            updateCustomEl({ layer: nextLayer });
            if (override) updateSlotLayout(el.id, { layer: nextLayer });
          }}
          onDelete={() => deleteSlot(el.id)}
          extraActions={
            isMedia && editable && onOpenMediaPicker && !isThumbnail ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenMediaPicker(el.id);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[17px] font-bold"
              >
                <ImagePlus size={16} />
                <span>Change Visual</span>
              </button>
            ) : undefined
          }
        >
          {node}
        </InteractiveSlot>
      );
    });
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-video overflow-hidden select-none shadow-md ${
        isThumbnail ? 'pointer-events-none' : ''
      }`}
      style={{
        backgroundColor: hideWaveBackground ? '#F4F4F5' : palette.layers[3],
      }}
    >
      {/* Scaled 1920x1080 Fixed Coordinate Slide Canvas */}
      <div
        ref={canvasBoxRef}
        onPointerDown={(e) => {
          if (!canEditComponents) return;
          if (e.button !== 0) return;
          const target = e.target as HTMLElement;
          if (
            target.closest(
              '[data-slot-id], button, input, textarea, select, [data-no-drag]'
            )
          ) {
            return;
          }
          const canvas = canvasBoxRef.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          const canvasX = ((e.clientX - rect.left) / rect.width) * 1920;
          const canvasY = ((e.clientY - rect.top) / rect.height) * 1080;
          marqueeStartRef.current = {
            clientX: e.clientX,
            clientY: e.clientY,
            canvasX,
            canvasY,
            ctrl: e.ctrlKey || e.metaKey,
          };
        }}
        onClickCapture={(e) => {
          if (Date.now() - lastDraggedAtRef.current < 180) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        className="origin-top-left relative flex flex-col"
        style={{
          width: 1920,
          height: 1080,
          transform: `scale(${scale})`,
          fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
        }}
      >
        {hideWaveBackground ? (
          <div className="absolute inset-0 z-0 bg-[#F8FAFC] border-2 border-slate-200">
            <div
              className="w-full h-full opacity-35"
              style={{
                backgroundImage:
                  'radial-gradient(#94A3B8 1.5px, transparent 1.5px)',
                backgroundSize: '36px 36px',
              }}
            />
          </div>
        ) : (
          <PaperCutRenderer
            phase={slide.phase}
            waveVariant={slide.waveVariant}
            invertWaveLayers={invert}
            obstacles={obstacles}
            customWaveLayers={slide.customWaveLayers}
            waveControlPoints={activeControlPoints}
            bottomFillMedia={effectiveMedia}
            className="absolute inset-0 z-0"
          />
        )}

        {effectiveSideConfig && !hideWaveBackground && (
          <SideAnchoredImageWave
            side={effectiveSideConfig.side}
            widthPercent={effectiveSideConfig.widthPercent || 38}
            controlPoints={activeSideImgPts}
            mediaItem={effectiveMedia}
            palette={palette}
            invert={invert}
            editable={editable}
            isThumbnail={isThumbnail}
            onOpenMediaPicker={onOpenMediaPicker}
            hoveredTarget={hoveredImageTarget}
            onHoverTarget={onHoverImageTarget}
          />
        )}

        {slide.presetId !== 'title-divider' && !isTitlePage && renderHeader()}

        {renderPresetContent(palette)}

        {/* Freeform Moved Components & Custom Elements Layer */}
        <div className="absolute inset-0 z-30 pointer-events-none">
          {movedOverlays}
          {renderCustomElementsOverlay()}
        </div>

        {/* Interactive Wave Path & Draggable Control Points Overlay */}
        {showWavePathEditor &&
          !hideWaveBackground &&
          !isThumbnail &&
          (computedPaper.controlPoints.length > 0 ||
            (effectiveSideConfig && activeSideImgPts.length > 0)) && (
            <svg
              ref={svgOverlayRef}
              viewBox="0 0 1920 1080"
              className="absolute inset-0 w-full h-full z-40 pointer-events-auto overflow-visible"
            >
              {computedPaper.controlPoints.length > 0 && (
                <>
                  <path
                    d={
                      slide.waveVariant === 'framed-halo' ||
                      slide.waveVariant === 'dark-halo-spotlight'
                        ? smoothClosedSpline(computedPaper.controlPoints)
                        : smoothSplineSegment(computedPaper.controlPoints)
                    }
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth={6}
                    strokeDasharray="18 12"
                    strokeLinecap="round"
                  />
                  {computedPaper.controlPoints.map((pt, idx) => {
                    const hx = Math.max(18, Math.min(1902, pt.x));
                    const hy = Math.max(18, Math.min(1062, pt.y));
                    const isOutside = Math.abs(hx - pt.x) > 2 || Math.abs(hy - pt.y) > 2;
                    return (
                      <g
                        key={`bg-pt-${idx}`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setDraggingPts(computedPaper.controlPoints);
                          setDragIdx(idx);
                        }}
                        style={{ cursor: 'grab' }}
                      >
                        {isOutside && (
                          <line
                            x1={hx}
                            y1={hy}
                            x2={pt.x}
                            y2={pt.y}
                            stroke="#D97706"
                            strokeWidth={3}
                            strokeDasharray="6 6"
                          />
                        )}
                        <circle cx={hx} cy={hy} r={30} fill="transparent" />
                        <circle
                          cx={hx}
                          cy={hy}
                          r={16}
                          fill={dragIdx === idx ? '#D97706' : '#FFFFFF'}
                          stroke="#D97706"
                          strokeWidth={6}
                        />
                        <text
                          x={hx}
                          y={hy + 7}
                          textAnchor="middle"
                          fontSize="16"
                          fontWeight="800"
                          fill={dragIdx === idx ? '#FFFFFF' : '#92400E'}
                          pointerEvents="none"
                        >
                          {idx + 1}
                        </text>
                      </g>
                    );
                  })}
                </>
              )}

              {/* Draggable Cyan Control Points for Side-Anchored Image Wave */}
              {effectiveSideConfig && activeSideImgPts.length > 0 && (
                <g>
                  <path
                    d={smoothSplineSegment(activeSideImgPts)}
                    fill="none"
                    stroke="#0284C7"
                    strokeWidth={6}
                    strokeDasharray="18 12"
                    strokeLinecap="round"
                  />
                  {activeSideImgPts.map((pt, idx) => {
                    const hx = Math.max(18, Math.min(1902, pt.x));
                    const hy = Math.max(18, Math.min(1062, pt.y));
                    const isOutside = Math.abs(hx - pt.x) > 2 || Math.abs(hy - pt.y) > 2;
                    const isDraggingThis = sideImgDragIdx === idx;
                    return (
                      <g
                        key={`side-pt-${idx}`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setSideImgDraggingPts(activeSideImgPts);
                          setSideImgDragIdx(idx);
                        }}
                        style={{ cursor: 'grab' }}
                      >
                        {isOutside && (
                          <line
                            x1={hx}
                            y1={hy}
                            x2={pt.x}
                            y2={pt.y}
                            stroke="#0284C7"
                            strokeWidth={3}
                            strokeDasharray="6 6"
                          />
                        )}
                        <circle cx={hx} cy={hy} r={32} fill="transparent" />
                        <circle
                          cx={hx}
                          cy={hy}
                          r={18}
                          fill={isDraggingThis ? '#0284C7' : '#FFFFFF'}
                          stroke="#0284C7"
                          strokeWidth={6}
                        />
                        <text
                          x={hx}
                          y={hy + 6}
                          textAnchor="middle"
                          fontSize="13"
                          fontWeight="800"
                          fill={isDraggingThis ? '#FFFFFF' : '#0369A1'}
                          pointerEvents="none"
                        >
                          Img {idx + 1}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}
            </svg>
          )}

        {/* Marquee Drag Selection Box */}
        {marqueeBox && (
          <div
            className="absolute pointer-events-none z-50 border-2 border-sky-400 bg-sky-400/20 rounded-xl shadow-lg backdrop-blur-[1px]"
            style={{
              left: marqueeBox.x,
              top: marqueeBox.y,
              width: marqueeBox.w,
              height: marqueeBox.h,
            }}
          />
        )}

        {/* Floating Multi-Selection Group Toolbar */}
        {selectedIds.length > 1 && groupBBox && canEditComponents && (
          <div
            data-no-drag="true"
      data-editable-text="true"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="absolute z-50 flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-900/95 text-white shadow-2xl border border-zinc-700 whitespace-nowrap animate-fade-in"
            style={{
              left: Math.max(40, Math.min(1920 - 520, groupBBox.x)),
              top: Math.max(16, groupBBox.y - 64),
            }}
          >
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-500/25 text-sky-300 text-[16px] font-black border border-sky-400/40">
              <span>{selectedIds.length} items</span>
            </div>
            <div className="w-[1px] h-6 bg-zinc-700 mx-1" />
            <button
              type="button"
              onClick={alignSelectedLeft}
              title="Align selected items to left edge"
              className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-300 hover:text-white transition flex items-center gap-1 text-[15px] font-bold"
            >
              <AlignLeft size={20} />
              <span className="hidden sm:inline">Left</span>
            </button>
            <button
              type="button"
              onClick={alignSelectedCenter}
              title="Align selected items horizontally centered"
              className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-300 hover:text-white transition flex items-center gap-1 text-[15px] font-bold"
            >
              <AlignCenter size={20} />
              <span className="hidden sm:inline">Center</span>
            </button>
            <button
              type="button"
              onClick={alignSelectedTop}
              title="Align selected items to top edge"
              className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-300 hover:text-white transition flex items-center gap-1 text-[15px] font-bold"
            >
              <Move size={20} className="rotate-90" />
              <span className="hidden sm:inline">Top</span>
            </button>
            {selectedIds.length >= 3 && (
              <button
                type="button"
                onClick={distributeSelectedHorizontally}
                title="Distribute items with equal horizontal spacing"
                className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-300 hover:text-white transition flex items-center gap-1 text-[15px] font-bold"
              >
                <AlignJustify size={20} />
                <span className="hidden sm:inline">Distribute</span>
              </button>
            )}
            <div className="w-[1px] h-6 bg-zinc-700 mx-1" />
            <button
              type="button"
              onClick={() => deleteSlots(selectedIds)}
              title="Delete all selected items (or press Delete key)"
              className="p-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white transition flex items-center gap-1 text-[15px] font-bold"
            >
              <Trash2 size={20} />
              <span>Delete</span>
            </button>
          </div>
        )}

        {/* Dynamic Snap Guidelines and Equal Spacing Badges */}
        {(activeGuides.length > 0 || activeDistanceGuides.length > 0) && (
          <svg
            viewBox="0 0 1920 1080"
            className="absolute inset-0 w-full h-full z-40 pointer-events-none overflow-visible"
          >
            {activeGuides.map((guide, idx) => (
              <g key={`snap-guide-${idx}`}>
                <line
                  x1={guide.orientation === 'vertical' ? guide.pos : guide.start}
                  y1={guide.orientation === 'vertical' ? guide.start : guide.pos}
                  x2={guide.orientation === 'vertical' ? guide.pos : guide.end}
                  y2={guide.orientation === 'vertical' ? guide.end : guide.pos}
                  stroke="#00E5FF"
                  strokeWidth={3}
                  strokeDasharray="8 6"
                  strokeLinecap="round"
                />
                {guide.orientation === 'vertical' ? (
                  <>
                    <line
                      x1={guide.pos - 8}
                      y1={guide.start}
                      x2={guide.pos + 8}
                      y2={guide.start}
                      stroke="#00E5FF"
                      strokeWidth={3}
                    />
                    <line
                      x1={guide.pos - 8}
                      y1={guide.end}
                      x2={guide.pos + 8}
                      y2={guide.end}
                      stroke="#00E5FF"
                      strokeWidth={3}
                    />
                  </>
                ) : (
                  <>
                    <line
                      x1={guide.start}
                      y1={guide.pos - 8}
                      x2={guide.start}
                      y2={guide.pos + 8}
                      stroke="#00E5FF"
                      strokeWidth={3}
                    />
                    <line
                      x1={guide.end}
                      y1={guide.pos - 8}
                      x2={guide.end}
                      y2={guide.pos + 8}
                      stroke="#00E5FF"
                      strokeWidth={3}
                    />
                  </>
                )}
              </g>
            ))}

            {activeDistanceGuides.map((dg, idx) => {
              const mid = (dg.start + dg.end) / 2;
              return (
                <g key={`dist-guide-${idx}`}>
                  <line
                    x1={dg.orientation === 'horizontal' ? dg.start : dg.crossPos}
                    y1={dg.orientation === 'horizontal' ? dg.crossPos : dg.start}
                    x2={dg.orientation === 'horizontal' ? dg.end : dg.crossPos}
                    y2={dg.orientation === 'horizontal' ? dg.crossPos : dg.end}
                    stroke="#10B981"
                    strokeWidth={2.5}
                  />
                  {dg.orientation === 'horizontal' ? (
                    <>
                      <line
                        x1={dg.start}
                        y1={dg.crossPos - 6}
                        x2={dg.start}
                        y2={dg.crossPos + 6}
                        stroke="#10B981"
                        strokeWidth={2.5}
                      />
                      <line
                        x1={dg.end}
                        y1={dg.crossPos - 6}
                        x2={dg.end}
                        y2={dg.crossPos + 6}
                        stroke="#10B981"
                        strokeWidth={2.5}
                      />
                      <rect
                        x={mid - 32}
                        y={dg.crossPos - 14}
                        width={64}
                        height={28}
                        rx={8}
                        fill="#064E3B"
                        stroke="#34D399"
                        strokeWidth={2}
                      />
                      <text
                        x={mid}
                        y={dg.crossPos + 5}
                        textAnchor="middle"
                        fontSize="14"
                        fontWeight="800"
                        fill="#ECFDF5"
                      >
                        {Math.round(dg.distance)}px
                      </text>
                    </>
                  ) : (
                    <>
                      <line
                        x1={dg.crossPos - 6}
                        y1={dg.start}
                        x2={dg.crossPos + 6}
                        y2={dg.start}
                        stroke="#10B981"
                        strokeWidth={2.5}
                      />
                      <line
                        x1={dg.crossPos - 6}
                        y1={dg.end}
                        x2={dg.crossPos + 6}
                        y2={dg.end}
                        stroke="#10B981"
                        strokeWidth={2.5}
                      />
                      <rect
                        x={dg.crossPos - 32}
                        y={mid - 14}
                        width={64}
                        height={28}
                        rx={8}
                        fill="#064E3B"
                        stroke="#34D399"
                        strokeWidth={2}
                      />
                      <text
                        x={dg.crossPos}
                        y={mid + 5}
                        textAnchor="middle"
                        fontSize="14"
                        fontWeight="800"
                        fill="#ECFDF5"
                      >
                        {Math.round(dg.distance)}px
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {/* Snapping / Freeform Indicator Pill */}
        {compDrag && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-zinc-950/90 backdrop-blur-md text-white text-[15px] font-bold shadow-2xl border border-zinc-700/80 flex items-center gap-2.5 pointer-events-none animate-fade-in">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isShiftHeld ? 'bg-amber-400' : 'bg-cyan-400 animate-pulse'
              }`}
            />
            <span>
              {isShiftHeld
                ? 'Freeform mode (Snapping disabled • Shift held)'
                : 'Smart Snapping active (Edges, Centers, Equal Spacing) • Hold Shift for freeform'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
