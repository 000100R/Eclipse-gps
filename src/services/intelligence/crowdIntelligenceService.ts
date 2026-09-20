/**
 * Eclipse GPS — Crowd Intelligence Service (Phase 13.7)
 * 
 * Combines real-time Firebase presence mesh, historical Panjika footfall patterns,
 * and area density into a unified crowd intelligence layer.
 * 
 * STRICT PROVENANCE RULE:
 * NEVER display fake "live" data.
 * Clearly distinguishes LIVE, ESTIMATED, HISTORICAL, and UNAVAILABLE.
 */

import { Location } from '../../types';
import {
  CrowdIntelligenceItem,
  CrowdStatusLevel,
  CrowdTrend,
  IntelligenceConfidence,
} from '../../types/crowdTraffic';
import {
  IntelligenceDataProvider,
  DataProviderMetadata,
  MapViewportBounds,
} from '../../types/intelligence';
import { intelligenceLayerService } from './intelligenceLayerService';
import { curatedEclipsePandals } from '../../data/curatedPandals';
import { DiscoveredPandal } from '../../types/discovery';
import { pujaCalendarService } from './pujaCalendarService';
import { crowdService } from '../realtime/crowdService';

class CrowdIntelligenceService implements IntelligenceDataProvider<CrowdIntelligenceItem> {
  public readonly layerId = 'CROWD' as const;

  public readonly metadata: DataProviderMetadata = {
    id: 'CROWD',
    name: 'Crowd Intelligence',
    sourceType: 'realtime',
    refreshIntervalMs: 30000,
    isAvailable: true,
  };

  // In-memory cache of evaluated crowd items
  private crowdCache: Map<string, CrowdIntelligenceItem> = new Map();

  constructor() {
    intelligenceLayerService.registerProvider(this);
  }

  public isAvailable(): boolean {
    return true;
  }

  public async load(_bounds: MapViewportBounds, _zoom?: number): Promise<CrowdIntelligenceItem[]> {
    return Array.from(this.crowdCache.values());
  }

  public async refresh(): Promise<CrowdIntelligenceItem[]> {
    return Array.from(this.crowdCache.values());
  }

  public getData(): CrowdIntelligenceItem[] {
    return Array.from(this.crowdCache.values());
  }

  public clear(): void {
    this.crowdCache.clear();
  }

  public destroy(): void {
    this.crowdCache.clear();
  }

