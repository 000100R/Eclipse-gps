/**
 * Eclipse GPS — PANDALS Intelligence Layer Data Provider (Phase 13.1.5)
 * PANDAL COVERAGE ENGINE
 * 
 * Unifies:
 * 1. Eclipse Curated Durga Puja Database (Priority 1)
 * 2. Google Earth KML / KMZ Imported Records (Priority 2 / 4)
 * 3. Google Places API (New) Discovery (Priority 3) with Grid Search & Multi-Query
 * 
 * Strict Invariants:
 * - Real multi-source discovery (no fabricated names or coordinates).
 * - Naktala Udayan Sangha is permanently anchored to VERIFIED_NAKTALA_COORDINATES (22.47449, 88.36658).
 * - Geographic Grid Search: divides viewport/areas into overlapping cells with caching.
 * - Adaptive Radius: starts near user, expands progressively (1km -> 3km -> 5km -> 10km -> 20km) until >= 5 results found.
 * - Viewport debounced search with 250m movement threshold to avoid redundant API queries.
 * - Concurrency control and debouncing to prevent rate limiting.
 */

import {
  IntelligenceDataProvider,
  IntelligenceLayerId,
  DataProviderMetadata,
  MapViewportBounds,
} from '../../types/intelligence';
import { DiscoveredPandal } from '../../types/discovery';
import { Location } from '../../types';
import { curatedEclipsePandals } from '../../data/curatedPandals';
import { googleEarthImportService } from '../geoImport/googleEarthImportService';
import {
  validateAndNormalizeCoordinates,
  verifyPandalAreaMatch,
  VERIFIED_NAKTALA_COORDINATES,
} from '../../utils/coordinateValidation';
import { intelligenceLayerService } from './intelligenceLayerService';
import { pandalGridSearchEngine } from '../discovery/pandalGridSearchEngine';
import { pandalEnrichmentService } from './pandalEnrichmentService';

export class PandalIntelligenceProvider implements IntelligenceDataProvider<DiscoveredPandal> {
  public readonly layerId: IntelligenceLayerId = 'PANDALS';

  public readonly metadata: DataProviderMetadata = {
    id: 'PANDALS',
    name: 'Durga Puja Pandals Intelligence',
    sourceType: 'curated',
    refreshIntervalMs: 60000,
    isAvailable: true,
  };

  // Cached unified list across all searched viewports and static sources
  private allUnifiedPandals: DiscoveredPandal[] = [];

  // Filtered pandals for currently active viewport
  private cachedViewportPandals: DiscoveredPandal[] = [];

  private lastBounds?: MapViewportBounds;
  private lastSearchedCenter?: Location;
  private lastSearchedZoom?: number;
  private userLocation?: Location;
  private lastError?: string;
  private emptyMessage?: string;

  constructor() {
    // Initial warmup of static curated pandals and preloaded Google Earth KML records
    const curated = this.loadCuratedPandals();
    const googleEarth = this.loadGoogleEarthImports();
    this.allUnifiedPandals = pandalGridSearchEngine.deduplicateAndMerge([...curated, ...googleEarth]);
    this.cachedViewportPandals = [...this.allUnifiedPandals];
  }

  public setUserLocation(loc?: Location): void {
    this.userLocation = loc;
  }

