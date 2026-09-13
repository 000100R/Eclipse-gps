import { isFirebaseConfigured } from '../services/firebase';

export interface PandalCrowdMetrics {
  available: boolean;
  count: number;
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH';
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
      level: 'LOW',
      levelLabel: 'Live crowd data unavailable',
      levelColorClass: 'text-neutral-500',
      trendLabel: '',
    };
  }

  const count = pandalCrowdCounts[pandalId] ?? 0;
  const trend = pandalCrowdTrends[pandalId] ?? 'STABLE';

  let level: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH' = 'LOW';
  let levelLabel = '🟢 Low Crowd';
  let levelColorClass = 'text-emerald-400';

  if (count >= 3 && count <= 5) {
    level = 'MODERATE';
    levelLabel = '🟡 Moderate Crowd';
    levelColorClass = 'text-amber-400';
  } else if (count >= 6 && count <= 10) {
    level = 'HIGH';
    levelLabel = '🟠 High Crowd';
    levelColorClass = 'text-orange-500';
  } else if (count > 10) {
    level = 'VERY HIGH';
    levelLabel = '🔴 Very High Crowd';
    levelColorClass = 'text-rose-500';
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
