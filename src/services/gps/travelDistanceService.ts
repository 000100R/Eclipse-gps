/**
 * Eclipse GPS — Real Travel Distance Service
 * Accumulates real movement between consecutive valid GPS positions received from HTML5 Geolocation.
 * Ignores invalid points, stationary jitter, and outlier teleport jumps.
 * Persists accumulated distance to local storage across sessions.
 */

const STORAGE_KEY_DISTANCE = 'eclipse_gps_total_travel_distance_meters';
const STORAGE_KEY_LAST_POS = 'eclipse_gps_last_valid_gps_position';

interface StoredPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export class TravelDistanceService {
  private lastPosition: StoredPosition | null = null;
  private listeners: Set<(distanceMeters: number) => void> = new Set();

  constructor() {
    this.initLastPosition();
  }

  private initLastPosition(): void {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAST_POS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed &&
          typeof parsed.lat === 'number' &&
          typeof parsed.lng === 'number' &&
          typeof parsed.timestamp === 'number'
        ) {
          // If the last position was recorded more than 15 minutes ago, don't use it for calculating a gap
          if (Date.now() - parsed.timestamp < 15 * 60 * 1000) {
            this.lastPosition = parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load last GPS position:', e);
    }
  }

  public getDistanceMeters(): number {
    if (typeof window === 'undefined') return 0;
    try {
      const val = localStorage.getItem(STORAGE_KEY_DISTANCE);
      if (!val) return 0;
      const num = parseFloat(val);
      return isNaN(num) || num < 0 ? 0 : num;
    } catch {
      return 0;
    }
  }

  public formatDistanceKm(meters?: number): string {
    const m = meters ?? this.getDistanceMeters();
    if (!m || m <= 0) return '0 km';
    const km = m / 1000;
    return `${km.toFixed(1)} km`;
  }

  public subscribe(listener: (distanceMeters: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(distanceMeters: number): void {
    this.listeners.forEach((l) => {
      try {
        l(distanceMeters);
      } catch (e) {
        console.error('Distance listener error:', e);
      }
    });
  }

  /**
   * Records a raw GeolocationPosition from HTML5 navigator.geolocation.
   * Validates coordinates, filters out jitter and outliers, and accumulates travel distance.
   */
  public recordPosition(pos: GeolocationPosition): number {
    if (!pos || !pos.coords) return this.getDistanceMeters();

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const accuracy = pos.coords.accuracy ?? 100;
    const timestamp = pos.timestamp || Date.now();

    // 1. Basic coordinate validation
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      (lat === 0 && lng === 0)
    ) {
      return this.getDistanceMeters();
    }

    // 2. Reject low-accuracy / noisy GPS fixes (e.g. coarse fixes > 80m accuracy)
    if (accuracy > 80) {
      return this.getDistanceMeters();
    }

    const currentPoint: StoredPosition = {
      lat,
      lng,
      accuracy,
      timestamp,
    };

    if (!this.lastPosition) {
      this.lastPosition = currentPoint;
      this.saveLastPosition(currentPoint);
      return this.getDistanceMeters();
    }

    const timeDeltaMs = timestamp - this.lastPosition.timestamp;

    // Reject duplicate or reversed timestamps (< 500ms)
    if (timeDeltaMs <= 500) {
      return this.getDistanceMeters();
    }

    // If more than 15 minutes elapsed since last position, treat as a new tracking session segment
    // (prevents accumulating unobserved jumps when the app was closed or device was sleeping)
    if (timeDeltaMs > 15 * 60 * 1000) {
      this.lastPosition = currentPoint;
      this.saveLastPosition(currentPoint);
      return this.getDistanceMeters();
    }

    const distMeters = this.calculateHaversineMeters(
      this.lastPosition.lat,
      this.lastPosition.lng,
      lat,
      lng
    );

    // 3. Stationary jitter filter: ignore movement under 5 meters to prevent phantom drift
    if (distMeters < 5) {
      return this.getDistanceMeters();
    }

    // 4. Outlier / teleport jump filter:
    // Reject physically improbable speed (> 45 m/s or ~162 km/h) or jumps > 3000m
    const speedMps = distMeters / (timeDeltaMs / 1000);
    if (speedMps > 45 || distMeters > 3000) {
      console.warn(`[GPS] Outlier jump discarded: ${Math.round(distMeters)}m in ${Math.round(timeDeltaMs / 1000)}s`);
      this.lastPosition = currentPoint;
      this.saveLastPosition(currentPoint);
      return this.getDistanceMeters();
    }

    // Valid movement delta between consecutive GPS updates
    const currentTotal = this.getDistanceMeters();
    const newTotal = currentTotal + distMeters;

    this.saveTotalDistance(newTotal);
    this.lastPosition = currentPoint;
    this.saveLastPosition(currentPoint);

    this.notify(newTotal);
    return newTotal;
  }

  private saveTotalDistance(meters: number): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_DISTANCE, meters.toFixed(2));
    } catch (e) {
      console.error('Failed to save travel distance:', e);
    }
  }

  private saveLastPosition(pos: StoredPosition): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_LAST_POS, JSON.stringify(pos));
    } catch {
      // Ignore
    }
  }

  private calculateHaversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
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

  public reset(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEY_DISTANCE);
      localStorage.removeItem(STORAGE_KEY_LAST_POS);
      this.lastPosition = null;
      this.notify(0);
    } catch (e) {
      console.error('Failed to reset distance:', e);
    }
  }
}

export const travelDistanceService = new TravelDistanceService();