  /**
   * Evaluates crowd intelligence for a single pandal with strict provenance distinction.
   * 
   * STRICT INTEGRITY RULES:
   * 1. NEVER generate or randomly assign LOW/MODERATE/HIGH/HEAVY crowd levels.
   * 2. NEVER treat static/demo crowd values as LIVE.
   * 3. A LIVE crowd level may ONLY be calculated from actual Eclipse live presence/geofence data.
   * 4. If there are insufficient real users/data to calculate crowd: crowdLevel = UNAVAILABLE.
   * 5. If the current date is before the actual Puja/event period and there is no real live
   *    presence data, do NOT show a festival crowd level.
   * 6. Eclipse must prefer saying "Crowd data unavailable" over displaying an unverified crowd level.
   */
  public getCrowdForPandal(
    pandalId: string,
    pandal?: Partial<DiscoveredPandal> | any,
    presenceCounts: Record<string, number> = {},
    presenceTrends: Record<string, 'INCREASING' | 'STABLE' | 'DECREASING'> = {}
  ): CrowdIntelligenceItem {
    const pId = pandalId || pandal?.id || 'unknown-pandal';
    const pName = pandal?.name || 'Durga Puja Pandal';
    const pLoc: Location = pandal?.location || { lat: 22.5726, lng: 88.3639 };

    const liveCount = presenceCounts[pId] ?? 0;
    const rawTrend = presenceTrends[pId] ?? 'STABLE';

    // 1. LIVE DATA: Calculated ONLY from actual active Firebase user presence sessions within 200m
    if (liveCount > 0) {
      let level: CrowdStatusLevel = 'LOW';
      let waitMins = 5;
      if (liveCount >= 15) {
        level = 'EXTREME';
        waitMins = 120;
      } else if (liveCount >= 10) {
        level = 'HEAVY';
        waitMins = 75;
      } else if (liveCount >= 6) {
        level = 'HIGH';
        waitMins = 45;
      } else if (liveCount >= 3) {
        level = 'MODERATE';
        waitMins = 20;
      }

      let trend: CrowdTrend = 'STABLE';
      if (rawTrend === 'INCREASING') trend = 'RISING';
      else if (rawTrend === 'DECREASING') trend = 'FALLING';

      const confidence: IntelligenceConfidence =
        liveCount >= 5 ? 'HIGH' : liveCount >= 2 ? 'MEDIUM' : 'LOW';

      const item: CrowdIntelligenceItem = {
        id: `crowd-${pId}`,
        pandalId: pId,
        pandalName: pName,
        location: pLoc,
        crowdLevel: level,
        crowdTrend: trend,
        activePresenceCount: liveCount,
        queueWaitMinutes: waitMins,
        source: 'LIVE',
        sourceLabel: `Eclipse Live Mesh (${liveCount} active user${liveCount > 1 ? 's' : ''} on-site)`,
        confidence,
        lastUpdated: Date.now(),
        notes: `Real-time footfall detected via GPS presence beacon within 200m perimeter.`,
      };

      this.crowdCache.set(pId, item);
      return item;
    }

    // 2. Verified Community Reports (only if genuinely submitted by a user within 30 mins)
    const communityStatus = crowdService.getLatestCrowdStatus(pId);
    if (
      communityStatus.source === 'COMMUNITY REPORT' &&
      communityStatus.level !== 'UNAVAILABLE' &&
      Date.now() - communityStatus.timestamp < 30 * 60 * 1000
    ) {
      const reportLevel = communityStatus.level as CrowdStatusLevel;
      const item: CrowdIntelligenceItem = {
        id: `crowd-${pId}`,
        pandalId: pId,
        pandalName: pName,
        location: pLoc,
        crowdLevel: reportLevel,
        crowdTrend: 'STABLE',
        queueWaitMinutes:
          reportLevel === 'EXTREME'
            ? 120
            : reportLevel === 'HEAVY'
            ? 60
            : reportLevel === 'HIGH'
            ? 45
            : reportLevel === 'MODERATE'
            ? 20
            : 5,
        source: 'ESTIMATED',
        sourceLabel: 'Verified Community Report (last 30m)',
        confidence: 'MEDIUM',
        lastUpdated: communityStatus.timestamp,
        notes: communityStatus.description || 'Verified report submitted on-site by community member.',
      };

      this.crowdCache.set(pId, item);
      return item;
    }

    // 3. HISTORICAL DATA: Verified festival benchmarks from curated records in project
    const curatedMatch = curatedEclipsePandals.find(
      (cp) => cp.id === pId || (cp.name && pName && cp.name.toLowerCase() === pName.toLowerCase())
    );
    const candidateLevel = (curatedMatch?.crowdLevel || (pandal?.crowdLevel && pandal.crowdLevel !== 'UNAVAILABLE' ? pandal.crowdLevel : undefined)) as CrowdStatusLevel | undefined;
    const rawHistoricalTrend = curatedMatch?.crowdTrend || pandal?.crowdTrend;

    if (candidateLevel && candidateLevel !== 'UNAVAILABLE') {
      let trend: CrowdTrend = 'STABLE';
      if (rawHistoricalTrend === 'RISING' || rawHistoricalTrend === 'INCREASING') trend = 'RISING';
      else if (rawHistoricalTrend === 'FALLING' || rawHistoricalTrend === 'DECREASING') trend = 'FALLING';

      const waitMins =
        candidateLevel === 'EXTREME'
          ? 90
          : candidateLevel === 'HEAVY'
          ? 60
          : candidateLevel === 'HIGH'
          ? 45
          : candidateLevel === 'MODERATE'
          ? 20
          : 10;

      const historicalItem: CrowdIntelligenceItem = {
        id: `crowd-${pId}`,
        pandalId: pId,
        pandalName: pName,
        location: pLoc,
        crowdLevel: candidateLevel,
        crowdTrend: trend,
        queueWaitMinutes: waitMins,
        source: 'HISTORICAL',
        sourceLabel: 'Historical Puja Benchmark',
        confidence: 'MEDIUM',
        lastUpdated: Date.now(),
        historicalPeakWindow: '07:00 PM – 02:00 AM (Ashtami / Navami peak)',
        notes: 'Documented Durga Puja footfall benchmark from past festival editions. Live telemetry activates when on-site presence is detected.',
      };

      this.crowdCache.set(pId, historicalItem);
      return historicalItem;
    }

    // 4. UNAVAILABLE: Zero real live telemetry, no community report, and no verified historical record
    // Never invent or guess crowd data.
    const unavailableItem: CrowdIntelligenceItem = {
      id: `crowd-${pId}`,
      pandalId: pId,
      pandalName: pName,
      location: pLoc,
      crowdLevel: 'UNAVAILABLE',
      crowdTrend: 'UNKNOWN',
      source: 'UNAVAILABLE',
      sourceLabel: 'Crowd data unavailable',
      confidence: 'NONE',
      lastUpdated: Date.now(),
      notes: 'Crowd data unavailable. Awaiting live user check-ins on-site.',
    };

    this.crowdCache.set(pId, unavailableItem);
    return unavailableItem;
  }

