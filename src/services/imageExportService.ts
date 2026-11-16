import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { PlannedLesson } from '../types/curriculum';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Capture a 1920x1080 slide canvas DOM element to a high-resolution PNG Blob.
 */
export async function captureSlideElementToBlob(element: HTMLElement): Promise<Blob> {
  const originalTransform = element.style.transform;
  const originalTransformOrigin = element.style.transformOrigin;

  // Temporarily reset zoom/scale transform so html2canvas renders at pristine 1920x1080 pixel dimensions
  element.style.transform = 'none';
  element.style.transformOrigin = 'top left';

  try {
    const canvas = await html2canvas(element, {
      width: 1920,
      height: 1080,
      scale: 1, // 1080p full HD
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#FFFFFF',
      windowWidth: 1920,
      windowHeight: 1080,
    });

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Slide canvas rasterization failed.'));
      }, 'image/png');
    });
  } finally {
    element.style.transform = originalTransform;
    element.style.transformOrigin = originalTransformOrigin;
  }
}

/**
 * Export the currently displayed slide as a 1920x1080 PNG image.
 */
export async function exportCurrentSlideToPng(
  slideTitle?: string,
  lessonNumber?: number,
  slideNumber?: number
): Promise<void> {
  const viewport = document.getElementById('active-slide-canvas-viewport');
  if (!viewport) {
    throw new Error('Slide canvas is not visible on screen. Ensure you are on Stage 4 Slide Studio.');
  }

  const blob = await captureSlideElementToBlob(viewport);
  const safeTitle = (slideTitle || 'Slide')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30);
  const prefix = lessonNumber ? `L${lessonNumber}-` : '';
  const numStr = slideNumber ? `Slide-${String(slideNumber).padStart(2, '0')}-` : 'Slide-';
  const filename = `${prefix}${numStr}${safeTitle}.png`;

  downloadBlob(blob, filename);
}

/**
 * Generate a ZIP containing all slides as PNG images.
 */
export async function packageSlidesToZip(
  slideBlobs: { filename: string; blob: Blob }[],
  lesson: PlannedLesson
): Promise<void> {
  const zip = new JSZip();
  for (const item of slideBlobs) {
    zip.file(item.filename, item.blob);
  }

  const safeTitle = (lesson.title || 'lesson')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 35);

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const zipFilename = `L${lesson.lessonNumber}-${safeTitle}-Slides-Images.zip`;
  downloadBlob(zipBlob, zipFilename);
}
