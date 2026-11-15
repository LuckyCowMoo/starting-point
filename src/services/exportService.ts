import PptxGenJS from 'pptxgenjs';
import { PlannedLesson, SlideData } from '../types/curriculum';
import { PHASE_PALETTES } from '../data/palettes';
import {
  rasterizePaperCutToPngDataUrl,
  sanitizeSvgMarkup,
} from '../components/canvas/PaperCutRenderer';
import {
  estimateSlideObstacles,
  isSlideRegionDark,
} from '../components/canvas/paperCutPresets';
import { isMcOptionCorrect, isTfOptionCorrect } from '../components/canvas/SlideCanvas';

function cleanHex(color?: string, fallback = '0F172A'): string {
  const c = (color || '').replace('#', '').trim();
  return /^[0-9a-fA-F]{6}$/.test(c) ? c.toUpperCase() : fallback;
}

function safeText(val?: unknown): string {
  return typeof val === 'string' ? val : val == null ? '' : String(val);
}

const pxX = (px: number) => Number(((px / 1920) * 13.333).toFixed(3));
const pxY = (px: number) => Number(((px / 1080) * 7.5).toFixed(3));

function getOverrideBox(slide: SlideData, slotId: string) {
  const o = slide.elementLayouts?.[slotId];
  if (!o) return null;
  return {
    x: pxX(o.x),
    y: pxY(o.y),
    w: Math.max(0.5, pxX(o.w)),
    h: Math.max(0.35, pxY(o.h)),
    layer: o.layer,
    boxed: o.boxed,
  };
}

async function svgStringToPngDataUrl(
  svgCode: string,
  width = 1280,
  height = 800
): Promise<string | null> {
  if (!svgCode || !svgCode.trim()) return null;
  const normalized = sanitizeSvgMarkup(svgCode);
  const blob = new Blob([normalized], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('SVG rasterization failed'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function imageUrlToDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    if (
      url.startsWith('data:image/png;base64,') ||
      url.startsWith('data:image/jpeg;base64,')
    ) {
      return url;
    }

    let objectUrl: string | null = null;
    let srcToLoad = url;
    if (!url.startsWith('data:')) {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) return null;
      objectUrl = URL.createObjectURL(blob);
      srcToLoad = objectUrl;
    }

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Image load failed'));
        image.src = srcToLoad;
      });
      const maxDim = 1600;
      const natW = Math.max(1, img.naturalWidth || img.width || 1200);
      const natH = Math.max(1, img.naturalHeight || img.height || 900);
      const ratio = Math.min(1, maxDim / Math.max(natW, natH));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(natW * ratio));
      canvas.height = Math.max(1, Math.round(natH * ratio));
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

function addSpeakerNotesAndBadges(pptSlide: PptxGenJS.Slide, slide: SlideData) {
  const parts: string[] = [];
  if (slide.speakerNotes) parts.push(slide.speakerNotes);
  if (slide.pedagogicalBadges) {
    parts.push(
      `\n[PEDAGOGY] ${slide.pedagogicalBadges.principle}\n[COGNITIVE LOAD] ${slide.pedagogicalBadges.cognitiveLoadNote}`
    );
    if (slide.pedagogicalBadges.retrievalLink) {
      parts.push(`[RETRIEVAL] ${slide.pedagogicalBadges.retrievalLink}`);
    }
  }
  if (parts.length > 0) {
    pptSlide.addNotes(parts.join('\n'));
  }
}

