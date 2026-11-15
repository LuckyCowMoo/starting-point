import React, { useId } from 'react';
import { PhasePalette, SlideMediaItem } from '../../types/curriculum';
import { Point, smoothSplineSegment } from './paperCutPresets';
import { ImagePlus, ClipboardPaste, Sparkles } from 'lucide-react';

export function getDefaultSideImageControlPoints(
  side: 'left' | 'right',
  widthPercent = 38
): Point[] {
  if (side === 'right') {
    const bx = Math.round(1920 * (1 - widthPercent / 100)); // e.g. 1190
    return [
      { x: bx + 10, y: -40 },
      { x: bx - 45, y: 260 },
      { x: bx + 35, y: 540 },
      { x: bx - 35, y: 820 },
      { x: bx + 15, y: 1120 },
    ];
  } else {
    const bx = Math.round(1920 * (widthPercent / 100)); // e.g. 730
    return [
      { x: bx - 10, y: -40 },
      { x: bx + 45, y: 260 },
      { x: bx - 35, y: 540 },
      { x: bx + 35, y: 820 },
      { x: bx - 15, y: 1120 },
    ];
  }
}

export interface SideImageWaveGeometry {
  mainClipPath: string;
  mainSpline: string;
  layer1Path: string;
  layer2Path: string;
  layer3Path: string;
  layer1Spline: string;
  layer2Spline: string;
  layer3Spline: string;
  layer1Pts: Point[];
  layer2Pts: Point[];
  layer3Pts: Point[];
}

export function computeSideImageWaveGeometry(
  side: 'left' | 'right',
  controlPoints: Point[]
): SideImageWaveGeometry {
  const isRight = side === 'right';
  const sign = isRight ? -1 : 1;
  const farX = isRight ? 1940 : -20;

  // Layer 3 (outermost contour stepping towards slide content, closest to page background)
  const layer3Pts = controlPoints.map((p) => ({
    x: Math.round(p.x + sign * 76),
    y: Math.round(p.y + 18),
  }));

  // Layer 2 (middle contour)
  const layer2Pts = controlPoints.map((p) => ({
    x: Math.round(p.x + sign * 48),
    y: Math.round(p.y - 14),
  }));

  // Layer 1 (sub-image continuation stepping slightly outward)
  const layer1Pts = controlPoints.map((p) => ({
    x: Math.round(p.x + sign * 22),
    y: Math.round(p.y + 10),
  }));

  const mainSpline = smoothSplineSegment(controlPoints);
  const layer1Spline = smoothSplineSegment(layer1Pts);
  const layer2Spline = smoothSplineSegment(layer2Pts);
  const layer3Spline = smoothSplineSegment(layer3Pts);

  const mainClipPath = `${mainSpline} L ${farX} 1120 L ${farX} -40 Z`;
  const layer1Path = `${layer1Spline} L ${farX} 1120 L ${farX} -40 Z`;
  const layer2Path = `${layer2Spline} L ${farX} 1120 L ${farX} -40 Z`;
  const layer3Path = `${layer3Spline} L ${farX} 1120 L ${farX} -40 Z`;

  return {
    mainClipPath,
    mainSpline,
    layer1Path,
    layer2Path,
    layer3Path,
    layer1Spline,
    layer2Spline,
    layer3Spline,
    layer1Pts,
    layer2Pts,
    layer3Pts,
  };
}

interface SideAnchoredImageWaveProps {
  side: 'left' | 'right';
  widthPercent?: number;
  controlPoints?: Point[];
  mediaItem?: SlideMediaItem;
  palette: PhasePalette;
  invert?: boolean;
  editable?: boolean;
  isThumbnail?: boolean;
  onOpenMediaPicker?: (targetId: string) => void;
  hoveredTarget?: string | null;
  onHoverTarget?: (targetId: string | null) => void;
}

