import React, { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  Layers,
  Link2,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import { PlannedLesson } from '../../types/curriculum';
import {
  createLessonDirectLink,
  createPortableLessonLink,
} from '../../utils/urlRouter';

interface ShareLessonModalProps {
  isOpen: boolean;
  lesson: PlannedLesson | null;
  currentSlideIndex?: number;
  onClose: () => void;
}

export const ShareLessonModal: React.FC<ShareLessonModalProps> = ({
  isOpen,
  lesson,
  currentSlideIndex = 0,
  onClose,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen || !lesson) return null;

  const directLessonLink = createLessonDirectLink(lesson.id, 4);
  const directSlideLink = createLessonDirectLink(lesson.id, 4, currentSlideIndex);
  const portableLink = createPortableLessonLink(lesson, currentSlideIndex);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-reveal-pop">
      <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-[#FAF6F0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
              <Share2 size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                Share Lesson {lesson.lessonNumber}: {lesson.title}
              </h3>
              <p className="text-xs text-zinc-600">
                Open directly into this lesson’s slides from any browser or device
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-500 hover:bg-zinc-200/60 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 text-sm max-h-[80vh] overflow-y-auto">
          {/* Link 1: Direct Link to Lesson Slides */}
          <div className="p-4 rounded-2xl border-2 border-emerald-500/20 bg-emerald-50/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-emerald-700" />
                <span className="font-bold text-zinc-900">Direct Link to Lesson Slides</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                Recommended
              </span>
            </div>
            <p className="text-xs text-zinc-600">
              Opens Starting Point directly into Lesson {lesson.lessonNumber} (Stage 4 Slide Studio).
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={directLessonLink}
                className="flex-1 px-3 py-2 rounded-xl border border-zinc-300 bg-white font-mono text-xs text-zinc-700 select-all"
              />
              <button
                type="button"
                onClick={() => void copyToClipboard(directLessonLink, 'lesson')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
              >
                {copiedKey === 'lesson' ? (
                  <>
                    <Check size={14} /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy Link
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Link 2: Direct Link to Current Slide */}
          <div className="p-4 rounded-2xl border border-zinc-200 bg-[#FAF6F0] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-indigo-600" />
                <span className="font-bold text-zinc-900">
                  Direct Link to Slide {currentSlideIndex + 1}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-zinc-600">
                Slide {currentSlideIndex + 1} of {lesson.slidesData.length}
              </span>
            </div>
            <p className="text-xs text-zinc-600">
              Jumps immediately to Slide {currentSlideIndex + 1} ({lesson.slidesData[currentSlideIndex]?.title || 'Slide'}) for focused classroom delivery.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={directSlideLink}
                className="flex-1 px-3 py-2 rounded-xl border border-zinc-300 bg-white font-mono text-xs text-zinc-700 select-all"
              />
              <button
                type="button"
                onClick={() => void copyToClipboard(directSlideLink, 'slide')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
              >
                {copiedKey === 'slide' ? (
                  <>
                    <Check size={14} /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy Slide Link
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Link 3: Portable Self-Contained Link */}
          <div className="p-4 rounded-2xl border border-zinc-200 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-600" />
                <span className="font-bold text-zinc-900">Portable Colleague Link</span>
              </div>
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md">
                Self-Contained
              </span>
            </div>
            <p className="text-xs text-zinc-600">
              Encodes the entire lesson into the link. Anyone clicking it on any computer or phone can view and present these exact slides without having your workspace files.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={portableLink}
                className="flex-1 px-3 py-2 rounded-xl border border-zinc-300 bg-white font-mono text-xs text-zinc-700 select-all truncate"
              />
              <button
                type="button"
                onClick={() => void copyToClipboard(portableLink, 'portable')}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition shrink-0"
              >
                {copiedKey === 'portable' ? (
                  <>
                    <Check size={14} /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy Portable Link
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Tip */}
          <div className="p-3 rounded-xl bg-zinc-100 text-zinc-600 text-xs flex items-center gap-2">
            <Link2 size={14} className="shrink-0 text-zinc-500" />
            <span>
              <strong>Tip:</strong> The browser URL in your address bar updates automatically as you switch slides. You can also simply copy the address bar anytime!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
