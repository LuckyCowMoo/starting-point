import React, { useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  Globe,
  HardDrive,
  Laptop,
  Layers,
  Link2,
  Share2,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import { PlannedLesson } from '../../types/curriculum';
import {
  createLessonDirectLink,
  createPortableLessonLink,
  downloadLessonJsonFile,
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
  const tomorrowLink = `${window.location.origin}${window.location.pathname}#load=lessons/tomorrow.json`;

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

  const copyLessonJson = () => {
    const jsonStr = JSON.stringify(lesson, null, 2);
    void copyToClipboard(jsonStr, 'json');
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-reveal-pop">
      <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-[#FAF6F0] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
              <Share2 size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                Share Lesson {lesson.lessonNumber}: {lesson.title}
              </h3>
              <p className="text-xs text-zinc-600">
                Open into this exact lesson from a different computer or classroom screen
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

        <div className="p-6 space-y-4 text-sm overflow-y-auto flex-1">
          {/* Option 1: Universal Portable Link (Recommended for Different Computer) */}
          <div className="p-4 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/50 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-700" />
                <span className="font-bold text-zinc-900">
                  Universal Portable Link (Any Computer)
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-200/80 px-2.5 py-0.5 rounded-full">
                ★ Recommended for Tomorrow
              </span>
            </div>
            <p className="text-xs text-zinc-700 leading-relaxed">
              Encodes your entire lesson directly inside the link. Send this link to yourself (via email, message, or notes) and open it on the classroom computer — it loads your exact custom slides with zero login or setup!
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={portableLink}
                className="flex-1 px-3 py-2 rounded-xl border border-emerald-200 bg-white font-mono text-xs text-zinc-700 select-all truncate shadow-2xs"
              />
              <button
                type="button"
                onClick={() => void copyToClipboard(portableLink, 'portable')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition shrink-0"
              >
                {copiedKey === 'portable' ? (
                  <>
                    <Check size={14} /> Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy Universal Link
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Option 2: 1-Click File Export & Bake into GitHub */}
          <div className="p-4 rounded-2xl border border-zinc-200 bg-[#FAF6F0] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileJson size={16} className="text-indigo-600" />
                <span className="font-bold text-zinc-900">Lesson File (.json) & AI Commit</span>
              </div>
              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                Fail-Safe Backup
              </span>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Download your lesson file or copy its JSON. Paste it into our AI chat, and we will commit it directly into the GitHub repository so your custom slides load automatically from the live link!
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => downloadLessonJsonFile(lesson)}
                className="flex-1 py-2 px-3 rounded-xl bg-white border border-zinc-300 text-zinc-800 font-bold text-xs hover:bg-zinc-50 flex items-center justify-center gap-1.5 shadow-2xs transition"
              >
                <Download size={14} className="text-zinc-600" />
                <span>Download .lesson.json</span>
              </button>
              <button
                type="button"
                onClick={copyLessonJson}
                className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 flex items-center justify-center gap-1.5 shadow-xs transition"
              >
                {copiedKey === 'json' ? (
                  <>
                    <Check size={14} /> JSON Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copy Lesson JSON
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Option 3: Device Direct Link (This Browser Only) */}
          <div className="p-4 rounded-2xl border border-zinc-200 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Laptop size={16} className="text-zinc-600" />
                <span className="font-bold text-zinc-900">Device Direct Link (This Browser)</span>
              </div>
              <span className="text-[10px] font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md">
                This Computer Only
              </span>
            </div>
            <p className="text-xs text-zinc-600">
              Quick bookmark link for <em>this</em> computer where your edits are stored in your browser's local memory.
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
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition shrink-0"
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

          {/* Option 4: Direct Link to Slide */}
          <div className="p-4 rounded-2xl border border-zinc-200 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-zinc-600" />
                <span className="font-bold text-zinc-900">
                  Direct Link to Slide {currentSlideIndex + 1}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-zinc-500">
                Slide {currentSlideIndex + 1} of {lesson.slidesData.length}
              </span>
            </div>
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
                className="px-4 py-2 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-bold text-xs flex items-center gap-1.5 transition shrink-0"
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

          {/* Classroom PC Tip */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <Link2 size={15} className="shrink-0 text-amber-700 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Opening on your classroom PC tomorrow:</p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Either click <strong>Copy Universal Link</strong> above and email it to yourself, or export the <strong>PowerPoint (.pptx)</strong> presentation from the top bar! Both will open seamlessly on any school computer.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
