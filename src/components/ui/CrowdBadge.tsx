import React from 'react';
import { CrowdLevel } from '../../types';
import { DataSourceType } from '../../types/crowdTraffic';

interface CrowdBadgeProps {
  level?: CrowdLevel | 'HIGH' | 'UNAVAILABLE' | string;
  status?: DataSourceType;
  lastUpdated?: number;
  showStatus?: boolean;
  className?: string;
  id?: string;
}

export const CrowdBadge: React.FC<CrowdBadgeProps> = ({
  level,
  status,
  lastUpdated,
  showStatus = false,
  className = '',
  id,
}) => {
  const config: Record<string, { color: string; label: string; dot: string }> = {
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
    HIGH: {
      color: 'text-orange-400 bg-orange-500/10 border-orange-500/30 shadow-orange-500/5',
      label: 'High Crowd',
      dot: 'bg-orange-400',
    },
    HEAVY: {
      color: 'text-orange-500 bg-orange-500/15 border-orange-500/30 shadow-orange-500/5',
      label: 'Heavy Crowd',
      dot: 'bg-orange-500',
    },
    EXTREME: {
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30 shadow-rose-500/5',
      label: 'Extreme Crowd',
      dot: 'bg-rose-400 animate-pulse',
    },
    UNAVAILABLE: {
      color: 'text-neutral-400 bg-neutral-900/80 border-neutral-800 shadow-none',
      label: 'Crowd Data Unavailable',
      dot: 'bg-neutral-600',
    },
  };

  // Safe fallback: If level is undefined, missing, or invalid, NEVER guess MODERATE. Always show UNAVAILABLE.
  const selectedKey = (level && config[level]) ? level : 'UNAVAILABLE';
  const selected = config[selectedKey];

  const statusPills: Record<DataSourceType, { label: string; color: string }> = {
    LIVE: { label: 'LIVE', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    ESTIMATED: { label: 'ESTIMATED', color: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
    HISTORICAL: { label: 'HISTORICAL', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
    UNAVAILABLE: { label: 'UNAVAILABLE', color: 'bg-neutral-800/90 text-neutral-400 border-neutral-700' },
  };

  const currentStatus = status || (selectedKey === 'UNAVAILABLE' ? 'UNAVAILABLE' : undefined);

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span
        id={id}
        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border shadow-xs tracking-wider uppercase ${selected.color} ${className}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${selected.dot}`} />
        <span>{selected.label}</span>
      </span>

      {showStatus && currentStatus && (
        <span
          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${statusPills[currentStatus]?.color || 'bg-neutral-800 text-neutral-400 border-neutral-700'}`}
        >
          {statusPills[currentStatus]?.label || currentStatus}
        </span>
      )}

      {lastUpdated && (
        <span className="text-[10px] text-neutral-500 font-mono">
          {new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
};
