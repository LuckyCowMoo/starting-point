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
}

export const RoutineBadgeIcon: React.FC<RoutineBadgeProps> = ({
  type,
  compact = false,
  onSlide = false,
}) => {
  const meta = ROUTINE_ICON_META[type];

  const renderIcon = (size: number) => {
    switch (type) {
      case 'write-in-books':
        return <BookOpenCheck size={size} />;
      case 'mwb-question':
        return <PencilRuler size={size} />;
      case 'pair-discussion':
        return <MessageSquareMore size={size} />;
      case 'independent-task':
        return <ClipboardCheck size={size} />;
      case 'key-vocab':
        return <KeyRound size={size} />;
      case 'extension-challenge':
        return <Sparkles size={size} />;
      case 'silent-think':
        return <Brain size={size} />;
    }
  };

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
