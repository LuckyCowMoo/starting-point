import React, { useEffect, useState } from 'react';
import {
  Check,
  Image as ImageIcon,
  Layers,
  Loader2,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { SlideMediaItem } from '../../types/curriculum';
import { SVG_DIAGRAM_TEMPLATES } from '../../data/svgDiagramLibrary';

interface MediaPickerModalProps {
  isOpen: boolean;
  currentMedia?: SlideMediaItem;
  pexelsApiKey: string;
  pixabayApiKey: string;
  onClose: () => void;
  onSelectMedia: (media: SlideMediaItem) => void;
}

type MediaTab = 'wikimedia' | 'pexels' | 'pixabay' | 'diagrams' | 'upload';

interface SearchResultItem {
  id: string;
  title: string;
  thumbUrl: string;
  fullUrl: string;
  attribution: string;
}

export const MediaPickerModal: React.FC<MediaPickerModalProps> = ({
  isOpen,
  currentMedia,
  pexelsApiKey,
  pixabayApiKey,
  onClose,
  onSelectMedia,
}) => {
  const [activeTab, setActiveTab] = useState<MediaTab>('wikimedia');
  const [query, setQuery] = useState('computer network fiber optic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [cropFit, setCropFit] = useState<'cover' | 'contain'>(
    currentMedia?.cropFit || 'contain'
  );
  const [isBoxed, setIsBoxed] = useState<boolean>(
    currentMedia?.placement !== 'unboxed' && currentMedia?.frameShape !== 'clean' && currentMedia?.boxed !== false
  );
  const [frameShape, setFrameShape] = useState<SlideMediaItem['frameShape']>(
    currentMedia?.frameShape || 'rounded-card'
  );
  const [customSvg, setCustomSvg] = useState(
    currentMedia?.svgCode || SVG_DIAGRAM_TEMPLATES[0].svgCode
  );

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'wikimedia') {
      void runSearch('wikimedia', query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            readFileAsMedia(blob, 'Pasted Screenshot');
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, cropFit, frameShape]);

  if (!isOpen) return null;

  const readFileAsMedia = (file: File, label?: string) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSelectMedia({
          id: `media-${Date.now()}`,
          type: 'image',
          title: label || file.name,
          url: reader.result,
          caption: label || file.name,
          cropFit: isBoxed ? cropFit : 'contain',
          frameShape: isBoxed ? frameShape : 'clean',
          placement: isBoxed ? 'boxed-card' : 'unboxed',
          boxed: isBoxed,
        });
        onClose();
      }
    };
    reader.readAsDataURL(file);
  };

  const runSearch = async (tab: MediaTab, searchTerm: string) => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    setError(null);

    try {
      if (tab === 'wikimedia') {
        const endpoint = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
          searchTerm
        )}&gsrlimit=12&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800&format=json&origin=*`;
        const res = await fetch(endpoint);
        const data = await res.json();
        const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
        const mapped: SearchResultItem[] = (pages as Array<{
          pageid: number;
          title: string;
          imageinfo?: Array<{ thumburl?: string; url?: string }>;
        }>)
          .filter((p) => p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url)
          .map((p) => ({
            id: String(p.pageid),
            title: p.title.replace(/^File:/, ''),
            thumbUrl: p.imageinfo![0].thumburl || p.imageinfo![0].url!,
            fullUrl: p.imageinfo![0].thumburl || p.imageinfo![0].url!,
            attribution: 'Wikimedia Commons',
          }));
        setResults(mapped);
      } else if (tab === 'pexels') {
        if (!pexelsApiKey.trim()) {
          setError('Add your free Pexels API key in Settings to search Pexels.');
          setResults([]);
          return;
        }
        const res = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(
            searchTerm
          )}&per_page=12`,
          { headers: { Authorization: pexelsApiKey.trim() } }
        );
        if (!res.ok) throw new Error(`Pexels API returned ${res.status}`);
        const data = await res.json();
        setResults(
          (data.photos || []).map(
            (p: {
              id: number;
              alt?: string;
              photographer?: string;
              src: { medium: string; large: string };
            }) => ({
              id: String(p.id),
              title: p.alt || 'Pexels Photo',
              thumbUrl: p.src.medium,
              fullUrl: p.src.large,
              attribution: `Pexels • ${p.photographer || 'Contributor'}`,
            })
          )
        );
      } else if (tab === 'pixabay') {
        if (!pixabayApiKey.trim()) {
          setError('Add your free Pixabay API key in Settings to search Pixabay.');
          setResults([]);
          return;
        }
        const res = await fetch(
          `https://pixabay.com/api/?key=${encodeURIComponent(
            pixabayApiKey.trim()
          )}&q=${encodeURIComponent(searchTerm)}&image_type=photo&per_page=12&safesearch=true`
        );
        if (!res.ok) throw new Error(`Pixabay API returned ${res.status}`);
        const data = await res.json();
        setResults(
          (data.hits || []).map(
            (h: {
              id: number;
              tags: string;
              user: string;
              webformatURL: string;
              largeImageURL: string;
            }) => ({
              id: String(h.id),
              title: h.tags,
              thumbUrl: h.webformatURL,
              fullUrl: h.largeImageURL,
              attribution: `Pixabay • ${h.user}`,
            })
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Media search failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-[#FAF6F0]">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">
              Visual & Media Picker
            </h3>
            <p className="text-xs text-zinc-600">
              Choose real photography, clean vector diagrams, or paste/upload screenshots (zero AI image slop)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-500 hover:bg-zinc-200/70 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs & Frame Controls */}
        <div className="px-6 py-3 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl text-xs font-semibold">
            {(
              [
                ['wikimedia', 'Wikimedia Commons'],
                ['pexels', 'Pexels'],
                ['pixabay', 'Pixabay'],
                ['diagrams', 'SVG Diagrams'],
                ['upload', 'Upload / Paste'],
              ] as [MediaTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === id
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs flex-wrap">
            <label className="text-zinc-500 font-medium">Card Style:</label>
            <select
              value={isBoxed ? 'boxed' : 'unboxed'}
              onChange={(e) => {
                const boxedVal = e.target.value === 'boxed';
                setIsBoxed(boxedVal);
                if (!boxedVal) {
                  setCropFit('contain');
                  setFrameShape('clean');
                } else {
                  setFrameShape('rounded-card');
                }
              }}
              className="px-2 py-1 rounded-lg border border-zinc-300 bg-white font-bold text-zinc-800"
            >
              <option value="boxed">Boxed Card (White Box + Shadow)</option>
              <option value="unboxed">Transparent (No Box, Floating PNG/SVG)</option>
            </select>

            <label className="text-zinc-500 font-medium ml-1">Crop:</label>
            <select
              value={cropFit}
              onChange={(e) => setCropFit(e.target.value as 'cover' | 'contain')}
              className="px-2 py-1 rounded-lg border border-zinc-300 bg-white"
            >
              <option value="contain">Fit Whole Visual (Contain)</option>
              <option value="cover">Crop to Fill Frame (Cover)</option>
            </select>

            {isBoxed && (
              <>
                <label className="text-zinc-500 font-medium ml-1">Mask:</label>
                <select
                  value={frameShape}
                  onChange={(e) =>
                    setFrameShape(e.target.value as SlideMediaItem['frameShape'])
                  }
                  className="px-2 py-1 rounded-lg border border-zinc-300 bg-white"
                >
                  <option value="rounded-card">Rounded Card</option>
                  <option value="organic-blob">Organic Paper-Cut Mask</option>
                  <option value="circle">Circular Frame</option>
                  <option value="clean">Sharp Clean Frame</option>
                </select>
              </>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {(activeTab === 'wikimedia' ||
            activeTab === 'pexels' ||
            activeTab === 'pixabay') && (
            <div className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void runSearch(activeTab, query);
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
                  />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search high-quality educational images (e.g. server rack, river meander, motherboard)..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                  <span>Search</span>
                </button>
              </form>

              {error && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
                  {error}
                </div>
              )}

              {!loading && results.length === 0 && !error && (
                <div className="text-center py-12 text-zinc-500 text-sm">
                  Search for any concept, historical photo, hardware, or scientific diagram.
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {results.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectMedia({
                        id: `media-${Date.now()}`,
                        type: 'image',
                        title: item.title,
                        url: item.fullUrl,
                        attribution: item.attribution,
                        caption: item.title,
                        cropFit: isBoxed ? cropFit : 'contain',
                        frameShape: isBoxed ? frameShape : 'clean',
                        placement: isBoxed ? 'boxed-card' : 'unboxed',
                        boxed: isBoxed,
                      });
                      onClose();
                    }}
                    className="group relative rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-50 hover:border-emerald-500 hover:shadow-lg transition text-left"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-zinc-200">
                      <img
                        src={item.thumbUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-semibold text-zinc-800 truncate">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {item.attribution}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'diagrams' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <Layers size={14} /> Built-In Educational Vector Diagrams
                </h4>
                <div className="space-y-2.5">
                  {SVG_DIAGRAM_TEMPLATES.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="p-3 rounded-2xl border border-zinc-200 hover:border-emerald-400 bg-[#FAF6F0] flex items-center gap-3 transition"
                    >
                      <div
                        className="w-28 h-18 shrink-0 rounded-xl bg-white border border-zinc-200 overflow-hidden p-1"
                        dangerouslySetInnerHTML={{ __html: tpl.svgCode }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-900 truncate">
                          {tpl.title}
                        </p>
                        <p className="text-xs text-zinc-600 line-clamp-2 mt-0.5">
                          {tpl.description}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => setCustomSvg(tpl.svgCode)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-zinc-300 text-[11px] font-semibold hover:bg-zinc-50"
                          >
                            Edit SVG
                          </button>
                          <button
                            onClick={() => {
                              onSelectMedia({
                                id: `svg-${Date.now()}`,
                                type: 'svg-diagram',
                                title: tpl.title,
                                svgCode: tpl.svgCode,
                                cropFit: 'contain',
                                frameShape: isBoxed ? frameShape : 'clean',
                                placement: isBoxed ? 'boxed-card' : 'unboxed',
                                boxed: isBoxed,
                              });
                              onClose();
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 flex items-center gap-1"
                          >
                            <Check size={12} /> Insert Diagram
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <Sparkles size={14} /> Live SVG Diagram Customizer
                </h4>
                <div
                  className="aspect-video rounded-2xl border border-zinc-200 bg-[#FAF6F0] overflow-hidden p-2"
                  dangerouslySetInnerHTML={{ __html: customSvg }}
                />
                <textarea
                  value={customSvg}
                  onChange={(e) => setCustomSvg(e.target.value)}
                  rows={6}
                  className="w-full p-3 rounded-xl border border-zinc-300 font-mono text-[11px] bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={() => {
                    onSelectMedia({
                      id: `svg-custom-${Date.now()}`,
                      type: 'svg-diagram',
                      title: 'Custom SVG Diagram',
                      svgCode: customSvg,
                      cropFit: 'contain',
                      frameShape: isBoxed ? frameShape : 'clean',
                      placement: isBoxed ? 'boxed-card' : 'unboxed',
                      boxed: isBoxed,
                    });
                    onClose();
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
                >
                  Apply Custom SVG to Slide
                </button>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-300 rounded-3xl p-12 bg-[#FAF6F0] hover:border-emerald-500 hover:bg-emerald-50/40 cursor-pointer transition">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                  <Upload size={24} />
                </div>
                <p className="text-base font-bold text-zinc-800">
                  Drop an image here, click to upload, or press Ctrl+V to paste
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Supports PNG, JPG, WEBP, SVG — cropped cleanly to match your slide frame
                </p>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readFileAsMedia(f);
                  }}
                />
              </label>

              <div className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600">
                <ImageIcon size={16} className="shrink-0 text-emerald-600" />
                <span>
                  Tip: Snip screenshots with <strong>Win + Shift + S</strong> and press{' '}
                  <strong>Ctrl + V</strong> anywhere inside this dialog to insert immediately!
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
