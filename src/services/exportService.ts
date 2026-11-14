import PptxGenJS from 'pptxgenjs';
import { PlannedLesson, SlideData } from '../types/curriculum';
import { PHASE_PALETTES } from '../data/palettes';
import { rasterizePaperCutToPngDataUrl } from '../components/canvas/PaperCutRenderer';
import { estimateSlideObstacles } from '../components/canvas/paperCutPresets';

async function svgStringToPngDataUrl(
  svgCode: string,
  width = 1280,
  height = 800
): Promise<string> {
  const blob = new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function imageUrlToDataUrl(url: string): Promise<string | null> {
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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
  pptx.title = lesson.title;

  for (let i = 0; i < lesson.slidesData.length; i++) {
    const slide = lesson.slidesData[i];
    const palette = PHASE_PALETTES[slide.phase];
    onProgress?.(`Rendering 3D paper-cut slide ${i + 1} of ${lesson.slidesData.length}...`);

    const obstacles = estimateSlideObstacles(slide);
    const bottomFillMedia =
      slide.mediaItem && slide.mediaItem.placement === 'fill-bottom-layer'
        ? slide.mediaItem
        : undefined;

    const bgPng = await rasterizePaperCutToPngDataUrl(
      slide.phase,
      slide.waveVariant,
      obstacles,
      slide.customWaveLayers,
      bottomFillMedia,
      1920,
      1080,
      slide.waveControlPoints
    );

    // For 4-Quadrant MWB Starter, generate 5 progressive reveal states (0..4)
    // so pressing forward once in Google Slides or PowerPoint reveals one answer at a time!
    const revealStates =
      slide.presetId === 'mwb-starter-quadrant' && slide.starterQuadrants?.length
        ? [0, 1, 2, 3, 4]
        : [0];

    for (const revealCount of revealStates) {
      const pptSlide = pptx.addSlide();
      pptSlide.background = { data: bgPng };
      addSpeakerNotesAndBadges(pptSlide, slide);

      const headerTextColor =
        slide.presetId === 'mwb-starter-quadrant' &&
        slide.waveVariant === 'top-bottom-strata'
          ? 'FFFFFF'
          : palette.darkInk.replace('#', '');

      // Clean Single-Line Title (rendered by lesson-title-page itself below date)
      if (slide.presetId !== 'lesson-title-page') {
        pptSlide.addText(slide.title, {
          x: 0.65,
          y: 0.35,
          w: 9.5,
          h: 0.72,
          fontFace: 'Outfit',
          fontSize: slide.presetId === 'title-divider' ? 38 : 30,
          bold: true,
          color: headerTextColor,
        });
      }

      // Visual Timer Badge (Top Right)
      if (slide.timerSeconds && slide.timerSeconds > 0) {
        const mins = Math.round(slide.timerSeconds / 60);
        pptSlide.addText(`${mins} MIN${mins === 1 ? '' : 'S'}`, {
          x: 11.1,
          y: 0.38,
          w: 1.55,
          h: 0.42,
          align: 'center',
          fontFace: 'JetBrains Mono',
          fontSize: 13,
          bold: true,
          color: palette.accent.replace('#', ''),
          fill: { color: 'FAF6F0' },
          line: { color: palette.accent.replace('#', ''), width: 1.5 },
          rectRadius: 0.1,
        });
      }

      // 1. 4-Quadrant MWB Starter
      if (slide.presetId === 'mwb-starter-quadrant' && slide.starterQuadrants) {
        const positions = [
          { x: 0.65, y: 1.35 },
          { x: 6.8, y: 1.35 },
          { x: 0.65, y: 4.3 },
          { x: 6.8, y: 4.3 },
        ];
        slide.starterQuadrants.slice(0, 4).forEach((q, qIdx) => {
          const pos = positions[qIdx];
          const isRevealed = qIdx < revealCount;
          pptSlide.addShape(pptx.ShapeType.roundRect, {
            x: pos.x,
            y: pos.y,
            w: 5.88,
            h: 2.75,
            fill: { color: 'FAF6F0', transparency: 3 },
            line: {
              color: isRevealed ? palette.accent.replace('#', '') : 'E2E8F0',
              width: isRevealed ? 2 : 1,
            },
            rectRadius: 0.15,
          });

          // Clean single digit 1..4 badge
          pptSlide.addText(String(qIdx + 1), {
            x: pos.x + 0.18,
            y: pos.y + 0.16,
            w: 0.36,
            h: 0.36,
            align: 'center',
            valign: 'middle',
            fontFace: 'Outfit',
            fontSize: 12,
            bold: true,
            color: 'FFFFFF',
            fill: { color: palette.accent.replace('#', '') },
            rectRadius: 0.08,
          });

          pptSlide.addText(q.question, {
            x: pos.x + 0.64,
            y: pos.y + 0.14,
            w: 5.05,
            h: q.options && q.options.length > 0 ? 0.78 : 1.75,
            fontFace: 'Plus Jakarta Sans',
            fontSize: 14,
            bold: true,
            color: '18181B',
            valign: 'top',
          });

          if (q.options && q.options.length > 0) {
            q.options.slice(0, 4).forEach((opt, optIdx) => {
              const col = optIdx % 2;
              const row = Math.floor(optIdx / 2);
              const letter = ['A', 'B', 'C', 'D'][optIdx];
              const cleanOpt = opt.replace(/^[A-D][\s.):\-]+/i, '');
              pptSlide.addText(`${letter}  ${cleanOpt}`, {
                x: pos.x + 0.18 + col * 2.8,
                y: pos.y + 0.98 + row * 0.44,
                w: 2.7,
                h: 0.38,
                fontFace: 'Plus Jakarta Sans',
                fontSize: 10.5,
                color: '334155',
                fill: { color: 'FFFFFF' },
                line: { color: 'E2E8F0', width: 0.75 },
                rectRadius: 0.06,
              });
            });
          }

          if (isRevealed) {
            pptSlide.addText(q.answer, {
              x: pos.x + 0.18,
              y: pos.y + 2.02,
              w: 5.5,
              h: 0.56,
              fontFace: 'Plus Jakarta Sans',
              fontSize: 12.5,
              bold: true,
              color: '064E3B',
              fill: { color: 'ECFDF5' },
              line: { color: '10B981', width: 1 },
              rectRadius: 0.08,
              valign: 'middle',
            });
          }
        });
        continue;
      }

      // 2. Lesson Title Page
      if (slide.presetId === 'lesson-title-page') {
        const dateStr =
          slide.lessonDate ||
          new Date().toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });

        pptSlide.addShape(pptx.ShapeType.roundRect, {
          x: 0.65,
          y: 0.5,
          w: 3.6,
          h: 0.45,
          fill: { color: 'FFFFFF', transparency: 4 },
          line: { color: palette.accent.replace('#', ''), width: 1.5 },
          rectRadius: 0.2,
        });
        pptSlide.addText(dateStr, {
          x: 0.75,
          y: 0.52,
          w: 3.4,
          h: 0.42,
          fontFace: 'Outfit',
          fontSize: 13,
          bold: true,
          color: palette.accent.replace('#', ''),
          valign: 'middle',
        });

        pptSlide.addText(slide.title, {
          x: 0.65,
          y: 1.15,
          w: 6.2,
          h: 1.85,
          fontFace: 'Outfit',
          fontSize: 38,
          bold: true,
          color: palette.darkInk.replace('#', ''),
          valign: 'top',
        });

        if (slide.bigQuestion) {
          pptSlide.addShape(pptx.ShapeType.roundRect, {
            x: 0.65,
            y: 3.25,
            w: 6.1,
            h: 2.0,
            fill: { color: 'FFFFFF', transparency: 5 },
            line: { color: palette.accent.replace('#', ''), width: 2.5 },
            rectRadius: 0.18,
          });
          pptSlide.addText(`TODAY'S ENQUIRY\n${slide.bigQuestion}`, {
            x: 0.9,
            y: 3.4,
            w: 5.6,
            h: 1.7,
            fontFace: 'Outfit',
            fontSize: 19,
            bold: true,
            color: '18181B',
            valign: 'middle',
          });
        }

        if (slide.mediaItem && slide.mediaItem.placement !== 'fill-bottom-layer') {
          let coverUri: string | null = null;
          if (slide.mediaItem.type === 'svg-diagram' && slide.mediaItem.svgCode) {
            coverUri = await svgStringToPngDataUrl(slide.mediaItem.svgCode);
          } else if (slide.mediaItem.url) {
            coverUri = await imageUrlToDataUrl(slide.mediaItem.url);
          }
          if (coverUri) {
            pptSlide.addImage({
              data: coverUri,
              x: 7.3,
              y: 0.85,
              w: 5.4,
              h: 5.6,
              sizing: { type: 'contain', w: 5.4, h: 5.6 },
            });
          }
        }
        continue;
      }

      // 3. Title & Big Question Divider
      if (slide.presetId === 'title-divider') {
        if (slide.bigQuestion) {
          pptSlide.addShape(pptx.ShapeType.roundRect, {
            x: 0.65,
            y: 2.0,
            w: 7.4,
            h: 2.2,
            fill: { color: 'FFFFFF', transparency: 5 },
            line: { color: palette.accent.replace('#', ''), width: 2.5 },
            rectRadius: 0.18,
          });
          pptSlide.addText(`BIG QUESTION\n${slide.bigQuestion}`, {
            x: 0.9,
            y: 2.2,
            w: 6.9,
            h: 1.8,
            fontFace: 'Outfit',
            fontSize: 21,
            bold: true,
            color: '18181B',
            valign: 'middle',
          });
        }

        if (slide.keyTermsStrip) {
          slide.keyTermsStrip.slice(0, 3).forEach((kt, idx) => {
            const xPos = 0.65 + idx * 3.95;
            pptSlide.addShape(pptx.ShapeType.roundRect, {
              x: xPos,
              y: 5.05,
              w: 3.7,
              h: 1.75,
              fill: { color: 'FFFFFF', transparency: 5 },
              line: { color: 'E4E4E7', width: 1 },
              rectRadius: 0.14,
            });
            pptSlide.addText(
              [
                { text: `${kt.term}\n`, options: { bold: true, fontSize: 15, color: palette.accent.replace('#', '') } },
                { text: kt.definition, options: { fontSize: 12, color: '3F3F46' } },
              ],
              { x: xPos + 0.2, y: 5.2, w: 3.3, h: 1.45, valign: 'top' }
            );
          });
        }
        continue;
      }

      // 3. Bespoke AI Custom Canvas Elements
      if (slide.presetId === 'custom' && slide.customCanvasElements) {
        for (const el of slide.customCanvasElements) {
          const x = (el.x / 100) * 13.333;
          const y = (el.y / 100) * 7.5;
          const w = (el.w / 100) * 13.333;
          const h = (el.h / 100) * 7.5;
          const isBottomLayer = el.layer === 'bottom' || el.tone === 'dark';

          if (!isBottomLayer) {
            pptSlide.addShape(pptx.ShapeType.roundRect, {
              x,
              y,
              w,
              h,
              fill: { color: 'FAF6F0', transparency: 4 },
              line: { color: 'E4E4E7', width: 1 },
              rectRadius: 0.14,
            });
          }

          if (el.kind === 'diagram' && el.svgCode) {
            const png = await svgStringToPngDataUrl(el.svgCode);
            pptSlide.addImage({
              data: png,
              x: x + 0.15,
              y: y + 0.45,
              w: w - 0.3,
              h: h - 0.6,
              sizing: { type: 'contain', w: w - 0.3, h: h - 0.6 },
            });
            if (el.heading) {
              pptSlide.addText(el.heading, {
                x: x + 0.15,
                y: y + 0.1,
                w: w - 0.3,
                h: 0.35,
                fontSize: 13,
                bold: true,
                color: isBottomLayer ? 'FFFFFF' : palette.accent.replace('#', ''),
              });
            }
          } else {
            pptSlide.addText(
              [
                ...(el.heading
                  ? [{ text: `${el.heading}\n`, options: { bold: true, fontSize: 14, color: isBottomLayer ? 'FFFFFF' : palette.accent.replace('#', '') } }]
                  : []),
                {
                  text: el.content,
                  options: {
                    fontSize: 12,
                    color: isBottomLayer ? 'F1F5F9' : '27272A',
                  },
                },
              ],
              { x: x + 0.2, y: y + 0.15, w: w - 0.4, h: h - 0.3, valign: 'top' }
            );
          }
        }
        continue;
      }

      // 4. Standard Content Blocks + Optional Media
      const hasBoxedMedia = Boolean(
        slide.mediaItem && slide.mediaItem.placement !== 'fill-bottom-layer'
      );
      const blockAreaW = hasBoxedMedia ? 6.1 : 12.0;
      const startX = slide.waveVariant === 'vertical-scurve-left' ? 3.2 : 0.65;
      const count = Math.max(1, slide.bodyBlocks.length);
      const blockH = Math.min(1.65, 5.1 / count);

      if (slide.presetId === 'comparison-two-column') {
        const half = Math.ceil(slide.bodyBlocks.length / 2);
        const colA = slide.bodyBlocks.slice(0, half);
        const colB = slide.bodyBlocks.slice(half);
        const colW = hasBoxedMedia ? 3.55 : 5.8;

        colA.forEach((b, idx) => {
          const isBottom = b.layer === 'bottom';
          if (!isBottom) {
            pptSlide.addShape(pptx.ShapeType.roundRect, {
              x: 0.65,
              y: 1.5 + idx * 2.6,
              w: colW,
              h: 4.9 / Math.max(1, colA.length),
              fill: { color: 'FAF6F0', transparency: 4 },
              line: { color: 'E4E4E7', width: 1 },
              rectRadius: 0.14,
            });
          }
          pptSlide.addText(
            [
              ...(b.heading ? [{ text: `${b.heading}\n`, options: { bold: true, fontSize: 16, color: isBottom ? 'FFFFFF' : palette.accent.replace('#', '') } }] : []),
              { text: b.content, options: { fontSize: 13, color: isBottom ? 'F1F5F9' : '27272A' } },
            ],
            { x: 0.85, y: 1.65 + idx * 2.6, w: colW - 0.4, h: 4.5 / Math.max(1, colA.length), valign: 'top' }
          );
        });

        const colBX = 0.65 + colW + 0.35;
        colB.forEach((b, idx) => {
          const isBottom = b.layer === 'bottom';
          if (!isBottom) {
            pptSlide.addShape(pptx.ShapeType.roundRect, {
              x: colBX,
              y: 1.5 + idx * 2.6,
              w: colW,
              h: 4.9 / Math.max(1, colB.length),
              fill: { color: 'FAF6F0', transparency: 4 },
              line: { color: 'E4E4E7', width: 1 },
              rectRadius: 0.14,
            });
          }
          pptSlide.addText(
            [
              ...(b.heading ? [{ text: `${b.heading}\n`, options: { bold: true, fontSize: 16, color: isBottom ? 'FFFFFF' : palette.accent.replace('#', '') } }] : []),
              { text: b.content, options: { fontSize: 13, color: isBottom ? 'F1F5F9' : '27272A' } },
            ],
            { x: colBX + 0.2, y: 1.65 + idx * 2.6, w: colW - 0.4, h: 4.5 / Math.max(1, colB.length), valign: 'top' }
          );
        });
      } else {
        slide.bodyBlocks.forEach((b, idx) => {
          const yPos = 1.45 + idx * (blockH + 0.18);
          const w = slide.waveVariant === 'vertical-scurve-left' ? 9.4 : blockAreaW;
          const isBottom = b.layer === 'bottom';
          if (!isBottom) {
            pptSlide.addShape(pptx.ShapeType.roundRect, {
              x: startX,
              y: yPos,
              w,
              h: blockH,
              fill: { color: b.style === 'code' ? '09090B' : 'FAF6F0', transparency: 4 },
              line: { color: palette.borderAccent.replace('#', ''), width: 1.2 },
              rectRadius: 0.14,
            });
          }
          pptSlide.addText(
            [
              ...(b.heading
                ? [{ text: `${b.heading}\n`, options: { bold: true, fontSize: 15, color: isBottom ? 'FFFFFF' : b.style === 'code' ? '34D399' : palette.accent.replace('#', '') } }]
                : []),
              {
                text: b.content,
                options: {
                  fontSize: 13,
                  fontFace: b.style === 'code' ? 'JetBrains Mono' : 'Plus Jakarta Sans',
                  color: isBottom ? 'F1F5F9' : b.style === 'code' ? 'A7F3D0' : '27272A',
                },
              },
            ],
            { x: startX + 0.2, y: yPos + 0.12, w: w - 0.4, h: blockH - 0.24, valign: 'top' }
          );
        });
      }

      if (hasBoxedMedia && slide.mediaItem) {
        const mediaX = slide.presetId === 'comparison-two-column' ? 8.3 : 7.15;
        const mediaW = slide.presetId === 'comparison-two-column' ? 4.4 : 5.5;
        let dataUri: string | null = null;
        if (slide.mediaItem.type === 'svg-diagram' && slide.mediaItem.svgCode) {
          dataUri = await svgStringToPngDataUrl(slide.mediaItem.svgCode);
        } else if (slide.mediaItem.url) {
          dataUri = await imageUrlToDataUrl(slide.mediaItem.url);
        }
        if (dataUri) {
          pptSlide.addImage({
            data: dataUri,
            x: mediaX,
            y: 1.5,
            w: mediaW,
            h: 5.0,
            sizing: { type: 'contain', w: mediaW, h: 5.0 },
          });
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
  const a = document.createElement('a');
  a.href = url;
  a.download = `L${lesson.lessonNumber}-${lesson.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}.pptx`;
  a.click();
  URL.revokeObjectURL(url);
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
