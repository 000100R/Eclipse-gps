/**
 * Eclipse GPS — Bonedi Bari Intelligence Layer Data Provider (Phase 13.2)
 * 
 * High-precision intelligence provider for Kolkata's historic aristocratic family Durga Puja houses.
 * 
 * Strict Invariants:
 * - Provides verified Bonedi Bari records with authenticated historical facts and genuine coordinates.
 * - Viewport-aware geographic querying with bounds buffering.
 * - Calculates accurate distance & estimated travel times from user's GPS location.
 * - Deduplicates records by normalized identity and coordinates.
 * - Never fabricates coordinates or historical facts.
 * - Clearly distinguishes verified heritage records from any unverified community additions.
 * - Connects to Eclipse Intelligence Grid and routing system.
 */

import {
  IntelligenceDataProvider,
  IntelligenceLayerId,
  DataProviderMetadata,
  MapViewportBounds,
} from '../../types/intelligence';
import { BonediBari } from '../../types/bonediBari';
import { Location } from '../../types';
import { curatedBonediBariList } from '../../data/curatedBonediBari';
import { intelligenceLayerService } from './intelligenceLayerService';

export class BonediBariIntelligenceProvider
  implements IntelligenceDataProvider<BonediBari>
{
  public readonly layerId: IntelligenceLayerId = 'BONEDI_BARI';

  public readonly metadata: DataProviderMetadata = {
    id: 'BONEDI_BARI',
    name: 'Bonedi Bari Heritage Intelligence',
    sourceType: 'curated',
    refreshIntervalMs: 120000,
    isAvailable: true,
  };

  // Master deduplicated pool of all known Bonedi Bari houses
  private allBonediBari: BonediBari[] = [];

  // Filtered and enriched list for currently active viewport
  private cachedViewportBonediBari: BonediBari[] = [];

  private lastBounds?: MapViewportBounds;
  private userLocation?: Location;
  private lastError?: string;
  private emptyMessage?: string;

  constructor() {
    this.allBonediBari = this.deduplicateRecords([...curatedBonediBariList]);
    this.cachedViewportBonediBari = [...this.allBonediBari];
  }

  public setUserLocation(loc?: Location): void {
    this.userLocation = loc;
  }

  /**
   * Load Bonedi Bari records within or around the given map viewport bounds
   */
  public async load(
    bounds: MapViewportBounds,
    _zoom?: number,
    userLoc?: Location
  ): Promise<BonediBari[]> {
    this.lastBounds = bounds;
    if (userLoc) {
      this.userLocation = userLoc;
    }

    intelligenceLayerService.updateLoadingState('BONEDI_BARI', true);
    this.emptyMessage = undefined;
    this.lastError = undefined;

    try {
      // 1. Filter against viewport with a 15% buffer
      const filtered = this.filterByViewportBounds(this.allBonediBari, bounds);

      // 2. Enrich with distance & estimated travel time from user location
      const enriched = filtered.map((item) =>
        this.enrichWithUserMetrics(item, this.userLocation)
      );

      // 3. Sort primarily by distance if user location is known, else by heritage age
      enriched.sort((a, b) => {
        if (a.distance !== undefined && b.distance !== undefined) {
          return a.distance - b.distance;
        }
        return a.pujaSince - b.pujaSince;
      });

      this.cachedViewportBonediBari = enriched;

      if (enriched.length === 0) {
        this.emptyMessage =
          'No heritage Bonedi Bari houses in this specific map area. Pan towards North/Central Kolkata or Behala.';
      }

      intelligenceLayerService.updateItemCount(
        'BONEDI_BARI',
        this.cachedViewportBonediBari.length
      );
      intelligenceLayerService.updateLoadingState('BONEDI_BARI', false);

      return this.cachedViewportBonediBari;
    } catch (err: any) {
      console.error('[BonediBariIntelligenceProvider] Error loading records:', err);
      this.lastError = err?.message || 'Failed to load Bonedi Bari intelligence';
      intelligenceLayerService.updateErrorState('BONEDI_BARI', this.lastError);
      intelligenceLayerService.updateLoadingState('BONEDI_BARI', false);
      return this.cachedViewportBonediBari;
    }
  }

  /**
   * Refresh current active viewport data
   */
  public async refresh(): Promise<BonediBari[]> {
    if (this.lastBounds) {
      return this.load(this.lastBounds, 14, this.userLocation);
    }
    const enriched = this.allBonediBari.map((item) =>
      this.enrichWithUserMetrics(item, this.userLocation)
    );
    this.cachedViewportBonediBari = enriched;
    intelligenceLayerService.updateItemCount('BONEDI_BARI', enriched.length);
    return enriched;
  }

  /**
   * Clear in-memory cached items for this provider
   */
  public clear(): void {
    this.cachedViewportBonediBari = [];
    this.lastBounds = undefined;
    intelligenceLayerService.updateItemCount('BONEDI_BARI', 0);
  }

  /**
   * Release resources
   */
  public destroy(): void {
    this.clear();
  }

  /**
   * Get cached data items currently held by provider
   */
  public getData(): BonediBari[] {
    return this.cachedViewportBonediBari.length > 0
      ? this.cachedViewportBonediBari
      : this.allBonediBari.map((item) =>
          this.enrichWithUserMetrics(item, this.userLocation)
        );
  }

  /**
   * Check if provider is available
   */
  public isAvailable(): boolean {
    return true;
  }

  /**
   * Search for Bonedi Bari by query term, area, metro station, or proximity
   */
  public async search(
    query: string,
    userLoc?: Location,
    _viewport?: MapViewportBounds
  ): Promise<BonediBari[]> {
    const effectiveLoc = userLoc || this.userLocation;
    const cleanQuery = query.toLowerCase().trim();

    // Enrich all records with metrics first
    const enrichedPool = this.allBonediBari.map((item) =>
      this.enrichWithUserMetrics(item, effectiveLoc)
    );

    if (!cleanQuery || cleanQuery === 'all' || cleanQuery.includes('bonedi bari')) {
      // If user asks "show Bonedi Bari near me" or general list
      if (cleanQuery.includes('near me') || cleanQuery.includes('nearby')) {
        if (effectiveLoc) {
          return enrichedPool.slice().sort((a, b) => (a.distance || 0) - (b.distance || 0));
        }
      }
    }

    // Specific Metro query matching (e.g. "Shyambazar", "Girish Park", "MG Road", "Esplanade")
    const metroMatches = enrichedPool.filter((item) => {
      const metroLower = item.nearestMetro.toLowerCase();
      return (
        metroLower.includes(cleanQuery) ||
        (cleanQuery.includes('shyambazar') && (metroLower.includes('shobhabazar') || metroLower.includes('girish park'))) ||
        (cleanQuery.includes('girish park') && metroLower.includes('girish park')) ||
        (cleanQuery.includes('mg road') && metroLower.includes('mahatma gandhi')) ||
        (cleanQuery.includes('central') && (metroLower.includes('esplanade') || metroLower.includes('mahatma gandhi'))) ||
        (cleanQuery.includes('esplanade') && metroLower.includes('esplanade')) ||
        (cleanQuery.includes('behala') && (item.zone?.toLowerCase().includes('behala') || metroLower.includes('behala')))
      );
    });

    if (metroMatches.length > 0) {
      return metroMatches.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }

    // Keyword filtering across name, family, description, special features, zone, and address
    const filtered = enrichedPool.filter((item) => {
      const matchName = item.name.toLowerCase().includes(cleanQuery);
      const matchFamily = item.family.toLowerCase().includes(cleanQuery);
      const matchAddress = item.address.toLowerCase().includes(cleanQuery);
      const matchDesc = item.heritageDescription.toLowerCase().includes(cleanQuery);
      const matchZone = item.zone?.toLowerCase().includes(cleanQuery);
      const matchFeatures = item.specialFeatures?.some((f) =>
        f.toLowerCase().includes(cleanQuery)
      );

      return matchName || matchFamily || matchAddress || matchDesc || matchZone || matchFeatures;
    });

    if (filtered.length > 0) {
      return filtered.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }

    // Fallback: If no exact string matched, return closest houses if "near" was asked
    if (cleanQuery.includes('near') || cleanQuery.includes('closest') || cleanQuery.includes('tour')) {
      return enrichedPool.slice().sort((a, b) => (a.distance || 0) - (b.distance || 0)).slice(0, 5);
    }

    return [];
  }

  /**
   * Get single Bonedi Bari by ID
   */
  public getById(id: string): BonediBari | undefined {
    const item = this.allBonediBari.find((b) => b.id === id);
    return item ? this.enrichWithUserMetrics(item, this.userLocation) : undefined;
  }

  public getEmptyMessage(): string | undefined {
    return this.emptyMessage;
  }

  /**
   * Viewport bounds filter with 15% geographic margin
   */
  private filterByViewportBounds(
    items: BonediBari[],
    bounds: MapViewportBounds
  ): BonediBari[] {
    const latSpan = bounds.north - bounds.south;
    const lngSpan = bounds.east - bounds.west;
    const buffer = 0.15;

    const north = bounds.north + latSpan * buffer;
    const south = bounds.south - latSpan * buffer;
    const east = bounds.east + lngSpan * buffer;
    const west = bounds.west - lngSpan * buffer;

    return items.filter(
      (b) =>
        b.latitude >= south &&
        b.latitude <= north &&
        b.longitude >= west &&
        b.longitude <= east
    );
  }

  /**
   * Enrich a Bonedi Bari record with real-time distance and estimated times
   */
  private enrichWithUserMetrics(
    item: BonediBari,
    userLoc?: Location
  ): BonediBari {
    const currentYear = new Date().getFullYear();
    const ageYears = item.pujaSince ? Math.max(1, currentYear - item.pujaSince) : undefined;

    if (!userLoc) {
      return {
        ...item,
        ageYears,
        distance: undefined,
        distanceFormatted: undefined,
        estimatedTravelTime: undefined,
      };
    }

    const distanceMeters = this.calculateDistanceInMeters(userLoc, item.location);
    const distanceFormatted =
      distanceMeters >= 1000
        ? `${(distanceMeters / 1000).toFixed(1)} km`
        : `${Math.round(distanceMeters)} m`;

    // Realistic Kolkata traffic estimates
    const driveMinutes = Math.max(2, Math.round(distanceMeters / 350));
    const walkMinutes = Math.max(1, Math.round(distanceMeters / 75));

    const estimatedTravelTime =
      distanceMeters <= 1500
        ? `${walkMinutes} min walk • ${driveMinutes} min drive`
        : `${driveMinutes} min drive • ${walkMinutes} min walk`;

    return {
      ...item,
      ageYears,
      distance: distanceMeters,
      distanceFormatted,
      estimatedTravelTime,
    };
  }

  /**
   * Deduplicate records based on unique ID or matching coordinate proximity (< 35m)
   */
  public deduplicateRecords(items: BonediBari[]): BonediBari[] {
    const seenIds = new Set<string>();
    const result: BonediBari[] = [];

    for (const item of items) {
      if (seenIds.has(item.id)) continue;

      // Coordinate proximity deduplication check
      const duplicateCoord = result.find(
        (existing) =>
          this.calculateDistanceInMeters(existing.location, item.location) < 35
      );

      if (duplicateCoord) {
        // Keep the record with verified status
        if (
          existingIsBetter(duplicateCoord, item)
        ) {
          continue;
        } else {
          // Replace with higher quality record
          const idx = result.indexOf(duplicateCoord);
          result[idx] = item;
          seenIds.add(item.id);
          continue;
        }
      }

      seenIds.add(item.id);
      result.push(item);
    }

    return result;
  }

  /**
   * Haversine distance in meters
   */
  public calculateDistanceInMeters(loc1: Location, loc2: Location): number {
    const R = 6371000;
    const dLat = ((loc2.lat - loc1.lat) * Math.PI) / 180;
    const dLng = ((loc2.lng - loc1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((loc1.lat * Math.PI) / 180) *
        Math.cos((loc2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

function existingIsBetter(existing: BonediBari, incoming: BonediBari): boolean {
  if (
    existing.verificationStatus === 'VERIFIED' &&
    incoming.verificationStatus !== 'VERIFIED'
  ) {
    return true;
  }
  return false;
}

export const bonediBariIntelligenceProvider = new BonediBariIntelligenceProvider();

// Automatically register provider with IntelligenceLayerService
intelligenceLayerService.registerProvider(bonediBariIntelligenceProvider);
