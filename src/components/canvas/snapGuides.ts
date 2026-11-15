export interface SnapBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SnapGuideLine {
  orientation: 'vertical' | 'horizontal';
  pos: number;
  start: number;
  end: number;
  label?: string;
}

export interface DistanceGuide {
  orientation: 'horizontal' | 'vertical';
  start: number;
  end: number;
  crossPos: number;
  distance: number;
}

export interface SnapResult {
  snappedX: number;
  snappedY: number;
  guides: SnapGuideLine[];
  distanceGuides: DistanceGuide[];
}

export function calculateSnapping(
  activeBox: SnapBox,
  otherBoxes: SnapBox[],
  threshold = 8,
  disabled = false
): SnapResult {
  if (disabled || otherBoxes.length === 0) {
    return {
      snappedX: activeBox.x,
      snappedY: activeBox.y,
      guides: [],
      distanceGuides: [],
    };
  }

  let snappedX = activeBox.x;
  let snappedY = activeBox.y;
  let bestDeltaX = Infinity;
  let bestDeltaY = Infinity;
  const guides: SnapGuideLine[] = [];
  const distanceGuides: DistanceGuide[] = [];

  const aW = activeBox.w;
  const aH = activeBox.h;
  const aLeft = activeBox.x;
  const aRight = activeBox.x + aW;
  const aCenterX = activeBox.x + aW / 2;

  const aTop = activeBox.y;
  const aBottom = activeBox.y + aH;
  const aCenterY = activeBox.y + aH / 2;

  // 1. Center of canvas landmarks
  const canvasCenterX = 960;
  const canvasCenterY = 540;

  if (Math.abs(aCenterX - canvasCenterX) <= threshold) {
    bestDeltaX = canvasCenterX - aCenterX;
    snappedX = activeBox.x + bestDeltaX;
    guides.push({
      orientation: 'vertical',
      pos: canvasCenterX,
      start: 0,
      end: 1080,
      label: 'Center',
    });
  }

  if (Math.abs(aCenterY - canvasCenterY) <= threshold) {
    bestDeltaY = canvasCenterY - aCenterY;
    snappedY = activeBox.y + bestDeltaY;
    guides.push({
      orientation: 'horizontal',
      pos: canvasCenterY,
      start: 0,
      end: 1920,
      label: 'Center',
    });
  }

  // 2. Horizontal Edge and Center Snapping (against other boxes)
  for (const b of otherBoxes) {
    const bLeft = b.x;
    const bRight = b.x + b.w;
    const bCenterX = b.x + b.w / 2;

    const yStart = Math.min(aTop, b.y) - 20;
    const yEnd = Math.max(aBottom, b.y + b.h) + 20;

    // aLeft -> bLeft
    if (Math.abs(aLeft - bLeft) <= threshold && Math.abs(aLeft - bLeft) < Math.abs(bestDeltaX)) {
      bestDeltaX = bLeft - aLeft;
      snappedX = bLeft;
      guides.length = 0; // replace with better fit
      guides.push({ orientation: 'vertical', pos: bLeft, start: yStart, end: yEnd });
    }
    // aLeft -> bRight
    if (Math.abs(aLeft - bRight) <= threshold && Math.abs(aLeft - bRight) < Math.abs(bestDeltaX)) {
      bestDeltaX = bRight - aLeft;
      snappedX = bRight;
      guides.length = 0;
      guides.push({ orientation: 'vertical', pos: bRight, start: yStart, end: yEnd });
    }
    // aRight -> bLeft
    if (Math.abs(aRight - bLeft) <= threshold && Math.abs(aRight - bLeft) < Math.abs(bestDeltaX)) {
      bestDeltaX = bLeft - aRight;
      snappedX = bLeft - aW;
      guides.length = 0;
      guides.push({ orientation: 'vertical', pos: bLeft, start: yStart, end: yEnd });
    }
    // aRight -> bRight
    if (Math.abs(aRight - bRight) <= threshold && Math.abs(aRight - bRight) < Math.abs(bestDeltaX)) {
      bestDeltaX = bRight - aRight;
      snappedX = bRight - aW;
      guides.length = 0;
      guides.push({ orientation: 'vertical', pos: bRight, start: yStart, end: yEnd });
    }
    // aCenterX -> bCenterX
    if (Math.abs(aCenterX - bCenterX) <= threshold && Math.abs(aCenterX - bCenterX) < Math.abs(bestDeltaX)) {
      bestDeltaX = bCenterX - aCenterX;
      snappedX = bCenterX - aW / 2;
      guides.length = 0;
      guides.push({ orientation: 'vertical', pos: bCenterX, start: yStart, end: yEnd, label: 'Center' });
    }
  }

  // 3. Vertical Edge and Center Snapping (against other boxes)
  for (const b of otherBoxes) {
    const bTop = b.y;
    const bBottom = b.y + b.h;
    const bCenterY = b.y + b.h / 2;

    const xStart = Math.min(aLeft, b.x) - 20;
    const xEnd = Math.max(aRight, b.x + b.w) + 20;

    // aTop -> bTop
    if (Math.abs(aTop - bTop) <= threshold && Math.abs(aTop - bTop) < Math.abs(bestDeltaY)) {
      bestDeltaY = bTop - aTop;
      snappedY = bTop;
      guides.push({ orientation: 'horizontal', pos: bTop, start: xStart, end: xEnd });
    }
    // aTop -> bBottom
    if (Math.abs(aTop - bBottom) <= threshold && Math.abs(aTop - bBottom) < Math.abs(bestDeltaY)) {
      bestDeltaY = bBottom - aTop;
      snappedY = bBottom;
      guides.push({ orientation: 'horizontal', pos: bBottom, start: xStart, end: xEnd });
    }
    // aBottom -> bTop
    if (Math.abs(aBottom - bTop) <= threshold && Math.abs(aBottom - bTop) < Math.abs(bestDeltaY)) {
      bestDeltaY = bTop - aBottom;
      snappedY = bTop - aH;
      guides.push({ orientation: 'horizontal', pos: bTop, start: xStart, end: xEnd });
    }
    // aBottom -> bBottom
    if (Math.abs(aBottom - bBottom) <= threshold && Math.abs(aBottom - bBottom) < Math.abs(bestDeltaY)) {
      bestDeltaY = bBottom - aBottom;
      snappedY = bBottom - aH;
      guides.push({ orientation: 'horizontal', pos: bBottom, start: xStart, end: xEnd });
    }
    // aCenterY -> bCenterY
    if (Math.abs(aCenterY - bCenterY) <= threshold && Math.abs(aCenterY - bCenterY) < Math.abs(bestDeltaY)) {
      bestDeltaY = bCenterY - aCenterY;
      snappedY = bCenterY - aH / 2;
      guides.push({ orientation: 'horizontal', pos: bCenterY, start: xStart, end: xEnd, label: 'Center' });
    }
  }

  // 4. Common Distance / Equal Spacing Snapping
  // Horizontal common spacing (between pairs of other boxes)
  if (otherBoxes.length >= 2) {
    for (let i = 0; i < otherBoxes.length; i++) {
      for (let j = 0; j < otherBoxes.length; j++) {
        if (i === j) continue;
        const b1 = otherBoxes[i];
        const b2 = otherBoxes[j];

        // Ensure b1 is to the left of b2
        if (b1.x + b1.w < b2.x) {
          const gap = b2.x - (b1.x + b1.w);
          if (gap > 12) {
            const crossY = (b1.y + b1.h / 2 + b2.y + b2.h / 2) / 2;

            // Scenario A: Active box placed to the right of b2 with matching gap
            const targetXRight = b2.x + b2.w + gap;
            if (Math.abs(activeBox.x - targetXRight) <= threshold && Math.abs(activeBox.x - targetXRight) < Math.abs(bestDeltaX)) {
              bestDeltaX = targetXRight - activeBox.x;
              snappedX = targetXRight;
              distanceGuides.push(
                { orientation: 'horizontal', start: b1.x + b1.w, end: b2.x, crossPos: crossY, distance: Math.round(gap) },
                { orientation: 'horizontal', start: b2.x + b2.w, end: targetXRight, crossPos: (b2.y + b2.h / 2 + aCenterY) / 2, distance: Math.round(gap) }
              );
            }

            // Scenario B: Active box placed to the left of b1 with matching gap
            const targetXLeft = b1.x - gap - aW;
            if (Math.abs(activeBox.x - targetXLeft) <= threshold && Math.abs(activeBox.x - targetXLeft) < Math.abs(bestDeltaX)) {
              bestDeltaX = targetXLeft - activeBox.x;
              snappedX = targetXLeft;
              distanceGuides.push(
                { orientation: 'horizontal', start: targetXLeft + aW, end: b1.x, crossPos: (aCenterY + b1.y + b1.h / 2) / 2, distance: Math.round(gap) },
                { orientation: 'horizontal', start: b1.x + b1.w, end: b2.x, crossPos: crossY, distance: Math.round(gap) }
              );
            }

            // Scenario C: Active box placed in the middle between b1 and b2 with equal spacing
            const totalSpan = b2.x - (b1.x + b1.w);
            if (totalSpan > aW + 16) {
              const eqGap = (totalSpan - aW) / 2;
              const targetXMid = b1.x + b1.w + eqGap;
              if (Math.abs(activeBox.x - targetXMid) <= threshold && Math.abs(activeBox.x - targetXMid) < Math.abs(bestDeltaX)) {
                bestDeltaX = targetXMid - activeBox.x;
                snappedX = targetXMid;
                distanceGuides.push(
                  { orientation: 'horizontal', start: b1.x + b1.w, end: targetXMid, crossPos: crossY, distance: Math.round(eqGap) },
                  { orientation: 'horizontal', start: targetXMid + aW, end: b2.x, crossPos: crossY, distance: Math.round(eqGap) }
                );
              }
            }
          }
        }

        // Vertical common spacing: ensure b1 is above b2
        if (b1.y + b1.h < b2.y) {
          const vGap = b2.y - (b1.y + b1.h);
          if (vGap > 12) {
            const crossX = (b1.x + b1.w / 2 + b2.x + b2.w / 2) / 2;

            // Scenario A: Active box placed below b2 with matching gap
            const targetYBelow = b2.y + b2.h + vGap;
            if (Math.abs(activeBox.y - targetYBelow) <= threshold && Math.abs(activeBox.y - targetYBelow) < Math.abs(bestDeltaY)) {
              bestDeltaY = targetYBelow - activeBox.y;
              snappedY = targetYBelow;
              distanceGuides.push(
                { orientation: 'vertical', start: b1.y + b1.h, end: b2.y, crossPos: crossX, distance: Math.round(vGap) },
                { orientation: 'vertical', start: b2.y + b2.h, end: targetYBelow, crossPos: (b2.x + b2.w / 2 + aCenterX) / 2, distance: Math.round(vGap) }
              );
            }

            // Scenario B: Active box placed above b1 with matching gap
            const targetYAbove = b1.y - vGap - aH;
            if (Math.abs(activeBox.y - targetYAbove) <= threshold && Math.abs(activeBox.y - targetYAbove) < Math.abs(bestDeltaY)) {
              bestDeltaY = targetYAbove - activeBox.y;
              snappedY = targetYAbove;
              distanceGuides.push(
                { orientation: 'vertical', start: targetYAbove + aH, end: b1.y, crossPos: (aCenterX + b1.x + b1.w / 2) / 2, distance: Math.round(vGap) },
                { orientation: 'vertical', start: b1.y + b1.h, end: b2.y, crossPos: crossX, distance: Math.round(vGap) }
              );
            }

            // Scenario C: Active box placed in the middle between b1 and b2 with equal spacing
            const totalVSpan = b2.y - (b1.y + b1.h);
            if (totalVSpan > aH + 16) {
              const eqVGap = (totalVSpan - aH) / 2;
              const targetYMid = b1.y + b1.h + eqVGap;
              if (Math.abs(activeBox.y - targetYMid) <= threshold && Math.abs(activeBox.y - targetYMid) < Math.abs(bestDeltaY)) {
                bestDeltaY = targetYMid - activeBox.y;
                snappedY = targetYMid;
                distanceGuides.push(
                  { orientation: 'vertical', start: b1.y + b1.h, end: targetYMid, crossPos: crossX, distance: Math.round(eqVGap) },
                  { orientation: 'vertical', start: targetYMid + aH, end: b2.y, crossPos: crossX, distance: Math.round(eqVGap) }
                );
              }
            }
          }
        }
      }
    }
  }

  return {
    snappedX: Math.round(snappedX),
    snappedY: Math.round(snappedY),
    guides,
    distanceGuides,
  };
}
