import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Database,
  Globe,
  HelpCircle,
  ImagePlus,
  Layers,
  Lightbulb,
  LucideIcon,
  Network,
  Scale,
  Search,
  Sparkles,
  Target,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import {
  DualCodeIconId,
  PhasePalette,
  SlideData,
  SlideMediaItem,
  SlideTextBlock,
} from '../../types/curriculum';
import { PHASE_PALETTES } from '../../data/palettes';
import { PaperCutRenderer } from './PaperCutRenderer';
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

interface SlideCanvasProps {
  slide: SlideData;
  isThumbnail?: boolean;
  hideWaveBackground?: boolean;
  starterRevealedCount?: number;
  editorPreviewAllAnswers?: boolean;
  interactiveTimer?: boolean;
  editable?: boolean;
  showWavePathEditor?: boolean;
  onUpdateSlide?: (patch: Partial<SlideData>) => void;
  onOpenMediaPicker?: () => void;
}

interface InlineEditableProps {
  value: string;
  editable?: boolean;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  renderPreview?: () => React.ReactNode;
  onCommit: (next: string) => void;
}

const InlineEditableText: React.FC<InlineEditableProps> = ({
  value,
  editable,
  multiline = false,
  placeholder = 'Click to edit...',
  className = '',
  style,
  renderPreview,
  onCommit,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (!editable) {
    return (
      <span className={className} style={style}>
        {value || placeholder}
      </span>
    );
  }

  if (editing) {
    const finish = () => {
      setEditing(false);
      if (draft !== value) {
        onCommit(draft);
      }
    };

    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          rows={Math.max(2, Math.min(8, draft.split('\n').length + 1))}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={finish}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(value);
              setEditing(false);
            }
          }}
          className={`${className} w-full bg-white/95 text-zinc-900 rounded-xl px-3 py-2 border-2 border-amber-500 shadow-lg outline-none resize-y`}
          style={{ ...style, color: '#18181B' }}
        />
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={draft}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            finish();
          } else if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={`${className} w-full bg-white/95 text-zinc-900 rounded-xl px-3 py-1 border-2 border-amber-500 shadow-lg outline-none`}
        style={{ ...style, color: '#18181B' }}
      />
    );
  }

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
      title="Click to edit text directly on slide"
      className={`${className} ${renderPreview ? 'block' : 'inline-block'} rounded-lg cursor-text transition-[outline] hover:outline-2 hover:outline-dashed hover:outline-amber-500/80 hover:bg-amber-50/15`}
      style={style}
    >
      {renderPreview ? (
        renderPreview()
      ) : value ? (
        value
      ) : (
        <span className="opacity-45 italic">{placeholder}</span>
      )}
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

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  isThumbnail = false,
  hideWaveBackground = false,
  starterRevealedCount = 0,
  editorPreviewAllAnswers = false,
  interactiveTimer = true,
  editable = false,
  showWavePathEditor = false,
  onUpdateSlide,
  onOpenMediaPicker,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgOverlayRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  const [draggingPts, setDraggingPts] = useState<Point[] | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const palette = PHASE_PALETTES[slide.phase];
  const invert = Boolean(slide.invertWaveLayers);
  const isStarter = slide.presetId === 'mwb-starter-quadrant';
  const isLeftSpine = slide.waveVariant === 'vertical-scurve-left';
  const isTitlePage = slide.presetId === 'lesson-title-page';

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

  const headerOnDark =
    !hideWaveBackground && isSlideRegionDark(slide.waveVariant, 'header', invert);
  const topOnDark =
    !hideWaveBackground && isSlideRegionDark(slide.waveVariant, 'top', invert);
  const bottomOnDark =
    !hideWaveBackground && isSlideRegionDark(slide.waveVariant, 'bottom', invert);
  const cornerOnDark =
    !hideWaveBackground &&
    isSlideRegionDark(slide.waveVariant, 'bottom-right-corner', invert);

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

  // Drag handler for SVG wave path control points
  useEffect(() => {
    if (dragIdx === null) return;
    const onMove = (e: PointerEvent) => {
      const svg = svgOverlayRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const canvasX = Math.max(
        15,
        Math.min(1905, ((e.clientX - rect.left) / rect.width) * 1920)
      );
      const canvasY = Math.max(
        15,
        Math.min(1065, ((e.clientY - rect.top) / rect.height) * 1080)
      );
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

  const renderBulletOrProse = (
    text: string,
    textColor: string,
    fontSizeClass = 'text-[31px]',
    onDark = false,
    onCommit?: (next: string) => void
  ) => {
    const renderFormatted = () => {
      const lines = text
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length <= 1 && !lines[0]?.startsWith('•') && !lines[0]?.startsWith('-')) {
        return (
          <p
            className={`${fontSizeClass} leading-[1.42] font-medium`}
            style={{ color: textColor }}
          >
            {text}
          </p>
        );
      }

      return (
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
                <span
                  className={`${fontSizeClass} leading-[1.4] font-medium`}
                  style={{ color: textColor }}
                >
                  {clean}
                </span>
              </li>
            );
          })}
        </ul>
      );
    };

    if (editable && onCommit && !isThumbnail) {
      return (
        <InlineEditableText
          value={text}
          editable={editable}
          multiline
          renderPreview={renderFormatted}
          onCommit={onCommit}
        />
      );
    }

    return renderFormatted();
  };

  const renderMediaFrame = (
    media?: SlideMediaItem,
    sizeClass = 'w-full h-full',
    requiredSlotLabel?: string,
    slotOnDark = bottomOnDark
  ) => {
    const canPick = Boolean(editable && onOpenMediaPicker && !isThumbnail);

    if (!media || media.placement === 'fill-bottom-layer') {
      if (!requiredSlotLabel) return null;

      return (
        <button
          type="button"
          disabled={!canPick}
          onClick={(e) => {
            e.stopPropagation();
            if (canPick) onOpenMediaPicker?.();
          }}
          className={`${sizeClass} rounded-3xl border-4 border-dashed flex flex-col items-center justify-center p-10 text-center transition ${
            hideWaveBackground
              ? 'border-slate-300 bg-slate-100/90 text-slate-600'
              : slotOnDark
              ? canPick
                ? 'cursor-pointer border-white/70 bg-white/18 hover:bg-white/28 text-white shadow-2xl backdrop-blur-xs'
                : 'cursor-default border-white/35 bg-white/10 text-white/80'
              : canPick
              ? 'cursor-pointer border-zinc-400/70 bg-white/80 hover:bg-white text-zinc-700 shadow-lg'
              : 'cursor-default border-zinc-300 bg-white/60 text-zinc-600'
          }`}
        >
          <div
            className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-5 shadow-md ${
              slotOnDark && !hideWaveBackground ? 'bg-white/20' : 'bg-slate-200/80 text-slate-700'
            }`}
          >
            <ImagePlus size={48} />
          </div>
          <p className="text-[34px] font-extrabold leading-tight">
            {requiredSlotLabel}
          </p>
          {canPick && (
            <p className="mt-3 text-[24px] font-medium opacity-90 max-w-md">
              Click to search Pexels, Pixabay, Wikimedia Commons, or pick a curriculum SVG diagram
            </p>
          )}
        </button>
      );
    }

    return (
      <div
        onClick={(e) => {
          if (canPick) {
            e.stopPropagation();
            onOpenMediaPicker?.();
          }
        }}
        title={canPick ? 'Click to change visual or SVG diagram' : undefined}
        className={`relative rounded-3xl overflow-hidden shadow-2xl bg-white border-4 border-white/90 flex flex-col group ${sizeClass} ${
          canPick ? 'cursor-pointer hover:ring-4 hover:ring-amber-400 transition' : ''
        }`}
      >
        {media.type === 'svg-diagram' && media.svgCode ? (
          <div
            className="flex-1 flex items-center justify-center p-6 bg-white overflow-hidden"
            dangerouslySetInnerHTML={{ __html: media.svgCode }}
          />
        ) : (
          <img
            src={media.url || ''}
            alt={media.title}
            className={`flex-1 w-full h-full min-h-0 ${
              media.cropFit === 'contain' ? 'object-contain bg-white' : 'object-cover'
            }`}
          />
        )}
        <div className="px-5 py-3 bg-white/95 border-t border-zinc-200 flex items-center justify-between text-[20px] text-zinc-700 font-semibold shrink-0">
          <span className="truncate">{media.title}</span>
          <span className="text-[17px] text-zinc-400 shrink-0 ml-3">
            {canPick ? 'Click to change' : media.attribution}
          </span>
        </div>
      </div>
    );
  };

  const renderCard = (b: SlideTextBlock, index: number, isTimeline = false) => {
    const onDark = b.layer === 'bottom' ? bottomOnDark : topOnDark;
    const textColor = onDark ? '#FFFFFF' : neutralDark;
    const headingColor = onDark ? '#FFFFFF' : neutralAccent;

    return (
      <div
        key={b.id}
        className={`rounded-3xl p-8 transition-all ${
          onDark
            ? 'bg-white/14 backdrop-blur-md border-2 border-white/30 shadow-xl'
            : hideWaveBackground
            ? 'bg-white border-2 border-slate-300 shadow-xs'
            : 'bg-white/92 backdrop-blur-xs border-2 shadow-lg'
        } ${b.style === 'highlight' ? 'border-l-[10px]' : ''}`}
        style={{
          borderColor: onDark ? 'rgba(255,255,255,0.28)' : neutralBorder,
          borderLeftColor:
            b.style === 'highlight'
              ? onDark
                ? '#FFFFFF'
                : neutralAccent
              : undefined,
        }}
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {isTimeline && (
              <span
                className="w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-[27px] shrink-0"
                style={{
                  backgroundColor: onDark ? '#FFFFFF' : neutralAccent,
                  color: onDark ? palette.layers[3] : '#FFFFFF',
                }}
              >
                {index + 1}
              </span>
            )}
            <DualCodeBadgeControl
              iconId={b.dualCodeIcon}
              accentColor={neutralAccent}
              onDarkSurface={onDark}
              editable={editable && !isThumbnail}
              onChangeIcon={(nextIcon) =>
                updateBlock(b.id, { dualCodeIcon: nextIcon })
              }
            />
            {b.heading ? (
              <h3
                className="text-[35px] font-extrabold leading-tight flex-1"
                style={{ color: headingColor }}
              >
                <InlineEditableText
                  value={b.heading}
                  editable={editable && !isThumbnail}
                  onCommit={(next) => updateBlock(b.id, { heading: next })}
                />
              </h3>
            ) : editable && !isThumbnail ? (
              <h3
                className="text-[30px] font-bold leading-tight opacity-60"
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
        </div>

        {renderBulletOrProse(
          b.content,
          textColor,
          'text-[30px]',
          onDark,
          (next) => updateBlock(b.id, { content: next })
        )}
      </div>
    );
  };

  const renderHeader = () => {
    return (
      <div
        className={`relative z-20 flex items-start justify-between px-20 pt-9 ${
          isLeftSpine ? 'pl-[470px]' : ''
        }`}
      >
        <div className="max-w-[1220px]">
          <h1
            className={`font-extrabold tracking-tight leading-[1.08] ${
              isStarter ? 'text-[50px]' : 'text-[60px]'
            }`}
            style={{ color: headerOnDark ? '#FFFFFF' : neutralDark }}
          >
            <InlineEditableText
              value={slide.title}
              editable={editable && !isThumbnail}
              onCommit={(next) => onUpdateSlide?.({ title: next })}
            />
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-6">
          {slide.timerSeconds && slide.timerSeconds > 0 && (
            <SlideTimerWidget
              initialSeconds={slide.timerSeconds}
              accentColor={neutralAccent}
              interactive={interactiveTimer && !isThumbnail}
            />
          )}
        </div>
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
      !hideWaveBackground && Boolean(effectiveMedia) && effectiveMedia?.placement === 'fill-bottom-layer';

    return (
      <div className="relative z-20 h-full flex flex-row items-stretch px-20 py-14 gap-12">
        {/* Left Top Sheet: Date, Huge Topic Title, Hook / Big Question, Key Terms */}
        <div
          className={`flex-1 flex flex-col justify-between py-2 ${
            isLeftSpine ? 'pl-[380px]' : ''
          }`}
        >
          <div className="space-y-7 max-w-[840px]">
            <div
              className={`inline-flex items-center gap-3 px-6 py-2.5 rounded-full text-[27px] font-bold border-2 shadow-sm ${
                topOnDark ? 'bg-white/15 text-white border-white/30' : 'bg-white'
              }`}
              style={
                topOnDark
                  ? undefined
                  : { borderColor: neutralBorder, color: neutralAccent }
              }
            >
              <Clock size={26} />
              <InlineEditableText
                value={dateValue}
                editable={editable && !isThumbnail}
                onCommit={(next) => onUpdateSlide?.({ lessonDate: next })}
              />
            </div>

            <h1
              className="text-[74px] font-extrabold leading-[1.05] tracking-tight"
              style={{ color: topOnDark ? '#FFFFFF' : neutralDark }}
            >
              <InlineEditableText
                value={slide.title}
                editable={editable && !isThumbnail}
                onCommit={(next) => onUpdateSlide?.({ title: next })}
              />
            </h1>

            {(slide.bigQuestion || (editable && !isThumbnail)) && (
              <div
                className={`p-8 rounded-3xl border-l-[12px] shadow-lg ${
                  topOnDark
                    ? 'bg-white/14 backdrop-blur-md border-y border-r border-white/25'
                    : hideWaveBackground
                    ? 'bg-white border-y border-r border-slate-200'
                    : 'bg-white/95'
                }`}
                style={{ borderLeftColor: topOnDark ? '#FFFFFF' : neutralAccent }}
              >
                <div
                  className="text-[22px] font-extrabold uppercase tracking-wider mb-2"
                  style={{ color: topOnDark ? '#FFFFFF' : neutralAccent }}
                >
                  Today&apos;s Enquiry
                </div>
                <p
                  className="text-[36px] font-bold leading-snug"
                  style={{ color: topOnDark ? '#FFFFFF' : neutralDark }}
                >
                  <InlineEditableText
                    value={slide.bigQuestion || ''}
                    placeholder="Add lesson hook / enquiry question..."
                    editable={editable && !isThumbnail}
                    multiline
                    onCommit={(next) => onUpdateSlide?.({ bigQuestion: next })}
                  />
                </p>
              </div>
            )}
          </div>

          {slide.keyTermsStrip && slide.keyTermsStrip.length > 0 && (
            <div className="flex flex-wrap gap-3.5 max-w-[840px]">
              {slide.keyTermsStrip.map((kt, i) => (
                <div
                  key={i}
                  className={`px-6 py-3 rounded-2xl border-2 shadow-sm text-[25px] ${
                    topOnDark
                      ? 'bg-white/16 border-white/30 text-white'
                      : 'bg-white/95'
                  }`}
                  style={topOnDark ? undefined : { borderColor: neutralBorder }}
                >
                  <span
                    className="font-extrabold"
                    style={{ color: topOnDark ? '#FFFFFF' : neutralAccent }}
                  >
                    {kt.term}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Cover Area: Cropped inside bottom coloured wave by default; clickable to change image */}
        <div className="w-[770px] shrink-0 flex items-center justify-center py-4">
          {isCoverFilledInWave ? (
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
          ) : effectiveMedia && !hideWaveBackground && effectiveMedia.placement === 'boxed-card' ? (
            renderMediaFrame(
              effectiveMedia,
              'w-full h-[820px]',
              'Lesson Cover Visual',
              bottomOnDark
            )
          ) : (
            renderMediaFrame(
              undefined,
              'w-full h-[820px]',
              'Lesson Cover Visual',
              bottomOnDark
            )
          )}
        </div>
      </div>
    );
  };

  const renderPresetContent = (p: PhasePalette) => {
    if (isTitlePage) {
      return renderLessonTitlePage(p);
    }

    if (slide.presetId === 'custom' && slide.customCanvasElements) {
      return (
        <div className="relative z-20 flex-1">
          {slide.customCanvasElements.map((el) => {
            const onDark = el.layer === 'bottom' ? bottomOnDark : topOnDark;
            return (
              <div
                key={el.id}
                className="absolute rounded-3xl p-6 shadow-md"
                style={{
                  left: `${el.x}%`,
                  top: `${el.y}%`,
                  width: `${el.w}%`,
                  height: `${el.h}%`,
                  backgroundColor:
                    hideWaveBackground
                      ? '#FFFFFF'
                      : el.tone === 'tinted'
                      ? p.softSurface
                      : el.tone === 'dark' || onDark
                      ? 'rgba(255,255,255,0.16)'
                      : 'rgba(255,255,255,0.92)',
                  color: onDark ? '#FFFFFF' : neutralDark,
                  border: `2px solid ${
                    onDark ? 'rgba(255,255,255,0.28)' : neutralBorder
                  }`,
                }}
              >
                {el.heading && (
                  <h4
                    className="text-[32px] font-extrabold mb-2.5"
                    style={{ color: onDark ? '#FFFFFF' : neutralAccent }}
                  >
                    <InlineEditableText
                      value={el.heading}
                      editable={editable && !isThumbnail}
                      onCommit={(next) =>
                        onUpdateSlide?.({
                          customCanvasElements: slide.customCanvasElements?.map((c) =>
                            c.id === el.id ? { ...c, heading: next } : c
                          ),
                        })
                      }
                    />
                  </h4>
                )}
                {el.content && (
                  <p className="text-[28px] leading-snug font-medium">
                    <InlineEditableText
                      value={el.content}
                      editable={editable && !isThumbnail}
                      multiline
                      onCommit={(next) =>
                        onUpdateSlide?.({
                          customCanvasElements: slide.customCanvasElements?.map((c) =>
                            c.id === el.id ? { ...c, content: next } : c
                          ),
                        })
                      }
                    />
                  </p>
                )}
                {el.svgCode && (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: el.svgCode }}
                  />
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (slide.presetId === 'mwb-starter-quadrant') {
      const quads = slide.starterQuadrants || [];
      return (
        <div className="relative z-20 flex-1 flex flex-col px-20 pt-16 pb-20 min-h-0">
          <div className="grid grid-cols-2 grid-rows-2 gap-6 flex-1 min-h-0">
            {quads.slice(0, 4).map((q, idx) => {
              const revealed = editorPreviewAllAnswers || idx < starterRevealedCount;
              const hasMcOptions = Boolean(q.options && q.options.length > 0);
              return (
                <div
                  key={q.id}
                  className={`rounded-3xl border-2 px-8 py-6 shadow-md flex flex-col justify-between min-h-0 overflow-hidden ${
                    topOnDark
                      ? 'bg-white/14 backdrop-blur-md border-white/30'
                      : 'bg-white/95'
                  }`}
                  style={topOnDark ? undefined : { borderColor: neutralBorder }}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className="w-13 h-13 rounded-2xl flex items-center justify-center font-extrabold text-[31px] shrink-0"
                      style={{
                        backgroundColor: topOnDark ? '#FFFFFF' : neutralAccent,
                        color: topOnDark ? palette.layers[3] : '#FFFFFF',
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[35px] font-bold leading-[1.24]"
                        style={{ color: topOnDark ? '#FFFFFF' : neutralDark }}
                      >
                        <InlineEditableText
                          value={q.question}
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

                  {hasMcOptions ? (
                    <div className="grid grid-cols-2 gap-4 pl-[68px] mt-3 flex-1 items-center">
                      {q.options!.slice(0, 4).map((opt, oi) => {
                        const letter = String.fromCharCode(65 + oi);
                        const cleanOptText = opt.replace(/^[A-D][\s.):\-]+/i, '');
                        const isCorrect = isMcOptionCorrect(opt, oi, q.answer);

                        let pillClass = topOnDark
                          ? 'bg-white/14 border-white/30 text-white'
                          : 'bg-[#FAF6F0] border-zinc-200 text-zinc-900';
                        let badgeClass = '';
                        let badgeStyle: React.CSSProperties = {
                          color: topOnDark ? '#FFFFFF' : neutralAccent,
                        };

                        if (revealed) {
                          if (isCorrect) {
                            pillClass =
                              'bg-emerald-600 border-emerald-700 text-white shadow-lg ring-4 ring-emerald-400/25';
                            badgeClass = 'bg-white/20 text-white px-2 py-0.5 rounded-lg';
                            badgeStyle = { color: '#FFFFFF' };
                          } else {
                            pillClass = topOnDark
                              ? 'bg-white/5 border-white/10 text-white/35 opacity-45'
                              : 'bg-zinc-100/80 border-zinc-200/70 text-zinc-400 opacity-50';
                            badgeStyle = {
                              color: topOnDark ? 'rgba(255,255,255,0.4)' : '#94A3B8',
                            };
                          }
                        }

                        return (
                          <div
                            key={oi}
                            className={`rounded-2xl px-5 py-4 border-2 text-[28px] font-bold leading-snug flex items-center gap-3 transition-all ${pillClass}`}
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
                                editable && !isThumbnail ? 'cursor-pointer hover:underline' : 'cursor-default'
                              }`}
                              style={badgeStyle}
                            >
                              {letter}.
                            </button>
                            <span className="flex-1 min-w-0">
                              <InlineEditableText
                                value={cleanOptText}
                                editable={editable && !isThumbnail}
                                onCommit={(next) => {
                                  const updated = q.options!.map((o, k) =>
                                    k === oi ? `${letter}. ${next}` : o
                                  );
                                  onUpdateSlide?.({
                                    starterQuadrants: quads.map((item) =>
                                      item.id === q.id
                                        ? {
                                            ...item,
                                            options: updated as [
                                              string,
                                              string,
                                              string,
                                              string,
                                            ],
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
                              <Check size={28} strokeWidth={3} className="shrink-0 text-white" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Open-question fallback reveal strip */
                    <div
                      className={`h-[76px] rounded-2xl px-6 mt-3 flex items-center transition-all shrink-0 ${
                        revealed
                          ? 'bg-emerald-600 text-white border-2 border-emerald-700 shadow-md'
                          : 'border-2 border-dashed border-zinc-300/70 bg-zinc-50/40'
                      }`}
                    >
                      {revealed ? (
                        <p className="text-[32px] font-extrabold leading-tight truncate w-full text-white">
                          <InlineEditableText
                            value={q.answer}
                            editable={editable && !isThumbnail}
                            onCommit={(next) =>
                              onUpdateSlide?.({
                                starterQuadrants: quads.map((item) =>
                                  item.id === q.id ? { ...item, answer: next } : item
                                ),
                              })
                            }
                          />
                        </p>
                      ) : (
                        <span className="sr-only">Open answer space</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (slide.presetId === 'title-divider') {
      return (
        <div className="relative z-20 flex-1 flex flex-col justify-between px-20 pb-20 pt-10">
          <div className="max-w-[980px] space-y-8">
            <h1
              className="text-[74px] font-extrabold leading-[1.06] tracking-tight"
              style={{ color: topOnDark ? '#FFFFFF' : neutralDark }}
            >
              <InlineEditableText
                value={slide.title}
                editable={editable && !isThumbnail}
                onCommit={(next) => onUpdateSlide?.({ title: next })}
              />
            </h1>

            {(slide.bigQuestion || (editable && !isThumbnail)) && (
              <div
                className={`p-8 rounded-3xl border-l-[12px] shadow-md ${
                  topOnDark
                    ? 'bg-white/14 backdrop-blur-md border-y border-r border-white/25'
                    : 'bg-white/92'
                }`}
                style={{ borderLeftColor: topOnDark ? '#FFFFFF' : neutralAccent }}
              >
                <p
                  className="text-[42px] font-bold leading-snug"
                  style={{ color: topOnDark ? '#FFFFFF' : neutralDark }}
                >
                  <InlineEditableText
                    value={slide.bigQuestion || ''}
                    placeholder="Add big question..."
                    editable={editable && !isThumbnail}
                    multiline
                    onCommit={(next) => onUpdateSlide?.({ bigQuestion: next })}
                  />
                </p>
              </div>
            )}
          </div>

          {slide.keyTermsStrip && slide.keyTermsStrip.length > 0 && (
            <div className="grid grid-cols-3 gap-6 max-w-[1520px]">
              {slide.keyTermsStrip.map((kt, i) => (
                <div
                  key={i}
                  className={`rounded-3xl border-2 p-6 shadow-md ${
                    topOnDark ? 'bg-white/15 border-white/30' : 'bg-white/95'
                  }`}
                  style={topOnDark ? undefined : { borderColor: neutralBorder }}
                >
                  <div
                    className="text-[31px] font-extrabold mb-1.5"
                    style={{ color: topOnDark ? '#FFFFFF' : neutralAccent }}
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
                      color: topOnDark ? 'rgba(255,255,255,0.88)' : p.mutedInk,
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
                </div>
              ))}
            </div>
          )}
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
          } gap-8 px-20 py-10 min-h-0`}
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
        <div className="relative z-20 flex-1 flex flex-col justify-center px-20 py-8 gap-8 min-h-0">
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

    const topBlocks = slide.bodyBlocks.filter((b) => b.layer !== 'bottom');
    const bottomBlocks = slide.bodyBlocks.filter((b) => b.layer === 'bottom');
    const isDualCodingLayout =
      slide.presetId === 'split-concept-dual-code' ||
      slide.presetId === 'worked-example-steps';
    const hasBoxedMedia =
      Boolean(effectiveMedia) && effectiveMedia?.placement !== 'fill-bottom-layer';
    const showRightColumn =
      bottomBlocks.length > 0 || hasBoxedMedia || hasFullBottomImage || isDualCodingLayout;

    return (
      <div
        className={`relative z-20 flex-1 flex gap-10 px-20 py-8 min-h-0 ${
          isLeftSpine ? 'pl-[470px]' : ''
        }`}
      >
        {/* Left Top-Sheet Zone */}
        <div
          className={`flex flex-col justify-center gap-6 ${
            showRightColumn ? 'w-[840px] shrink-0' : 'flex-1 max-w-[1160px]'
          }`}
        >
          {topBlocks.map((b, i) => renderCard(b, i))}
        </div>

        {/* Right Zone: Designated Dual-Coding Visual Area or Bottom-Layer Cards */}
        {showRightColumn && (
          <div className="flex-1 flex flex-col justify-center gap-6 min-w-0">
            {bottomBlocks.map((b, i) => renderCard(b, i))}

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

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video overflow-hidden select-none shadow-md"
      style={{
        backgroundColor: hideWaveBackground ? '#F4F4F5' : palette.layers[3],
      }}
    >
      {/* Scaled 1920x1080 Fixed Coordinate Slide Canvas */}
      <div
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

        {slide.presetId !== 'title-divider' && !isTitlePage && renderHeader()}

        {renderPresetContent(palette)}

        {/* Monochrome Corner Routine Icons (cleanly pinned in bottom-right corner, never inside text cards) */}
        {!isTitlePage && slide.routineIcons && slide.routineIcons.length > 0 && (
          <div className="absolute bottom-7 right-12 z-30 flex items-center gap-2.5 pointer-events-none">
            {slide.routineIcons.slice(0, 3).map((ri) => (
              <RoutineBadgeIcon
                key={ri}
                type={ri}
                monochromeCorner
                onDark={cornerOnDark}
              />
            ))}
          </div>
        )}

        {/* Interactive Wave Path & Draggable Control Points Overlay */}
        {showWavePathEditor &&
          !hideWaveBackground &&
          !isThumbnail &&
          computedPaper.controlPoints.length > 0 && (
            <svg
              ref={svgOverlayRef}
              viewBox="0 0 1920 1080"
              className="absolute inset-0 w-full h-full z-40 pointer-events-auto"
            >
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
              {computedPaper.controlPoints.map((pt, idx) => (
                <g
                  key={idx}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setDraggingPts(computedPaper.controlPoints);
                    setDragIdx(idx);
                  }}
                  style={{ cursor: 'grab' }}
                >
                  <circle cx={pt.x} cy={pt.y} r={30} fill="transparent" />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={16}
                    fill={dragIdx === idx ? '#D97706' : '#FFFFFF'}
                    stroke="#D97706"
                    strokeWidth={6}
                  />
                  <text
                    x={pt.x}
                    y={pt.y + 7}
                    textAnchor="middle"
                    fontSize="16"
                    fontWeight="800"
                    fill={dragIdx === idx ? '#FFFFFF' : '#92400E'}
                    pointerEvents="none"
                  >
                    {idx + 1}
                  </text>
                </g>
              ))}
            </svg>
          )}
      </div>
    </div>
  );
};
