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

/**
 * Cyclic closed Catmull-Rom spline with C1-continuous tangents across the loop seam (zero 90-degree corners).
 */
export function smoothClosedSpline(pts: Point[]): string {
  const n = pts.length;
  if (n === 0) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return `${d} Z`;
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
 * Determine whether a logical region on the slide renders over the dark coloured surface vs light creamy sheet.
 */
export function isSlideRegionDark(
  waveVariant: WaveVariant,
  region: 'header' | 'top' | 'bottom' | 'bottom-right-corner',
  invertWaveLayers = false
): boolean {
  const flip = (isDarkByDefault: boolean) =>
    invertWaveLayers ? !isDarkByDefault : isDarkByDefault;

  if (region === 'header') {
    if (
      waveVariant === 'top-bottom-strata' ||
      waveVariant === 'framed-halo' ||
      waveVariant === 'dark-canvas-bottom-paper' ||
      waveVariant === 'dark-halo-spotlight'
    ) {
      return flip(true);
    }
    return flip(false);
  }

  if (region === 'top') {
    if (waveVariant === 'dark-canvas-bottom-paper') {
      return flip(true);
    }
    return flip(false);
  }

  if (region === 'bottom') {
    if (waveVariant === 'dark-canvas-bottom-paper') {
      return flip(false);
    }
    return flip(true);
  }

  // bottom-right-corner (around 1820, 1020)
  if (
    waveVariant === 'vertical-scurve-left' ||
    waveVariant === 'dark-canvas-bottom-paper' ||
    waveVariant === 'corner-cavern-tr'
  ) {
    return flip(false);
  }
  return flip(true);
}

/**
 * Solve a 1D curve x(y) where left side is Sheet and right side is Base Cavern.
 * Keeps gentle obstacle margins and 3 smoothing passes so organic sinusoidal S-curve waviness remains crisp.
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

  const falloffY = 210;
  const corePadY = 28;

  for (const box of obstacles) {
    const pushRight = invertToLeftSpine ? box.layer === 'bottom' : box.layer === 'top';
    const marginX = box.layer === 'top' ? 38 : 90;
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

  // Gentle 3-pass smoothing preserves organic curves instead of flattening the S-wave into a straight line
  for (let pass = 0; pass < 3; pass++) {
    vals = vals.map((_, i) => {
      const v0 = vals[Math.max(0, i - 2)];
      const v1 = vals[Math.max(0, i - 1)];
      const v2 = vals[i];
      const v3 = vals[Math.min(n - 1, i + 1)];
      const v4 = vals[Math.min(n - 1, i + 2)];
      const smoothed = v0 * 0.1 + v1 * 0.22 + v2 * 0.36 + v3 * 0.22 + v4 * 0.1;
      const lo = Math.min(hardMin[i], hardMax[i]);
      const hi = Math.max(hardMin[i], hardMax[i]);
      return clamp(smoothed, lo, hi);
    });
  }

  return vals;
}

/**
 * Solve a horizontal curve y(x) separating upper region from lower region.
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

  const falloffX = 200;
  const corePadX = 36;

  for (const box of obstacles) {
    const pushDown = isTopWaveFromDarkTop ? box.layer === 'bottom' : box.layer === 'top';
    const marginY = box.layer === 'top' ? (isTopWaveFromDarkTop ? 36 : 42) : 95;
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
    const lo = Math.min(Math.max(hardMin[i], softMin[i]), hi);
    return clamp(g, lo, hi);
  });

  for (let pass = 0; pass < 3; pass++) {
    vals = vals.map((_, i) => {
      const v0 = vals[Math.max(0, i - 2)];
      const v1 = vals[Math.max(0, i - 1)];
      const v2 = vals[i];
      const v3 = vals[Math.min(n - 1, i + 1)];
      const v4 = vals[Math.min(n - 1, i + 2)];
      const smoothed = v0 * 0.1 + v1 * 0.22 + v2 * 0.36 + v3 * 0.22 + v4 * 0.1;
      const hasBottomOverride = !isTopWaveFromDarkTop && hardMax[i] < 1035;
      const hi = hasBottomOverride ? hardMax[i] : Math.max(hardMin[i], hardMax[i]);
      const lo = hasBottomOverride ? Math.min(hardMin[i], hi) : Math.min(hardMin[i], hardMax[i]);
      return clamp(smoothed, lo, hi);
    });
  }

  return vals;
}

/**
 * Estimate 1920x1080 bounding boxes for slide content so procedural waves keep safe clearance
 * while leaving sufficient corridor room for pronounced natural waviness.
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
  const maxLineW = isLessonTitlePage ? 840 : 1140;
  const lines = Math.max(1, Math.ceil(rawTitleW / maxLineW));
  const titleW = Math.min(maxLineW, rawTitleW);
  const titleH = lines * titleFontSize * 1.18 + 16;

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
      x: 165,
      y: 130,
      w: 1590,
      h: 805,
      layer: 'top',
    });
    return boxes;
  }

  if (slide.waveVariant === 'dark-halo-spotlight') {
    boxes.push({
      x: 250,
      y: 195,
      w: 1420,
      h: 710,
      layer: 'top',
    });
    return boxes;
  }

  if (slide.waveVariant === 'dark-canvas-bottom-paper') {
    boxes.push({
      x: 80,
      y: 48,
      w: 1760,
      h: 760,
      layer: 'top',
    });
    return boxes;
  }

  if (isLessonTitlePage) {
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
      w: Math.min(840, titleW),
      h: titleH,
      layer: 'top',
    });
    boxes.push({
      x: titleStartX,
      y: 350,
      w: 800,
      h: 280,
      layer: 'top',
    });
    if (!isBottomWave && !isLeftSpine) {
      boxes.push({
        x: 1120,
        y: 110,
        w: 740,
        h: 860,
        layer: 'bottom',
      });
    } else {
      boxes.push({
        x: 1080,
        y: 130,
        w: 750,
        h: 640,
        layer: 'top',
      });
    }
    return boxes;
  }

  boxes.push({
    x: titleStartX,
    y: 48,
    w: Math.min(820, titleW),
    h: titleH,
    layer: 'top',
  });

  if (isTitleDivider) {
    if (slide.bigQuestion) {
      boxes.push({
        x: 80,
        y: 230,
        w: 920,
        h: 250,
        layer: 'top',
      });
    }
    if (slide.keyTermsStrip && slide.keyTermsStrip.length > 0) {
      boxes.push({
        x: 80,
        y: 680,
        w: 1460,
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
        w: 800,
        h: 720,
        layer: 'top',
      });
    } else {
      boxes.push({
        x: titleStartX,
        y: 175,
        w: isBottomWave ? 1740 : 960,
        h: isBottomWave ? 650 : 720,
        layer: 'top',
      });
    }
  }

  if (bottomBlocks.length > 0 || hasFullBottomImage) {
    boxes.push({
      x: 1120,
      y: 230,
      w: 720,
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
  /** Outer / background base colour behind SVG wave paths */
  bottomBaseColor: string;
  /** Back-to-front paper-cut shapes: [wave3, wave2, wave1, mainSheet, ...accents] */
  layers: PaperCutLayer[];
  /** Bounding region inside which a 'fill-bottom-layer' image is cropped & positioned */
  bottomCavernRect: { x: number; y: number; w: number; h: number };
  /** Editable spline control points in 1920x1080 space */
  controlPoints: Point[];
}

