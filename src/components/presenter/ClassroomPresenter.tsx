import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  StickyNote,
  X,
} from 'lucide-react';
import { PlannedLesson } from '../../types/curriculum';
import { PHASE_PALETTES } from '../../data/palettes';
import { SlideCanvas } from '../canvas/SlideCanvas';

interface ClassroomPresenterProps {
  lesson: PlannedLesson;
  initialSlideIndex?: number;
  onExit: () => void;
}

export const ClassroomPresenter: React.FC<ClassroomPresenterProps> = ({
  lesson,
  initialSlideIndex = 0,
  onExit,
}) => {
  const [slideIdx, setSlideIdx] = useState(
    Math.min(initialSlideIndex, Math.max(0, lesson.slidesData.length - 1))
  );
  const [starterRevealedCount, setStarterRevealedCount] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toolbarHidden, setToolbarHidden] = useState(false);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1920,
    h: typeof window !== 'undefined' ? window.innerHeight : 1080,
  }));

  // Track window resize to ensure 16:9 canvas always fills maximum screen space without letterbox/pillarbox where possible
  useEffect(() => {
    const handleResize = () => {
      setViewport({
        w: window.innerWidth,
        h: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync fullscreen state
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const slide = lesson.slidesData[slideIdx];
  const isStarter = slide?.presetId === 'mwb-starter-quadrant';
  const maxStarterSteps = slide?.starterQuadrants?.length ?? 4;

  const goNext = useCallback(() => {
    if (!slide) return;
    if (isStarter && starterRevealedCount < maxStarterSteps) {
      setStarterRevealedCount((c) => c + 1);
      return;
    }
    if (slideIdx < lesson.slidesData.length - 1) {
      setSlideIdx((i) => i + 1);
      setStarterRevealedCount(0);
    }
  }, [slide, isStarter, starterRevealedCount, maxStarterSteps, slideIdx, lesson.slidesData.length]);

  const goPrev = useCallback(() => {
    if (!slide) return;
    if (isStarter && starterRevealedCount > 0) {
      setStarterRevealedCount((c) => c - 1);
      return;
    }
    if (slideIdx > 0) {
      const prevSlide = lesson.slidesData[slideIdx - 1];
      setSlideIdx((i) => i - 1);
      setStarterRevealedCount(
        prevSlide?.presetId === 'mwb-starter-quadrant'
          ? prevSlide.starterQuadrants?.length ?? 4
          : 0
      );
    }
  }, [slide, isStarter, starterRevealedCount, slideIdx, lesson.slidesData]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen rejection if browser/iframe restricts it
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape') {
        if (!document.fullscreenElement) {
          onExit();
        }
      } else if (e.key.toLowerCase() === 'n') {
        setShowNotes((v) => !v);
      } else if (e.key.toLowerCase() === 'h') {
        setToolbarHidden((v) => !v);
      } else if (e.key.toLowerCase() === 'f') {
        void toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onExit]);

  if (!slide) return null;
  const palette = PHASE_PALETTES[slide.phase];

  // Mathematical 16:9 Aspect-Fit: Fill the screen as much as possible without crop or stretch
  const targetAspect = 16 / 9;
  let stageW = viewport.w;
  let stageH = stageW / targetAspect;

  if (stageH > viewport.h) {
    stageH = viewport.h;
    stageW = stageH * targetAspect;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden">
      {/* Main 16:9 Stage — Perfectly fills the screen up to the physical edges */}
      <div
        style={{
          width: `${Math.floor(stageW)}px`,
          height: `${Math.floor(stageH)}px`,
          maxWidth: '100vw',
          maxHeight: '100vh',
        }}
        className="relative overflow-hidden select-none shadow-2xl"
      >
        <SlideCanvas
          slide={slide}
          starterRevealedCount={starterRevealedCount}
          interactiveTimer={true}
        />
      </div>

      {/* Optional Teacher Speaker Notes Drawer */}
      {showNotes && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[90vw] max-w-3xl bg-zinc-900/95 backdrop-blur-md text-white border border-zinc-700 rounded-2xl p-4 shadow-2xl z-50 space-y-1.5 animate-reveal-pop">
          <div className="flex items-center justify-between text-xs text-amber-300 font-bold">
            <span>Teacher Notes — Slide {slide.slideNumber} ({palette.name})</span>
            <button onClick={() => setShowNotes(false)} className="text-zinc-400 hover:text-white">
              <X size={14} />
            </button>
          </div>
          <p className="text-sm text-zinc-100 leading-relaxed">{slide.speakerNotes}</p>
        </div>
      )}

      {/* Floating Bottom Presenter HUD */}
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-zinc-900/90 hover:bg-zinc-900 backdrop-blur-md text-white px-3.5 py-2 rounded-2xl border border-zinc-700/80 shadow-2xl text-xs transition-all duration-300 ${
          toolbarHidden
            ? 'translate-y-24 opacity-0 pointer-events-none'
            : 'translate-y-0 opacity-100 pointer-events-auto'
        }`}
      >
        <button
          onClick={goPrev}
          disabled={slideIdx === 0 && (!isStarter || starterRevealedCount === 0)}
          className="p-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-30"
          title="Previous (Left Arrow)"
        >
          <ChevronLeft size={18} />
        </button>

        <span className="font-mono font-bold px-2">
          Slide {slideIdx + 1} / {lesson.slidesData.length}
          {isStarter && (
            <span className="text-sky-300 ml-2">
              (Reveal {starterRevealedCount}/{maxStarterSteps})
            </span>
          )}
        </span>

        <button
          onClick={goNext}
          disabled={
            slideIdx === lesson.slidesData.length - 1 &&
            (!isStarter || starterRevealedCount >= maxStarterSteps)
          }
          className="p-1.5 rounded-lg hover:bg-zinc-800 disabled:opacity-30"
          title="Next / Reveal Answer (Space or Right Arrow)"
        >
          <ChevronRight size={18} />
        </button>

        <div className="w-px h-5 bg-zinc-700 mx-1" />

        <button
          onClick={() => setShowNotes((v) => !v)}
          className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition ${
            showNotes ? 'bg-amber-500 text-zinc-950' : 'hover:bg-zinc-800 text-zinc-300'
          }`}
          title="Toggle Teacher Notes (Key: N)"
        >
          <StickyNote size={14} />
          <span>Notes</span>
        </button>

        <button
          onClick={() => void toggleFullscreen()}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300"
          title="Toggle Fullscreen (Key: F)"
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>

        <button
          type="button"
          onClick={() => setToolbarHidden(true)}
          className="px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center gap-1 transition"
          title="Hide Toolbar (Press 'H')"
        >
          <EyeOff size={14} />
          <span className="hidden sm:inline">Hide Bar</span>
        </button>

        <button
          onClick={onExit}
          className="px-3 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white font-bold flex items-center gap-1 ml-1"
        >
          <X size={14} /> Exit
        </button>
      </div>

      {/* Discreet Pill Trigger to Restore Toolbar when Hidden */}
      {toolbarHidden && (
        <button
          type="button"
          onClick={() => setToolbarHidden(false)}
          className="fixed bottom-2.5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 bg-zinc-900/75 hover:bg-zinc-900 text-zinc-400 hover:text-white px-3 py-1 rounded-full border border-zinc-700/60 shadow-lg text-xs backdrop-blur-xs transition opacity-40 hover:opacity-100 animate-reveal-pop"
          title="Show Toolbar (Press 'H')"
        >
          <Eye size={13} className="text-emerald-400" />
          <span>Show Toolbar</span>
          <span className="text-[10px] text-zinc-500 font-mono bg-zinc-800 px-1 py-0.5 rounded">H</span>
        </button>
      )}
    </div>
  );
};
