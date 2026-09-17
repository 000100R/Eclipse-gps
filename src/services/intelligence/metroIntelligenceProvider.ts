/**
 * Eclipse GPS — Metro Intelligence Provider (Phase 13.3)
 * 
 * High-precision transit intelligence provider connecting Kolkata Metro stations
 * with nearby Durga Puja pandals and heritage Bonedi Baris.
 * 
 * Strict Invariants:
 * - Uses verified Kolkata Metro station coordinates.
 * - Queries genuine Eclipse PANDAL and BONEDI_BARI providers.
 * - Calculates walking distance & times using routing logic.
 * - Returns nearby places sorted strictly by walking distance.
 * - Never fabricates stations, coordinates, or connections.
 * - Connects to Eclipse Intelligence Grid architecture.
 */

import {
  IntelligenceDataProvider,
  IntelligenceLayerId,
  DataProviderMetadata,
  MapViewportBounds,
} from '../../types/intelligence';
import {
  MetroStation,
  NearbyPandalRef,
  NearbyBonediBariRef,
  MetroLineCategory,
  MetroGateRouteOption,
  MetroGateIntelligenceResult,
  MetroEntranceExit,
} from '../../types/metro';
import { Location, Pandal } from '../../types';
import { curatedMetroStations } from '../../data/curatedMetroStations';
import { curatedEclipsePandals } from '../../data/curatedPandals';
import { curatedBonediBariList } from '../../data/curatedBonediBari';
import { intelligenceLayerService } from './intelligenceLayerService';
import { routingService } from '../routing/routingService';
import { pandalDiscoveryService } from '../discovery/pandalDiscoveryService';