export async function generateLessonPptxBlob(
  lesson: PlannedLesson,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.333" x 7.5" (16:9)
  pptx.author = 'Starting Point';
  pptx.title = safeText(lesson.title) || 'Lesson Slides';

  for (let i = 0; i < lesson.slidesData.length; i++) {
    const slide = lesson.slidesData[i];
    const palette = PHASE_PALETTES[slide.phase];
    const accentHex = cleanHex(palette.accent, '047857');
    const darkInkHex = cleanHex(palette.darkInk, '0F172A');
    const borderHex = cleanHex(palette.borderAccent, 'CBD5E1');
    const hidden = new Set(slide.hiddenElementIds || []);

    onProgress?.(
      `Rendering 3D paper-cut slide ${i + 1} of ${lesson.slidesData.length}...`
    );

    const obstacles = estimateSlideObstacles(slide);
    const mediaPlacement =
      slide.mediaItem?.placement ??
      (slide.presetId === 'lesson-title-page'
        ? 'fill-bottom-layer'
        : 'boxed-card');
    const bottomFillMedia =
      slide.mediaItem && mediaPlacement === 'fill-bottom-layer'
        ? { ...slide.mediaItem, placement: 'fill-bottom-layer' as const }
        : undefined;

    const bgPng = await rasterizePaperCutToPngDataUrl(
      slide.phase,
      slide.waveVariant,
      obstacles,
      slide.customWaveLayers,
      bottomFillMedia,
      1920,
      1080,
      slide.waveControlPoints,
      Boolean(slide.invertWaveLayers)
    );

    const revealStates =
      slide.presetId === 'mwb-starter-quadrant' && slide.starterQuadrants?.length
        ? [0, 1, 2, 3, 4]
        : [0];

    const headerIsDark = isSlideRegionDark(
      slide.waveVariant,
      'header',
      Boolean(slide.invertWaveLayers)
    );
    const isBlockOnDark = (layer?: 'top' | 'bottom') =>
      isSlideRegionDark(
        slide.waveVariant,
        layer === 'bottom' ? 'bottom' : 'top',
        Boolean(slide.invertWaveLayers)
      );

    for (const revealCount of revealStates) {
      const pptSlide = pptx.addSlide();
      pptSlide.background = { data: bgPng };
      addSpeakerNotesAndBadges(pptSlide, slide);

      // Header title & timer/controls (non-title-page slides)
      if (slide.presetId !== 'lesson-title-page') {
        if (slide.presetId !== 'title-divider' && !hidden.has('slot-title')) {
          const titleOv = getOverrideBox(slide, 'slot-title');
          const titleOnDark = titleOv?.layer
            ? titleOv.layer === 'bottom'
            : headerIsDark;
          const titleBox = titleOv || {
            x: 0.65,
            y: 0.35,
            w: 9.5,
            h: 0.72,
          };
          if (titleOv?.boxed) {
            pptSlide.addShape(pptx.ShapeType.roundRect, {
              x: titleBox.x,
              y: titleBox.y,
              w: titleBox.w,
              h: titleBox.h,
              fill: { color: titleOnDark ? '1E293B' : 'FFFFFF', transparency: 8 },
              line: { color: titleOnDark ? '64748B' : borderHex, width: 1.2 },
              rectRadius: 0.14,
            });
          }
          pptSlide.addText(safeText(slide.title), {
            x: titleBox.x + (titleOv?.boxed ? 0.14 : 0),
            y: titleBox.y,
            w: Math.max(0.5, titleBox.w - (titleOv?.boxed ? 0.28 : 0)),
            h: titleBox.h,
            fontFace: 'Outfit',
            fontSize: 30,
            bold: true,
            color: titleOnDark ? 'FFFFFF' : darkInkHex,
          });
        }

        if (slide.timerSeconds && slide.timerSeconds > 0 && !hidden.has('slot-controls')) {
          const ctrlOv = getOverrideBox(slide, 'slot-controls');
          const mins = Math.max(1, Math.round(slide.timerSeconds / 60));
          pptSlide.addText(`${mins} MIN${mins === 1 ? '' : 'S'}`, {
            x: ctrlOv?.x ?? 11.1,
            y: ctrlOv?.y ?? 0.38,
            w: ctrlOv?.w ?? 1.55,
            h: ctrlOv?.h ?? 0.42,
            align: 'center',
            fontFace: 'JetBrains Mono',
            fontSize: 13,
            bold: true,
            color: accentHex,
            fill: { color: 'FAF6F0' },
            line: { color: accentHex, width: 1.5 },
            rectRadius: 0.1,
          });
        }
      }

      const isDualCodingLayout =
        slide.presetId === 'split-concept-dual-code' ||
        slide.presetId === 'worked-example-steps';
      const hasBoxedMedia =
        slide.presetId !== 'lesson-title-page' &&
        !hidden.has('slot-media') &&
        Boolean(slide.mediaItem && mediaPlacement !== 'fill-bottom-layer');

      // 1. 4-Quadrant MWB Starter (unboxed typography by default)
      if (slide.presetId === 'mwb-starter-quadrant' && slide.starterQuadrants) {
        const defaultPositions = [
          { x: 0.65, y: 1.35, w: 5.88, h: 2.75 },
          { x: 6.8, y: 1.35, w: 5.88, h: 2.75 },
          { x: 0.65, y: 4.3, w: 5.88, h: 2.75 },
          { x: 6.8, y: 4.3, w: 5.88, h: 2.75 },
        ];
        slide.starterQuadrants.slice(0, 4).forEach((q, qIdx) => {
          const slotId = `slot-quad-${qIdx}`;
          if (hidden.has(slotId)) return;
          const ov = getOverrideBox(slide, slotId);
          const pos = ov || defaultPositions[qIdx];
          const isRevealed = qIdx < revealCount;
          const quadOnDark = ov?.layer
            ? ov.layer === 'bottom'
            : isBlockOnDark('top');
          const quadBoxed = Boolean(ov?.boxed);

          if (quadBoxed) {
            pptSlide.addShape(pptx.ShapeType.roundRect, {
              x: pos.x,
              y: pos.y,
              w: pos.w,
              h: pos.h,
              fill: { color: quadOnDark ? '1E293B' : 'FFFFFF', transparency: 6 },
              line: {
                color: isRevealed ? accentHex : quadOnDark ? '64748B' : 'E2E8F0',
                width: isRevealed ? 2 : 1,
              },
              rectRadius: 0.15,
            });
          }

          const isTf =
            q.layout === 'true-false' ||
            (q.options &&
              q.options.length === 2 &&
              (q.options[0].toLowerCase().trim() === 'true' ||
                q.options[1].toLowerCase().trim() === 'false' ||
                q.options[0].toLowerCase().trim() === 'false' ||
                q.options[1].toLowerCase().trim() === 'true'));
          const hasImg = Boolean(q.imageUrl);
          const isMc =
            q.layout === 'multiple-choice' ||
            q.layout === 'identify-picture-mc' ||
            (!isTf && !q.layout && q.options && q.options.length > 0);

          let contentX = pos.x + 0.62;
          let contentW = Math.max(1.2, pos.w - 0.72);

          if (hasImg) {
            const imgW = 1.6;
            const imgH = Math.max(1.0, pos.h - 0.45);
            try {
              pptSlide.addImage({
                path: q.imageUrl,
                x: pos.x + 0.12,
                y: pos.y + 0.35,
                w: imgW,
                h: imgH,
              });
            } catch {
              // Ignore image load failure
            }
            contentX = pos.x + imgW + 0.25;
            contentW = Math.max(1.0, pos.w - (imgW + 0.38));
          }

          pptSlide.addText(String(qIdx + 1), {
            x: hasImg ? pos.x + 0.12 : pos.x + 0.12,
            y: pos.y + 0.1,
            w: 0.34,
            h: 0.34,
            align: 'center',
            valign: 'middle',
            fontFace: 'Outfit',
            fontSize: 11,
            bold: true,
            color: quadOnDark ? darkInkHex : 'FFFFFF',
            fill: { color: quadOnDark ? 'FFFFFF' : accentHex },
            rectRadius: 0.08,
          });

          pptSlide.addText(safeText(q.question), {
            x: contentX,
            y: pos.y + 0.1,
            w: contentW,
            h: isMc || isTf ? 0.75 : Math.max(0.8, pos.h - 0.9),
            fontFace: 'Plus Jakarta Sans',
            fontSize: hasImg ? 12.5 : 13.5,
            bold: true,
            color: quadOnDark ? 'FFFFFF' : darkInkHex,
            valign: 'top',
          });

          if (isTf) {
            // True / False Chooser in PPTX
            const tfW = Math.max(0.8, (contentW - 0.2) / 2);
            ['True', 'False'].forEach((tfVal, tfIdx) => {
              const isThisTrue = tfVal === 'True';
              const isCorrect = isTfOptionCorrect(isThisTrue, q.answer);
              const letter = tfIdx === 0 ? 'A' : 'B';

              pptSlide.addText(`${letter}. ${tfVal}`, {
                x: contentX + tfIdx * (tfW + 0.2),
                y: pos.y + 0.95,
                w: tfW,
                h: 0.5,
                align: 'center',
                valign: 'middle',
                fontFace: 'Plus Jakarta Sans',
                fontSize: 12,
                bold: Boolean(isRevealed && isCorrect),
                color: isRevealed
                  ? isCorrect
                    ? 'FFFFFF'
                    : '94A3B8'
                  : quadOnDark
                  ? 'FFFFFF'
                  : darkInkHex,
                fill: {
                  color: isRevealed
                    ? isCorrect
                      ? '059669'
                      : 'F1F5F9'
                    : 'F8FAFC',
                },
                line: {
                  color: isRevealed
                    ? isCorrect
                      ? '047857'
                      : 'E2E8F0'
                    : 'CBD5E1',
                  width: 1,
                },
                rectRadius: 0.08,
              });
            });

            if (isRevealed && q.answer && q.answer.includes('—')) {
              pptSlide.addText(safeText(q.answer), {
                x: contentX,
                y: pos.y + 1.55,
                w: contentW,
                h: 0.42,
                fontFace: 'Plus Jakarta Sans',
                fontSize: 10.5,
                bold: true,
                color: '065F46',
                fill: { color: 'ECFDF5' },
                line: { color: 'A7F3D0', width: 1 },
                rectRadius: 0.06,
                valign: 'middle',
              });
            }
          } else if (isMc && q.options && q.options.length > 0) {
            const colW = Math.max(1.0, (contentW - 0.15) / 2);
            q.options.slice(0, 4).forEach((opt, optIdx) => {
              const col = optIdx % 2;
              const row = Math.floor(optIdx / 2);
              const letter = ['A', 'B', 'C', 'D'][optIdx];
              const cleanOpt = safeText(opt).replace(/^[A-D][\s.):\-]+/i, '');
              const isCorrect = isMcOptionCorrect(opt, optIdx, q.answer);
              const optColor = isRevealed
                ? isCorrect
                  ? 'FFFFFF'
                  : quadOnDark
                  ? '94A3B8'
                  : '9CA3AF'
                : quadOnDark
                ? 'F1F5F9'
                : '334155';

              pptSlide.addText(`${letter}. ${cleanOpt}`, {
                x: contentX + col * (colW + 0.15),
                y: pos.y + 0.95 + row * 0.58,
                w: colW,
                h: 0.5,
                fontFace: 'Plus Jakarta Sans',
                fontSize: hasImg ? 10.5 : 11.5,
                bold: Boolean(isRevealed && isCorrect),
                color: optColor,
                ...(isRevealed && isCorrect
                  ? {
                      fill: { color: '059669' },
                      line: { color: '047857', width: 1.5 },
                      rectRadius: 0.08,
                    }
                  : {}),
              });
            });
          } else if (isRevealed) {
            pptSlide.addText(safeText(q.answer), {
              x: contentX,
              y: pos.y + Math.max(1.0, pos.h - 0.72),
              w: contentW,
              h: 0.54,
              fontFace: 'Plus Jakarta Sans',
              fontSize: 12,
              bold: true,
              color: 'FFFFFF',
              fill: { color: '059669' },
              line: { color: '047857', width: 1 },
              rectRadius: 0.08,
              valign: 'middle',
            });
          } else {
            pptSlide.addText('Whiteboard Response Area', {
              x: contentX,
              y: pos.y + Math.max(1.0, pos.h - 0.72),
              w: contentW,
              h: 0.54,
              fontFace: 'Plus Jakarta Sans',
              fontSize: 11,
              color: '94A3B8',
              line: { color: 'CBD5E1', width: 1, dashType: 'dash' },
              rectRadius: 0.08,
              align: 'center',
              valign: 'middle',
            });
          }
        });
      } else if (slide.presetId === 'lesson-title-page') {
        // 2. Lesson Title Page (unboxed by default)
        if (!hidden.has('slot-date')) {
          const dateOv = getOverrideBox(slide, 'slot-date');
          const dateOnDark = dateOv?.layer
            ? dateOv.layer === 'bottom'
            : isBlockOnDark('top');
          const dateStr =
            slide.lessonDate ||
            new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });
          const dateBox = dateOv || { x: 0.65, y: 0.5, w: 4.5, h: 0.45 };
          if (dateOv?.boxed) {
            pptSlide.addShape(pptx.ShapeType.roundRect, {
              x: dateBox.x,
              y: dateBox.y,
              w: dateBox.w,
              h: dateBox.h,
              fill: { color: dateOnDark ? '1E293B' : 'FFFFFF', transparency: 4 },
              line: { color: accentHex, width: 1.5 },
              rectRadius: 0.2,
            });
          }
          pptSlide.addText(safeText(dateStr), {
            x: dateBox.x + (dateOv?.boxed ? 0.14 : 0),
            y: dateBox.y,
            w: Math.max(1, dateBox.w - (dateOv?.boxed ? 0.28 : 0)),
            h: dateBox.h,
            fontFace: 'Outfit',
            fontSize: 14,
            bold: true,
            color: dateOnDark ? 'FFFFFF' : accentHex,
            valign: 'middle',
          });
        }

        if (!hidden.has('slot-title')) {
          const titleOv = getOverrideBox(slide, 'slot-title');
          const titleOnDark = titleOv?.layer
            ? titleOv.layer === 'bottom'
            : isBlockOnDark('top');
          const titleBox = titleOv || { x: 0.65, y: 1.15, w: 6.2, h: 1.85 };
          if (titleOv?.boxed) {
            pptSlide.addShape(pptx.ShapeType.roundRect, {
              x: titleBox.x,
              y: titleBox.y,
              w: titleBox.w,
              h: titleBox.h,
              fill: { color: titleOnDark ? '1E293B' : 'FFFFFF', transparency: 6 },
              line: { color: borderHex, width: 1.2 },
              rectRadius: 0.16,
            });
          }
          pptSlide.addText(safeText(slide.title), {
            x: titleBox.x + (titleOv?.boxed ? 0.15 : 0),
            y: titleBox.y,
            w: Math.max(1, titleBox.w - (titleOv?.boxed ? 0.3 : 0)),
            h: titleBox.h,
            fontFace: 'Outfit',
            fontSize: 38,
            bold: true,
            color: titleOnDark ? 'FFFFFF' : darkInkHex,
            valign: 'top',
          });
        }

        if (slide.bigQuestion && !hidden.has('slot-big-question')) {
          const bqOv = getOverrideBox(slide, 'slot-big-question');
          const bqOnDark = bqOv?.layer
            ? bqOv.layer === 'bottom'
            : isBlockOnDark('top');
          const bqBox = bqOv || { x: 0.65, y: 3.25, w: 6.1, h: 2.0 };
          if (bqOv?.boxed) {
            pptSlide.addShape(pptx.ShapeType.roundRect, {
              x: bqBox.x,
              y: bqBox.y,
              w: bqBox.w,
              h: bqBox.h,
              fill: { color: bqOnDark ? '1E293B' : 'FFFFFF', transparency: 5 },
              line: { color: accentHex, width: 2 },
              rectRadius: 0.18,
            });
          } else {
            pptSlide.addShape(pptx.ShapeType.rect, {
              x: bqBox.x,
              y: bqBox.y + 0.1,
              w: 0.08,
              h: Math.max(0.4, bqBox.h - 0.2),
              fill: { color: bqOnDark ? 'FFFFFF' : accentHex },
              line: { color: bqOnDark ? 'FFFFFF' : accentHex, width: 0 },
            });
          }
          pptSlide.addText(
            [
              {
                text: "TODAY'S ENQUIRY\n",
                options: {
                  bold: true,
                  fontSize: 11,
                  color: bqOnDark ? 'FFFFFF' : accentHex,
                },
              },
              {
                text: safeText(slide.bigQuestion),
                options: {
                  bold: true,
                  fontSize: 18,
                  color: bqOnDark ? 'FFFFFF' : darkInkHex,
                },
              },
            ],
            {
              x: bqBox.x + 0.24,
              y: bqBox.y + 0.08,
              w: Math.max(1, bqBox.w - 0.36),
              h: Math.max(0.6, bqBox.h - 0.16),
              fontFace: 'Outfit',
              valign: 'middle',
            }
          );
        }

        if (
          slide.keyTermsStrip &&
          slide.keyTermsStrip.length > 0 &&
          !hidden.has('slot-terms-inline')
        ) {
          const termsOv = getOverrideBox(slide, 'slot-terms-inline');
          const termsOnDark = termsOv?.layer
            ? termsOv.layer === 'bottom'
            : isBlockOnDark('top');
          const termsBox = termsOv || { x: 0.65, y: 6.1, w: 6.1, h: 0.7 };
          const joinedTerms = slide.keyTermsStrip.map((kt) => kt.term).join('   •   ');
          pptSlide.addText(joinedTerms, {
            x: termsBox.x,
            y: termsBox.y,
            w: termsBox.w,
            h: termsBox.h,
            fontFace: 'Plus Jakarta Sans',
            fontSize: 14,
            bold: true,
            color: termsOnDark ? 'FFFFFF' : accentHex,
            valign: 'middle',
          });
        }

        if (
          slide.mediaItem &&
          mediaPlacement !== 'fill-bottom-layer' &&
          !hidden.has('slot-media')
        ) {
          const mediaOv = getOverrideBox(slide, 'slot-media');
          const mBox = mediaOv || { x: 7.3, y: 0.85, w: 5.4, h: 5.6 };
          let coverUri: string | null = null;
          if (slide.mediaItem.type === 'svg-diagram' && slide.mediaItem.svgCode) {
            coverUri = await svgStringToPngDataUrl(slide.mediaItem.svgCode);
          } else if (slide.mediaItem.url) {
            coverUri = await imageUrlToDataUrl(slide.mediaItem.url);
          }
          if (coverUri) {
            pptSlide.addImage({
              data: coverUri,
              x: mBox.x,
              y: mBox.y,
              w: mBox.w,
              h: mBox.h,
              sizing: {
                type: slide.mediaItem.cropFit === 'contain' ? 'contain' : 'cover',
                w: mBox.w,
                h: mBox.h,
              },
            });
          }
        }
      } else if (slide.presetId === 'title-divider') {
        // 3. Title & Big Question Divider
        if (!hidden.has('slot-title')) {
          const titleOv = getOverrideBox(slide, 'slot-title');
          const titleOnDark = titleOv?.layer
            ? titleOv.layer === 'bottom'
            : isBlockOnDark('top');
          const titleBox = titleOv || { x: 0.65, y: 0.55, w: 8.5, h: 1.2 };
          pptSlide.addText(safeText(slide.title), {
            x: titleBox.x,
            y: titleBox.y,
            w: titleBox.w,
            h: titleBox.h,
            fontFace: 'Outfit',
            fontSize: 38,
            bold: true,
            color: titleOnDark ? 'FFFFFF' : darkInkHex,
          });
        }

        if (slide.bigQuestion && !hidden.has('slot-big-question')) {
          const bqOv = getOverrideBox(slide, 'slot-big-question');
          const bqOnDark = bqOv?.layer
            ? bqOv.layer === 'bottom'
            : isBlockOnDark('top');
          const bqBox = bqOv || { x: 0.65, y: 2.0, w: 7.4, h: 2.2 };
          if (bqOv?.boxed) {
            pptSlide.addShape(pptx.ShapeType.roundRect, {
              x: bqBox.x,
              y: bqBox.y,
              w: bqBox.w,
              h: bqBox.h,
              fill: { color: bqOnDark ? '1E293B' : 'FFFFFF', transparency: 5 },
              line: { color: accentHex, width: 2 },
              rectRadius: 0.18,
            });
          } else {
            pptSlide.addShape(pptx.ShapeType.rect, {
              x: bqBox.x,
              y: bqBox.y + 0.12,
              w: 0.09,
              h: Math.max(0.4, bqBox.h - 0.24),
              fill: { color: bqOnDark ? 'FFFFFF' : accentHex },
              line: { color: bqOnDark ? 'FFFFFF' : accentHex, width: 0 },
            });
          }
          pptSlide.addText(safeText(slide.bigQuestion), {
            x: bqBox.x + 0.25,
            y: bqBox.y + 0.1,
            w: Math.max(1, bqBox.w - 0.35),
            h: Math.max(0.5, bqBox.h - 0.2),
            fontFace: 'Outfit',
            fontSize: 22,
            bold: true,
            color: bqOnDark ? 'FFFFFF' : darkInkHex,
            valign: 'middle',
          });
        }

        if (slide.keyTermsStrip) {
          slide.keyTermsStrip.slice(0, 3).forEach((kt, idx) => {
            const slotId = `slot-term-${idx}`;
            if (hidden.has(slotId)) return;
            const ov = getOverrideBox(slide, slotId);
            const termOnDark = ov?.layer
              ? ov.layer === 'bottom'
              : isBlockOnDark('top');
            const box = ov || { x: 0.65 + idx * 3.95, y: 5.05, w: 3.7, h: 1.75 };

            if (ov?.boxed) {
              pptSlide.addShape(pptx.ShapeType.roundRect, {
                x: box.x,
                y: box.y,
                w: box.w,
                h: box.h,
                fill: { color: termOnDark ? '1E293B' : 'FFFFFF', transparency: 5 },
                line: { color: borderHex, width: 1 },
                rectRadius: 0.14,
              });
            } else {
              pptSlide.addShape(pptx.ShapeType.rect, {
                x: box.x,
                y: box.y,
                w: Math.min(box.w, 1.4),
                h: 0.05,
                fill: { color: termOnDark ? 'FFFFFF' : accentHex },
                line: { color: termOnDark ? 'FFFFFF' : accentHex, width: 0 },
              });
            }
            pptSlide.addText(
              [
                {
                  text: `${safeText(kt.term)}\n`,
                  options: {
                    bold: true,
                    fontSize: 16,
                    color: termOnDark ? 'FFFFFF' : accentHex,
                  },
                },
                {
                  text: safeText(kt.definition),
                  options: {
                    fontSize: 13,
                    color: termOnDark ? 'F1F5F9' : '3F3F46',
                  },
                },
              ],
              {
                x: box.x + (ov?.boxed ? 0.16 : 0),
                y: box.y + 0.12,
                w: Math.max(0.8, box.w - (ov?.boxed ? 0.32 : 0)),
                h: Math.max(0.5, box.h - 0.2),
                valign: 'top',
              }
            );
          });
        }
      } else if (
        (slide.presetId === 'vocab-words-only' ||
          slide.presetId === 'vocab-single-term-focus' ||
          slide.presetId === 'vocabulary-spotlight') &&
        (slide.keyTermsStrip?.length || slide.bodyBlocks.length)
      ) {
        const vocabItems = slide.keyTermsStrip?.length
          ? slide.keyTermsStrip
          : slide.bodyBlocks.map((b) => ({
              term: b.heading || 'Key Term',
              definition: b.content,
            }));

        if (slide.presetId === 'vocab-single-term-focus' && vocabItems[0]) {
          if (!hidden.has('slot-vocab-focus')) {
            const ov = getOverrideBox(slide, 'slot-vocab-focus');
            const onDark = ov?.layer ? ov.layer === 'bottom' : isBlockOnDark('top');
            const box = ov || { x: 0.65, y: 1.6, w: 6.1, h: 4.5 };
            const item = vocabItems[0];

            if (ov?.boxed) {
              pptSlide.addShape(pptx.ShapeType.roundRect, {
                x: box.x,
                y: box.y,
                w: box.w,
                h: box.h,
                fill: { color: onDark ? '1E293B' : 'FFFFFF', transparency: 4 },
                line: { color: accentHex, width: 2 },
                rectRadius: 0.16,
              });
            } else {
              pptSlide.addShape(pptx.ShapeType.rect, {
                x: box.x,
                y: box.y + 0.12,
                w: 0.09,
                h: Math.max(0.5, box.h - 0.24),
                fill: { color: onDark ? 'FFFFFF' : accentHex },
                line: { color: onDark ? 'FFFFFF' : accentHex, width: 0 },
              });
            }
            pptSlide.addText(
              [
                {
                  text: `${safeText(item.term)}\n\n`,
                  options: {
                    bold: true,
                    fontSize: 28,
                    color: onDark ? 'FFFFFF' : accentHex,
                  },
                },
                {
                  text: safeText(item.definition),
                  options: { fontSize: 18, color: onDark ? 'F1F5F9' : darkInkHex },
                },
              ],
              {
                x: box.x + 0.26,
                y: box.y + 0.12,
                w: Math.max(1, box.w - 0.36),
                h: Math.max(0.8, box.h - 0.24),
                valign: 'top',
              }
            );
          }
        } else {
          const isWordsOnly = slide.presetId === 'vocab-words-only';
          vocabItems.slice(0, 6).forEach((vt, idx) => {
            const slotId = `slot-vocab-${idx}`;
            if (hidden.has(slotId)) return;
            const ov = getOverrideBox(slide, slotId);
            const onDark = ov?.layer ? ov.layer === 'bottom' : isBlockOnDark('top');
            const rowH = vocabItems.length >= 5 ? 0.88 : 1.08;
            const box = ov || { x: 0.65, y: 1.45 + idx * (rowH + 0.1), w: 6.1, h: rowH };

            if (ov?.boxed) {
              pptSlide.addShape(pptx.ShapeType.roundRect, {
                x: box.x,
                y: box.y,
                w: box.w,
                h: box.h,
                fill: { color: onDark ? '1E293B' : 'FFFFFF', transparency: 4 },
                line: { color: borderHex, width: 1.2 },
                rectRadius: 0.12,
              });
            }
            pptSlide.addText(
              isWordsOnly
                ? `${safeText(vt.term)}\n_______________________________________`
                : [
                    {
                      text: `${safeText(vt.term)}: `,
                      options: {
                        bold: true,
                        fontSize: 15,
                        color: onDark ? 'FFFFFF' : accentHex,
                      },
                    },
                    {
                      text: safeText(vt.definition),
                      options: {
                        fontSize: 13.5,
                        color: onDark ? 'F1F5F9' : '27272A',
                      },
                    },
                  ],
              {
                x: box.x + (ov?.boxed ? 0.18 : 0),
                y: box.y + 0.04,
                w: Math.max(1, box.w - (ov?.boxed ? 0.36 : 0)),
                h: Math.max(0.4, box.h - 0.08),
                valign: 'middle',
              }
            );
          });
        }
      } else if (slide.presetId === 'comparison-two-column') {
        const leftBlocks = slide.bodyBlocks.filter((b) => b.column !== 'right');
        const rightBlocks = slide.bodyBlocks.filter((b) => b.column === 'right');
        const colW = hasBoxedMedia ? 3.7 : 5.85;
        const colXCoords = [0.65, 0.65 + colW + 0.35];

        [leftBlocks, rightBlocks].forEach((colBlocks, colIdx) => {
          colBlocks.forEach((b, idx) => {
            if (hidden.has(b.id)) return;
            const ov = getOverrideBox(slide, b.id);
            const effectiveLayer = ov?.layer ?? b.layer ?? 'top';
            const isDarkSurface = isBlockOnDark(effectiveLayer);
            const isBoxed =
              ov?.boxed !== undefined
                ? ov.boxed
                : b.style === 'boxed' || b.style === 'code';
            const slotH = 4.9 / Math.max(1, colBlocks.length);
            const box = ov || {
              x: colXCoords[colIdx],
              y: 1.5 + idx * (slotH + 0.2),
              w: colW,
              h: slotH,
            };

            if (isBoxed) {
              pptSlide.addShape(pptx.ShapeType.roundRect, {
                x: box.x,
                y: box.y,
                w: box.w,
                h: box.h,
                fill: {
                  color:
                    b.style === 'code'
                      ? '09090B'
                      : isDarkSurface
                      ? '1E293B'
                      : 'FFFFFF',
                  transparency: b.style === 'code' ? 0 : 6,
                },
                line: { color: isDarkSurface ? '64748B' : borderHex, width: 1.2 },
                rectRadius: 0.14,
              });
            }
            pptSlide.addText(
              [
                ...(b.heading
                  ? [
                      {
                        text: `${safeText(b.heading)}\n`,
                        options: {
                          bold: true,
                          fontSize: 17,
                          color: isDarkSurface ? 'FFFFFF' : accentHex,
                        },
                      },
                    ]
                  : []),
                {
                  text: safeText(b.content),
                  options: {
                    fontSize: 14,
                    color: isDarkSurface ? 'F1F5F9' : darkInkHex,
                  },
                },
              ],
              {
                x: box.x + (isBoxed ? 0.18 : 0),
                y: box.y + 0.08,
                w: Math.max(0.8, box.w - (isBoxed ? 0.36 : 0)),
                h: Math.max(0.4, box.h - 0.16),
                valign: 'top',
              }
            );
          });
        });
      } else if (slide.presetId !== 'custom') {
        // Default, dual-code, process-timeline, worked-example, plenary, hinge, active-task (unboxed by default)
        const startX =
          slide.waveVariant === 'vertical-scurve-left' ||
          slide.waveVariant === 'dark-canvas-left-paper'
            ? 3.2
            : 0.65;
        const blockAreaW =
          slide.waveVariant === 'vertical-scurve-left' ||
          slide.waveVariant === 'dark-canvas-left-paper'
            ? 9.4
            : hasBoxedMedia || isDualCodingLayout
            ? 6.0
            : 11.8;
        const count = Math.max(1, slide.bodyBlocks.length);
        const blockH = Math.min(1.65, 5.1 / count);

        slide.bodyBlocks.forEach((b, idx) => {
          if (hidden.has(b.id)) return;
          const ov = getOverrideBox(slide, b.id);
          const effectiveLayer = ov?.layer ?? b.layer ?? 'top';
          const isDarkSurface = isBlockOnDark(effectiveLayer);
          const isCode = b.style === 'code';
          const isBoxed =
            ov?.boxed !== undefined ? ov.boxed : b.style === 'boxed' || isCode;
          const isHighlight = !isBoxed && (b.style === 'highlight' || b.style === 'challenge');
          const box = ov || {
            x: startX,
            y: 1.45 + idx * (blockH + 0.18),
            w: blockAreaW,
            h: blockH,
          };

          if (isBoxed) {
            pptSlide.addShape(pptx.ShapeType.roundRect, {
              x: box.x,
              y: box.y,
              w: box.w,
              h: box.h,
              fill: {
                color: isCode ? '09090B' : isDarkSurface ? '1E293B' : 'FFFFFF',
                transparency: isCode ? 0 : 6,
              },
              line: { color: isDarkSurface ? '64748B' : borderHex, width: 1.2 },
              rectRadius: 0.14,
            });
          } else if (isHighlight) {
            pptSlide.addShape(pptx.ShapeType.rect, {
              x: box.x,
              y: box.y + 0.08,
              w: 0.08,
              h: Math.max(0.35, box.h - 0.16),
              fill: { color: isDarkSurface ? 'FFFFFF' : accentHex },
              line: { color: isDarkSurface ? 'FFFFFF' : accentHex, width: 0 },
            });
          }

          pptSlide.addText(
            [
              ...(b.heading
                ? [
                    {
                      text: `${safeText(b.heading)}\n`,
                      options: {
                        bold: true,
                        fontSize: 16,
                        color: isDarkSurface
                          ? 'FFFFFF'
                          : isCode
                          ? '34D399'
                          : accentHex,
                      },
                    },
                  ]
                : []),
              {
                text: safeText(b.content),
                options: {
                  fontSize: 14,
                  fontFace: isCode ? 'JetBrains Mono' : 'Plus Jakarta Sans',
                  color: isDarkSurface
                    ? 'F1F5F9'
                    : isCode
                    ? 'A7F3D0'
                    : darkInkHex,
                },
              },
            ],
            {
              x: box.x + (isBoxed || isHighlight ? 0.2 : 0),
              y: box.y + 0.06,
              w: Math.max(0.8, box.w - (isBoxed || isHighlight ? 0.36 : 0)),
              h: Math.max(0.4, box.h - 0.12),
              valign: 'top',
            }
          );
        });
      }

      // Preset media visual slot (moved or default)
      if (hasBoxedMedia && slide.mediaItem) {
        const mediaOv = getOverrideBox(slide, 'slot-media');
        const mBox = mediaOv || {
          x: slide.presetId === 'comparison-two-column' ? 8.3 : 7.15,
          y: 1.5,
          w: slide.presetId === 'comparison-two-column' ? 4.4 : 5.5,
          h: 5.0,
        };
        let dataUri: string | null = null;
        if (slide.mediaItem.type === 'svg-diagram' && slide.mediaItem.svgCode) {
          dataUri = await svgStringToPngDataUrl(slide.mediaItem.svgCode);
        } else if (slide.mediaItem.url) {
          dataUri = await imageUrlToDataUrl(slide.mediaItem.url);
        }
        if (dataUri) {
          pptSlide.addImage({
            data: dataUri,
            x: mBox.x,
            y: mBox.y,
            w: mBox.w,
            h: mBox.h,
            sizing: { type: 'contain', w: mBox.w, h: mBox.h },
          });
        }
      }

      // Slide-level Table Data
      if (slide.tableData) {
        const tData = slide.tableData;
        const tableRows: any[] = [];
        if (tData.headers && tData.headers.length > 0) {
          tableRows.push(
            tData.headers.map((h) => ({
              text: safeText(h),
              options: {
                fill: { color: 'E2E8F0' },
                color: darkInkHex,
                bold: true,
                fontSize: 13,
                fontFace: 'Plus Jakarta Sans',
                align: 'center',
                valign: 'middle',
              },
            }))
          );
        }
        const numRows = Math.max(1, tData.rows || tData.cells?.length || 1);
        const numCols = Math.max(1, tData.cols || tData.headers?.length || tData.cells?.[0]?.length || 1);
        for (let r = 0; r < numRows; r++) {
          const row = tData.cells?.[r] || [];
          tableRows.push(
            Array.from({ length: numCols }, (_, c) => ({
              text: safeText(row[c] || ''),
              options: {
                fill: { color: r % 2 === 0 ? 'FFFFFF' : 'F8FAFC' },
                color: darkInkHex,
                fontSize: 12,
                fontFace: 'Plus Jakarta Sans',
                align: 'left',
                valign: 'middle',
              },
            }))
          );
        }
        pptSlide.addTable(tableRows, {
          x: 1.2,
          y: 2.2,
          w: 10.9,
          h: 4.5,
          border: { pt: 1, color: borderHex },
          autoPage: false,
        });
      }

      // Freeform & Custom Canvas Elements (supported on ALL presets!)
      if (slide.customCanvasElements && slide.customCanvasElements.length > 0) {
        for (const el of slide.customCanvasElements) {
          if (hidden.has(el.id)) continue;
          const ov = getOverrideBox(slide, el.id);
          const x = ov?.x ?? (el.x / 100) * 13.333;
          const y = ov?.y ?? (el.y / 100) * 7.5;
          const w = ov?.w ?? Math.max(0.8, (el.w / 100) * 13.333);
          const h = ov?.h ?? Math.max(0.5, (el.h / 100) * 7.5);
          const effectiveLayer = ov?.layer ?? el.layer ?? 'top';
          const isDarkSurface = isBlockOnDark(effectiveLayer) || el.tone === 'dark';
          const isBoxed =
            ov?.boxed !== undefined ? ov.boxed : Boolean(el.boxed);

          if (el.kind === 'table' || el.tableData) {
            const tData = el.tableData;
            if (tData) {
              const tableRows: any[] = [];
              if (tData.headers && tData.headers.length > 0) {
                tableRows.push(
                  tData.headers.map((h) => ({
                    text: safeText(h),
                    options: {
                      fill: { color: isDarkSurface ? '1E293B' : 'E2E8F0' },
                      color: isDarkSurface ? 'FFFFFF' : darkInkHex,
                      bold: true,
                      fontSize: 12,
                      fontFace: 'Plus Jakarta Sans',
                      align: 'center',
                      valign: 'middle',
                    },
                  }))
                );
              }
              const numRows = Math.max(1, tData.rows || tData.cells?.length || 1);
              const numCols = Math.max(1, tData.cols || tData.headers?.length || tData.cells?.[0]?.length || 1);
              for (let r = 0; r < numRows; r++) {
                const row = tData.cells?.[r] || [];
                tableRows.push(
                  Array.from({ length: numCols }, (_, c) => ({
                    text: safeText(row[c] || ''),
                    options: {
                      fill: { color: isDarkSurface ? '0F172A' : (r % 2 === 0 ? 'FFFFFF' : 'F8FAFC') },
                      color: isDarkSurface ? 'E2E8F0' : darkInkHex,
                      fontSize: 11,
                      fontFace: 'Plus Jakarta Sans',
                      align: 'left',
                      valign: 'middle',
                    },
                  }))
                );
              }
              pptSlide.addTable(tableRows, {
                x,
                y,
                w,
                h,
                border: { pt: 1, color: isDarkSurface ? '475569' : borderHex },
                autoPage: false,
              });
            }
          } else if (el.kind === 'image' && el.imageUrl) {
            const imgUri = await imageUrlToDataUrl(el.imageUrl);
            if (imgUri) {
              pptSlide.addImage({
                data: imgUri,
                x,
                y,
                w,
                h,
                sizing: {
                  type: el.cropFit === 'contain' ? 'contain' : 'cover',
                  w,
                  h,
                },
              });
            }
          } else if (el.svgCode) {
            const png = await svgStringToPngDataUrl(el.svgCode);
            if (isBoxed) {
              pptSlide.addShape(pptx.ShapeType.roundRect, {
                x,
                y,
                w,
                h,
                fill: { color: 'FFFFFF', transparency: 4 },
                line: { color: borderHex, width: 1.2 },
                rectRadius: 0.14,
              });
            }
            if (png) {
              pptSlide.addImage({
                data: png,
                x: x + 0.12,
                y: y + 0.12,
                w: Math.max(0.5, w - 0.24),
                h: Math.max(0.4, h - 0.24),
                sizing: {
                  type: 'contain',
                  w: Math.max(0.5, w - 0.24),
                  h: Math.max(0.4, h - 0.24),
                },
              });
            }
          } else if (el.kind !== 'image') {
            if (isBoxed) {
              pptSlide.addShape(pptx.ShapeType.roundRect, {
                x,
                y,
                w,
                h,
                fill: { color: isDarkSurface ? '1E293B' : 'FFFFFF', transparency: 6 },
                line: { color: isDarkSurface ? '64748B' : borderHex, width: 1.2 },
                rectRadius: 0.14,
              });
            }
            pptSlide.addText(
              [
                ...(el.heading
                  ? [
                      {
                        text: `${safeText(el.heading)}\n`,
                        options: {
                          bold: true,
                          fontSize: 15,
                          color: isDarkSurface ? 'FFFFFF' : accentHex,
                        },
                      },
                    ]
                  : []),
                {
                  text: safeText(el.content),
                  options: {
                    fontSize: 13.5,
                    color: isDarkSurface ? 'F1F5F9' : darkInkHex,
                  },
                },
              ],
              {
                x: x + (isBoxed ? 0.18 : 0),
                y: y + 0.08,
                w: Math.max(0.8, w - (isBoxed ? 0.36 : 0)),
                h: Math.max(0.4, h - 0.16),
                valign: 'top',
              }
            );
          }
        }
      }
    }
  }

  onProgress?.('Packaging .pptx file...');
  const out = await pptx.write({ outputType: 'blob' });
  return out as Blob;
}