export const SideAnchoredImageWave: React.FC<SideAnchoredImageWaveProps> = ({
  side,
  widthPercent = 38,
  controlPoints,
  mediaItem,
  palette,
  invert = false,
  editable = false,
  isThumbnail = false,
  onOpenMediaPicker,
  hoveredTarget,
  onHoverTarget,
}) => {
  const uid = useId().replace(/:/g, '');
  const pts = controlPoints && controlPoints.length >= 3
    ? controlPoints
    : getDefaultSideImageControlPoints(side, widthPercent);

  const geom = computeSideImageWaveGeometry(side, pts);
  const isRight = side === 'right';
  const shadowDir = isRight ? -1 : 1;

  // Compute image bounding box cropped to the visible area inside the wave
  // rather than the whole 1920x1080 canvas
  const minPtsX = Math.min(...pts.map((p) => p.x));
  const maxPtsX = Math.max(...pts.map((p) => p.x));
  const minL1X = Math.min(...geom.layer1Pts.map((p) => p.x));
  const maxL1X = Math.max(...geom.layer1Pts.map((p) => p.x));

  // Small padding (25px) ensures spline overshoot is fully covered with image
  const mainImgX = isRight ? Math.max(0, Math.floor(minPtsX - 25)) : 0;
  const mainImgW = isRight ? 1920 - mainImgX : Math.min(1920, Math.ceil(maxPtsX + 25));

  const l1ImgX = isRight ? Math.max(0, Math.floor(minL1X - 25)) : 0;
  const l1ImgW = isRight ? 1920 - l1ImgX : Math.min(1920, Math.ceil(maxL1X + 25));

  // Background page colour blending targets:
  // Default creamy surface is #FAF6F0. If inverted, the page may be dark category layers.
  const pageBgColor = invert ? palette.layers[3] : '#FAF6F0';
  const categoryTone = palette.layers[1] || palette.accent;
  const softSurface = palette.softSurface || '#F4EFE6';

  const hasImage = Boolean(mediaItem && (mediaItem.url || mediaItem.svgCode));
  const canInteract = editable && !isThumbnail;
  const slotId = 'slot-anchored-side-image';

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden select-none">
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full overflow-hidden"
      >
        <defs>
          {/* Main Photo Clip Path */}
          <clipPath id={`side-img-clip-${uid}`}>
            <path d={geom.mainClipPath} />
          </clipPath>

          {/* Layer 1 Continuation Clip Path */}
          <clipPath id={`side-layer1-clip-${uid}`}>
            <path d={geom.layer1Path} />
          </clipPath>

          {/* 3D Paper-Cut Drop Shadows */}
          <filter
            id={`side-shadow-3-${uid}`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feDropShadow
              dx={shadowDir * 12}
              dy={5}
              stdDeviation={16}
              floodColor="#09090B"
              floodOpacity="0.20"
            />
          </filter>

          <filter
            id={`side-shadow-2-${uid}`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feDropShadow
              dx={shadowDir * 10}
              dy={4}
              stdDeviation={13}
              floodColor="#09090B"
              floodOpacity="0.22"
            />
          </filter>

          <filter
            id={`side-shadow-1-${uid}`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feDropShadow
              dx={shadowDir * 8}
              dy={4}
              stdDeviation={11}
              floodColor="#09090B"
              floodOpacity="0.25"
            />
          </filter>

          <filter
            id={`side-shadow-0-${uid}`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feDropShadow
              dx={shadowDir * 9}
              dy={5}
              stdDeviation={15}
              floodColor="#09090B"
              floodOpacity="0.30"
            />
          </filter>
        </defs>

        {/* ============================================================== */}
        {/* Layer 3: Outermost contour blending into page background       */}
        {/* ============================================================== */}
        <g filter={`url(#side-shadow-3-${uid})`}>
          <path
            d={geom.layer3Path}
            fill={pageBgColor}
            fillOpacity={0.96}
          />
          <path
            d={geom.layer3Spline}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity={0.4}
            strokeWidth={2}
          />
        </g>

        {/* ============================================================== */}
        {/* Layer 2: Middle contour with subtle category/soft tint         */}
        {/* ============================================================== */}
        <g filter={`url(#side-shadow-2-${uid})`}>
          <path
            d={geom.layer2Path}
            fill={softSurface}
            fillOpacity={0.88}
          />
          <path
            d={geom.layer2Path}
            fill={categoryTone}
            fillOpacity={0.16}
          />
          <path
            d={geom.layer2Spline}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity={0.45}
            strokeWidth={2.2}
          />
        </g>

        {/* ============================================================== */}
        {/* Layer 1: Sub-image wave continuation stepping toward content   */}
        {/* ============================================================== */}
        <g filter={`url(#side-shadow-1-${uid})`}>
          {hasImage && mediaItem?.url ? (
            <g clipPath={`url(#side-layer1-clip-${uid})`}>
              {/* Shifted continuation of the image */}
              <image
                href={mediaItem.url}
                x={l1ImgX}
                y={10}
                width={l1ImgW}
                height={1080}
                preserveAspectRatio="xMidYMid slice"
                opacity={0.7}
              />
              {/* Tint overlay blending closer to page color */}
              <rect
                x={l1ImgX}
                y={0}
                width={l1ImgW}
                height={1080}
                fill={softSurface}
                opacity={0.45}
              />
              <rect
                x={l1ImgX}
                y={0}
                width={l1ImgW}
                height={1080}
                fill={categoryTone}
                opacity={0.18}
              />
            </g>
          ) : (
            <path
              d={geom.layer1Path}
              fill={softSurface}
              fillOpacity={0.95}
            />
          )}
          <path
            d={geom.layer1Spline}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity={0.5}
            strokeWidth={2.5}
          />
        </g>

        {/* ============================================================== */}
        {/* Layer 0: Main Crisp Image with 3D drop shadow onto layers      */}
        {/* ============================================================== */}
        <g filter={`url(#side-shadow-0-${uid})`}>
          {hasImage && mediaItem?.url ? (
            <g clipPath={`url(#side-img-clip-${uid})`}>
              <image
                href={mediaItem.url}
                x={mainImgX}
                y={0}
                width={mainImgW}
                height={1080}
                preserveAspectRatio="xMidYMid slice"
              />
            </g>
          ) : hasImage && mediaItem?.type === 'svg-diagram' && mediaItem.svgCode ? (
            <g clipPath={`url(#side-img-clip-${uid})`}>
              <foreignObject x={mainImgX} y={0} width={mainImgW} height={1080}>
                <div
                  className="w-full h-full bg-white flex items-center justify-center p-8"
                  dangerouslySetInnerHTML={{ __html: mediaItem.svgCode }}
                />
              </foreignObject>
            </g>
          ) : (
            <path
              d={geom.mainClipPath}
              fill={categoryTone}
              fillOpacity={0.3}
            />
          )}

          {/* Crisp highlight edge running down the main cut line */}
          <path
            d={geom.mainSpline}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity={0.65}
            strokeWidth={3}
          />
        </g>
      </svg>

      {/* Interactive Overlay & Clipboard Paste / Change Visual Trigger */}
      {canInteract && (
        <div
          data-slot-id={slotId}
          onMouseEnter={() => onHoverTarget?.(slotId)}
          onMouseLeave={() => onHoverTarget?.(null)}
          onClick={(e) => {
            e.stopPropagation();
            onOpenMediaPicker?.(slotId);
          }}
          className={`group pointer-events-auto absolute top-0 bottom-0 ${
            isRight ? 'right-0' : 'left-0'
          } flex flex-col items-center justify-center cursor-pointer transition`}
          style={{
            width: `${widthPercent}%`,
          }}
          title={
            hasImage
              ? 'Click to change side visual or press Ctrl+V to paste new image'
              : 'Click or press Ctrl+V to add anchored side image'
          }
        >
          {/* Change/Paste Floating Pill */}
          <div
            className={`absolute top-5 ${
              isRight ? 'right-6' : 'left-6'
            } bg-zinc-900/90 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xl border border-white/20 transition z-30 ${
              hasImage
                ? 'opacity-0 group-hover:opacity-100 pointer-events-none'
                : 'opacity-100'
            }`}
          >
            <ClipboardPaste size={14} className="text-emerald-400" />
            <span>{hasImage ? 'Ctrl+V to replace' : 'Ctrl+V to paste side image'}</span>
          </div>

          {!hasImage && (
            <div className="flex flex-col items-center justify-center text-center p-8 rounded-3xl bg-white/75 backdrop-blur-xs border-2 border-dashed border-zinc-400 shadow-xl max-w-sm mx-auto group-hover:border-emerald-600 group-hover:bg-white transition">
              <div className="w-20 h-20 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4 shadow-sm border border-emerald-200">
                <ImagePlus size={40} />
              </div>
              <p className="text-[26px] font-extrabold text-zinc-800 leading-tight">
                Anchored Side Visual
              </p>
              <p className="mt-2 text-[18px] font-medium text-zinc-600">
                Click to pick or press Ctrl+V to paste
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                <Sparkles size={13} /> Multi-Layer Paper-Cut Wave
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