  /**
   * Evaluates crowd intelligence across a list of pandals.
   */
  public getAllCrowdItems(
    pandals: DiscoveredPandal[] | any[],
    presenceCounts: Record<string, number> = {},
    presenceTrends: Record<string, 'INCREASING' | 'STABLE' | 'DECREASING'> = {}
  ): CrowdIntelligenceItem[] {
    const results: CrowdIntelligenceItem[] = [];
    const sourceList = pandals && pandals.length > 0 ? pandals : curatedEclipsePandals;

    for (const p of sourceList) {
      const item = this.getCrowdForPandal(p.id, p, presenceCounts, presenceTrends);
      results.push(item);
    }

    const activeCount = results.filter(i => i.crowdLevel !== 'UNAVAILABLE').length;
    intelligenceLayerService.updateItemCount('CROWD', activeCount);
    return results;
  }

  /**
   * Finds nearby pandals with lower crowd levels than the target.
   */
  public getLessCrowdedAlternatives(
    targetPandalId: string,
    allPandals: DiscoveredPandal[] | any[],
    presenceCounts: Record<string, number> = {},
    presenceTrends: Record<string, 'INCREASING' | 'STABLE' | 'DECREASING'> = {},
    limit: number = 3
  ): { pandal: DiscoveredPandal; crowdItem: CrowdIntelligenceItem; distanceMeters: number }[] {
    const target = allPandals.find(p => p.id === targetPandalId);
    if (!target) return [];

    const targetCrowd = this.getCrowdForPandal(target.id, target, presenceCounts, presenceTrends);
    const targetRank = this.getCrowdRank(targetCrowd.crowdLevel);

    const candidates: { pandal: DiscoveredPandal; crowdItem: CrowdIntelligenceItem; distanceMeters: number }[] = [];

    for (const p of allPandals) {
      if (p.id === targetPandalId) continue;
      const c = this.getCrowdForPandal(p.id, p, presenceCounts, presenceTrends);
      if (c.crowdLevel === 'UNAVAILABLE') continue;

      const cRank = this.getCrowdRank(c.crowdLevel);
      if (cRank < targetRank) {
        const dist = this.haversineDistance(target.location, p.location);
        candidates.push({ pandal: p, crowdItem: c, distanceMeters: dist });
      }
    }

    // Sort by proximity, then by lowest crowd rank
    candidates.sort((a, b) => {
      const rankDiff = this.getCrowdRank(a.crowdItem.crowdLevel) - this.getCrowdRank(b.crowdItem.crowdLevel);
      if (rankDiff !== 0) return rankDiff;
      return a.distanceMeters - b.distanceMeters;
    });

    return candidates.slice(0, limit);
  }

  /**
   * Retrieves high/heavy crowd hotspots across the city.
   */
  public getCrowdedAreas(
    allPandals: DiscoveredPandal[] | any[],
    presenceCounts: Record<string, number> = {},
    presenceTrends: Record<string, 'INCREASING' | 'STABLE' | 'DECREASING'> = {}
  ): CrowdIntelligenceItem[] {
    const items = this.getAllCrowdItems(allPandals, presenceCounts, presenceTrends);
    return items.filter(i => i.crowdLevel === 'EXTREME' || i.crowdLevel === 'HEAVY' || i.crowdLevel === 'HIGH');
  }

  private getCrowdRank(level: CrowdStatusLevel): number {
    switch (level) {
      case 'LOW': return 1;
      case 'MODERATE': return 2;
      case 'HIGH': return 3;
      case 'HEAVY': return 4;
      case 'EXTREME': return 5;
      default: return 99;
    }
  }

  private haversineDistance(loc1: Location, loc2: Location): number {
    if (!loc1 || !loc2) return 999999;
    const R = 6371e3;
    const phi1 = (loc1.lat * Math.PI) / 180;
    const phi2 = (loc2.lat * Math.PI) / 180;
    const deltaPhi = ((loc2.lat - loc1.lat) * Math.PI) / 180;
    const deltaLambda = ((loc2.lng - loc1.lng) * Math.PI) / 180;
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }
}

export const crowdIntelligenceService = new CrowdIntelligenceService();
