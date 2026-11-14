import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Presentation,
  X,
} from 'lucide-react';
import { AppSettings, PlannedLesson } from '../../types/curriculum';
import {
  downloadLessonPptx,
  exportLessonToGoogleSlides,
} from '../../services/exportService';

interface ExportModalProps {
  isOpen: boolean;
  lesson: PlannedLesson | null;
  settings: AppSettings;
  onUpdateGoogleClientId: (clientId: string) => void;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  lesson,
  settings,
  onUpdateGoogleClientId,
  onClose,
}) => {
  const [busy, setBusy] = useState<'pptx' | 'gslides' | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [googleSlideLink, setGoogleSlideLink] = useState<string | null>(null);

  if (!isOpen || !lesson) return null;

  const handlePptx = async () => {
    setBusy('pptx');
    setError(null);
    setStatusMsg('Preparing presentation...');
    try {
      await downloadLessonPptx(lesson, setStatusMsg);
      setStatusMsg('PowerPoint (.pptx) downloaded!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PPTX export failed.');
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

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 bg-[#FAF6F0] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              Export Lesson {lesson.lessonNumber} Slides
            </h3>
            <p className="text-xs text-zinc-600">
              Hybrid export: 1080p 3D paper-cut waves + editable text, progressive 4-quadrant starter & teacher speaker notes
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-500 hover:bg-zinc-200/60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 text-sm">
          {/* Option 1: Direct Google Slides API */}
          <div className="p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/40 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500 text-white">
                  <Presentation size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900">
                    1-Click Create in Google Slides
                  </h4>
                  <p className="text-xs text-zinc-600">
                    Uploads & converts straight into an editable Google Slides deck in your Google Drive
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                Google OAuth Client ID (free from Google Cloud Console — enable Google Drive API):
              </label>
              <input
                type="text"
                value={settings.googleClientId}
                onChange={(e) => onUpdateGoogleClientId(e.target.value)}
                placeholder="1234567890-abcdefg.apps.googleusercontent.com"
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 bg-white font-mono text-xs"
              />
            </div>

            <button
              onClick={() => void handleGoogleSlides()}
              disabled={busy !== null}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy === 'gslides' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Presentation size={16} />
              )}
              <span>Export Directly to Google Slides</span>
            </button>

            {googleSlideLink && (
              <a
                href={googleSlideLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700"
              >
                <CheckCircle2 size={15} />
                <span>Open New Presentation in Google Slides</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>

          {/* Option 2: Universal .pptx Download */}
          <div className="p-4 rounded-2xl border border-zinc-200 bg-[#FAF6F0] space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-zinc-900 text-white">
                <FileSpreadsheet size={18} />
              </div>
              <div>
                <h4 className="font-bold text-zinc-900">
                  Download Universal PowerPoint (.pptx)
                </h4>
                <p className="text-xs text-zinc-600">
                  Zero-setup file — opens in desktop PowerPoint OR drag straight into Google Drive to share with colleagues
                </p>
              </div>
            </div>

            <button
              onClick={() => void handlePptx()}
              disabled={busy !== null}
              className="w-full py-2.5 rounded-xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy === 'pptx' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={16} />
              )}
              <span>Download .pptx File</span>
            </button>
          </div>

          {statusMsg && !error && (
            <p className="text-xs text-center font-semibold text-emerald-700">
              {statusMsg}
            </p>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
