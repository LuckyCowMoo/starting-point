import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
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
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Ignore fullscreen rejection if iframe/sandbox restricts it
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
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onExit]);

  if (!slide) return null;
  const palette = PHASE_PALETTES[slide.phase];

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col items-center justify-center select-none">
      {/* Main 16:9 Stage */}
      <div className="w-full h-full flex items-center justify-center p-2 sm:p-4">
        <div className="w-full max-w-[1780px] max-h-full aspect-video rounded-2xl overflow-hidden shadow-2xl">
          <SlideCanvas
            slide={slide}
            starterRevealedCount={starterRevealedCount}
            interactiveTimer={true}
          />
        </div>
      </div>

      {/* Optional Teacher Speaker Notes Drawer */}
      {showNotes && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[90vw] max-w-3xl bg-zinc-900/95 backdrop-blur-md text-white border border-zinc-700 rounded-2xl p-4 shadow-2xl z-50 space-y-1.5">
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
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-zinc-900/85 hover:bg-zinc-900 backdrop-blur-md text-white px-4 py-2 rounded-2xl border border-zinc-700/80 shadow-xl text-xs transition">
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
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>

        <button
          onClick={onExit}
          className="px-3 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white font-bold flex items-center gap-1 ml-1"
        >
          <X size={14} /> Exit
        </button>
      </div>
    </div>
  );
};