export async function downloadLessonPptx(
  lesson: PlannedLesson,
  onProgress?: (msg: string) => void
): Promise<void> {
  const blob = await generateLessonPptxBlob(lesson, onProgress);
  const url = URL.createObjectURL(blob);
  const safeName = (lesson.title || 'lesson')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'lesson';
  const a = document.createElement('a');
  a.href = url;
  a.download = `L${lesson.lessonNumber}-${safeName}.pptx`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- Direct Google Drive / Google Slides Upload via GIS OAuth ---

interface GoogleTokenWindow extends Window {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (resp: { access_token?: string; error?: string }) => void;
        }) => { requestAccessToken: () => void };
      };
    };
  };
}

export async function exportLessonToGoogleSlides(
  lesson: PlannedLesson,
  googleClientId: string,
  onProgress?: (msg: string) => void
): Promise<{ id: string; webViewLink: string }> {
  if (!googleClientId.trim()) {
    throw new Error(
      'Enter your Google OAuth Client ID in Settings (or below) to create slides directly in Google Drive.'
    );
  }

  const gWindow = window as GoogleTokenWindow;
  if (!gWindow.google?.accounts?.oauth2) {
    throw new Error(
      'Google Identity Services script is still loading or blocked offline. Check network connectivity.'
    );
  }

  onProgress?.('Waiting for Google sign-in...');
  const accessToken = await new Promise<string>((resolve, reject) => {
    const client = gWindow.google!.accounts.oauth2.initTokenClient({
      client_id: googleClientId.trim(),
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || 'Google authorisation failed.'));
        } else {
          resolve(resp.access_token);
        }
      },
    });
    client.requestAccessToken();
  });

  const pptxBlob = await generateLessonPptxBlob(lesson, onProgress);
  onProgress?.('Uploading & converting to native Google Slides...');

  const metadata = {
    name: `Lesson ${lesson.lessonNumber} - ${lesson.title}`,
    mimeType: 'application/vnd.google-apps.presentation',
  };

  const boundary = 'starting_point_multipart_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart =
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata);
  const mediaHeader =
    'Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation\r\n\r\n';

  const bodyBlob = new Blob([
    delimiter,
    metadataPart,
    delimiter,
    mediaHeader,
    pptxBlob,
    closeDelimiter,
  ]);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: bodyBlob,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Google Drive upload error (${uploadRes.status}): ${errText}`);
  }

  const uploaded = (await uploadRes.json()) as {
    id: string;
    webViewLink?: string;
  };
  return {
    id: uploaded.id,
    webViewLink:
      uploaded.webViewLink ||
      `https://docs.google.com/presentation/d/${uploaded.id}/edit`,
  };
}