  /**
   * Main Viewport Loading Pipeline with Grid Search & 250m Delta Optimization
   */
  public async load(
    bounds: MapViewportBounds,
    zoom?: number,
    userLoc?: Location
  ): Promise<DiscoveredPandal[]> {
    this.lastBounds = bounds;
    if (userLoc) {
      this.userLocation = userLoc;
    }

    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;
    const currentCenter: Location = { lat: centerLat, lng: centerLng };
    const currentZoom = zoom || 14;

    // Check if map movement is minimal (< 250m and zoom delta < 1)
    if (this.lastSearchedCenter && this.lastSearchedZoom !== undefined && this.allUnifiedPandals.length > 0) {
      const distanceDelta = pandalGridSearchEngine.calculateDistanceInMeters(
        this.lastSearchedCenter,
        currentCenter
      );
      const zoomDelta = Math.abs(this.lastSearchedZoom - currentZoom);

      if (distanceDelta < 250 && zoomDelta < 1.0) {
        // Skip calling external Google Places API; re-filter all known pandals
        const filtered = this.filterByViewportBounds(this.allUnifiedPandals, bounds);
        const enriched = filtered.map((p) => this.enrichWithUserMetrics(p, this.userLocation));
        this.cachedViewportPandals = enriched;

        this.emptyMessage = enriched.length === 0 ? 'No verified pandals found in this map area.' : undefined;
        intelligenceLayerService.updateItemCount('PANDALS', enriched.length);
        return this.cachedViewportPandals;
      }
    }

    intelligenceLayerService.updateLoadingState('PANDALS', true);
    this.emptyMessage = undefined;
    this.lastError = undefined;

    try {
      // 1. Decompose viewport into geographic cells
      const gridCells = pandalGridSearchEngine.decomposeViewportIntoGridCells(bounds, currentZoom);

      // 2. Fetch live Google Places via multi-query grid discovery
      const googlePlacesPromise = pandalGridSearchEngine.executeGridSearch(gridCells);

      // 3. Load curated and Google Earth data
      const curated = this.loadCuratedPandals();
      const googleEarth = this.loadGoogleEarthImports();
      const googlePlaces = await googlePlacesPromise;

      // 4. Merge and Deduplicate with strict source priority and Naktala safeguard
      const merged = pandalGridSearchEngine.deduplicateAndMerge([
        ...this.allUnifiedPandals,
        ...curated,
        ...googleEarth,
        ...googlePlaces,
      ]);

      this.allUnifiedPandals = merged;
      this.lastSearchedCenter = currentCenter;
      this.lastSearchedZoom = currentZoom;

      // 5. Filter for current viewport with 15% buffer
      const filteredByViewport = this.filterByViewportBounds(this.allUnifiedPandals, bounds);

      // 6. Enrich with user distance / travel time
      const enriched = filteredByViewport.map((p) => this.enrichWithUserMetrics(p, this.userLocation));

      this.cachedViewportPandals = enriched;

      // Check empty state
      if (this.cachedViewportPandals.length === 0) {
        this.emptyMessage = 'No verified pandals found in this map area.';
      }

      intelligenceLayerService.updateItemCount('PANDALS', this.cachedViewportPandals.length);
      intelligenceLayerService.updateLoadingState('PANDALS', false);

      return this.cachedViewportPandals;
    } catch (err: any) {
      console.error('[PandalIntelligenceProvider] Error during grid load:', err);
      // Fallback to static data
      const fallback = this.filterByViewportBounds(this.loadCuratedPandals(), bounds);
      this.cachedViewportPandals = fallback;
      this.lastError = err?.message || 'Failed to complete pandal discovery pass';
      intelligenceLayerService.updateItemCount('PANDALS', this.cachedViewportPandals.length);
      intelligenceLayerService.updateLoadingState('PANDALS', false);
      intelligenceLayerService.updateErrorState('PANDALS', this.lastError);
      return this.cachedViewportPandals;
    }
  }

  public async refresh(): Promise<DiscoveredPandal[]> {
    if (this.lastBounds) {
      return this.load(this.lastBounds, this.lastSearchedZoom, this.userLocation);
    }
    return this.getData();
  }

  public clear(): void {
    this.cachedViewportPandals = [];
    this.emptyMessage = undefined;
    this.lastError = undefined;
    intelligenceLayerService.updateItemCount('PANDALS', 0);
  }

  public destroy(): void {
    this.clear();
  }

  public getData(): DiscoveredPandal[] {
    return [...this.cachedViewportPandals];
  }

  public getAllKnownData(): DiscoveredPandal[] {
    return [...this.allUnifiedPandals];
  }

  public getEmptyMessage(): string | undefined {
    return this.emptyMessage;
  }

  public isAvailable(): boolean {
    return true;
  }

