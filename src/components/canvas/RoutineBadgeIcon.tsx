import React from 'react';
import {
  BookOpenCheck,
  Brain,
  ClipboardCheck,
  KeyRound,
  MessageSquareMore,
  PencilRuler,
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
        return <PencilRuler size={size} strokeWidth={strokeWidth} />;
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
        className={`inline-flex items-center justify-center w-11 h-11 rounded-2xl transition-colors ${
          onDark
            ? 'text-white/85 bg-white/10'
            : 'text-zinc-800/80 bg-zinc-900/6'
        }`}
      >
        {renderIcon(28, 2.1)}
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