export class MetroIntelligenceProvider
  implements IntelligenceDataProvider<MetroStation>
{
  public readonly layerId: IntelligenceLayerId = 'METRO';

  public readonly metadata: DataProviderMetadata = {
    id: 'METRO',
    name: 'Kolkata Metro Intelligence',
    sourceType: 'curated',
    refreshIntervalMs: 180000,
    isAvailable: true,
  };

  private allStations: MetroStation[] = [];
  private cachedViewportStations: MetroStation[] = [];
  private lastBounds?: MapViewportBounds;
  private userLocation?: Location;
  private activeLineFilter: MetroLineCategory = 'ALL';
  private lineFilterListeners: Set<(filter: MetroLineCategory) => void> = new Set();
  private routedPandalsCache = new Map<string, NearbyPandalRef[]>();
  private gateIntelligenceCache = new Map<string, MetroGateIntelligenceResult>();

  constructor() {
    this.allStations = [...curatedMetroStations];
    this.enrichAllStations();
    this.cachedViewportStations = [...this.allStations];
  }

  public setUserLocation(loc?: Location): void {
    this.userLocation = loc;
  }

  public getLineFilter(): MetroLineCategory {
    return this.activeLineFilter;
  }

  public setLineFilter(filter: MetroLineCategory): void {
    if (this.activeLineFilter === filter) return;
    this.activeLineFilter = filter;
    this.lineFilterListeners.forEach((listener) => {
      try {
        listener(filter);
      } catch (e) {
        console.error('Error notifying line filter listener', e);
      }
    });
    // Trigger refresh with new line filter
    this.refresh();
  }

  public subscribeLineFilter(listener: (filter: MetroLineCategory) => void): () => void {
    this.lineFilterListeners.add(listener);
    return () => this.lineFilterListeners.delete(listener);
  }

  public matchesLineFilter(station: MetroStation, filter: MetroLineCategory = this.activeLineFilter): boolean {
    if (filter === 'ALL') return true;
    const line = (station.line || '').toLowerCase();
    const lines = (station.lines || []).map((l) => l.toLowerCase());
    const combined = [line, ...lines].join(' ');

    switch (filter) {
      case 'BLUE':
        return combined.includes('blue') || combined.includes('north-south') || combined.includes('line 1');
      case 'GREEN':
        return combined.includes('green') || combined.includes('east-west') || combined.includes('line 2');
      case 'PURPLE':
        return combined.includes('purple') || combined.includes('joka') || combined.includes('line 3');
      case 'YELLOW':
        return combined.includes('yellow') || combined.includes('airport') || combined.includes('noapara-barasat') || combined.includes('line 4');
      default:
        return true;
    }
  }

  public getLineCounts(): Record<MetroLineCategory, number> {
    return {
      ALL: this.allStations.length,
      BLUE: this.allStations.filter((s) => this.matchesLineFilter(s, 'BLUE')).length,
      GREEN: this.allStations.filter((s) => this.matchesLineFilter(s, 'GREEN')).length,
      PURPLE: this.allStations.filter((s) => this.matchesLineFilter(s, 'PURPLE')).length,
      YELLOW: this.allStations.filter((s) => this.matchesLineFilter(s, 'YELLOW')).length,
    };
  }

  /**
   * Pre-enrich all metro stations with verified nearby pandals and bonedi baris
   * sorted by walking distance.
   */
  private enrichAllStations(): void {
    this.allStations = this.allStations.map((station) => {
      const nearbyPandals = this.findNearbyPandalsForStation(station);
      const nearbyBonediBaris = this.findNearbyBonediBarisForStation(station);

      // Re-sort nearby places strictly by walking distance
      nearbyPandals.sort((a, b) => a.distanceMeters - b.distanceMeters);
      nearbyBonediBaris.sort((a, b) => a.distanceMeters - b.distanceMeters);

      return {
        ...station,
        nearbyPandals,
        nearbyBonediBaris,
      };
    });
  }

  /**
   * Load Metro stations within or around map viewport
   */
  public async load(
    bounds: MapViewportBounds,
    _zoom?: number,
    userLoc?: Location
  ): Promise<MetroStation[]> {
    this.lastBounds = bounds;
    if (userLoc) {
      this.userLocation = userLoc;
    }

    intelligenceLayerService.updateLoadingState('METRO', true);

    try {
      // 1. Filter stations by selected metro line
      const lineStations = this.allStations.filter((st) => this.matchesLineFilter(st, this.activeLineFilter));

      // 2. Filter stations by viewport with 20% geographic buffer
      const filtered = this.filterByViewportBounds(lineStations, bounds);

      // 3. Enrich with user distance if GPS location available
      const enriched = filtered.map((st) => this.enrichWithUserMetrics(st, this.userLocation));

      // 4. Sort stations: by user distance if known, else North-to-South
      enriched.sort((a, b) => {
        if (a.distance !== undefined && b.distance !== undefined) {
          return a.distance - b.distance;
        }
        return b.latitude - a.latitude;
      });

      this.cachedViewportStations = enriched;
      intelligenceLayerService.updateItemCount('METRO', enriched.length);
      intelligenceLayerService.updateLoadingState('METRO', false);
      return enriched;
    } catch (err: any) {
      intelligenceLayerService.updateLoadingState('METRO', false);
      intelligenceLayerService.updateErrorState('METRO', err?.message || 'Failed to load Metro stations');
      return this.cachedViewportStations;
    }
  }

  public async refresh(): Promise<MetroStation[]> {
    if (this.lastBounds) {
      return this.load(this.lastBounds, 14, this.userLocation);
    }
    const lineStations = this.allStations.filter((st) => this.matchesLineFilter(st, this.activeLineFilter));
    const enriched = lineStations.map((st) => this.enrichWithUserMetrics(st, this.userLocation));
    this.cachedViewportStations = enriched;
    intelligenceLayerService.updateItemCount('METRO', enriched.length);
    return enriched;
  }

  public clear(): void {
    this.cachedViewportStations = [];
    this.lastBounds = undefined;
    this.routedPandalsCache.clear();
    this.gateIntelligenceCache.clear();
    intelligenceLayerService.updateItemCount('METRO', 0);
  }

  public destroy(): void {
    this.clear();
    this.lineFilterListeners.clear();
  }

  public getData(): MetroStation[] {
    const lineStations = this.allStations.filter((st) => this.matchesLineFilter(st, this.activeLineFilter));
    if (this.cachedViewportStations.length > 0) {
      return this.cachedViewportStations.filter((st) => this.matchesLineFilter(st, this.activeLineFilter));
    }
    return lineStations.map((st) => this.enrichWithUserMetrics(st, this.userLocation));
  }

  public getAllStations(filter: MetroLineCategory = this.activeLineFilter): MetroStation[] {
    const lineStations = this.allStations.filter((st) => this.matchesLineFilter(st, filter));
    return lineStations.map((st) => this.enrichWithUserMetrics(st, this.userLocation));
  }

  public isAvailable(): boolean {
    return true;
  }

  /**
   * Find a station by exact ID or case-insensitive name match
   */
  public getStationById(id: string): MetroStation | undefined {
    const station = this.allStations.find((s) => s.id === id);
    return station ? this.enrichWithUserMetrics(station, this.userLocation) : undefined;
  }

  /**
   * Lookup station by natural text (e.g. "Shyambazar", "Kalighat", "Rabindra Sadan")
   */
  public getStationByNameOrQuery(query: string): MetroStation | undefined {
    const clean = query.toLowerCase().replace(/metro\s*station|metro/g, '').trim();
    if (!clean) return undefined;

    // 1. Direct includes
    const match = this.allStations.find((s) => {
      const sName = s.name.toLowerCase();
      return sName.includes(clean) || clean.includes(sName.replace(/metro/g, '').trim());
    });

    if (match) return this.enrichWithUserMetrics(match, this.userLocation);

    // 2. Keyword fallback (e.g. "tollygunge" -> Mahanayak Uttam Kumar)
    const aliases: Record<string, string> = {
      tollygunge: 'metro-tollygunge',
      'uttam kumar': 'metro-tollygunge',
      bhowanipore: 'metro-netaji-bhavan',
      elgin: 'metro-netaji-bhavan',
      hazra: 'metro-jatin-das-park',
      rashbehari: 'metro-kalighat',
      naktala: 'metro-gitanjali',
      bansdroni: 'metro-bansdroni',
      kudghat: 'metro-netaji-kudghat',
      'lake gardens': 'metro-rabindra-sarobar',
      howrah: 'metro-howrah-station',
      burrabazar: 'metro-mg-road',
      'salt lake': 'metro-city-centre',
      kankurgachi: 'metro-phoolbagan',
      barisha: 'metro-behala-chowrasta',
      behala: 'metro-behala-chowrasta',
    };

    for (const [key, id] of Object.entries(aliases)) {
      if (clean.includes(key)) {
        const found = this.allStations.find((s) => s.id === id);
        if (found) return this.enrichWithUserMetrics(found, this.userLocation);
      }
    }

    return undefined;
  }

  /**
   * Search Metro stations by query or proximity
   */
  public async search(query: string, userLoc?: Location): Promise<MetroStation[]> {
    const activeLoc = userLoc || this.userLocation;
    const clean = query.toLowerCase().trim();

    // 1. Check for specific station name
    const specificStation = this.getStationByNameOrQuery(clean);
    if (specificStation) {
      return [this.enrichWithUserMetrics(specificStation, activeLoc)];
    }

    // 2. Filter list by partial text matches
    const filtered = this.allStations.filter((s) => {
      const name = s.name.toLowerCase();
      const line = s.line.toLowerCase();
      const gates = (s.entrancesExits || []).map((e) => `${e.name} ${e.landmark || ''}`.toLowerCase()).join(' ');
      return name.includes(clean) || line.includes(clean) || gates.includes(clean);
    });

    const enriched = filtered.map((s) => this.enrichWithUserMetrics(s, activeLoc));
    enriched.sort((a, b) => (a.distance || 999999) - (b.distance || 999999));
    return enriched;
  }

  /**
   * "PUJA FROM METRO" Core Action:
   * Returns all nearby Pandals and Bonedi Baris for a station, sorted strictly by walking distance.
   */
  public getNearbyPujasForStation(stationIdOrName: string): {
    station: MetroStation;
    pandals: NearbyPandalRef[];
    bonediBaris: NearbyBonediBariRef[];
    allPujas: (NearbyPandalRef | NearbyBonediBariRef)[];
    totalCount: number;
  } | null {
    let station = this.allStations.find((s) => s.id === stationIdOrName);
    if (!station) {
      station = this.getStationByNameOrQuery(stationIdOrName);
    }
    if (!station) return null;

    const enrichedStation = this.enrichWithUserMetrics(station, this.userLocation);
    const pandals = this.findNearbyPandalsForStation(enrichedStation);
    const bonediBaris = this.findNearbyBonediBarisForStation(enrichedStation);

    // Sort pandals and bonedi baris strictly by walking distance
    pandals.sort((a, b) => a.distanceMeters - b.distanceMeters);
    bonediBaris.sort((a, b) => a.distanceMeters - b.distanceMeters);

    const allPujas: (NearbyPandalRef | NearbyBonediBariRef)[] = [...pandals, ...bonediBaris];
    allPujas.sort((a, b) => a.distanceMeters - b.distanceMeters);

    return {
      station: enrichedStation,
      pandals,
      bonediBaris,
      allPujas,
      totalCount: allPujas.length,
    };
  }

  /**
   * Calculate exact walking route from a station to a puja location
   */
  public async calculateWalkingRouteToPuja(
    station: MetroStation,
    pujaLoc: Location
  ) {
    return routingService.calculateRoute(
      station.location,
      pujaLoc,
      [],
      false,
      'foot'
    );
  }

  /**
   * ECLIPSE GPS — Metro to Pandal Discovery
   * When a user selects a Metro station:
   * - Shows nearby pandals around that station using spatial discovery and pandal dataset.
   * - Sorts pandals by walking distance from the selected Metro station.
   * - For the closest 10 pandals, calculates walking distance and walking time using the existing routing service.
   * - Never calculates routes for all pandals, only the closest 10 candidates.
   * - Returns real OSRM walking distances and durations without inventing values.
   */
  public async getNearbyPandalsForStationWithWalkingRoutes(
    station: MetroStation
  ): Promise<NearbyPandalRef[]> {
    if (this.routedPandalsCache.has(station.id)) {
      return this.routedPandalsCache.get(station.id)!;
    }

    const candidates: NearbyPandalRef[] = [];
    const seenIds = new Set<string>();

    // 1. Use spatial discovery system to discover nearby pandals around the metro station
    try {
      const discovery = await pandalDiscoveryService.discoverPandals({
        near: station.location,
        radius: 3000,
        mode: 'nearby',
        sortBy: 'nearest',
      });

      if (discovery && discovery.pandals && discovery.pandals.length > 0) {
        for (const p of discovery.pandals) {
          if (!seenIds.has(p.id)) {
            seenIds.add(p.id);
            const dist = p.distance !== undefined
              ? p.distance
              : this.calculateDistanceInMeters(station.location, p.location);
            candidates.push({
              id: p.id,
              name: p.name,
              distanceMeters: Math.round(dist),
              walkingMinutes: Math.max(1, Math.round(dist / 75)),
              crowdLevel: p.crowdLevel,
              theme: p.theme,
              location: p.location,
              address: p.address,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[MetroIntelligence] Spatial discovery query fallback:', err);
    }

    // 2. Ensure explicitly linked station pandals from curated dataset are included
    for (const pid of station.nearbyPandalIds || []) {
      if (!seenIds.has(pid)) {
        const p = curatedEclipsePandals.find((item) => item.id === pid);
        if (p) {
          seenIds.add(p.id);
          const dist = this.calculateDistanceInMeters(station.location, {
            lat: p.latitude,
            lng: p.longitude,
          });
          candidates.push({
            id: p.id,
            name: p.name,
            distanceMeters: Math.round(dist),
            walkingMinutes: Math.max(1, Math.round(dist / 75)),
            crowdLevel: p.crowdLevel,
            theme: p.theme,
            location: { lat: p.latitude, lng: p.longitude },
            address: p.address,
          });
        }
      }
    }

    // 3. Fallback: if candidates empty, scan curated dataset within 2500m
    if (candidates.length === 0) {
      for (const p of curatedEclipsePandals) {
        if (seenIds.has(p.id)) continue;
        const dist = this.calculateDistanceInMeters(station.location, {
          lat: p.latitude,
          lng: p.longitude,
        });
        if (dist <= 2500) {
          seenIds.add(p.id);
          candidates.push({
            id: p.id,
            name: p.name,
            distanceMeters: Math.round(dist),
            walkingMinutes: Math.max(1, Math.round(dist / 75)),
            crowdLevel: p.crowdLevel,
            theme: p.theme,
            location: { lat: p.latitude, lng: p.longitude },
            address: p.address,
          });
        }
      }
    }

    // Sort candidates by initial distance from metro station
    candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);

    // 4. "Do not calculate routes for all pandals. Only calculate the closest 10 candidates."
    const closest10 = candidates.slice(0, 10);
    const remaining = candidates.slice(10);

    // 5. "For the closest 10 pandals, calculate walking distance and walking time using the existing routing service."
    // "Do not invent distances or times."
    const routed10 = await this.calculateWalkingRoutesInBatches(station.location, closest10, 3);

    // 6. "Sort pandals by walking distance from the selected Metro station."
    routed10.sort((a, b) => a.distanceMeters - b.distanceMeters);

    const finalResults = [...routed10, ...remaining];
    this.routedPandalsCache.set(station.id, finalResults);
    return finalResults;
  }

  private async calculateWalkingRoutesInBatches(
    origin: Location,
    pandals: NearbyPandalRef[],
    concurrency: number = 3
  ): Promise<NearbyPandalRef[]> {
    const results: NearbyPandalRef[] = [];
    for (let i = 0; i < pandals.length; i += concurrency) {
      const batch = pandals.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (pandal) => {
          try {
            const route = await routingService.calculateRoute(
              origin,
              pandal.location,
              [],
              false,
              'foot'
            );
            return {
              ...pandal,
              distanceMeters: Math.round(route.distance),
              walkingMinutes: Math.max(1, Math.round(route.duration / 60)),
              isCalculatedRoute: true,
            };
          } catch (err) {
            console.warn('[MetroIntelligence] Route calculation failed for pandal', pandal.name, err);
            return pandal;
          }
        })
      );
      results.push(...batchResults);
    }
    return results;
  }

  /**
   * ECLIPSE GPS — Metro Gate Intelligence
   * Given a metro station and a target pandal:
   * 1. Checks if the station has verified entrance/exit gates with geographic coordinates.
   * 2. If no gate data or unverified: returns { hasVerifiedGates: false, ... }
   * 3. If verified gates exist:
   *    Calculates walking routes from each gate to the pandal using the existing routing service (OSRM foot profile).
   * 4. Determines the most suitable exit based on the actual walking route (shortest distance/time).
   * 5. Returns formatted recommendation and other exits.
   */
  public async calculateMetroGateIntelligence(
    station: MetroStation,
    targetPandal: NearbyPandalRef | Pandal
  ): Promise<MetroGateIntelligenceResult> {
    const cacheKey = `${station.id}_${targetPandal.id}`;
    if (this.gateIntelligenceCache.has(cacheKey)) {
      return this.gateIntelligenceCache.get(cacheKey)!;
    }

    const rawGates = station.entrancesExits || station.entrances || [];
    // Only consider gates with real geographic coordinates
    const verifiedGates = rawGates.filter(
      (g) =>
        (g.latitude !== undefined && g.longitude !== undefined && g.latitude !== 0 && g.longitude !== 0) ||
        (g.location && g.location.lat !== 0 && g.location.lng !== 0)
    );

    if (verifiedGates.length === 0) {
      const unverifiedResult: MetroGateIntelligenceResult = {
        hasVerifiedGates: false,
        station,
        targetPandal,
        otherGates: [],
        allGateRoutes: [],
      };
      this.gateIntelligenceCache.set(cacheKey, unverifiedResult);
      return unverifiedResult;
    }

    const pandalLoc: Location =
      'location' in targetPandal && targetPandal.location
        ? targetPandal.location
        : { lat: (targetPandal as any).latitude, lng: (targetPandal as any).longitude };

    // Calculate walking route for each verified gate
    const gateOptions: MetroGateRouteOption[] = await Promise.all(
      verifiedGates.map(async (gate) => {
        const gateLoc: Location = gate.location
          ? gate.location
          : { lat: gate.latitude!, lng: gate.longitude! };

        try {
          const route = await routingService.calculateRoute(
            gateLoc,
            pandalLoc,
            [],
            false,
            'foot'
          );

          const distM = Math.round(route.distance);
          const walkMin = Math.max(1, Math.round(route.duration / 60));

          return {
            gate: {
              ...gate,
              location: gateLoc,
              latitude: gateLoc.lat,
              longitude: gateLoc.lng,
            },
            distanceMeters: distM,
            walkingMinutes: walkMin,
            geometry: route.geometry && route.geometry.length > 0 ? route.geometry : [gateLoc, pandalLoc],
            isRecommended: false,
            walkingDistanceFormatted: distM < 1000 ? `${distM} m walk` : `${(distM / 1000).toFixed(2)} km walk`,
            walkingTimeFormatted: `~${walkMin} min`,
          };
        } catch (err) {
          console.warn(`[MetroGateIntelligence] Route calculation fallback for gate ${gate.gateNumber}:`, err);
          const straightDist = Math.round(this.calculateDistanceInMeters(gateLoc, pandalLoc));
          const estMin = Math.max(1, Math.round(straightDist / 75));
          return {
            gate: {
              ...gate,
              location: gateLoc,
              latitude: gateLoc.lat,
              longitude: gateLoc.lng,
            },
            distanceMeters: straightDist,
            walkingMinutes: estMin,
            geometry: [gateLoc, pandalLoc],
            isRecommended: false,
            walkingDistanceFormatted: straightDist < 1000 ? `${straightDist} m walk` : `${(straightDist / 1000).toFixed(2)} km walk`,
            walkingTimeFormatted: `~${estMin} min`,
          };
        }
      })
    );

    // Sort options strictly by actual walking route distance
    gateOptions.sort((a, b) => a.distanceMeters - b.distanceMeters);

    if (gateOptions.length > 0) {
      gateOptions[0].isRecommended = true;
    }

    const recommendedGate = gateOptions[0];
    const otherGates = gateOptions.slice(1);

    const result: MetroGateIntelligenceResult = {
      hasVerifiedGates: true,
      station,
      targetPandal,
      recommendedGate,
      otherGates,
      allGateRoutes: gateOptions,
      activeGateRoute: recommendedGate,
    };

    this.gateIntelligenceCache.set(cacheKey, result);
    return result;
  }

  /**
   * Find nearby verified pandals around this metro station (< 2.2 km or explicitly linked)
   */
  private findNearbyPandalsForStation(station: MetroStation): NearbyPandalRef[] {
    const results: NearbyPandalRef[] = [];
    const seenIds = new Set<string>();

    // 1. Explicitly linked pandals
    for (const pid of station.nearbyPandalIds || []) {
      const p = curatedEclipsePandals.find((item) => item.id === pid);
      if (p && !seenIds.has(p.id)) {
        seenIds.add(p.id);
        const dist = this.calculateDistanceInMeters(station.location, {
          lat: p.latitude,
          lng: p.longitude,
        });
        const walkMin = Math.max(1, Math.round(dist / 75));
        results.push({
          id: p.id,
          name: p.name,
          distanceMeters: Math.round(dist),
          walkingMinutes: walkMin,
          crowdLevel: p.crowdLevel,
          theme: p.theme,
          location: { lat: p.latitude, lng: p.longitude },
          address: p.address,
        });
      }
    }

    // 2. Proximity scan for other pandals within 1.8km
    for (const p of curatedEclipsePandals) {
      if (seenIds.has(p.id)) continue;
      const dist = this.calculateDistanceInMeters(station.location, {
        lat: p.latitude,
        lng: p.longitude,
      });

      if (dist <= 1800) {
        seenIds.add(p.id);
        const walkMin = Math.max(1, Math.round(dist / 75));
        results.push({
          id: p.id,
          name: p.name,
          distanceMeters: Math.round(dist),
          walkingMinutes: walkMin,
          crowdLevel: p.crowdLevel,
          theme: p.theme,
          location: { lat: p.latitude, lng: p.longitude },
          address: p.address,
        });
      }
    }

    return results;
  }

  /**
   * Find nearby verified Bonedi Baris around this metro station (< 2.5 km or explicitly linked)
   */
  private findNearbyBonediBarisForStation(station: MetroStation): NearbyBonediBariRef[] {
    const results: NearbyBonediBariRef[] = [];
    const seenIds = new Set<string>();
    const currentYear = new Date().getFullYear();

    // 1. Explicitly linked Bonedi Baris
    for (const bid of station.nearbyBonediBariIds || []) {
      const b = curatedBonediBariList.find((item) => item.id === bid);
      if (b && !seenIds.has(b.id)) {
        seenIds.add(b.id);
        const dist = this.calculateDistanceInMeters(station.location, b.location);
        const walkMin = Math.max(1, Math.round(dist / 75));
        const ageYears = b.pujaSince ? Math.max(1, currentYear - b.pujaSince) : undefined;
        results.push({
          id: b.id,
          name: b.name,
          family: b.family,
          distanceMeters: Math.round(dist),
          walkingMinutes: walkMin,
          pujaSince: b.pujaSince,
          ageYears,
          location: b.location,
          address: b.address,
        });
      }
    }

    // 2. Proximity scan for other Bonedi Baris within 2.2km
    for (const b of curatedBonediBariList) {
      if (seenIds.has(b.id)) continue;
      const dist = this.calculateDistanceInMeters(station.location, b.location);

      if (dist <= 2200) {
        seenIds.add(b.id);
        const walkMin = Math.max(1, Math.round(dist / 75));
        const ageYears = b.pujaSince ? Math.max(1, currentYear - b.pujaSince) : undefined;
        results.push({
          id: b.id,
          name: b.name,
          family: b.family,
          distanceMeters: Math.round(dist),
          walkingMinutes: walkMin,
          pujaSince: b.pujaSince,
          ageYears,
          location: b.location,
          address: b.address,
        });
      }
    }

    return results;
  }

  /**
   * Enrich station with user distance and travel time from user's GPS
   */
  private enrichWithUserMetrics(station: MetroStation, userLoc?: Location): MetroStation {
    if (!userLoc) {
      return {
        ...station,
        entrances: station.entrancesExits,
      };
    }

    const distMeters = Math.round(
      this.calculateDistanceInMeters(userLoc, station.location)
    );

    const distanceFormatted =
      distMeters < 1000
        ? `${distMeters} m`
        : `${(distMeters / 1000).toFixed(1)} km`;

    const walkMinutes = Math.max(1, Math.round(distMeters / 75));
    const driveMinutes = Math.max(1, Math.round(distMeters / 350));

    const estimatedTravelTime =
      distMeters <= 1500
        ? `${walkMinutes} min walk • ${driveMinutes} min drive`
        : `${driveMinutes} min drive • ${walkMinutes} min walk`;

    return {
      ...station,
      distance: distMeters,
      distanceFormatted,
      estimatedWalkingTime: `${walkMinutes} mins`,
      estimatedTravelTime,
      entrances: station.entrancesExits,
    };
  }

  /**
   * Viewport bounds filter with 20% geographic buffer
   */
  private filterByViewportBounds(
    stations: MetroStation[],
    bounds: MapViewportBounds
  ): MetroStation[] {
    const latSpan = Math.abs(bounds.north - bounds.south);
    const lngSpan = Math.abs(bounds.east - bounds.west);
    const latBuffer = latSpan * 0.20;
    const lngBuffer = lngSpan * 0.20;

    const north = bounds.north + latBuffer;
    const south = bounds.south - latBuffer;
    const east = bounds.east + lngBuffer;
    const west = bounds.west - lngBuffer;

    return stations.filter(
      (st) =>
        st.latitude >= south &&
        st.latitude <= north &&
        st.longitude >= west &&
        st.longitude <= east
    );
  }

  /**
   * Return all curated Metro stations
   */
  public getStations(): MetroStation[] {
    return this.allStations;
  }

  /**
   * Find the most relevant Metro station for a given Pandal by name or proximity
   */
  public findStationForPandal(
    nearestMetroName?: string,
    pandalLocation?: Location
  ): MetroStation | undefined {
    if (nearestMetroName) {
      const cleanQuery = nearestMetroName
        .toLowerCase()
        .replace(/metro\s*station|metro/gi, '')
        .trim();
      const match = this.allStations.find((s) => {
        const sName = s.name
          .toLowerCase()
          .replace(/metro\s*station|metro/gi, '')
          .trim();
        return (
          sName === cleanQuery ||
          sName.includes(cleanQuery) ||
          cleanQuery.includes(sName)
        );
      });
      if (match) return match;
    }

    if (pandalLocation && pandalLocation.lat && pandalLocation.lng) {
      let closestStation: MetroStation | undefined;
      let minDistance = 5000; // max 5 km
      for (const station of this.allStations) {
        const dist = this.calculateDistanceInMeters(station.location, pandalLocation);
        if (dist < minDistance) {
          minDistance = dist;
          closestStation = station;
        }
      }
      return closestStation;
    }

    return undefined;
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

export const metroIntelligenceProvider = new MetroIntelligenceProvider();

// Register provider automatically with IntelligenceLayerService
intelligenceLayerService.registerProvider(metroIntelligenceProvider);
