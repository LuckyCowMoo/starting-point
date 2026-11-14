import React from 'react';
import {
  ExternalLink,
  KeyRound,
  RotateCcw,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AppSettings } from '../../types/curriculum';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  onResetDemoWorkspace: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onUpdateSettings,
  onResetDemoWorkspace,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 bg-[#FAF6F0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600 text-white">
              <Settings size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900">
                Starting Point Settings
              </h3>
              <p className="text-xs text-zinc-600">
                Bring-Your-Own-Key (stored locally in your browser — never sent to any third-party server)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-500 hover:bg-zinc-200/70"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Gemini BYOK */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-emerald-950 flex items-center gap-1.5">
                <KeyRound size={15} className="text-emerald-700" />
                Gemini API Key & Reasoning Model
              </span>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-1"
              >
                Get API Key <ExternalLink size={11} />
              </a>
            </div>

            <input
              type="password"
              value={settings.geminiApiKey}
              onChange={(e) =>
                onUpdateSettings({ ...settings, geminiApiKey: e.target.value })
              }
              placeholder="AIzaSy..."
              className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <div>
              <label className="block font-semibold text-emerald-950 mb-1">
                Gemini Model (High-Reasoning Recommended):
              </label>
              <select
                value={settings.geminiModel}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, geminiModel: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-emerald-300 bg-white font-semibold"
              >
                <option value="gemini-2.5-pro">
                  gemini-2.5-pro (Highest Pedagogical Quality — Recommended)
                </option>
                <option value="gemini-2.5-flash">
                  gemini-2.5-flash (Faster Drafting)
                </option>
              </select>
            </div>

            <div className="flex items-start gap-1.5 text-[11px] text-emerald-900">
              <ShieldCheck size={14} className="shrink-0 mt-0.5 text-emerald-700" />
              <span>
                Quality-first architecture: Starting Point sends full sequence context while making surgical single-section or single-slide updates so you never sacrifice accuracy or pay to rebuild whole decks.
              </span>
            </div>
          </div>

          {/* Media Search Keys */}
          <div className="p-4 rounded-2xl bg-[#FAF6F0] border border-zinc-200 space-y-3">
            <h4 className="font-bold text-sm text-zinc-900">
              Optional Stock Photo Keys (Wikimedia Commons needs no key)
            </h4>
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">
                Pexels API Key (optional):
              </label>
              <input
                type="password"
                value={settings.pexelsApiKey}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, pexelsApiKey: e.target.value })
                }
                placeholder="Paste free Pexels API key..."
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 bg-white font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">
                Pixabay API Key (optional):
              </label>
              <input
                type="password"
                value={settings.pixabayApiKey}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, pixabayApiKey: e.target.value })
                }
                placeholder="Paste free Pixabay API key..."
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 bg-white font-mono"
              />
            </div>
          </div>

          {/* Google Slides Client ID */}
          <div className="p-4 rounded-2xl bg-[#FAF6F0] border border-zinc-200 space-y-2">
            <h4 className="font-bold text-sm text-zinc-900">
              Google Slides Direct Export (Optional OAuth Client ID)
            </h4>
            <p className="text-[11px] text-zinc-600">
              Add your GitHub Pages URL (or <code>http://localhost:5173</code>) as an Authorised JavaScript Origin in Google Cloud Console with the Drive API enabled.
            </p>
            <input
              type="text"
              value={settings.googleClientId}
              onChange={(e) =>
                onUpdateSettings({ ...settings, googleClientId: e.target.value })
              }
              placeholder="1234567890-abcdefg.apps.googleusercontent.com"
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 bg-white font-mono"
            />
          </div>

          {/* Preferences */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-zinc-200">
            <div>
              <p className="font-bold text-zinc-900">
                Show Pedagogical Rationale Badges
              </p>
              <p className="text-[11px] text-zinc-500">
                Displays Rosenshine & Cognitive Load Theory explanations on teacher planning stages
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.showPedagogicalCallouts}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  showPedagogicalCallouts: e.target.checked,
                })
              }
              className="w-4 h-4 accent-emerald-600"
            />
          </div>

          {/* Demo Reset */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => {
                onResetDemoWorkspace();
                onClose();
              }}
              className="px-3.5 py-2 rounded-xl border border-zinc-300 text-zinc-700 font-semibold hover:bg-zinc-50 flex items-center gap-1.5"
            >
              <RotateCcw size={13} /> Restore Demo Curriculum
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-800"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
