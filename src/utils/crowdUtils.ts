import { isFirebaseConfigured } from '../services/firebase';

export interface PandalCrowdMetrics {
  available: boolean;
  count: number;
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'HEAVY' | 'EXTREME' | 'UNAVAILABLE';
  levelLabel: string;
  levelColorClass: string;
  trendLabel: string;
}

export function getPandalCrowdMetrics(
  pandalId: string,
  pandalCrowdCounts: Record<string, number>,
  pandalCrowdTrends: Record<string, 'INCREASING' | 'STABLE' | 'DECREASING'>
): PandalCrowdMetrics {
  if (!isFirebaseConfigured() || Object.keys(pandalCrowdCounts).length === 0) {
    return {
      available: false,
      count: 0,
      level: 'UNAVAILABLE',
      levelLabel: 'Live crowd data unavailable',
      levelColorClass: 'text-neutral-500',
      trendLabel: '',
    };
  }

  const count = pandalCrowdCounts[pandalId] ?? 0;
  if (count <= 0) {
    return {
      available: false,
      count: 0,
      level: 'UNAVAILABLE',
      levelLabel: 'Crowd data unavailable',
      levelColorClass: 'text-neutral-500',
      trendLabel: '',
    };
  }

  const trend = pandalCrowdTrends[pandalId] ?? 'STABLE';

  let level: 'LOW' | 'MODERATE' | 'HIGH' | 'HEAVY' | 'EXTREME' | 'UNAVAILABLE' = 'LOW';
  let levelLabel = '🟢 Low Crowd';
  let levelColorClass = 'text-emerald-400';

  if (count >= 15) {
    level = 'EXTREME';
    levelLabel = '🔴 Extreme Crowd';
    levelColorClass = 'text-rose-400';
  } else if (count >= 10) {
    level = 'HEAVY';
    levelLabel = '🟠 Heavy Crowd';
    levelColorClass = 'text-orange-400';
  } else if (count >= 6) {
    level = 'HIGH';
    levelLabel = '🟠 High Crowd';
    levelColorClass = 'text-orange-400';
  } else if (count >= 3) {
    level = 'MODERATE';
    levelLabel = '🟡 Moderate Crowd';
    levelColorClass = 'text-amber-400';
  } else {
    level = 'LOW';
    levelLabel = '🟢 Low Crowd';
    levelColorClass = 'text-emerald-400';
  }

  let trendLabel = '→ Stable';
  if (trend === 'INCREASING') {
    trendLabel = '📈 Increasing';
  } else if (trend === 'DECREASING') {
    trendLabel = '📉 Decreasing';
  }

  return {
    available: true,
    count,
    level,
    levelLabel,
    levelColorClass,
    trendLabel,
  };
}
