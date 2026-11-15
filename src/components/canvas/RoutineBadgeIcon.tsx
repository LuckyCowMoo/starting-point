import React from 'react';
import {
  BookOpenCheck,
  Brain,
  ClipboardCheck,
  KeyRound,
  MessageSquareMore,
  Sparkles,
} from 'lucide-react';
import { RoutineIconType } from '../../types/curriculum';
import { ROUTINE_ICON_META } from '../../data/palettes';

interface RoutineBadgeProps {
  type: RoutineIconType;
  compact?: boolean;
  onSlide?: boolean;
  monochromeCorner?: boolean;
  onDark?: boolean;
}

/**
 * Custom Mini-Whiteboard & Dry-Wipe Marker Pen SVG icon so pupils immediately
 * recognise show-me board routines without reading a label.
 */
const MiniWhiteboardPenIcon: React.FC<{ size: number; strokeWidth?: number }> = ({
  size,
  strokeWidth = 2,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {/* Mini-whiteboard rounded frame with bottom ledge */}
    <rect x="2.5" y="4.5" width="15" height="12.5" rx="2.2" />
    <path d="M5 17v1.5h10V17" />
    {/* Subtle writing line on whiteboard */}
    <path d="M5.5 9.5h6.5" />
    <path d="M5.5 13h4" />
    {/* Angled dry-wipe marker pen beside/overlapping right edge */}
    <path d="M19.5 4.5l2 2-7.8 7.8-2.6.6.6-2.6 7.8-7.8z" fill="currentColor" fillOpacity="0.16" />
    <path d="M17.8 6.2l2 2" />
  </svg>
);

export const RoutineBadgeIcon: React.FC<RoutineBadgeProps> = ({
  type,
  compact = false,
  onSlide = false,
  monochromeCorner = false,
  onDark = false,
}) => {
  const meta = ROUTINE_ICON_META[type];

  const renderIcon = (size: number, strokeWidth = 2) => {
    switch (type) {
      case 'write-in-books':
        return <BookOpenCheck size={size} strokeWidth={strokeWidth} />;
      case 'mwb-question':
        return <MiniWhiteboardPenIcon size={size} strokeWidth={strokeWidth} />;
      case 'pair-discussion':
        return <MessageSquareMore size={size} strokeWidth={strokeWidth} />;
      case 'independent-task':
        return <ClipboardCheck size={size} strokeWidth={strokeWidth} />;
      case 'key-vocab':
        return <KeyRound size={size} strokeWidth={strokeWidth} />;
      case 'extension-challenge':
        return <Sparkles size={size} strokeWidth={strokeWidth} />;
      case 'silent-think':
        return <Brain size={size} strokeWidth={strokeWidth} />;
    }
  };

  if (monochromeCorner) {
    return (
      <span
        title={meta.label}
        aria-label={meta.label}
        className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl border-2 transition-colors ${
          onDark
            ? 'text-white border-white/30 bg-white/14 shadow-md'
            : 'text-zinc-800 border-zinc-300/80 bg-white/85 shadow-sm'
        }`}
      >
        {renderIcon(34, 2.2)}
      </span>
    );
  }

  if (compact) {
    return (
      <span
        title={`${meta.label}: ${meta.description}`}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight border"
        style={{
          backgroundColor: `${meta.color}14`,
          borderColor: `${meta.color}35`,
          color: meta.color,
        }}
      >
        {renderIcon(12)}
        <span>{meta.shortLabel}</span>
      </span>
    );
  }

  return (
    <div
      title={meta.description}
      className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-semibold border shadow-xs ${
        onSlide ? 'text-[11px] bg-white/90 backdrop-blur-xs' : 'text-xs bg-white'
      }`}
      style={{
        borderColor: `${meta.color}40`,
        color: meta.color,
      }}
    >
      <span
        className="flex items-center justify-center rounded-lg p-1 text-white"
        style={{ backgroundColor: meta.color }}
      >
        {renderIcon(onSlide ? 12 : 13)}
      </span>
      <span className="tracking-tight">{meta.shortLabel}</span>
    </div>
  );
};
