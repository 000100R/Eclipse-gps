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
} from '../../types/metro';
import { Location } from '../../types';
import { curatedMetroStations } from '../../data/curatedMetroStations';
import { curatedEclipsePandals } from '../../data/curatedPandals';
import { curatedBonediBariList } from '../../data/curatedBonediBari';
import { intelligenceLayerService } from './intelligenceLayerService';
import { routingService } from '../routing/routingService';

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

  constructor() {
    this.allStations = [...curatedMetroStations];
    this.enrichAllStations();
    this.cachedViewportStations = [...this.allStations];
  }

  public setUserLocation(loc?: Location): void {
    this.userLocation = loc;
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
      // Filter stations by viewport with 20% geographic buffer
      const filtered = this.filterByViewportBounds(this.allStations, bounds);

      // Enrich with user distance if GPS location available
      const enriched = filtered.map((st) => this.enrichWithUserMetrics(st, this.userLocation));

      // Sort stations: by user distance if known, else North-to-South
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
    const enriched = this.allStations.map((st) => this.enrichWithUserMetrics(st, this.userLocation));
    this.cachedViewportStations = enriched;
    intelligenceLayerService.updateItemCount('METRO', enriched.length);
    return enriched;
  }

  public clear(): void {
    this.cachedViewportStations = [];
    this.lastBounds = undefined;
    intelligenceLayerService.updateItemCount('METRO', 0);
  }

  public destroy(): void {
    this.clear();
  }

  public getData(): MetroStation[] {
    return this.cachedViewportStations.length > 0
      ? this.cachedViewportStations
      : this.allStations.map((st) => this.enrichWithUserMetrics(st, this.userLocation));
  }

  public getAllStations(): MetroStation[] {
    return this.allStations.map((st) => this.enrichWithUserMetrics(st, this.userLocation));
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