export function computeConformingPaperCut(
  variant: WaveVariant,
  palette: PhasePalette,
  obstacles: ObstacleBox[] = [],
  customLayers?: PaperCutLayer[],
  customControlPoints?: Point[],
  invertWaveLayers = false
): ComputedPaperCut {
  if (customLayers && customLayers.length > 0) {
    return {
      bottomBaseColor: palette.creamyWhite,
      layers: customLayers,
      bottomCavernRect: { x: 960, y: 0, w: 960, h: 1080 },
      controlPoints: [],
    };
  }

  // Color ramp polarity: flips creamy white vs deep theme colour seamlessly across every variant
  const baseFill = invertWaveLayers ? palette.creamyWhite : palette.layers[3];
  const sheetFill = invertWaveLayers ? palette.layers[3] : palette.creamyWhite;
  const w3Color = invertWaveLayers ? palette.layers[0] : palette.layers[2];
  const w2Color = palette.layers[1];
  const w1Color = invertWaveLayers ? palette.layers[2] : palette.layers[0];

  const N = 10;
  const yStations = Array.from({ length: N }, (_, i) => (i / (N - 1)) * 1080);
  const xStations = Array.from({ length: N }, (_, i) => (i / (N - 1)) * 1920);

  // 1. TOP-BOTTOM STRATA
  if (variant === 'top-bottom-strata') {
    const centerTopObstacles = obstacles.filter((o) => o.layer === 'top');
    const topGuide = yStations.map(
      (_, i) => 165 + Math.sin(i * 1.15) * 16 + Math.cos(i * 0.6) * 8
    );
    const botGuide = yStations.map(
      (_, i) => 955 + Math.cos(i * 1.1) * 18 + Math.sin(i * 0.7) * 8
    );

    const topBound = solveHorizontalBottomBoundary(
      topGuide,
      xStations,
      centerTopObstacles,
      true
    ).map((y) => clamp(y, 145, 185));

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
        y: clamp(topBound[i] - dy + Math.sin(i * 0.95 + phaseShift) * 9, 95, 320),
      }));

    const mkBotPoints = (dy: number, phaseShift: number): Point[] =>
      botPts.map((pt, i) => ({
        x: pt.x,
        y: clamp(pt.y + dy + Math.cos(i * 0.95 + phaseShift) * 9, 700, 1068),
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
      bottomBaseColor: baseFill,
      bottomCavernRect: { x: 0, y: 0, w: 1920, h: 1080 },
      controlPoints: botPts,
      layers: [
        {
          id: 'top-w3',
          d: `${smoothSplineSegment(topWave3)} L 1920 1080 L 0 1080 Z`,
          color: w3Color,
          shadowOffsetX: 0,
          shadowOffsetY: -10,
          shadowBlur: 18,
        },
        {
          id: 'top-w2',
          d: `${smoothSplineSegment(topWave2)} L 1920 1080 L 0 1080 Z`,
          color: w2Color,
          shadowOffsetX: 0,
          shadowOffsetY: -10,
          shadowBlur: 18,
        },
        {
          id: 'top-w1',
          d: `${smoothSplineSegment(topWave1)} L 1920 1080 L 0 1080 Z`,
          color: w1Color,
          shadowOffsetX: 0,
          shadowOffsetY: -12,
          shadowBlur: 20,
        },
        {
          id: 'bot-w3',
          d: `${smoothSplineSegment(botWave3)} L 1920 0 L 0 0 Z`,
          color: w3Color,
          shadowOffsetX: 0,
          shadowOffsetY: 10,
          shadowBlur: 18,
        },
        {
          id: 'bot-w2',
          d: `${smoothSplineSegment(botWave2)} L 1920 0 L 0 0 Z`,
          color: w2Color,
          shadowOffsetX: 0,
          shadowOffsetY: 10,
          shadowBlur: 18,
        },
        {
          id: 'bot-w1',
          d: `${smoothSplineSegment(botWave1)} L 1920 0 L 0 0 Z`,
          color: w1Color,
          shadowOffsetX: 0,
          shadowOffsetY: 12,
          shadowBlur: 20,
        },
        {
          id: 'top-creamy-sheet',
          d: creamyBandPath,
          color: sheetFill,
          shadowOffsetX: 0,
          shadowOffsetY: 16,
          shadowBlur: 28,
        },
      ],
    };
  }

  // 2. FRAMED HALO & DARK HALO SPOTLIGHT (C1-continuous cyclic superellipse loop — zero corners!)
  if (variant === 'framed-halo' || variant === 'dark-halo-spotlight') {
    const isSpotlight = variant === 'dark-halo-spotlight';
    const topBoxes = obstacles.filter((b) => b.layer === 'top');
    const minX = topBoxes.length
      ? Math.max(isSpotlight ? 185 : 95, Math.min(...topBoxes.map((b) => b.x)) - (isSpotlight ? 35 : 50))
      : isSpotlight
      ? 230
      : 135;
    const maxX = topBoxes.length
      ? Math.min(isSpotlight ? 1735 : 1825, Math.max(...topBoxes.map((b) => b.x + b.w)) + (isSpotlight ? 35 : 50))
      : isSpotlight
      ? 1690
      : 1785;
    const minY = topBoxes.length
      ? Math.max(isSpotlight ? 145 : 70, Math.min(...topBoxes.map((b) => b.y)) - (isSpotlight ? 25 : 40))
      : isSpotlight
      ? 175
      : 105;
    const maxY = topBoxes.length
      ? Math.min(isSpotlight ? 950 : 1015, Math.max(...topBoxes.map((b) => b.y + b.h)) + (isSpotlight ? 25 : 40))
      : isSpotlight
      ? 925
      : 970;

    const rx = (maxX - minX) / 2;
    const ry = (maxY - minY) / 2;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const LOOP_PTS = 16;
    const defaultLoopPts: Point[] = Array.from({ length: LOOP_PTS }, (_, i) => {
      const theta = (i / LOOP_PTS) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      // Superellipse n=4 + subtle organic ripple keeps corners sweeping and round while enclosing rectangular cards
      const superR = Math.pow(Math.pow(Math.abs(cosT), 3.6) + Math.pow(Math.abs(sinT), 3.6), -1 / 3.6);
      const ripple = 1 + 0.024 * Math.sin(i * 1.9);
      return {
        x: clamp(centerX + cosT * superR * rx * ripple, 20, 1900),
        y: clamp(centerY + sinT * superR * ry * ripple, 20, 1060),
      };
    });

    const baseLoop =
      customControlPoints && customControlPoints.length >= 8
        ? customControlPoints.map((p) => ({
            x: clamp(p.x, 15, 1905),
            y: clamp(p.y, 15, 1065),
          }))
        : defaultLoopPts;

    const cx = baseLoop.reduce((s, p) => s + p.x, 0) / baseLoop.length;
    const cy = baseLoop.reduce((s, p) => s + p.y, 0) / baseLoop.length;

    const mkLoop = (inset: number, phaseShift: number): string => {
      const scaled = baseLoop.map((p, i) => {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        const waveJitter = inset === 0 ? 0 : Math.sin(i * 1.45 + phaseShift) * 14;
        return {
          x: clamp(p.x + (dx / len) * (inset + waveJitter), 8, 1912),
          y: clamp(p.y + (dy / len) * (inset + waveJitter), 8, 1072),
        };
      });
      return smoothClosedSpline(scaled);
    };

    const insetScale = isSpotlight ? 1.45 : 1.0;

    return {
      bottomBaseColor: baseFill,
      bottomCavernRect: { x: 0, y: 0, w: 1920, h: 1080 },
      controlPoints: baseLoop,
      layers: [
        {
          id: 'halo-w3',
          d: mkLoop(Math.round(108 * insetScale), 0.3),
          color: w3Color,
          shadowOffsetX: 0,
          shadowOffsetY: 14,
          shadowBlur: 26,
        },
        {
          id: 'halo-w2',
          d: mkLoop(Math.round(70 * insetScale), 1.4),
          color: w2Color,
          shadowOffsetX: 0,
          shadowOffsetY: 14,
          shadowBlur: 26,
        },
        {
          id: 'halo-w1',
          d: mkLoop(Math.round(34 * insetScale), 2.4),
          color: w1Color,
          shadowOffsetX: 0,
          shadowOffsetY: 14,
          shadowBlur: 28,
        },
        {
          id: 'halo-creamy',
          d: mkLoop(0, 0),
          color: sheetFill,
          shadowOffsetX: 0,
          shadowOffsetY: 16,
          shadowBlur: 32,
        },
      ],
    };
  }

  // 3. LEFT SPINE S-CURVE
  if (variant === 'vertical-scurve-left') {
    const guideX = yStations.map((_, i) => {
      const t = i / (N - 1);
      return 345 + Math.sin(t * Math.PI * 2.1) * 76 + Math.cos(t * Math.PI * 1.1) * 28;
    });
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
        x: clamp(p.x - dx - (dx === 0 ? 0 : Math.sin(i * 0.95 + phase) * 18), 15, 1860),
        y: p.y,
      }));
      return `${smoothSplineSegment(wPts)} L 1920 1080 L 1920 0 Z`;
    };

    return {
      bottomBaseColor: baseFill,
      bottomCavernRect: { x: 0, y: 0, w: 460, h: 1080 },
      controlPoints: pts,
      layers: [
        {
          id: 'ls-w3',
          d: mkWave(128, 0.4),
          color: w3Color,
          shadowOffsetX: -12,
          shadowOffsetY: 8,
          shadowBlur: 24,
        },
        {
          id: 'ls-w2',
          d: mkWave(82, 1.5),
          color: w2Color,
          shadowOffsetX: -12,
          shadowOffsetY: 8,
          shadowBlur: 24,
        },
        {
          id: 'ls-w1',
          d: mkWave(40, 2.5),
          color: w1Color,
          shadowOffsetX: -14,
          shadowOffsetY: 10,
          shadowBlur: 26,
        },
        {
          id: 'ls-creamy',
          d: mkWave(0, 0),
          color: sheetFill,
          shadowOffsetX: -16,
          shadowOffsetY: 10,
          shadowBlur: 28,
        },
      ],
    };
  }

  // 4. MAJORITY COLOURED TOP + BOTTOM PAPER SWEEP (dark-canvas-bottom-paper)
  if (variant === 'dark-canvas-bottom-paper') {
    const guideY = xStations.map((_, i) => {
      const t = i / (N - 1);
      return 910 + Math.sin(t * Math.PI * 2.2) * 36 + Math.cos(t * Math.PI * 1.1) * 18;
    });
    const autoBoundY = solveHorizontalBottomBoundary(guideY, xStations, obstacles, false);
    const hasCustomPts = customControlPoints && customControlPoints.length === N;
    const pts: Point[] = hasCustomPts
      ? customControlPoints.map((p) => ({
          x: clamp(p.x, 0, 1920),
          y: clamp(p.y, 680, 1060),
        }))
      : xStations.map((x, i) => ({ x, y: autoBoundY[i] }));

    const mkBottomSheetWave = (dy: number, phase: number) => {
      const wPts = pts.map((p, i) => ({
        x: p.x,
        y: clamp(p.y - dy + (dy === 0 ? 0 : Math.sin(i * 1.05 + phase) * 14), 680, 1060),
      }));
      return `${smoothSplineSegment(wPts)} L 1920 1080 L 0 1080 Z`;
    };

    const avgY = pts.reduce((a, b) => a + b.y, 0) / pts.length;

    return {
      bottomBaseColor: baseFill,
      bottomCavernRect: {
        x: 0,
        y: 0,
        w: 1920,
        h: Math.min(1080, avgY + 40),
      },
      controlPoints: pts,
      layers: [
        {
          id: 'dc-b-w3',
          d: mkBottomSheetWave(90, 0.4),
          color: w3Color,
          shadowOffsetX: 0,
          shadowOffsetY: -12,
          shadowBlur: 24,
        },
        {
          id: 'dc-b-w2',
          d: mkBottomSheetWave(58, 1.5),
          color: w2Color,
          shadowOffsetX: 0,
          shadowOffsetY: -12,
          shadowBlur: 24,
        },
        {
          id: 'dc-b-w1',
          d: mkBottomSheetWave(28, 2.5),
          color: w1Color,
          shadowOffsetX: 0,
          shadowOffsetY: -14,
          shadowBlur: 26,
        },
        {
          id: 'dc-b-creamy',
          d: mkBottomSheetWave(0, 0),
          color: sheetFill,
          shadowOffsetX: 0,
          shadowOffsetY: -18,
          shadowBlur: 30,
        },
      ],
    };
  }

  // 5. HORIZONTAL BOTTOM WAVES (corner-cavern-br, bottom-undulation, diagonal-surge)
  if (
    variant === 'corner-cavern-br' ||
    variant === 'bottom-undulation' ||
    variant === 'diagonal-surge'
  ) {
    const guideY = xStations.map((_, i) => {
      const t = i / (N - 1);
      if (variant === 'corner-cavern-br') {
        return 925 - Math.pow(t, 1.45) * 400 + Math.sin(t * Math.PI * 2.4) * 44;
      }
      if (variant === 'diagonal-surge') {
        return 950 - Math.pow(t, 1.3) * 360 + Math.cos(t * Math.PI * 2.3) * 42;
      }
      return 805 + Math.sin(t * Math.PI * 2.5) * 48 + Math.cos(t * Math.PI * 1.2) * 22;
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
          p.y + dy + (dy === 0 ? 0 : Math.sin(i * 1.0 + phase) * 16),
          35,
          1072
        ),
      }));
      return `${smoothSplineSegment(wPts)} L 1920 0 L 0 0 Z`;
    };

    const avgY = pts.reduce((a, b) => a + b.y, 0) / pts.length;

    return {
      bottomBaseColor: baseFill,
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
          color: w3Color,
          shadowOffsetX: 0,
          shadowOffsetY: 12,
          shadowBlur: 24,
        },
        {
          id: 'bh-w2',
          d: mkWave(84, 1.7),
          color: w2Color,
          shadowOffsetX: 0,
          shadowOffsetY: 12,
          shadowBlur: 24,
        },
        {
          id: 'bh-w1',
          d: mkWave(40, 2.8),
          color: w1Color,
          shadowOffsetX: 0,
          shadowOffsetY: 14,
          shadowBlur: 26,
        },
        {
          id: 'bh-creamy',
          d: mkWave(0, 0),
          color: sheetFill,
          shadowOffsetX: 0,
          shadowOffsetY: 18,
          shadowBlur: 30,
        },
      ],
    };
  }

  // 6. RIGHT-SIDE PROCEDURAL CAVERN WAVES & MAJORITY-COLOURED LEFT PAPER ISLAND
  const guideX = yStations.map((_, i) => {
    const t = i / (N - 1);
    if (variant === 'dark-canvas-left-paper') {
      // Compact left white sheet (~42% width), leaving ~58% coloured waves & dark cavern on the right
      return 865 + Math.sin(t * Math.PI * 2.3) * 76 + Math.cos(t * Math.PI * 1.2) * 32;
    }
    if (variant === 'corner-cavern-tr') {
      return 1070 + Math.pow(t, 1.25) * 630 + Math.sin(t * Math.PI * 2.4) * 64;
    }
    if (variant === 'dual-ribbon') {
      return 1250 + Math.pow(t, 1.15) * 460 + Math.cos(t * Math.PI * 2.2) * 58;
    }
    if (variant === 'island-cutout-right') {
      return 1020 + Math.sin(t * Math.PI * 2.4) * 82 + Math.cos(t * Math.PI * 1.3) * 28;
    }
    // vertical-scurve-right: pronounced organic S-curve down the middle-right
    return 1025 + Math.sin(t * Math.PI * 2.15) * 86 + Math.cos(t * Math.PI * 1.05) * 30;
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
        p.x + dx + (dx === 0 ? 0 : Math.sin(i * 1.0 + phase) * 18),
        120,
        1908
      ),
      y: p.y,
    }));
    return `${smoothSplineSegment(wPts)} L 0 1080 L 0 0 Z`;
  };

  const minRightCavernX = Math.min(...pts.map((p) => p.x));
  const avgRightCavernX = pts.reduce((a, b) => a + b.x, 0) / pts.length;

  const layers: PaperCutLayer[] = [
    {
      id: 'rc-w3',
      d: mkRightWave(138, 0.4),
      color: w3Color,
      shadowOffsetX: 12,
      shadowOffsetY: 10,
      shadowBlur: 24,
    },
    {
      id: 'rc-w2',
      d: mkRightWave(88, 1.6),
      color: w2Color,
      shadowOffsetX: 12,
      shadowOffsetY: 10,
      shadowBlur: 24,
    },
    {
      id: 'rc-w1',
      d: mkRightWave(42, 2.7),
      color: w1Color,
      shadowOffsetX: 14,
      shadowOffsetY: 12,
      shadowBlur: 26,
    },
    {
      id: 'rc-creamy',
      d: mkRightWave(0, 0),
      color: sheetFill,
      shadowOffsetX: 18,
      shadowOffsetY: 14,
      shadowBlur: 32,
    },
  ];

  if (
    variant === 'island-cutout-right' ||
    variant === 'corner-cavern-tr' ||
    variant === 'dark-canvas-left-paper'
  ) {
    const sampleIdx = Math.min(pts.length - 1, 7);
    const pebbleX = clamp(Math.max(pts[sampleIdx].x + 220, 1520), 1300, 1780);
    const pebbleY = variant === 'corner-cavern-tr' ? 185 : 840;
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
        color: w2Color,
        shadowOffsetX: -8,
        shadowOffsetY: 12,
        shadowBlur: 20,
      });
    }
  }

  return {
    bottomBaseColor: baseFill,
    bottomCavernRect: {
      x: clamp(Math.min(minRightCavernX, avgRightCavernX) - 10, 460, 1300),
      y: 0,
      w: 1920 - clamp(Math.min(minRightCavernX, avgRightCavernX) - 10, 460, 1300),
      h: 1080,
    },
    controlPoints: pts,
    layers,
  };
}
