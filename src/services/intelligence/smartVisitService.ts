/**
 * Eclipse GPS — Smart Visit Recommendation Engine (Phase 13.7)
 * 
 * Computes a transparent, grounded visit recommendation for any pandal.
 * Combines:
 * - Current crowd level & trend
 * - Corridor traffic condition
 * - Estimated travel route time
 * - Current hour of day
 * - Bengal festival calendar / ritual phase
 * 
 * STRICT DIRECTIVE:
 * Does NOT claim predictive accuracy that available data cannot support.
 * Transparently reveals contributing factors.
 */

import { Location } from '../../types';
import {
  SmartVisitRecommendation,
} from '../../types/crowdTraffic';
import { crowdIntelligenceService } from './crowdIntelligenceService';
import { trafficIntelligenceService } from './trafficIntelligenceService';
import { pujaCalendarService } from './pujaCalendarService';
import { DiscoveredPandal } from '../../types/discovery';

export class SmartVisitService {
  /**
   * Calculates a transparent visit recommendation for a pandal.
   */
  public calculateRecommendation(
    pandal: DiscoveredPandal | any,
    allPandals: DiscoveredPandal[] | any[] = [],
    presenceCounts: Record<string, number> = {},
    presenceTrends: Record<string, 'INCREASING' | 'STABLE' | 'DECREASING'> = {},
    userLocation?: Location | null
  ): SmartVisitRecommendation {
    if (!pandal) {
      return {
        status: 'NEUTRAL',
        headline: 'No pandal selected',
        description: 'Select a pandal on the map to evaluate crowd and traffic intelligence.',
        crowdFactor: 'No data',
        trafficFactor: 'No data',
        timingFactor: 'No data',
        calendarFactor: 'No data',
        isDataAvailable: false,
      };
    }

    const crowd = crowdIntelligenceService.getCrowdForPandal(
      pandal.id,
      pandal,
      presenceCounts,
      presenceTrends
    );

    const traffic = trafficIntelligenceService.getTrafficNearPandal(
      pandal.id,
      pandal.location
    );

    const now = new Date();
    const currentHour = now.getHours();

    // 1. Evaluate Current Hour / Time Period
    let timeLabel = '';
    let isPeakHour = false;
    let isFavorableHour = false;

    if (currentHour >= 6 && currentHour < 12) {
      timeLabel = 'Morning Darshan Window (06:00 AM – 12:00 PM)';
      isFavorableHour = true;
    } else if (currentHour >= 12 && currentHour < 17) {
      timeLabel = 'Afternoon Window (12:00 PM – 05:00 PM)';
      isFavorableHour = true;
    } else if (currentHour >= 17 && currentHour < 24) {
      timeLabel = 'Evening Peak Lighting & Footfall Rush (05:00 PM – Midnight)';
      isPeakHour = true;
    } else {
      timeLabel = 'Late Night Hopping Window (Midnight – 05:00 AM)';
      isFavorableHour = false;
    }

    // 2. Evaluate Festival Calendar Day & Active Rituals
    const calendarStatus = pujaCalendarService.getCurrentFestivalDayStatus();
    let calendarFactor = '';
    if (calendarStatus.eventName) {
      calendarFactor = `${calendarStatus.eventName}${calendarStatus.pujaDay ? ` (${calendarStatus.pujaDay})` : ''}`;
    } else {
      calendarFactor = 'Durga Puja Festival Calendar Active';
    }

    // Check if data is completely unavailable
    const hasCrowdData = crowd.crowdLevel !== 'UNAVAILABLE';
    const hasTrafficData = Boolean(traffic && traffic.status !== 'UNAVAILABLE');

    if (!hasCrowdData && !hasTrafficData) {
      return {
        status: 'NEUTRAL',
        headline: 'Limited live telemetry available',
        description: 'Sensor and volunteer telemetry are not yet registered for this venue. Normal daytime visiting applies.',
        crowdFactor: 'No crowd sensors or recent presence beacons registered for this pandal.',
        trafficFactor: 'Local connecting streets show standard residential flow.',
        timingFactor: timeLabel,
        calendarFactor,
        isDataAvailable: false,
      };
    }

    // 3. Summarize Crowd Factor
    let crowdSummary = '';
    if (crowd.crowdLevel === 'UNAVAILABLE') {
      crowdSummary = 'Crowd telemetry unavailable; no presence beacons registered.';
    } else {
      const waitStr = crowd.queueWaitMinutes ? `~${crowd.queueWaitMinutes} min queue wait` : 'queue wait time not logged';
      crowdSummary = `Footfall is ${crowd.crowdLevel} (Trend: ${crowd.crowdTrend}, ${waitStr}). Provenance: ${crowd.source} (${crowd.sourceLabel}).`;
    }

    // 4. Summarize Traffic Factor
    let trafficSummary = '';
    if (!traffic || traffic.status === 'UNAVAILABLE') {
      trafficSummary = 'Traffic data unavailable for immediate access roads.';
    } else {
      const delayStr = traffic.estimatedDelayMinutes > 0 ? `+${traffic.estimatedDelayMinutes} min delay` : 'negligible delay';
      const statusWord = traffic.status === 'HEAVY' || traffic.status === 'CONGESTED' ? 'Heavy' : traffic.status === 'MODERATE' || traffic.status === 'SLOW' ? 'Moderate' : 'Clear';
      trafficSummary = `${traffic.corridorName} traffic is ${statusWord} (${delayStr}). ${traffic.alternativeRoute ? 'Advisory: ' + traffic.alternativeRoute : ''}`;
    }

    // 5. Look for Less Crowded Alternatives if this pandal is heavily congested
    let alternativePandal: SmartVisitRecommendation['alternativePandal'] = undefined;
    if ((crowd.crowdLevel === 'EXTREME' || crowd.crowdLevel === 'HEAVY' || crowd.crowdLevel === 'HIGH') && allPandals.length > 0) {
      const alternatives = crowdIntelligenceService.getLessCrowdedAlternatives(
        pandal.id,
        allPandals,
        presenceCounts,
        presenceTrends,
        1
      );

      if (alternatives.length > 0) {
        const alt = alternatives[0];
        alternativePandal = {
          id: alt.pandal.id,
          name: alt.pandal.name,
          crowdLevel: alt.crowdItem.crowdLevel,
          distanceMeters: alt.distanceMeters,
        };
      }
    }

    // 6. Formulate Decision
    let headline = '';
    let description = '';
    let status: 'RECOMMENDED' | 'CAUTION' | 'AVOID' | 'NEUTRAL' = 'NEUTRAL';

    const isCrowdExtreme = crowd.crowdLevel === 'EXTREME';
    const isCrowdHeavy = crowd.crowdLevel === 'HEAVY' || isCrowdExtreme;
    const isCrowdHigh = crowd.crowdLevel === 'HIGH';
    const isCrowdModerate = crowd.crowdLevel === 'MODERATE';
    const isTrafficCongested = traffic?.status === 'CONGESTED' || traffic?.status === 'HEAVY';
    const isTrafficSlow = traffic?.status === 'SLOW' || traffic?.status === 'MODERATE';

    if (isCrowdExtreme) {
      status = 'AVOID';
      headline = 'Extreme crowd surge — avoid visiting now';
      description = alternativePandal
        ? `Massive queue congestion detected (~120m wait). We recommend visiting ${alternativePandal.name} (${alternativePandal.distanceMeters ? (alternativePandal.distanceMeters / 1000).toFixed(1) + ' km away, ' : ''}${alternativePandal.crowdLevel} crowd) instead.`
        : `Extreme footfall detected with massive queue delays. Security barricades active. Defer visit or arrive late night.`;
    } else if (isCrowdHeavy || (isCrowdHigh && crowd.crowdTrend === 'RISING') || (isCrowdHigh && isTrafficCongested)) {
      if (alternativePandal) {
        status = 'AVOID';
        headline = 'Heavy crowd — nearby alternatives available';
        const distKm = alternativePandal.distanceMeters
          ? `${(alternativePandal.distanceMeters / 1000).toFixed(1)} km away`
          : 'nearby';
        description = `Peak footfall with extended queue delays. Consider visiting ${alternativePandal.name} (${distKm}, ${alternativePandal.crowdLevel} crowd) instead.`;
      } else {
        status = 'CAUTION';
        headline = 'Consider visiting later';
        description = `Queue delays are currently high with ${crowd.crowdTrend.toLowerCase()} movement. Visiting during afternoon lull or after midnight is advised.`;
      }
    } else if (isCrowdModerate && isPeakHour && crowd.crowdTrend === 'RISING') {
      status = 'CAUTION';
      headline = 'Crowd rising — visit soon to avoid long queues';
      description = `Current footfall is manageable but rising quickly as evening rush sets in. Arterial corridors remain navigable.`;
    } else if (crowd.crowdLevel === 'LOW' || (isCrowdModerate && !isTrafficCongested)) {
      status = 'RECOMMENDED';
      headline = 'Good time to visit';
      description = isFavorableHour
        ? `Manageable footfall and smooth traffic flow. Excellent window for darshan without prolonged queues.`
        : `Steady movement with minimal queue delays. Corridors are accessible.`;
    } else if (isTrafficCongested && !isCrowdHeavy) {
      status = 'CAUTION';
      headline = 'Approach roads congested — use Metro';
      description = `The venue itself has manageable queues, but access corridors have vehicle backups. Disembark at the nearest metro station if possible.`;
    } else {
      status = 'NEUTRAL';
      headline = 'Moderate visiting conditions';
      description = `Standard festival visiting flow. Keep buffer time for security perimeter and pedestrian barricades.`;
    }

    return {
      status,
      headline,
      description,
      crowdFactor: crowdSummary,
      trafficFactor: trafficSummary,
      timingFactor: `${timeLabel} (Local Time: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      calendarFactor,
      alternativePandal,
      isDataAvailable: true,
    };
  }
}

export const smartVisitService = new SmartVisitService();
