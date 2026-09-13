import React from 'react';
import { CrowdLevel } from '../../types';

interface CrowdBadgeProps {
  level: CrowdLevel;
  className?: string;
  id?: string;
}

export const CrowdBadge: React.FC<CrowdBadgeProps> = ({ level, className = '', id }) => {
  const config = {
    LOW: {
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/5',
      label: 'Low Crowd',
      dot: 'bg-emerald-400',
    },
    MODERATE: {
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30 shadow-amber-500/5',
      label: 'Moderate',
      dot: 'bg-amber-400',
    },
    HEAVY: {
      color: 'text-orange-400 bg-orange-500/10 border-orange-500/30 shadow-orange-500/5',
      label: 'Heavy Crowd',
      dot: 'bg-orange-400',
    },
    EXTREME: {
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30 shadow-rose-500/5',
      label: 'Extreme Crowd',
      dot: 'bg-rose-400 animate-pulse',
    },
  };

  const selected = config[level] || config.MODERATE;

  return (
    <span
      id={id}
      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border shadow-xs tracking-wider uppercase ${selected.color} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${selected.dot}`} />
      <span>{selected.label}</span>
    </span>
  );
};
