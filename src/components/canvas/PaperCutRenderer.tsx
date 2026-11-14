import React, { useId } from 'react';
import {
  LessonPhase,
  PaperCutLayer,
  SlideMediaItem,
  WaveVariant,
} from '../../types/curriculum';
import { PHASE_PALETTES } from '../../data/palettes';
import {
  computeConformingPaperCut,
  ObstacleBox,
  Point,
} from './paperCutPresets';

interface PaperCutRendererProps {
  phase: LessonPhase;
  waveVariant: WaveVariant;
  obstacles?: ObstacleBox[];
  customWaveLayers?: PaperCutLayer[];
  waveControlPoints?: Point[];
  bottomFillMedia?: SlideMediaItem;
  className?: string;
}

export const PaperCutRenderer: React.FC<PaperCutRendererProps> = ({
  phase,
  waveVariant,
  obstacles = [],
  customWaveLayers,
  waveControlPoints,
  bottomFillMedia,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const palette = PHASE_PALETTES[phase];
  const { bottomBaseColor, layers, bottomCavernRect } = computeConformingPaperCut(
    waveVariant,
    palette,
    obstacles,
    customWaveLayers,
    waveControlPoints
  );

  const showBottomPhoto =
    bottomFillMedia &&
    bottomFillMedia.placement === 'fill-bottom-layer' &&
    bottomFillMedia.type === 'image' &&
    bottomFillMedia.url;

  return (
    <div className={`pointer-events-none select-none overflow-hidden ${className}`}>
      {/* Full-bleed Bottom Layer Photo (cropped cleanly inside the bottom cavern) */}
      {showBottomPhoto && (
        <div
          className="absolute inset-0 z-0"
          style={{ backgroundColor: bottomBaseColor }}
        >
          <img
            src={bottomFillMedia.url}
            alt={bottomFillMedia.title}
            className="absolute object-cover"
            style={{
              left: `${(bottomCavernRect.x / 1920) * 100}%`,
              top: `${(bottomCavernRect.y / 1080) * 100}%`,
              width: `${(bottomCavernRect.w / 1920) * 100}%`,
              height: `${(bottomCavernRect.h / 1080) * 100}%`,
            }}
          />
          {/* Subtle colour-graded tint so bottom photo harmonises with theme */}
          <div
            className="absolute inset-0 opacity-20 mix-blend-multiply"
            style={{ backgroundColor: bottomBaseColor }}
          />
        </div>
      )}

      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full z-10"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {layers.map((layer, idx) => (
            <filter
              key={layer.id}
              id={`pc-shadow-${uid}-${idx}`}
              x="-15%"
              y="-15%"
              width="130%"
              height="130%"
            >
              <feDropShadow
                dx={layer.shadowOffsetX ?? 0}
                dy={layer.shadowOffsetY ?? 14}
                stdDeviation={layer.shadowBlur ?? 22}
                floodColor="#09090B"
                floodOpacity="0.28"
              />
            </filter>
          ))}
        </defs>

        {/* Bottom Dark Layer base fill when no bottom-layer photo is active */}
        {!showBottomPhoto && (
          <rect width="1920" height="1080" fill={bottomBaseColor} />
        )}

        {layers.map((layer, idx) => (
          <g key={layer.id} filter={`url(#pc-shadow-${uid}-${idx})`}>
            <path
              d={layer.d}
              fill={layer.color}
              fillOpacity={layer.opacity ?? 1}
            />
            <path
              d={layer.d}
              fill="none"
              stroke="#FFFFFF"
              strokeOpacity="0.22"
              strokeWidth="2.5"
            />
          </g>
        ))}
      </svg>
    </div>
  );
};

async function loadCorsImage(url: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
    return img;
  } catch {
    return null;
  }
}

/**
 * High-resolution HTML5 Canvas 2D rasterizer using the exact same procedural wave curves
 * and optional cropped bottom-layer photo so PowerPoint & Google Slides match 100%.
 */
export async function rasterizePaperCutToPngDataUrl(
  phase: LessonPhase,
  waveVariant: WaveVariant,
  obstacles: ObstacleBox[] = [],
  customWaveLayers?: PaperCutLayer[],
  bottomFillMedia?: SlideMediaItem,
  width = 1920,
  height = 1080,
  waveControlPoints?: Point[]
): Promise<string> {
  const palette = PHASE_PALETTES[phase];
  const { bottomBaseColor, layers, bottomCavernRect } = computeConformingPaperCut(
    waveVariant,
    palette,
    obstacles,
    customWaveLayers,
    waveControlPoints
  );

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context.');
  }

  ctx.save();
  ctx.scale(width / 1920, height / 1080);

  ctx.fillStyle = bottomBaseColor;
  ctx.fillRect(0, 0, 1920, 1080);

  if (
    bottomFillMedia &&
    bottomFillMedia.placement === 'fill-bottom-layer' &&
    bottomFillMedia.type === 'image' &&
    bottomFillMedia.url
  ) {
    const img = await loadCorsImage(bottomFillMedia.url);
    if (img) {
      const { x, y, w, h } = bottomCavernRect;
      const imgAspect = img.width / img.height;
      const boxAspect = w / h;
      let sx = 0;
      let sy = 0;
      let sw = img.width;
      let sh = img.height;
      if (imgAspect > boxAspect) {
        sw = img.height * boxAspect;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / boxAspect;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    }
  }

  for (const layer of layers) {
    const path = new Path2D(layer.d);

    ctx.save();
    ctx.shadowColor = 'rgba(9, 9, 11, 0.30)';
    ctx.shadowBlur = (layer.shadowBlur ?? 22) * 1.4;
    ctx.shadowOffsetX = layer.shadowOffsetX ?? 0;
    ctx.shadowOffsetY = layer.shadowOffsetY ?? 14;
    ctx.globalAlpha = layer.opacity ?? 1;
    ctx.fillStyle = layer.color;
    ctx.fill(path);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 2.5;
    ctx.stroke(path);
    ctx.restore();
  }

  ctx.restore();
  return canvas.toDataURL('image/png');
}
