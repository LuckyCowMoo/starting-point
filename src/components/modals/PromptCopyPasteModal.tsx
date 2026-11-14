import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  ClipboardCopy,
  ClipboardPaste,
  Terminal,
  X,
} from 'lucide-react';

interface PromptCopyPasteModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  promptText: string;
  placeholder?: string;
  onClose: () => void;
  onApplyResponse: (rawText: string) => void;
}

export const PromptCopyPasteModal: React.FC<PromptCopyPasteModalProps> = ({
  isOpen,
  title,
  subtitle = 'Use any external LLM web chat (ChatGPT, Claude, or Gemini Web) completely free — zero API key required.',
  promptText,
  placeholder = 'Paste the JSON response returned by your AI chat here...',
  onClose,
  onApplyResponse,
}) => {
  const [copied, setCopied] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError('Clipboard access blocked — please select and copy the prompt manually below.');
    }
  };

  const handleApply = () => {
    setError(null);
    if (!pastedText.trim()) {
      setError('Please paste the JSON response from your LLM chat before applying.');
      return;
    }
    try {
      onApplyResponse(pastedText);
      setPastedText('');
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not parse the pasted response. Check that it contains valid JSON.'
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/75 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl border border-zinc-200 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#FAF6F0] border-b border-zinc-200 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Terminal size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-zinc-900">
                {title}
              </h2>
              <p className="text-xs text-zinc-600 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-900 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Step 1: Copy Prompt */}
          <div className="rounded-2xl border border-zinc-200 bg-[#FAF6F0] p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-zinc-900">
                Step 1: Copy Complete Pedagogical Prompt
              </h3>
              <button
                type="button"
                onClick={() => void handleCopyPrompt()}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-900 text-white hover:bg-zinc-800'
                }`}
              >
                {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
                <span>{copied ? 'Prompt Copied!' : 'Copy Full Prompt'}</span>
              </button>
            </div>
            <textarea
              readOnly
              value={promptText}
              rows={7}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              className="w-full p-3 rounded-xl border border-zinc-300 bg-white text-[11px] font-mono text-zinc-700 leading-relaxed resize-y focus:outline-none"
            />
          </div>

          {/* Step 2: Paste JSON Response */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                <ClipboardPaste size={16} className="text-emerald-600" />
                <span>Step 2: Paste AI Response JSON</span>
              </h3>
              <span className="text-[11px] text-zinc-400">
                Markdown ```json fences are automatically stripped
              </span>
            </div>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={8}
              placeholder={placeholder}
              className="w-full p-3 rounded-xl border border-zinc-300 bg-[#FAF6F0]/40 text-xs font-mono text-zinc-800 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-700 text-xs font-bold hover:bg-zinc-100 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm flex items-center gap-1.5 transition"
          >
            <Check size={15} />
            <span>Validate &amp; Apply Response</span>
          </button>
        </div>
      </div>
    </div>
  );
};
