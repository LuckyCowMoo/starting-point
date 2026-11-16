import React, { useState } from 'react';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileImage,
  FileSpreadsheet,
  HelpCircle,
  Image as ImageIcon,
  Loader2,
  Presentation,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import { AppSettings, PlannedLesson } from '../../types/curriculum';
import {
  downloadLessonPptx,
  exportLessonToGoogleSlides,
} from '../../services/exportService';
import { exportCurrentSlideToPng } from '../../services/imageExportService';

interface ExportModalProps {
  isOpen: boolean;
  lesson: PlannedLesson | null;
  settings: AppSettings;
  currentSlideIndex?: number;
  onUpdateGoogleClientId: (clientId: string) => void;
  onExportAllSlidesImages?: () => Promise<void>;
  onExportVisualPptx?: () => Promise<void>;
  onOpenShareModal?: () => void;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  lesson,
  settings,
  currentSlideIndex = 0,
  onUpdateGoogleClientId,
  onExportAllSlidesImages,
  onExportVisualPptx,
  onOpenShareModal,
  onClose,
}) => {
  const [busy, setBusy] = useState<'visual-pptx' | 'pptx' | 'gslides' | 'image' | 'images-zip' | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [googleSlideLink, setGoogleSlideLink] = useState<string | null>(null);
  const [showDriveGuide, setShowDriveGuide] = useState(false);

  if (!isOpen || !lesson) return null;

  const currentSlideTitle = lesson.slidesData[currentSlideIndex]?.title || 'Slide';

  const handleVisualPptx = async () => {
    setBusy('visual-pptx');
    setError(null);
    setStatusMsg('Rendering 1080p presentation slides...');
    try {
      if (onExportVisualPptx) {
        await onExportVisualPptx();
      } else {
        await downloadLessonPptx(lesson, setStatusMsg);
      }
      setStatusMsg('Presentation (.pptx) downloaded!');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Presentation export failed.'
      );
    } finally {
      setBusy(null);
    }
  };

  const handleEditablePptx = async () => {
    setBusy('pptx');
    setError(null);
    setStatusMsg('Generating editable shapes and text...');
    try {
      await downloadLessonPptx(lesson, setStatusMsg);
      setStatusMsg('Editable PowerPoint (.pptx) downloaded!');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'string' && err
          ? err
          : 'PPTX export failed (check slide images/diagrams and try again).';
      setError(msg);
    } finally {
      setBusy(null);
    }
  };

  const handleGoogleSlides = async () => {
    setBusy('gslides');
    setError(null);
    setGoogleSlideLink(null);
    setStatusMsg('Connecting to Google Drive...');
    try {
      const result = await exportLessonToGoogleSlides(
        lesson,
        settings.googleClientId,
        setStatusMsg
      );
      setGoogleSlideLink(result.webViewLink);
      setStatusMsg('Created in Google Slides!');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Google Slides export failed.'
      );
    } finally {
      setBusy(null);
    }
  };

  const handleCurrentSlideImage = async () => {
    setBusy('image');
    setError(null);
    setStatusMsg('Capturing 1080p slide image...');
    try {
      await exportCurrentSlideToPng(
        currentSlideTitle,
        lesson.lessonNumber,
        currentSlideIndex + 1
      );
      setStatusMsg(`Saved Slide ${currentSlideIndex + 1} as PNG!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image export failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleAllSlidesZip = async () => {
    if (!onExportAllSlidesImages) {
      // Fallback to exporting active slide
      await handleCurrentSlideImage();
      return;
    }
    setBusy('images-zip');
    setError(null);
    setStatusMsg('Rendering and packaging all slides into ZIP archive...');
    try {
      await onExportAllSlidesImages();
      setStatusMsg('All slides exported as high-res images in ZIP!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image ZIP export failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-reveal-pop">
      <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-[#FAF6F0] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold text-zinc-900">
              Export Lesson {lesson.lessonNumber}: {lesson.title}
            </h3>
            <p className="text-xs text-zinc-600">
              1080p 3D paper-cut waves + editable text, starter quadrants, speaker notes & image packs
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-500 hover:bg-zinc-200/60 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-4 text-sm overflow-y-auto flex-1">
          {/* Quick Direct Link Banner */}
          {onOpenShareModal && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-600 text-white">
                  <Share2 size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">
                    Want to open directly via a link?
                  </h4>
                  <p className="text-[11px] text-emerald-800">
                    Generate a direct shareable URL to this lesson or slide
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenShareModal();
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-1 shrink-0"
              >
                <span>Share Link</span>
              </button>
            </div>
          )}

          {/* Option 1: Export as Images (.png / .zip) */}
          <div className="p-4 rounded-2xl border-2 border-emerald-500/25 bg-emerald-50/30 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                <ImageIcon size={18} />
              </div>
              <div>
                <h4 className="font-bold text-zinc-900">
                  Export as High-Res Images (PNG)
                </h4>
                <p className="text-xs text-zinc-600">
                  Crisp 1920×1080 full HD slide images ready for Google Classroom, Canvas, Teams, or printouts
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleAllSlidesZip()}
                disabled={busy !== null}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs transition"
              >
                {busy === 'images-zip' ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Archive size={15} />
                )}
                <span>Export All ({lesson.slidesData.length} Slides) as ZIP</span>
              </button>

              <button
                type="button"
                onClick={() => void handleCurrentSlideImage()}
                disabled={busy !== null}
                className="py-2.5 px-3 rounded-xl bg-white border border-emerald-300 text-emerald-900 font-bold text-xs hover:bg-emerald-50 disabled:opacity-50 flex items-center justify-center gap-2 shadow-2xs transition"
              >
                {busy === 'image' ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <FileImage size={15} />
                )}
                <span>Slide {currentSlideIndex + 1} Image (PNG)</span>
              </button>
            </div>
          </div>

          {/* Option 2: PowerPoint (.pptx) Exports */}
          <div className="p-4 rounded-2xl border-2 border-zinc-900/10 bg-[#FAF6F0] space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-zinc-900 text-white">
                <FileSpreadsheet size={18} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-zinc-900">
                    PowerPoint (.pptx) & Google Slides
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Fixed & Enhanced
                  </span>
                </div>
                <p className="text-xs text-zinc-600">
                  Ready to present in Microsoft PowerPoint or drop directly into Google Drive (drive.google.com)
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {/* Primary Pixel-Perfect Button */}
              <button
                type="button"
                onClick={() => void handleVisualPptx()}
                disabled={busy !== null}
                className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 text-white font-bold text-xs hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-between shadow-xs transition"
              >
                <div className="flex items-center gap-2">
                  {busy === 'visual-pptx' ? (
                    <Loader2 size={15} className="animate-spin text-emerald-400" />
                  ) : (
                    <Sparkles size={15} className="text-emerald-400" />
                  )}
                  <span>Download Presentation (.pptx) — Pixel-Perfect</span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-md">
                  Recommended
                </span>
              </button>

              {/* Native Editable PowerPoint Button */}
              <button
                type="button"
                onClick={() => void handleEditablePptx()}
                disabled={busy !== null}
                className="w-full py-2.5 px-3 rounded-xl bg-white border border-zinc-300 text-zinc-800 font-bold text-xs hover:bg-zinc-100 disabled:opacity-50 flex items-center justify-between shadow-2xs transition"
              >
                <div className="flex items-center gap-2">
                  {busy === 'pptx' ? (
                    <Loader2 size={15} className="animate-spin text-zinc-600" />
                  ) : (
                    <Download size={15} />
                  )}
                  <span>Download Editable PowerPoint (.pptx)</span>
                </div>
                <span className="text-[10px] font-medium text-zinc-500">
                  Native Shapes & Text
                </span>
              </button>
            </div>
          </div>

          {/* Option 3: 1-Click Create in Google Slides (Requires OAuth Client ID) */}
          <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50/40 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500 text-white">
                  <Presentation size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900">
                    1-Click Create in Google Slides (Direct API)
                  </h4>
                  <p className="text-xs text-zinc-600">
                    Uploads directly into your Google Drive via Google OAuth
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-zinc-700">
                  Google OAuth Client ID:
                </label>
                <button
                  type="button"
                  onClick={() => setShowDriveGuide((v) => !v)}
                  className="text-[11px] text-amber-900 font-semibold hover:underline flex items-center gap-1"
                >
                  <HelpCircle size={12} />
                  <span>{showDriveGuide ? 'Hide instructions' : 'How do I set this up?'}</span>
                  {showDriveGuide ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>

              {/* Step-by-Step Google Drive Setup Guide */}
              {showDriveGuide && (
                <div className="mb-3 p-3.5 rounded-xl bg-amber-100/70 border border-amber-300 text-xs text-zinc-800 space-y-2 animate-reveal-pop">
                  <h5 className="font-bold text-amber-950 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-700" />
                    How to set up Google Drive 1-Click Upload:
                  </h5>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-zinc-700">
                    <li>
                      Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-blue-700 underline font-semibold">Google Cloud Console</a> and create a free project.
                    </li>
                    <li>
                      Go to <strong>APIs & Services &gt; Library</strong>, search for and enable <strong>Google Drive API</strong>.
                    </li>
                    <li>
                      Under <strong>OAuth consent screen</strong>, select <strong>External</strong>, then enter an App Name (e.g. <em>Starting Point</em>) and your email.
                    </li>
                    <li>
                      Go to <strong>Credentials &gt; Create Credentials &gt; OAuth client ID</strong>.
                    </li>
                    <li>
                      Select Application Type: <strong>Web application</strong>. Under <strong>Authorized JavaScript origins</strong>, add:
                      <div className="mt-1 font-mono text-[10px] bg-white p-1.5 rounded-md border border-amber-200 select-all space-y-0.5">
                        <div>http://localhost:5173</div>
                        <div>http://127.0.0.1:5173</div>
                        <div>https://luckycowmoo.github.io</div>
                      </div>
                    </li>
                    <li>
                      Click <strong>Create</strong>, copy the generated Client ID (ends with <code>.apps.googleusercontent.com</code>), and paste it below!
                    </li>
                  </ol>
                  <div className="pt-1 text-[11px] text-amber-900 font-semibold bg-white/70 p-2 rounded-lg border border-amber-200">
                    💡 <strong>Simpler Alternative:</strong> If you don't want to create a Google Cloud project, just click <strong>Download .pptx File</strong> above and drag it into <a href="https://drive.google.com" target="_blank" rel="noreferrer" className="underline font-bold">drive.google.com</a> — Google automatically converts it to Google Slides with zero setup!
                  </div>
                </div>
              )}

              <input
                type="text"
                value={settings.googleClientId}
                onChange={(e) => onUpdateGoogleClientId(e.target.value)}
                placeholder="1234567890-abcdefg.apps.googleusercontent.com"
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 bg-white font-mono text-xs text-zinc-700"
              />
            </div>

            <button
              onClick={() => void handleGoogleSlides()}
              disabled={busy !== null}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 disabled:opacity-50 flex items-center justify-center gap-2 transition"
            >
              {busy === 'gslides' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Presentation size={15} />
              )}
              <span>Upload Directly to Google Slides</span>
            </button>

            {googleSlideLink && (
              <a
                href={googleSlideLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition"
              >
                <CheckCircle2 size={15} />
                <span>Open New Presentation in Google Slides</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>

          {/* Live Status Message & Error Box */}
          {statusMsg && !error && (
            <p className="text-xs text-center font-semibold text-emerald-700 animate-fade-in">
              {statusMsg}
            </p>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-fade-in">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
