import React from 'react';
import { TrafficStatusLevel, DataSourceType } from '../../types/crowdTraffic';

interface TrafficBadgeProps {
  status?: TrafficStatusLevel | string;
  source?: DataSourceType;
  showSource?: boolean;
  className?: string;
  id?: string;
}

export const TrafficBadge: React.FC<TrafficBadgeProps> = ({
  status,
  source,
  showSource = false,
  className = '',
  id,
}) => {
  // Normalize input
  const normalizedStatus = React.useMemo(() => {
    if (!status) return 'UNAVAILABLE';
    const s = status.toUpperCase();
    if (s === 'CLEAR') return 'CLEAR';
    if (s === 'MODERATE' || s === 'SLOW') return 'MODERATE';
    if (s === 'HEAVY' || s === 'CONGESTED' || s === 'JAM') return 'HEAVY';
    return 'UNAVAILABLE';
  }, [status]);

  const config: Record<'CLEAR' | 'MODERATE' | 'HEAVY' | 'UNAVAILABLE', { color: string; label: string; dot: string }> = {
    CLEAR: {
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/5',
      label: 'Clear',
      dot: 'bg-emerald-400',
    },
    MODERATE: {
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30 shadow-amber-500/5',
      label: 'Moderate',
      dot: 'bg-amber-400',
    },
    HEAVY: {
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30 shadow-rose-500/5',
      label: 'Heavy',
      dot: 'bg-rose-400 animate-pulse',
    },
    UNAVAILABLE: {
      color: 'text-neutral-400 bg-neutral-900/80 border-neutral-800 shadow-none',
      label: 'Traffic data unavailable',
      dot: 'bg-neutral-600',
    },
  };

  const selected = config[normalizedStatus];

  const sourcePills: Record<DataSourceType, { label: string; color: string }> = {
    LIVE: { label: 'LIVE', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    ESTIMATED: { label: 'ESTIMATED', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
    HISTORICAL: { label: 'HISTORICAL', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    UNAVAILABLE: { label: 'UNAVAILABLE', color: 'bg-neutral-800/90 text-neutral-400 border-neutral-700' },
  };

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        id={id || `traffic-badge-${normalizedStatus.toLowerCase()}`}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm transition-colors ${selected.color}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selected.dot}`} />
        <span>{selected.label}</span>
      </span>

      {showSource && source && source !== 'UNAVAILABLE' && sourcePills[source] && (
        <span
          className={`px-1.5 py-0.2 text-[8px] font-mono font-bold uppercase tracking-wider rounded border ${sourcePills[source].color}`}
        >
          {sourcePills[source].label}
        </span>
      )}
    </div>
  );
};
