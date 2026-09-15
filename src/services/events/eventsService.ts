import { Event, Pandal } from '../../types';
import { demoPandals } from '../../data/demoPandals';
import { demoEvents } from '../../data/demoEvents';
import { crowdIntelligenceService } from '../intelligence/crowdIntelligenceService';

export class EventsService {
  private favoritesKey = 'eclipse_gps_favorites';
  private visitedKey = 'eclipse_gps_visited';

  getPandals(): Pandal[] {
    const favs = this.getFavorites();
    const visited = this.getVisited();

    return demoPandals.map(p => {
      // Crowd level must NEVER hallucinate or use static demo values.
      // Evaluated strictly via crowdIntelligenceService from live presence/geofence data.
      const crowdItem = crowdIntelligenceService.getCrowdForPandal(p.id, p);
      const isUnavailable = crowdItem.crowdLevel === 'UNAVAILABLE';

      return {
        ...p,
        crowdLevel: crowdItem.crowdLevel,
        queueTimeMinutes: isUnavailable ? 0 : (crowdItem.queueWaitMinutes ?? 0),
        queueEstimate: isUnavailable ? 'Unavailable' : `${crowdItem.queueWaitMinutes ?? 5} mins`,
        favouriteStatus: favs.includes(p.id),
        visitedStatus: visited.includes(p.id),
      };
    });
  }

  getEvents(): Event[] {
    if (typeof window === 'undefined') return demoEvents;

    const favs = this.getFavorites();
    const visited = this.getVisited();

    // Durga Puja mode maps pandals to general events structure when searched generally, or returns events directly
    const generalEvents = demoEvents.map(e => ({
      ...e,
      favouriteStatus: favs.includes(e.id),
      visitedStatus: visited.includes(e.id),
    }));

    return generalEvents;
  }

  getCombinedList(): (Pandal | Event)[] {
    const pandals = this.getPandals();
    const events = this.getEvents();
    return [...pandals, ...events];
  }

  getItemById(id: string): Pandal | Event | null {
    const all = this.getCombinedList();
    return all.find(item => item.id === id) || null;
  }

  // Favorites Management
  getFavorites(): string[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(this.favoritesKey);
    return data ? JSON.parse(data) : [];
  }

  toggleFavorite(id: string): boolean {
    if (typeof window === 'undefined') return false;
    const favs = this.getFavorites();
    const index = favs.indexOf(id);
    let isFav = false;

    if (index >= 0) {
      favs.splice(index, 1);
    } else {
      favs.push(id);
      isFav = true;
    }

    localStorage.setItem(this.favoritesKey, JSON.stringify(favs));
    return isFav;
  }

  // Visited Management
  getVisited(): string[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(this.visitedKey);
    return data ? JSON.parse(data) : [];
  }

  toggleVisited(id: string): boolean {
    if (typeof window === 'undefined') return false;
    const visited = this.getVisited();
    const index = visited.indexOf(id);
    let isVisited = false;

    if (index >= 0) {
      visited.splice(index, 1);
    } else {
      visited.push(id);
      isVisited = true;
    }

    localStorage.setItem(this.visitedKey, JSON.stringify(visited));
    return isVisited;
  }
}

export const eventsService = new EventsService();
export const EventServiceProvider = eventsService;
export const PandalServiceProvider = eventsService;
