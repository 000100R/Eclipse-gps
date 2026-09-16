import { VisitedPandalRecord, Location } from '../../types';
import { eventsService } from '../events/eventsService';

const STORAGE_KEY = 'eclipse_gps_visited_pandals_records';
const VISIT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes between separate visit count increments

/**
 * Calculates haversine distance in meters between two coordinates.
 */
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class VisitedPandalsService {
  /**
   * Retrieves all persisted visited pandal records.
   */
  public getRecords(): VisitedPandalRecord[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed: VisitedPandalRecord[] = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to load visited pandal records from storage:', e);
      return [];
    }
  }

  /**
   * Total number of unique pandals visited.
   */
  public getTotalVisitedCount(): number {
    return this.getRecords().length;
  }

  /**
   * Checks if a specific pandal has been visited.
   */
  public isVisited(pandalId: string): boolean {
    const records = this.getRecords();
    return records.some((r) => r.pandalId === pandalId);
  }

  /**
   * Gets the record for a specific pandal if it exists.
   */
  public getRecord(pandalId: string): VisitedPandalRecord | undefined {
    const records = this.getRecords();
    return records.find((r) => r.pandalId === pandalId);
  }

  /**
   * Records a visit to a pandal.
   * Prevents duplicates by keying on pandalId.
   * If already visited recently, updates latestVisitedAt without inflating visit count.
   * If re-visited after the cooldown, increments visit count.
   */
  public recordVisit(pandal: {
    id: string;
    name: string;
    location?: Location;
    latitude?: number;
    longitude?: number;
  }): { record: VisitedPandalRecord; isNew: boolean } {
    if (typeof window === 'undefined') {
      const fallbackRecord: VisitedPandalRecord = {
        pandalId: pandal.id,
        pandalName: pandal.name,
        coordinates: {
          lat: pandal.location?.lat ?? pandal.latitude ?? 0,
          lng: pandal.location?.lng ?? pandal.longitude ?? 0,
        },
        firstVisitedAt: Date.now(),
        latestVisitedAt: Date.now(),
        visitCount: 1,
      };
      return { record: fallbackRecord, isNew: true };
    }

    const records = this.getRecords();
    const existingIndex = records.findIndex((r) => r.pandalId === pandal.id);
    const now = Date.now();
    let isNew = false;
    let targetRecord: VisitedPandalRecord;

    const coords = {
      lat: pandal.location?.lat ?? pandal.latitude ?? 0,
      lng: pandal.location?.lng ?? pandal.longitude ?? 0,
    };

    if (existingIndex >= 0) {
      const existing = records[existingIndex];
      const timeSinceLastVisit = now - (existing.latestVisitedAt || existing.firstVisitedAt);
      const shouldIncrementCount = timeSinceLastVisit >= VISIT_COOLDOWN_MS;

      targetRecord = {
        ...existing,
        pandalName: pandal.name || existing.pandalName,
        coordinates: (coords.lat && coords.lng) ? coords : existing.coordinates,
        latestVisitedAt: now,
        visitCount: shouldIncrementCount ? existing.visitCount + 1 : existing.visitCount,
      };

      records[existingIndex] = targetRecord;
    } else {
      isNew = true;
      targetRecord = {
        pandalId: pandal.id,
        pandalName: pandal.name,
        coordinates: coords,
        firstVisitedAt: now,
        latestVisitedAt: now,
        visitCount: 1,
      };
      records.unshift(targetRecord);
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.error('Failed to save visited pandal record:', e);
    }

    // Keep legacy eventsService visited IDs in sync
    const legacyVisited = eventsService.getVisited();
    if (!legacyVisited.includes(pandal.id)) {
      legacyVisited.push(pandal.id);
      try {
        localStorage.setItem('eclipse_gps_visited', JSON.stringify(legacyVisited));
      } catch (e) {
        console.error('Failed to update legacy visited IDs:', e);
      }
    }

    return { record: targetRecord, isNew };
  }

  /**
   * Checks current GPS coordinates against candidates within a geofence radius.
   * Returns newly recorded visits.
   */
  public checkGpsGeofence(
    userLoc: Location,
    candidates: Array<{
      id: string;
      name: string;
      location?: Location;
      latitude?: number;
      longitude?: number;
    }>,
    radiusMeters: number = 75
  ): VisitedPandalRecord[] {
    if (!userLoc || typeof userLoc.lat !== 'number' || typeof userLoc.lng !== 'number') {
      return [];
    }

    // Guard against Null Island / invalid GPS coordinates
    if (userLoc.lat === 0 && userLoc.lng === 0) {
      return [];
    }

    const newlyVisited: VisitedPandalRecord[] = [];

    for (const candidate of candidates) {
      const lat = candidate.location?.lat ?? candidate.latitude;
      const lng = candidate.location?.lng ?? candidate.longitude;

      if (typeof lat !== 'number' || typeof lng !== 'number' || (lat === 0 && lng === 0)) {
        continue;
      }

      // Quick bounding box check (~0.001 deg is roughly 110 meters)
      const latDiff = Math.abs(userLoc.lat - lat);
      const lngDiff = Math.abs(userLoc.lng - lng);
      if (latDiff > 0.0015 || lngDiff > 0.0015) {
        continue;
      }

      const distance = calculateDistanceMeters(userLoc.lat, userLoc.lng, lat, lng);
      if (distance <= radiusMeters) {
        const { record } = this.recordVisit(candidate);
        newlyVisited.push(record);
      }
    }

    return newlyVisited;
  }

  /**
   * Deletes a visited pandal record.
   */
  public removeRecord(pandalId: string): void {
    if (typeof window === 'undefined') return;
    const records = this.getRecords().filter((r) => r.pandalId !== pandalId);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      const legacyVisited = eventsService.getVisited().filter((id) => id !== pandalId);
      localStorage.setItem('eclipse_gps_visited', JSON.stringify(legacyVisited));
    } catch (e) {
      console.error('Failed to remove visited pandal record:', e);
    }
  }

  /**
   * Clears all visited pandal records.
   */
  public clearAll(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('eclipse_gps_visited');
    } catch (e) {
      console.error('Failed to clear visited pandal records:', e);
    }
  }
}

export const visitedPandalsService = new VisitedPandalsService();
