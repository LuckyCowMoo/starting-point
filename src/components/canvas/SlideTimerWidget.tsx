import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Timer, Volume2, VolumeX } from 'lucide-react';

interface SlideTimerWidgetProps {
  initialSeconds: number;
  accentColor: string;
  interactive?: boolean;
  compact?: boolean;
}

interface RollingDigitProps {
  char: string;
}

const RollingDigit: React.FC<RollingDigitProps> = ({ char }) => {
  const [current, setCurrent] = useState(char);
  const [previous, setPrevious] = useState<string | null>(null);
  const [rollId, setRollId] = useState(0);

  useEffect(() => {
    if (char !== current) {
      setPrevious(current);
      setCurrent(char);
      setRollId((n) => n + 1);
    }
  }, [char, current]);

  if (char === ':') {
    return <span className="inline-block px-0.5 leading-none opacity-80">:</span>;
  }

  return (
    <span className="relative inline-flex items-center justify-center w-[0.72em] h-[1.24em] overflow-hidden rounded-lg bg-zinc-900/5 border border-zinc-300/60 mx-[1px]">
      {previous !== null && (
        <span
          key={`out-${rollId}`}
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center leading-none animate-timer-drum-out"
        >
          {previous}
        </span>
      )}
      <span
        key={`in-${rollId}`}
        className={`flex items-center justify-center leading-none ${
          rollId > 0 ? 'animate-timer-drum-in' : ''
        }`}
      >
        {current}
      </span>
    </span>
  );
};

export const SlideTimerWidget: React.FC<SlideTimerWidgetProps> = ({
  initialSeconds,
  accentColor,
  interactive = true,
  compact = false,
}) => {
  const [remaining, setRemaining] = useState(initialSeconds);
  const [running, setRunning] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const prevInitialRef = useRef(initialSeconds);

  useEffect(() => {
    if (prevInitialRef.current !== initialSeconds) {
      prevInitialRef.current = initialSeconds;
      setRemaining(initialSeconds);
      setRunning(false);
    }
  }, [initialSeconds]);

  const playChime = () => {
    if (!soundOn) return;
    try {
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.14);
        gain.gain.setValueAtTime(0.18, now + i * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.65);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.14);
        osc.stop(now + i * 0.14 + 0.7);
      });
    } catch {
      // Ignore Web Audio restrictions if blocked
    }
  };

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setRunning(false);
          playChime();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, soundOn]);

  if (!initialSeconds || initialSeconds <= 0) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const pct = Math.max(0, Math.min(100, (remaining / initialSeconds) * 100));

  if (compact) {
    return (
      <div
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/95 shadow-lg border-2 font-mono font-bold text-2xl"
        style={{ borderColor: accentColor, color: '#18181B' }}
      >
        <Timer size={24} style={{ color: accentColor }} />
        <span className="inline-flex items-center">
          {formatted.split('').map((ch, idx) => (
            <RollingDigit key={idx} char={ch} />
          ))}
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col gap-2 bg-white/95 backdrop-blur-md rounded-2xl px-5 py-3 shadow-xl border-2 min-w-[285px]"
      style={{ borderColor: remaining === 0 ? '#E11D48' : accentColor }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Timer
            size={28}
            style={{ color: remaining === 0 ? '#E11D48' : accentColor }}
          />
          <span
            className={`inline-flex items-center font-mono font-extrabold text-4xl tracking-tight ${
              remaining === 0 ? 'text-rose-600 animate-pulse' : 'text-zinc-900'
            }`}
          >
            {formatted.split('').map((ch, idx) => (
              <RollingDigit key={idx} char={ch} />
            ))}
          </span>
        </div>

        {interactive && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setRunning((r) => !r)}
              className="p-2 rounded-xl text-white transition hover:opacity-90"
              style={{ backgroundColor: accentColor }}
              title={running ? 'Pause Timer' : 'Start Timer'}
            >
              {running ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              onClick={() => setRemaining((r) => r + 60)}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-sm font-bold"
              title="Add 1 minute"
            >
              +1m
            </button>
            <button
              onClick={() => {
                setRunning(false);
                setRemaining(initialSeconds);
              }}
              className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
              title="Reset Timer"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={() => setSoundOn((s) => !s)}
              className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
              title={soundOn ? 'Mute Chime' : 'Enable Chime'}
            >
              {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>
        )}
      </div>

      {/* Visual Progress Track */}
      <div className="h-2.5 w-full rounded-full bg-zinc-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            backgroundColor: remaining === 0 ? '#E11D48' : accentColor,
          }}
        />
      </div>
    </div>
  );
};
