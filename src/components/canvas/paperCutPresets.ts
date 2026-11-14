import {
  PaperCutLayer,
  PhasePalette,
  SlideData,
  WaveVariant,
} from '../../types/curriculum';

export interface ObstacleBox {
  x: number;
  y: number;
  w: number;
  h: number;
  layer: 'top' | 'bottom';
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Convert an ordered array of anchor points into a C1-continuous Catmull-Rom cubic Bezier SVG path segment.
 */
export function smoothSplineSegment(pts: Point[]): string {
  if (pts.length === 0) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function intervalDistance(val: number, start: number, end: number): number {
  if (val < start) return start - val;
  if (val > end) return val - end;
  return 0;
}

/**
 * Solve a 1D curve x(y) where left side is Creamy White Top Layer and right side is Dark Bottom Layer.
 * Uses a wide 260px cosine feathering envelope and 10 passes of 5-tap Gaussian smoothing so
 * waves remain flowing and serene unless the natural guide encroaches on content.
 */
function solveVerticalRightBoundary(
  guideX: number[],
  yStations: number[],
  obstacles: ObstacleBox[],
  invertToLeftSpine = false
): number[] {
  const n = guideX.length;
  const hardMin = new Array<number>(n).fill(invertToLeftSpine ? 90 : 120);
  const hardMax = new Array<number>(n).fill(invertToLeftSpine ? 1800 : 1860);
  const softMin = [...hardMin];
  const softMax = [...hardMax];

  const falloffY = 260;
  const corePadY = 42;

  for (const box of obstacles) {
    const pushRight = invertToLeftSpine ? box.layer === 'bottom' : box.layer === 'top';
    const marginX = box.layer === 'top' ? 76 : 165;
    const targetEdge = pushRight ? box.x + box.w + marginX : box.x - marginX;

    for (let i = 0; i < n; i++) {
      const dist = intervalDistance(yStations[i], box.y - corePadY, box.y + box.h + corePadY);
      if (dist <= 0) {
        if (pushRight) {
          hardMin[i] = Math.max(hardMin[i], targetEdge);
        } else {
          hardMax[i] = Math.min(hardMax[i], targetEdge);
        }
      }
      if (dist < falloffY) {
        const w = dist <= 0 ? 1 : 0.5 * (1 + Math.cos((Math.PI * dist) / falloffY));
        if (pushRight && guideX[i] < targetEdge) {
          softMin[i] = Math.max(softMin[i], guideX[i] + w * (targetEdge - guideX[i]));
        } else if (!pushRight && guideX[i] > targetEdge) {
          softMax[i] = Math.min(softMax[i], guideX[i] - w * (guideX[i] - targetEdge));
        }
      }
    }
  }

  let vals = guideX.map((g, i) => {
    const lo = Math.min(Math.max(hardMin[i], softMin[i]), hardMax[i]);
    const hi = Math.max(lo, Math.min(hardMax[i], softMax[i]));
    return clamp(g, lo, hi);
  });

  // 10 passes of wide 5-tap Gaussian kernel (0.12, 0.23, 0.30, 0.23, 0.12) keeping hard obstacle safety
  for (let pass = 0; pass < 10; pass++) {
    vals = vals.map((_, i) => {
      const v0 = vals[Math.max(0, i - 2)];
      const v1 = vals[Math.max(0, i - 1)];
      const v2 = vals[i];
      const v3 = vals[Math.min(n - 1, i + 1)];
      const v4 = vals[Math.min(n - 1, i + 2)];
      const smoothed = v0 * 0.12 + v1 * 0.23 + v2 * 0.3 + v3 * 0.23 + v4 * 0.12;
      const lo = Math.min(hardMin[i], hardMax[i]);
      const hi = Math.max(hardMin[i], hardMax[i]);
      return clamp(smoothed, lo, hi);
    });
  }

  return vals;
}

/**
 * Solve a horizontal curve y(x) where top side is Creamy White Top Layer and bottom side is Dark Bottom Layer.
 * Uses wide cosine feathering and 10-pass 5-tap Gaussian smoothing for sweeping, calm contours.
 */
function solveHorizontalBottomBoundary(
  guideY: number[],
  xStations: number[],
  obstacles: ObstacleBox[],
  isTopWaveFromDarkTop = false
): number[] {
  const n = guideY.length;
  const hardMin = new Array<number>(n).fill(isTopWaveFromDarkTop ? 80 : 35);
  const hardMax = new Array<number>(n).fill(isTopWaveFromDarkTop ? 920 : 1035);
  const softMin = [...hardMin];
  const softMax = [...hardMax];

  const falloffX = 240;
  const corePadX = 48;

  for (const box of obstacles) {
    const pushDown = isTopWaveFromDarkTop ? box.layer === 'bottom' : box.layer === 'top';
    const marginY = box.layer === 'top' ? (isTopWaveFromDarkTop ? 46 : 62) : 165;
    const targetEdge = pushDown
      ? box.y + box.h + marginY
      : Math.max(45, box.y - marginY);

    for (let i = 0; i < n; i++) {
      const dist = intervalDistance(xStations[i], box.x - corePadX, box.x + box.w + corePadX);
      if (dist <= 0) {
        if (pushDown) {
          hardMin[i] = Math.max(hardMin[i], targetEdge);
        } else {
          hardMax[i] = Math.min(hardMax[i], targetEdge);
        }
      }
      if (dist < falloffX) {
        const w = dist <= 0 ? 1 : 0.5 * (1 + Math.cos((Math.PI * dist) / falloffX));
        if (pushDown && guideY[i] < targetEdge) {
          softMin[i] = Math.max(softMin[i], guideY[i] + w * (targetEdge - guideY[i]));
        } else if (!pushDown && guideY[i] > targetEdge) {
          softMax[i] = Math.min(softMax[i], guideY[i] - w * (guideY[i] - targetEdge));
        }
      }
    }
  }

  let vals = guideY.map((g, i) => {
    const hasBottomOverride = !isTopWaveFromDarkTop && hardMax[i] < 1035;
    const hi = hasBottomOverride
      ? Math.min(hardMax[i], softMax[i])
      : Math.max(hardMin[i], Math.min(hardMax[i], softMax[i]));
    const lo = hasBottomOverride
      ? Math.min(Math.max(hardMin[i], softMin[i]), hi)
      : Math.min(Math.max(hardMin[i], softMin[i]), hi);
    return clamp(g, lo, hi);
  });

  for (let pass = 0; pass < 10; pass++) {
    vals = vals.map((_, i) => {
      const v0 = vals[Math.max(0, i - 2)];
      const v1 = vals[Math.max(0, i - 1)];
      const v2 = vals[i];
      const v3 = vals[Math.min(n - 1, i + 1)];
      const v4 = vals[Math.min(n - 1, i + 2)];
      const smoothed = v0 * 0.12 + v1 * 0.23 + v2 * 0.3 + v3 * 0.23 + v4 * 0.12;
      const hasBottomOverride = !isTopWaveFromDarkTop && hardMax[i] < 1035;
      const hi = hasBottomOverride ? hardMax[i] : Math.max(hardMin[i], hardMax[i]);
      const lo = hasBottomOverride ? Math.min(hardMin[i], hi) : Math.min(hardMin[i], hardMax[i]);
      return clamp(smoothed, lo, hi);
    });
  }

  return vals;
}

/**
 * Estimate exact 1920x1080 bounding boxes for all title, body, and bottom-layer elements
 * so the procedural paper-cut waves wrap around them seamlessly without ever overlapping text.
 */
export function estimateSlideObstacles(slide: SlideData): ObstacleBox[] {
  const boxes: ObstacleBox[] = [];
  const isLessonTitlePage = slide.presetId === 'lesson-title-page';
  const isTitleDivider = slide.presetId === 'title-divider';
  const isLeftSpine = slide.waveVariant === 'vertical-scurve-left';
  const isBottomWave =
    slide.waveVariant === 'corner-cavern-br' ||
    slide.waveVariant === 'bottom-undulation' ||
    slide.waveVariant === 'diagonal-surge';

  const titleFontSize = isLessonTitlePage || isTitleDivider ? 72 : 58;
  const titleStartX = isLeftSpine ? 470 : 80;
  const estCharW = titleFontSize * 0.54;
  const rawTitleW = Math.max(280, slide.title.length * estCharW + 40);
  const maxLineW = isLessonTitlePage ? 900 : 1180;
  const lines = Math.max(1, Math.ceil(rawTitleW / maxLineW));
  const titleW = Math.min(maxLineW, rawTitleW);
  const titleH = lines * titleFontSize * 1.18 + 16;

  // Starter slides place title cleanly inside the top dark band; other slides place title on Top Creamy White layer
  if (slide.waveVariant === 'top-bottom-strata') {
    boxes.push({
      x: 76,
      y: 26,
      w: Math.min(1300, rawTitleW),
      h: 82,
      layer: 'bottom',
    });
    boxes.push({
      x: 76,
      y: 205,
      w: 1768,
      h: 725,
      layer: 'top',
    });
    return boxes;
  }

  if (slide.waveVariant === 'framed-halo') {
    boxes.push({
      x: 170,
      y: 135,
      w: 1580,
      h: 795,
      layer: 'top',
    });
    return boxes;
  }

  if (isLessonTitlePage) {
    // Date chip + large topic title + big question on left top sheet
    boxes.push({
      x: titleStartX,
      y: 52,
      w: 400,
      h: 54,
      layer: 'top',
    });
    boxes.push({
      x: titleStartX,
      y: 120,
      w: titleW,
      h: titleH,
      layer: 'top',
    });
    boxes.push({
      x: titleStartX,
      y: 350,
      w: 840,
      h: 280,
      layer: 'top',
    });
    // Right-hand large cover photo/diagram slot (sits in bottom cavern on right-cavern waves)
    if (!isBottomWave && !isLeftSpine) {
      boxes.push({
        x: 1060,
        y: 130,
        w: 770,
        h: 810,
        layer: 'bottom',
      });
    } else {
      boxes.push({
        x: 1050,
        y: 130,
        w: 780,
        h: 640,
        layer: 'top',
      });
    }
    return boxes;
  }

  boxes.push({
    x: titleStartX,
    y: 48,
    w: titleW,
    h: titleH,
    layer: 'top',
  });

  if (isTitleDivider) {
    if (slide.bigQuestion) {
      boxes.push({
        x: 80,
        y: 230,
        w: 980,
        h: 250,
        layer: 'top',
      });
    }
    if (slide.keyTermsStrip && slide.keyTermsStrip.length > 0) {
      boxes.push({
        x: 80,
        y: 680,
        w: 1540,
        h: 320,
        layer: 'top',
      });
    }
    return boxes;
  }

  const hasBoxedMedia =
    Boolean(slide.mediaItem) && slide.mediaItem?.placement !== 'fill-bottom-layer';
  const hasFullBottomImage =
    Boolean(slide.mediaItem) && slide.mediaItem?.placement === 'fill-bottom-layer';
  const isDualVisualPreset =
    slide.presetId === 'split-concept-dual-code' ||
    slide.presetId === 'worked-example-steps';

  const topBlocks = slide.bodyBlocks.filter((b) => b.layer !== 'bottom');
  const bottomBlocks = slide.bodyBlocks.filter((b) => b.layer === 'bottom');

  if (topBlocks.length > 0) {
    if (slide.presetId === 'comparison-two-column') {
      boxes.push({
        x: 80,
        y: 175,
        w: hasBoxedMedia ? 1050 : 1760,
        h: 720,
        layer: 'top',
      });
    } else if (slide.presetId === 'process-timeline-flow') {
      boxes.push({
        x: 80,
        y: 185,
        w: 1760,
        h: 590,
        layer: 'top',
      });
    } else if (
      bottomBlocks.length > 0 ||
      hasBoxedMedia ||
      hasFullBottomImage ||
      isDualVisualPreset
    ) {
      boxes.push({
        x: titleStartX,
        y: 175,
        w: 840,
        h: 720,
        layer: 'top',
      });
    } else {
      boxes.push({
        x: titleStartX,
        y: 175,
        w: isBottomWave ? 1740 : 1120,
        h: isBottomWave ? 650 : 720,
        layer: 'top',
      });
    }
  }

  if (bottomBlocks.length > 0 || hasFullBottomImage) {
    boxes.push({
      x: 1080,
      y: 230,
      w: 760,
      h: 640,
      layer: 'bottom',
    });
  }

  if (slide.presetId === 'custom' && slide.customCanvasElements) {
    for (const el of slide.customCanvasElements) {
      boxes.push({
        x: (el.x / 100) * 1920,
        y: (el.y / 100) * 1080,
        w: (el.w / 100) * 1920,
        h: (el.h / 100) * 1080,
        layer: el.layer || 'top',
      });
    }
  }

  return boxes;
}

export interface ComputedPaperCut {
  /** Base dark bottom colour (layers[3]) */
  bottomBaseColor: string;
  /** Back-to-front paper-cut shapes: [wave3, wave2, wave1, topCreamyWhiteSheet, ...accents] */
  layers: PaperCutLayer[];
  /** Bounding region inside which a 'fill-bottom-layer' image is visually spotlighted */
  bottomCavernRect: { x: number; y: number; w: number; h: number };
  /** Editable spline control points in 1920x1080 space */
  controlPoints: Point[];
}

export function computeConformingPaperCut(
  variant: WaveVariant,
  palette: PhasePalette,
  obstacles: ObstacleBox[] = [],
  customLayers?: PaperCutLayer[],
  customControlPoints?: Point[]
): ComputedPaperCut {
  if (customLayers && customLayers.length > 0) {
    return {
      bottomBaseColor: palette.creamyWhite,
      layers: customLayers,
      bottomCavernRect: { x: 960, y: 0, w: 960, h: 1080 },
      controlPoints: [],
    };
  }

  const N = 10;
  const yStations = Array.from({ length: N }, (_, i) => (i / (N - 1)) * 1080);
  const xStations = Array.from({ length: N }, (_, i) => (i / (N - 1)) * 1920);

  // 1. TOP-BOTTOM STRATA
  if (variant === 'top-bottom-strata') {
    const centerTopObstacles = obstacles.filter((o) => o.layer === 'top');
    const topGuide = yStations.map((_, i) => 170 + Math.sin(i * 1.1) * 10);
    const botGuide = yStations.map((_, i) => 965 + Math.cos(i * 0.95) * 12);

    const topBound = solveHorizontalBottomBoundary(
      topGuide,
      xStations,
      centerTopObstacles,
      true
    ).map((y) => clamp(y, 155, 178));

    const autoBotBound = solveHorizontalBottomBoundary(
      botGuide,
      xStations,
      centerTopObstacles,
      false
    );

    const hasCustomPts = customControlPoints && customControlPoints.length === N;
    const botPts: Point[] = hasCustomPts
      ? customControlPoints.map((p) => ({
          x: clamp(p.x, 0, 1920),
          y: clamp(p.y, 700, 1045),
        }))
      : xStations.map((x, i) => ({ x, y: autoBotBound[i] }));

    const mkTopPoints = (dy: number, phaseShift: number): Point[] =>
      xStations.map((x, i) => ({
        x,
        y: clamp(topBound[i] - dy + Math.sin(i * 0.9 + phaseShift) * 6, 100, 320),
      }));

    const mkBotPoints = (dy: number, phaseShift: number): Point[] =>
      botPts.map((pt, i) => ({
        x: pt.x,
        y: clamp(pt.y + dy + Math.cos(i * 0.9 + phaseShift) * 6, 700, 1068),
      }));

    const topWave3 = mkTopPoints(58, 0.3);
    const topWave2 = mkTopPoints(38, 1.4);
    const topWave1 = mkTopPoints(18, 2.2);

    const botWave3 = mkBotPoints(60, 0.5);
    const botWave2 = mkBotPoints(38, 1.6);
    const botWave1 = mkBotPoints(18, 2.5);

    const topCreamPts = xStations.map((x, i) => ({ x, y: topBound[i] }));
    const revBotPts = [...botPts].reverse();

    const creamyBandPath = `${smoothSplineSegment(topCreamPts)} L ${revBotPts[0].x.toFixed(1)} ${revBotPts[0].y.toFixed(1)} ${smoothSplineSegment(revBotPts).replace(/^M/, 'L')} Z`;

    return {
      bottomBaseColor: palette.layers[3],
      bottomCavernRect: { x: 0, y: 0, w: 1920, h: 1080 },
      controlPoints: botPts,
      layers: [
        {
          id: 'top-w3',
          d: `${smoothSplineSegment(topWave3)} L 1920 1080 L 0 1080 Z`,
          color: palette.layers[2],
          shadowOffsetX: 0,
          shadowOffsetY: -10,
          shadowBlur: 18,
        },
        {
          id: 'top-w2',
          d: `${smoothSplineSegment(topWave2)} L 1920 1080 L 0 1080 Z`,
          color: palette.layers[1],
          shadowOffsetX: 0,
          shadowOffsetY: -10,
          shadowBlur: 18,
        },
        {
          id: 'top-w1',
          d: `${smoothSplineSegment(topWave1)} L 1920 1080 L 0 1080 Z`,
          color: palette.layers[0],
          shadowOffsetX: 0,
          shadowOffsetY: -12,
          shadowBlur: 20,
        },
        {
          id: 'bot-w3',
          d: `${smoothSplineSegment(botWave3)} L 1920 0 L 0 0 Z`,
          color: palette.layers[2],
          shadowOffsetX: 0,
          shadowOffsetY: 10,
          shadowBlur: 18,
        },
        {
          id: 'bot-w2',
          d: `${smoothSplineSegment(botWave2)} L 1920 0 L 0 0 Z`,
          color: palette.layers[1],
          shadowOffsetX: 0,
          shadowOffsetY: 10,
          shadowBlur: 18,
        },
        {
          id: 'bot-w1',
          d: `${smoothSplineSegment(botWave1)} L 1920 0 L 0 0 Z`,
          color: palette.layers[0],
          shadowOffsetX: 0,
          shadowOffsetY: 12,
          shadowBlur: 20,
        },
        {
          id: 'top-creamy-sheet',
          d: creamyBandPath,
          color: palette.creamyWhite,
          shadowOffsetX: 0,
          shadowOffsetY: 16,
          shadowBlur: 28,
        },
      ],
    };
  }

  // 2. FRAMED HALO
  if (variant === 'framed-halo') {
    const topBoxes = obstacles.filter((b) => b.layer === 'top');
    const minX = topBoxes.length
      ? Math.max(95, Math.min(...topBoxes.map((b) => b.x)) - 42)
      : 140;
    const maxX = topBoxes.length
      ? Math.min(1825, Math.max(...topBoxes.map((b) => b.x + b.w)) + 42)
      : 1780;
    const minY = topBoxes.length
      ? Math.max(70, Math.min(...topBoxes.map((b) => b.y)) - 36)
      : 110;
    const maxY = topBoxes.length
      ? Math.min(1010, Math.max(...topBoxes.map((b) => b.y + b.h)) + 36)
      : 965;

    const l = clamp(minX, 15, 1890);
    const r = clamp(maxX, 30, 1905);
    const t = clamp(minY, 15, 1050);
    const b = clamp(maxY, 30, 1065);
    const mx = (l + r) / 2;
    const my = (t + b) / 2;

    const defaultLoopPts: Point[] = [
      { x: l + 45, y: t + 10 },
      { x: mx - 240, y: t - 14 },
      { x: mx + 220, y: t + 14 },
      { x: r - 45, y: t - 8 },
      { x: r + 14, y: my - 180 },
      { x: r - 12, y: my + 190 },
      { x: r - 45, y: b + 8 },
      { x: mx + 230, y: b - 14 },
      { x: mx - 230, y: b + 14 },
      { x: l + 45, y: b - 10 },
      { x: l - 14, y: my + 180 },
      { x: l + 12, y: my - 180 },
    ];

    const baseLoop =
      customControlPoints && customControlPoints.length === 12
        ? customControlPoints.map((p) => ({
            x: clamp(p.x, 15, 1905),
            y: clamp(p.y, 15, 1065),
          }))
        : defaultLoopPts;

    const cx = baseLoop.reduce((s, p) => s + p.x, 0) / baseLoop.length;
    const cy = baseLoop.reduce((s, p) => s + p.y, 0) / baseLoop.length;

    const mkLoop = (inset: number): string => {
      const scaled = baseLoop.map((p) => {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        return {
          x: clamp(p.x + (dx / len) * inset, 10, 1910),
          y: clamp(p.y + (dy / len) * inset, 10, 1070),
        };
      });
      return `${smoothSplineSegment([...scaled, scaled[0]])} Z`;
    };

    return {
      bottomBaseColor: palette.layers[3],
      bottomCavernRect: { x: 0, y: 0, w: 1920, h: 1080 },
      controlPoints: baseLoop,
      layers: [
        {
          id: 'halo-w3',
          d: mkLoop(102),
          color: palette.layers[2],
          shadowOffsetX: 0,
          shadowOffsetY: 14,
          shadowBlur: 26,
        },
        {
          id: 'halo-w2',
          d: mkLoop(66),
          color: palette.layers[1],
          shadowOffsetX: 0,
          shadowOffsetY: 14,
          shadowBlur: 26,
        },
        {
          id: 'halo-w1',
          d: mkLoop(32),
          color: palette.layers[0],
          shadowOffsetX: 0,
          shadowOffsetY: 14,
          shadowBlur: 28,
        },
        {
          id: 'halo-creamy',
          d: mkLoop(0),
          color: palette.creamyWhite,
          shadowOffsetX: 0,
          shadowOffsetY: 16,
          shadowBlur: 32,
        },
      ],
    };
  }

  // 3. LEFT SPINE S-CURVE
  if (variant === 'vertical-scurve-left') {
    const guideX = yStations.map(
      (_, i) => 360 + Math.sin(i * 0.72) * 58 - Math.cos(i * 0.42) * 24
    );
    const autoBoundX = solveVerticalRightBoundary(guideX, yStations, obstacles, true);
    const hasCustomPts = customControlPoints && customControlPoints.length === N;
    const pts: Point[] = hasCustomPts
      ? customControlPoints.map((p) => ({
          x: clamp(p.x, 90, 1800),
          y: clamp(p.y, 0, 1080),
        }))
      : yStations.map((y, i) => ({ x: autoBoundX[i], y }));

    const mkWave = (dx: number, phase: number) => {
      const wPts = pts.map((p, i) => ({
        x: clamp(p.x - dx - (dx === 0 ? 0 : Math.sin(i * 0.8 + phase) * 10), 15, 1860),
        y: p.y,
      }));
      return `${smoothSplineSegment(wPts)} L 1920 1080 L 1920 0 Z`;
    };

    return {
      bottomBaseColor: palette.layers[3],
      bottomCavernRect: { x: 0, y: 0, w: 460, h: 1080 },
      controlPoints: pts,
      layers: [
        {
          id: 'ls-w3',
          d: mkWave(126, 0.4),
          color: palette.layers[2],
          shadowOffsetX: -12,
          shadowOffsetY: 8,
          shadowBlur: 24,
        },
        {
          id: 'ls-w2',
          d: mkWave(80, 1.5),
          color: palette.layers[1],
          shadowOffsetX: -12,
          shadowOffsetY: 8,
          shadowBlur: 24,
        },
        {
          id: 'ls-w1',
          d: mkWave(38, 2.5),
          color: palette.layers[0],
          shadowOffsetX: -14,
          shadowOffsetY: 10,
          shadowBlur: 26,
        },
        {
          id: 'ls-creamy',
          d: mkWave(0, 0),
          color: palette.creamyWhite,
          shadowOffsetX: -16,
          shadowOffsetY: 10,
          shadowBlur: 28,
        },
      ],
    };
  }

  // 4. HORIZONTAL BOTTOM WAVES (corner-cavern-br, bottom-undulation, diagonal-surge)
  if (
    variant === 'corner-cavern-br' ||
    variant === 'bottom-undulation' ||
    variant === 'diagonal-surge'
  ) {
    const guideY = xStations.map((_, i) => {
      const t = i / (N - 1);
      if (variant === 'corner-cavern-br') {
        return 930 - Math.pow(t, 1.5) * 410 + Math.sin(i * 0.9) * 26;
      }
      if (variant === 'diagonal-surge') {
        return 960 - Math.pow(t, 1.35) * 370 + Math.cos(i * 0.85) * 24;
      }
      return 805 + Math.sin(i * 0.95) * 36;
    });

    const autoBoundY = solveHorizontalBottomBoundary(guideY, xStations, obstacles, false);
    const hasCustomPts = customControlPoints && customControlPoints.length === N;
    const pts: Point[] = hasCustomPts
      ? customControlPoints.map((p) => ({
          x: clamp(p.x, 0, 1920),
          y: clamp(p.y, 45, 1065),
        }))
      : xStations.map((x, i) => ({ x, y: autoBoundY[i] }));

    const mkWave = (dy: number, phase: number) => {
      const wPts = pts.map((p, i) => ({
        x: p.x,
        y: clamp(
          p.y + dy + (dy === 0 ? 0 : Math.sin(i * 0.9 + phase) * 10),
          35,
          1072
        ),
      }));
      return `${smoothSplineSegment(wPts)} L 1920 0 L 0 0 Z`;
    };

    const avgY = pts.reduce((a, b) => a + b.y, 0) / pts.length;

    return {
      bottomBaseColor: palette.layers[3],
      bottomCavernRect: {
        x: 0,
        y: Math.max(0, avgY - 60),
        w: 1920,
        h: 1080 - Math.max(0, avgY - 60),
      },
      controlPoints: pts,
      layers: [
        {
          id: 'bh-w3',
          d: mkWave(132, 0.5),
          color: palette.layers[2],
          shadowOffsetX: 0,
          shadowOffsetY: 12,
          shadowBlur: 24,
        },
        {
          id: 'bh-w2',
          d: mkWave(84, 1.7),
          color: palette.layers[1],
          shadowOffsetX: 0,
          shadowOffsetY: 12,
          shadowBlur: 24,
        },
        {
          id: 'bh-w1',
          d: mkWave(40, 2.8),
          color: palette.layers[0],
          shadowOffsetX: 0,
          shadowOffsetY: 14,
          shadowBlur: 26,
        },
        {
          id: 'bh-creamy',
          d: mkWave(0, 0),
          color: palette.creamyWhite,
          shadowOffsetX: 0,
          shadowOffsetY: 18,
          shadowBlur: 30,
        },
      ],
    };
  }

  // 5. RIGHT-SIDE PROCEDURAL CAVERN WAVES
  const guideX = yStations.map((_, i) => {
    const t = i / (N - 1);
    if (variant === 'corner-cavern-tr') {
      return 1120 + Math.pow(t, 1.3) * 600 + Math.sin(i * 1.0) * 46;
    }
    if (variant === 'dual-ribbon') {
      return 1320 + Math.pow(t, 1.15) * 440 + Math.cos(i * 0.95) * 40;
    }
    if (variant === 'island-cutout-right') {
      return 1045 + Math.sin(i * 1.05) * 62;
    }
    return 1060 + Math.sin(i * 0.88) * 72;
  });

  const autoBoundX = solveVerticalRightBoundary(guideX, yStations, obstacles, false);
  const hasCustomPts = customControlPoints && customControlPoints.length === N;
  const pts: Point[] = hasCustomPts
    ? customControlPoints.map((p) => ({
        x: clamp(p.x, 120, 1895),
        y: clamp(p.y, 0, 1080),
      }))
    : yStations.map((y, i) => ({ x: autoBoundX[i], y }));

  const mkRightWave = (dx: number, phase: number) => {
    const wPts = pts.map((p, i) => ({
      x: clamp(
        p.x + dx + (dx === 0 ? 0 : Math.sin(i * 0.9 + phase) * 11),
        120,
        1908
      ),
      y: p.y,
    }));
    return `${smoothSplineSegment(wPts)} L 0 1080 L 0 0 Z`;
  };

  const minRightCavernX = Math.min(...pts.map((p) => p.x));

  const layers: PaperCutLayer[] = [
    {
      id: 'rc-w3',
      d: mkRightWave(132, 0.4),
      color: palette.layers[2],
      shadowOffsetX: 12,
      shadowOffsetY: 10,
      shadowBlur: 24,
    },
    {
      id: 'rc-w2',
      d: mkRightWave(84, 1.6),
      color: palette.layers[1],
      shadowOffsetX: 12,
      shadowOffsetY: 10,
      shadowBlur: 24,
    },
    {
      id: 'rc-w1',
      d: mkRightWave(40, 2.7),
      color: palette.layers[0],
      shadowOffsetX: 14,
      shadowOffsetY: 12,
      shadowBlur: 26,
    },
    {
      id: 'rc-creamy',
      d: mkRightWave(0, 0),
      color: palette.creamyWhite,
      shadowOffsetX: 18,
      shadowOffsetY: 14,
      shadowBlur: 32,
    },
  ];

  if (variant === 'island-cutout-right' || variant === 'corner-cavern-tr') {
    const sampleIdx = Math.min(pts.length - 1, 7);
    const pebbleX = clamp(Math.max(pts[sampleIdx].x + 220, 1520), 1300, 1780);
    const pebbleY = variant === 'island-cutout-right' ? 840 : 185;
    const collides = obstacles.some(
      (o) =>
        pebbleX + 80 >= o.x &&
        pebbleX - 80 <= o.x + o.w &&
        pebbleY + 60 >= o.y &&
        pebbleY - 60 <= o.y + o.h
    );
    if (!collides) {
      layers.push({
        id: 'pebble-accent',
        d: `M ${pebbleX} ${pebbleY - 35} C ${pebbleX + 55} ${pebbleY - 45}, ${pebbleX + 75} ${pebbleY + 15}, ${pebbleX + 25} ${pebbleY + 42} C ${pebbleX - 25} ${pebbleY + 65}, ${pebbleX - 65} ${pebbleY + 15}, ${pebbleX - 45} ${pebbleY - 22} C ${pebbleX - 30} ${pebbleY - 48}, ${pebbleX - 20} ${pebbleY - 30}, ${pebbleX} ${pebbleY - 35} Z`,
        color: palette.layers[1],
        shadowOffsetX: -8,
        shadowOffsetY: 12,
        shadowBlur: 20,
      });
    }
  }

  return {
    bottomBaseColor: palette.layers[3],
    bottomCavernRect: {
      x: clamp(minRightCavernX - 20, 500, 1300),
      y: 0,
      w: 1920 - clamp(minRightCavernX - 20, 500, 1300),
      h: 1080,
    },
    controlPoints: pts,
    layers,
  };
}