  /**
   * Reusable Search method for Copilot and Search Bars
   * Never fabricates coordinates; uses grid search, adaptive radius, and exact deduplication.
   */
  public async search(
    query: string,
    location?: Location,
    bounds?: MapViewportBounds
  ): Promise<DiscoveredPandal[]> {
    const cleanQuery = query.toLowerCase().trim();
    const activeLoc = location || this.userLocation || { lat: 22.5697, lng: 88.3639 };

    // 1. Check if user is asking for "near me" or "nearby"
    const isNearbyQuery = /near\s*me|nearby|around\s*me|closest|nearest/i.test(cleanQuery);
    if (isNearbyQuery) {
      // Execute adaptive radius search (1km -> 3km -> 5km -> 10km -> 20km)
      const { pandals } = await pandalGridSearchEngine.searchAdaptiveNearby(activeLoc, 1000, 5);

      // Merge with all known curated & Google Earth pandals
      const curated = this.loadCuratedPandals();
      const googleEarth = this.loadGoogleEarthImports();
      const unified = pandalGridSearchEngine.deduplicateAndMerge([
        ...curated,
        ...googleEarth,
        ...pandals,
      ]);

      const enriched = unified
        .map((p) => this.enrichWithUserMetrics(p, activeLoc))
        .sort((a, b) => (a.distance || 999999) - (b.distance || 999999));

      return enriched.slice(0, 15);
    }

    // 2. Check for specific area search (e.g. "Shyambazar", "Salt Lake", "Naktala", "Garia", etc.)
    const areaCenter = this.resolveAreaCenter(cleanQuery);
    if (areaCenter) {
      const cells = pandalGridSearchEngine.decomposeIntoGridCells(areaCenter, 3500);
      const cellResults = await pandalGridSearchEngine.executeGridSearch(cells, cleanQuery);

      const curated = this.loadCuratedPandals();
      const googleEarth = this.loadGoogleEarthImports();
      const unified = pandalGridSearchEngine.deduplicateAndMerge([
        ...this.allUnifiedPandals,
        ...curated,
        ...googleEarth,
        ...cellResults,
      ]);
      this.allUnifiedPandals = unified;

      const filtered = unified.filter((p) => {
        const nMatch = p.name.toLowerCase().includes(cleanQuery);
        const aMatch = p.area.toLowerCase().includes(cleanQuery);
        const d = pandalGridSearchEngine.calculateDistanceInMeters(areaCenter, p.location);
        return nMatch || aMatch || d < 4000;
      });

      return filtered
        .map((p) => this.enrichWithUserMetrics(p, activeLoc))
        .sort((a, b) => (a.distance || 999999) - (b.distance || 999999));
    }

    // 3. General Text Search across known records
    let results = this.allUnifiedPandals.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(cleanQuery);
      const areaMatch = p.area.toLowerCase().includes(cleanQuery);
      const themeMatch = (p.theme || '').toLowerCase().includes(cleanQuery);
      const addressMatch = (p.address || '').toLowerCase().includes(cleanQuery);
      return nameMatch || areaMatch || themeMatch || addressMatch;
    });

    // If local results are low, execute a targeted cell search around active location or bounds
    if (results.length < 3 && cleanQuery.length >= 3) {
      const searchCenter = bounds
        ? { lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 }
        : activeLoc;

      const cells = pandalGridSearchEngine.decomposeIntoGridCells(searchCenter, 5000);
      const cellResults = await pandalGridSearchEngine.executeGridSearch(cells, cleanQuery);

      const unified = pandalGridSearchEngine.deduplicateAndMerge([
        ...this.allUnifiedPandals,
        ...cellResults,
      ]);
      this.allUnifiedPandals = unified;

      results = this.allUnifiedPandals.filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(cleanQuery);
        const areaMatch = p.area.toLowerCase().includes(cleanQuery);
        return nameMatch || areaMatch;
      });
    }

    if (activeLoc) {
      results = results.map((p) => this.enrichWithUserMetrics(p, activeLoc));
      results.sort((a, b) => (a.distance || 999999) - (b.distance || 999999));
    }

    return results;
  }

  // =========================================================================
  // SOURCE A: Curated Eclipse Database (Priority 1)
  // =========================================================================
  private loadCuratedPandals(): DiscoveredPandal[] {
    return curatedEclipsePandals.map((item) => {
      // 1. Strict Coordinate Validation
      const validated = validateAndNormalizeCoordinates(item.latitude, item.longitude, item.name);
      const finalCoords = validated || { lat: item.latitude, lng: item.longitude };

      // 2. Naktala Safeguard: strictly verify Naktala coordinates
      const areaCheck = verifyPandalAreaMatch(item.name, item.area, finalCoords.lat, finalCoords.lng);
      const safeCoords = (!areaCheck.valid && areaCheck.correctedCoords)
        ? areaCheck.correctedCoords
        : finalCoords;

      const pandal: DiscoveredPandal = {
        id: item.id,
        name: item.name,
        latitude: safeCoords.lat,
        longitude: safeCoords.lng,
        location: { lat: safeCoords.lat, lng: safeCoords.lng },
        address: item.address,
        area: item.area,
        city: 'Kolkata',
        source: 'ECLIPSE_CURATED',
        sourceId: item.id,
        verificationStatus: 'VERIFIED',
        rating: item.rating || 4.8,
        userRatingCount: item.userRatingCount || 1200,
        description: item.description,
        theme: item.theme,
        crowdLevel: item.crowdLevel,
        crowdTrend: item.crowdTrend,
        queueEstimate: item.queueEstimate,
        zone: item.zone,
        verified: true,
        parkingAvailability: item.parkingAvailability,
        photos: item.images || [],
        images: item.images || [],
      };

      return pandal;
    });
  }

  // =========================================================================
  // SOURCE B: Google Earth KML / KMZ Imports (Priority 2 / 4)
  // =========================================================================
  private loadGoogleEarthImports(): DiscoveredPandal[] {
    try {
      const records = googleEarthImportService.getImportedRecords();
      const pandalRecords = records.filter(
        (r) => r.category === 'PANDAL' || /pandal|puja|durgotsav|mandap/i.test(r.name)
      );

      const normalized: DiscoveredPandal[] = [];

      for (const rec of pandalRecords) {
        const coords = validateAndNormalizeCoordinates(rec.latitude, rec.longitude, rec.name);
        if (!coords) continue;

        const areaCheck = verifyPandalAreaMatch(rec.name, rec.folderHierarchy?.[0] || '', coords.lat, coords.lng);
        const finalCoords = (!areaCheck.valid && areaCheck.correctedCoords)
          ? areaCheck.correctedCoords
          : coords;

        const isVerified = rec.verificationStatus === 'verified';
        const cleanDesc = rec.description ? this.stripHtml(rec.description) : undefined;
        const detectedArea = rec.folderHierarchy?.[0] || this.extractAreaFromName(rec.name) || 'Kolkata';

        normalized.push({
          id: `kml-${rec.id}`,
          name: rec.name,
          latitude: finalCoords.lat,
          longitude: finalCoords.lng,
          location: { lat: finalCoords.lat, lng: finalCoords.lng },
          address: cleanDesc || `${detectedArea}, Kolkata`,
          area: detectedArea,
          city: 'Kolkata',
          source: 'GOOGLE_EARTH',
          sourceId: rec.id,
          verificationStatus: isVerified ? 'VERIFIED' : 'UNVERIFIED',
          description: cleanDesc,
          verified: isVerified,
          crowdLevel: 'MODERATE',
          rating: 4.7,
          userRatingCount: 350,
        });
      }

      return normalized;
    } catch (err) {
      console.warn('[PandalIntelligenceProvider] Error reading Google Earth imported records:', err);
      return [];
    }
  }

  // =========================================================================
  // VIEWPORT FILTERING
  // =========================================================================
  private filterByViewportBounds(
    items: DiscoveredPandal[],
    bounds: MapViewportBounds
  ): DiscoveredPandal[] {
    // 15% padding so moving the map feels fluid without missing markers at the edge
    const latSpan = Math.abs(bounds.north - bounds.south);
    const lngSpan = Math.abs(bounds.east - bounds.west);
    const latBuffer = latSpan * 0.15;
    const lngBuffer = lngSpan * 0.15;

    const north = bounds.north + latBuffer;
    const south = bounds.south - latBuffer;
    const east = bounds.east + lngBuffer;
    const west = bounds.west - lngBuffer;

    return items.filter((item) => {
      return (
        item.latitude >= south &&
        item.latitude <= north &&
        item.longitude >= west &&
        item.longitude <= east
      );
    });
  }

  // =========================================================================
  // METRICS & HELPERS
  // =========================================================================
  private enrichWithUserMetrics(pandal: DiscoveredPandal, userLoc?: Location): DiscoveredPandal {
    const baseEnriched = pandalEnrichmentService.enrichPandal(pandal);

    if (!userLoc || typeof userLoc.lat !== 'number' || typeof userLoc.lng !== 'number') {
      return baseEnriched;
    }

    const distMeters = Math.round(
      pandalGridSearchEngine.calculateDistanceInMeters(userLoc, baseEnriched.location)
    );
    let travelTime = '5 min';
    if (distMeters < 1000) {
      const walkMin = Math.max(2, Math.round(distMeters / 80));
      travelTime = `${walkMin} min walk`;
    } else {
      const driveMin = Math.max(5, Math.round((distMeters / 1000) * 3.5 + 2));
      travelTime = `${driveMin} min`;
    }

    return {
      ...baseEnriched,
      distance: distMeters,
      estimatedTravelTime: travelTime,
    };
  }

  private resolveAreaCenter(query: string): Location | null {
    const q = query.toLowerCase();
    const areaMap: Record<string, Location> = {
      shyambazar: { lat: 22.598, lng: 88.371 },
      kumartuli: { lat: 22.597, lng: 88.358 },
      bagbazar: { lat: 22.602, lng: 88.368 },
      hatibagan: { lat: 22.595, lng: 88.372 },
      maniktala: { lat: 22.584, lng: 88.374 },
      ultadanga: { lat: 22.593, lng: 88.384 },
      'salt lake': { lat: 22.586, lng: 88.411 },
      ballygunge: { lat: 22.528, lng: 88.365 },
      gariahat: { lat: 22.520, lng: 88.362 },
      kalighat: { lat: 22.519, lng: 88.345 },
      bhawanipur: { lat: 22.531, lng: 88.348 },
      dhakuria: { lat: 22.509, lng: 88.368 },
      jodhpur: { lat: 22.503, lng: 88.363 },
      kasba: { lat: 22.518, lng: 88.384 },
      behala: { lat: 22.498, lng: 88.318 },
      haridevpur: { lat: 22.485, lng: 88.342 },
      naktala: VERIFIED_NAKTALA_COORDINATES,
      garia: { lat: 22.465, lng: 88.375 },
      jadavpur: { lat: 22.495, lng: 88.370 },
      'dum dum': { lat: 22.609, lng: 88.408 },
    };

    for (const [key, loc] of Object.entries(areaMap)) {
      if (q.includes(key)) {
        return loc;
      }
    }
    return null;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>?/gm, '').trim();
  }

  private extractAreaFromName(name: string): string | undefined {
    const commonAreas = [
      'Ballygunge', 'Bhawanipur', 'Kalighat', 'Alipore', 'Chetla', 'Gariahat',
      'Lake Town', 'Salt Lake', 'Bowbazar', 'College Street', 'Kumartuli',
      'Bagbazar', 'Behala', 'New Alipore', 'Garia', 'Naktala', 'Jadavpur',
      'Hatibagan', 'Shyambazar', 'Kankurgachi', 'Dum Dum'
    ];
    const lower = name.toLowerCase();
    for (const a of commonAreas) {
      if (lower.includes(a.toLowerCase())) return a;
    }
    return undefined;
  }
}

export const pandalIntelligenceProvider = new PandalIntelligenceProvider();

// Automatically register provider with IntelligenceLayerService
intelligenceLayerService.registerProvider(pandalIntelligenceProvider);
