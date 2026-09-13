import { Location, TrafficStatus } from '../../types';

export class TrafficService {
  private trafficDatabase: Map<string, TrafficStatus> = new Map();

  constructor() {
    // Seed with initial realistic mock traffic states for development
    this.trafficDatabase.set('route-sreebhumi', {
      routeId: 'pandal-1',
      level: 'jam',
      lastUpdated: Date.now() - 3 * 60000, // 3 mins ago
    });
    this.trafficDatabase.set('route-santosh', {
      routeId: 'pandal-2',
      level: 'heavy',
      lastUpdated: Date.now() - 10 * 60000,
    });
    this.trafficDatabase.set('route-maddox', {
      routeId: 'pandal-3',
      level: 'moderate',
      lastUpdated: Date.now() - 1 * 60000,
    });
  }

  async getTrafficForRoute(routeId: string): Promise<TrafficStatus> {
    // If we have a cached status, return it, otherwise generate a moderate/low demo status
    if (this.trafficDatabase.has(routeId)) {
      return this.trafficDatabase.get(routeId)!;
    }

    return {
      routeId,
      level: Math.random() > 0.5 ? 'low' : 'moderate',
      lastUpdated: Date.now(),
    };
  }

  async getTrafficNearLocation(location: Location): Promise<'low' | 'moderate' | 'heavy' | 'jam'> {
    // Simulate real-time API call
    const rand = Math.random();
    if (rand > 0.85) return 'jam';
    if (rand > 0.6) return 'heavy';
    if (rand > 0.3) return 'moderate';
    return 'low';
  }
}

export const trafficService = new TrafficService();
