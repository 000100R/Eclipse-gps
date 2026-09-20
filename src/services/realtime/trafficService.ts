import { Location, TrafficStatus } from '../../types';
import { trafficIntelligenceService } from '../intelligence/trafficIntelligenceService';

export class TrafficService {
  async getTrafficForRoute(routeId: string): Promise<TrafficStatus> {
    const item = trafficIntelligenceService.getTrafficNearPandal(routeId);
    if (!item || item.status === 'UNAVAILABLE') {
      return {
        routeId,
        level: 'low',
        lastUpdated: Date.now(),
      };
    }

    const levelMap: Record<string, 'low' | 'moderate' | 'heavy' | 'jam'> = {
      CLEAR: 'low',
      MODERATE: 'moderate',
      SLOW: 'moderate',
      HEAVY: 'heavy',
      CONGESTED: 'jam',
      UNAVAILABLE: 'low',
    };

    return {
      routeId,
      level: levelMap[item.status] || 'low',
      lastUpdated: item.lastUpdated,
    };
  }

  async getTrafficNearLocation(location: Location): Promise<'low' | 'moderate' | 'heavy' | 'jam'> {
    const item = trafficIntelligenceService.getTrafficNearPandal('', location);
    if (!item || item.status === 'UNAVAILABLE') {
      return 'low';
    }
    if (item.status === 'HEAVY' || item.status === 'CONGESTED') return 'heavy';
    if (item.status === 'MODERATE' || item.status === 'SLOW') return 'moderate';
    return 'low';
  }
}

export const trafficService = new TrafficService();

