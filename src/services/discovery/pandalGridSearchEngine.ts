import { Location } from '../../types';
import { DiscoveredPandal } from '../../types/discovery';
import { MapViewportBounds } from '../../types/intelligence';
import {
  extractPlaceCoordinates,
  validateAndNormalizeCoordinates,
  verifyPandalAreaMatch,
  VERIFIED_NAKTALA_COORDINATES,
} from '../../utils/coordinateValidation';

/**
 * Grid Cell definition for multi-cell geographic exploration
 */
export interface GeographicGridCell {
  id: string;
  key: string;
  center: Location;
  radius: number; // in meters
  bounds?: MapViewportBounds;
}

/**
 * Multi-query searches required for high-recall Durga Puja discovery
 */
export const MULTI_QUERY_SEARCH_TERMS = [
  'Durga Puja',
  'Durga Puja Pandal',
  'Durga Puja Mandap',
  'Puja Pandal',
  'Durga Puja Committee',
  'Durga Puja Kolkata',
] as const;

/**
 * Progressive adaptive radius expansion ladder in meters
 */
export const ADAPTIVE_RADIUS_STEPS: readonly number[] = [1000, 3000, 5000, 10000, 20000];

// Cache TTL: 10 minutes
const CELL_CACHE_TTL_MS = 10 * 60 * 1000;

interface CachedCellEntry {
  key: string;
  timestamp: number;
  places: DiscoveredPandal[];
}

export class PandalGridSearchEngine {
  private static instance: PandalGridSearchEngine;

  // Spatial cell cache to avoid redundant Google Places calls
  private cellCache = new Map<string, CachedCellEntry>();

  // Lock to avoid duplicate concurrent searches on identical cells
  private pendingCellSearches = new Map<string, Promise<DiscoveredPandal[]>>();

  private constructor() {}

  public static getInstance(): PandalGridSearchEngine {
    if (!PandalGridSearchEngine.instance) {
      PandalGridSearchEngine.instance = new PandalGridSearchEngine();
    }
    return PandalGridSearchEngine.instance;
  }

  /**
   * Computes a spatial hash key for a coordinate and radius
   * Uses ~0.015 degree buckets (~1.6 km)
   */
  public getCellKey(lat: number, lng: number, radius: number): string {
    const latBucket = Math.round(lat / 0.015);
    const lngBucket = Math.round(lng / 0.015);
    const radBucket = Math.round(radius / 1000);
    return `cell_${latBucket}_${lngBucket}_${radBucket}`;
  }

  /**
   * Check if a cell is cached and fresh
   */
  public getCachedCellResults(cellKey: string): DiscoveredPandal[] | null {
    const entry = this.cellCache.get(cellKey);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CELL_CACHE_TTL_MS) {
      this.cellCache.delete(cellKey);
      return null;
    }
    return entry.places;
  }

  /**
   * Store cell results in memory cache
   */
  public setCachedCellResults(cellKey: string, places: DiscoveredPandal[]): void {
    if (this.cellCache.size > 300) {
      const oldestKey = this.cellCache.keys().next().value;
      if (oldestKey) this.cellCache.delete(oldestKey);
    }
    this.cellCache.set(cellKey, {
      key: cellKey,
      timestamp: Date.now(),
      places,
    });
  }

  /**
   * 1. DECOMPOSE AREA OR RADIUS INTO OVERLAPPING GEOGRAPHIC CELLS
   *
   * For smaller areas (<= 1.5km), 1 cell is sufficient.
   * For medium areas (1.5km - 6km), 5 cells (center + 4 cardinal offsets with ~25% overlap).
   * For large areas (> 6km up to 20km), 9 cells (3x3 grid) to maximize coverage.
   */
  public decomposeIntoGridCells(center: Location, radiusMeters: number): GeographicGridCell[] {
    const radius = Math.max(500, radiusMeters);

    if (radius <= 1500) {
      // Single cell
      const key = this.getCellKey(center.lat, center.lng, radius);
      return [
        {
          id: `cell-center-${key}`,
          key,
          center,
          radius,
        },
      ];
    }

    if (radius <= 6000) {
      // 5 Overlapping Cells: Center + North, South, East, West (offset by 0.55 * radius for 25-30% overlap)
      const cellRadius = Math.round(radius * 0.65);
      const offsetMeters = radius * 0.55;
      const latOffset = offsetMeters / 111320;
      const lngOffset = offsetMeters / (111320 * Math.cos((center.lat * Math.PI) / 180));

      const centers: { label: string; loc: Location }[] = [
        { label: 'center', loc: center },
        { label: 'north', loc: { lat: center.lat + latOffset, lng: center.lng } },
        { label: 'south', loc: { lat: center.lat - latOffset, lng: center.lng } },
        { label: 'east', loc: { lat: center.lat, lng: center.lng + lngOffset } },
        { label: 'west', loc: { lat: center.lat, lng: center.lng - lngOffset } },
      ];

      return centers.map(({ label, loc }) => {
        const key = this.getCellKey(loc.lat, loc.lng, cellRadius);
        return {
          id: `cell-${label}-${key}`,
          key,
          center: loc,
          radius: cellRadius,
        };
      });
    }

    // Large radius (> 6000m): 3x3 Overlapping Grid (9 cells)
    const subRadius = Math.round(radius * 0.45);
    const stepMeters = radius * 0.6;
    const latStep = stepMeters / 111320;
    const lngStep = stepMeters / (111320 * Math.cos((center.lat * Math.PI) / 180));

    const grid: GeographicGridCell[] = [];
    let idx = 0;
    for (let row = -1; row <= 1; row++) {
      for (let col = -1; col <= 1; col++) {
        const cellCenter: Location = {
          lat: center.lat + row * latStep,
          lng: center.lng + col * lngStep,
        };
        const key = this.getCellKey(cellCenter.lat, cellCenter.lng, subRadius);
        grid.push({
          id: `cell-grid-${idx++}-${key}`,
          key,
          center: cellCenter,
          radius: subRadius,
        });
      }
    }

    return grid;
  }

  /**
   * Decomposes a Map Viewport into overlapping geographic cells based on zoom & span
   */
  public decomposeViewportIntoGridCells(bounds: MapViewportBounds, zoom: number): GeographicGridCell[] {
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;
    const center: Location = { lat: centerLat, lng: centerLng };

    const latSpanMeters = Math.abs(bounds.north - bounds.south) * 111320;
    const lngSpanMeters = Math.abs(bounds.east - bounds.west) * 111320 * Math.cos((centerLat * Math.PI) / 180);
    const maxSpan = Math.max(latSpanMeters, lngSpanMeters);

    if (zoom >= 15 || maxSpan <= 2000) {
      // High zoom: 1 cell is adequate
      const radius = Math.min(2500, Math.max(800, Math.round(maxSpan / 2)));
      const key = this.getCellKey(centerLat, centerLng, radius);
      return [
        {
          id: `vp-center-${key}`,
          key,
          center,
          radius,
          bounds,
        },
      ];
    }

    if (zoom >= 13 || maxSpan <= 7000) {
      // Moderate zoom: 4 or 5 overlapping cells
      return this.decomposeIntoGridCells(center, Math.round(maxSpan / 2));
    }

    // Low zoom (< 13): 3x2 or 3x3 grid
    return this.decomposeIntoGridCells(center, Math.min(18000, Math.round(maxSpan / 2)));
  }

  /**
   * 2. EXECUTE MULTI-QUERY DISCOVERY ACROSS GRID CELLS
   *
   * Runs queries with concurrency control (max 2 parallel requests) and 80ms delays
   * to avoid 429 rate limit triggers while maximizing discovery yield.
   */
  public async executeGridSearch(
    cells: GeographicGridCell[],
    customQuery?: string
  ): Promise<DiscoveredPandal[]> {
    const accumulatedPandals: DiscoveredPandal[] = [];

    // Filter out duplicate cell keys in this single batch
    const uniqueCellsMap = new Map<string, GeographicGridCell>();
    for (const cell of cells) {
      if (!uniqueCellsMap.has(cell.key)) {
        uniqueCellsMap.set(cell.key, cell);
      }
    }
    const uniqueCells = Array.from(uniqueCellsMap.values());

    // Concurrency limit: Process 2 cells at a time
    const CONCURRENCY_LIMIT = 2;
    for (let i = 0; i < uniqueCells.length; i += CONCURRENCY_LIMIT) {
      const slice = uniqueCells.slice(i, i + CONCURRENCY_LIMIT);
      const batchPromises = slice.map((cell) => this.searchSingleCell(cell, customQuery));
      const batchResults = await Promise.all(batchPromises);

      for (const res of batchResults) {
        accumulatedPandals.push(...res);
      }

      // Small throttle between batches to avoid burst limits
      if (i + CONCURRENCY_LIMIT < uniqueCells.length) {
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    }

    return accumulatedPandals;
  }

  /**
   * Searches a single geographic cell using multi-queries (Text Search + Nearby Search)
   */
  private async searchSingleCell(
    cell: GeographicGridCell,
    customQuery?: string
  ): Promise<DiscoveredPandal[]> {
    // 1. Check in-memory cell cache
    const cached = this.getCachedCellResults(cell.key);
    if (cached) {
      return cached;
    }

    // 2. Check if a search on this exact cell is currently in-flight
    if (this.pendingCellSearches.has(cell.key)) {
      return this.pendingCellSearches.get(cell.key)!;
    }

    const searchPromise = (async () => {
      const discoveredInCell: DiscoveredPandal[] = [];

      // Determine queries to run
      const queriesToRun: string[] = customQuery && customQuery.trim().length > 2
        ? [customQuery, 'Durga Puja', 'Durga Puja Pandal']
        : [MULTI_QUERY_SEARCH_TERMS[0], MULTI_QUERY_SEARCH_TERMS[1], MULTI_QUERY_SEARCH_TERMS[2]];

      // A. Run Text Searches with location bias/restriction
      for (const query of queriesToRun) {
        try {
          const textResults = await this.fetchServerPlacesSearch(query, cell.center, cell.radius);
          if (textResults && textResults.length > 0) {
            discoveredInCell.push(...textResults);
          }
        } catch (_) {}
      }

      // B. Run Nearby Search with locationRestriction.circle and cultural/worship types
      try {
        const nearbyResults = await this.fetchServerPlacesNearby(cell.center, cell.radius);
        if (nearbyResults && nearbyResults.length > 0) {
          discoveredInCell.push(...nearbyResults);
        }
      } catch (_) {}

      // Deduplicate results within this cell
      const deduplicatedCell = this.deduplicatePlaces(discoveredInCell);
      this.setCachedCellResults(cell.key, deduplicatedCell);

      return deduplicatedCell;
    })();

    this.pendingCellSearches.set(cell.key, searchPromise);
    try {
      return await searchPromise;
    } finally {
      this.pendingCellSearches.delete(cell.key);
    }
  }

  /**
   * Helper: Calls /api/places/search
   */
  private async fetchServerPlacesSearch(
    query: string,
    center: Location,
    radius: number
  ): Promise<DiscoveredPandal[]> {
    try {
      const res = await fetch('/api/places/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          location: center,
          radius,
        }),
      });

      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data.places)) return [];

      const list: DiscoveredPandal[] = [];
      for (const p of data.places) {
        const normalized = this.normalizeGooglePlace(p, center);
        if (normalized) list.push(normalized);
      }
      return list;
    } catch (_) {
      return [];
    }
  }

  /**
   * Helper: Calls /api/places/nearby
   */
  private async fetchServerPlacesNearby(
    center: Location,
    radius: number
  ): Promise<DiscoveredPandal[]> {
    try {
      const res = await fetch('/api/places/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: center,
          radius,
          includedTypes: [
            'place_of_worship',
            'tourist_attraction',
            'cultural_landmark',
            'community_center',
            'event_venue',
          ],
        }),
      });

      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data.places)) return [];

      const list: DiscoveredPandal[] = [];
      for (const p of data.places) {
        const normalized = this.normalizeGooglePlace(p, center);
        if (normalized) list.push(normalized);
      }
      return list;
    } catch (_) {
      return [];
    }
  }

  /**
   * Normalizes a raw Google Place record with strict coordinate and Naktala verification
   */
  public normalizeGooglePlace(place: any, defaultCenter?: Location): DiscoveredPandal | null {
    if (!place || !place.id) return null;

    const rawName = place.displayName?.text || place.name || '';
    if (!rawName || rawName.trim().length === 0) return null;

    // Filter out places that clearly have nothing to do with Durga Puja or Pandals/Clubs/Temples
    const cleanLower = rawName.toLowerCase();
    const isPujaRelated =
      cleanLower.includes('durga') ||
      cleanLower.includes('puja') ||
      cleanLower.includes('pandal') ||
      cleanLower.includes('mandap') ||
      cleanLower.includes('durgotsav') ||
      cleanLower.includes('samiti') ||
      cleanLower.includes('sangha') ||
      cleanLower.includes('club') ||
      cleanLower.includes('sarbojanin') ||
      cleanLower.includes('kalibari') ||
      cleanLower.includes('mandir');

    // If types are place_of_worship or community_center, accept even if name lacks "puja"
    const types = Array.isArray(place.types) ? place.types : [];
    const isWorship = types.includes('place_of_worship') || types.includes('hindu_temple') || types.includes('cultural_landmark');

    if (!isPujaRelated && !isWorship) {
      return null;
    }

    // Extract & validate coordinates
    const coords = extractPlaceCoordinates(place) || defaultCenter;
    if (!coords) return null;

    const validatedCoords = validateAndNormalizeCoordinates(coords.lat, coords.lng, rawName);
    if (!validatedCoords) return null;

    // Strict Naktala Safeguard: If name matches Naktala Udayan Sangha, force verified coordinates
    const areaCheck = verifyPandalAreaMatch(rawName, place.formattedAddress || '', validatedCoords.lat, validatedCoords.lng);
    const finalCoords = (!areaCheck.valid && areaCheck.correctedCoords)
      ? areaCheck.correctedCoords
      : validatedCoords;

    const address = place.formattedAddress || 'Kolkata, West Bengal';
    const area = this.extractAreaFromAddress(address) || this.extractAreaFromName(rawName) || 'Kolkata';

    return {
      id: `gp-${place.id}`,
      name: rawName,
      latitude: finalCoords.lat,
      longitude: finalCoords.lng,
      location: { lat: finalCoords.lat, lng: finalCoords.lng },
      address,
      area,
      city: 'Kolkata',
      source: 'GOOGLE_PLACES',
      sourceId: place.id,
      verificationStatus: 'UNVERIFIED',
      rating: place.rating,
      userRatingCount: place.userRatingCount,
      googleMapsUri: place.googleMapsUri,
      photos: Array.isArray(place.photos)
        ? place.photos.map((p: any) => p.name || p.photo_reference).filter(Boolean)
        : [],
      crowdLevel: 'MODERATE',
      verified: false,
      status: place.businessStatus || 'OPERATIONAL',
      queueEstimate: '20 - 30 mins',
      queueTimeMinutes: 25,
      parkingAvailability: 'limited',
      parkingStatus: 'moderate',
      estimatedVisitDuration: 30,
      accessibility: true,
    };
  }

  /**
   * 3. ADAPTIVE RADIUS EXPANSION
   *
   * For "Find pandals near me":
   * Starts with initial radius (e.g. 1000m).
   * If fewer than targetCount (default 5) found, expands progressively:
   * 1000m -> 3000m -> 5000m -> 10000m -> 20000m.
   * Stops expanding as soon as targetCount is reached.
   */
  public async searchAdaptiveNearby(
    center: Location,
    initialRadius: number = 1000,
    targetCount: number = 5,
    customQuery?: string
  ): Promise<{ pandals: DiscoveredPandal[]; radiusUsed: number }> {
    const stepsToTry = ADAPTIVE_RADIUS_STEPS.filter((r) => r >= initialRadius);
    if (stepsToTry.length === 0) stepsToTry.push(initialRadius);

    let finalRadius = initialRadius;
    let accumulated: DiscoveredPandal[] = [];

    for (const radius of stepsToTry) {
      finalRadius = radius;
      const cells = this.decomposeIntoGridCells(center, radius);
      const cellResults = await this.executeGridSearch(cells, customQuery);

      accumulated = this.deduplicatePlaces([...accumulated, ...cellResults]);

      // Count items within the current radius
      const withinRadius = accumulated.filter((p) => {
        const dist = this.calculateDistanceInMeters(center, p.location);
        return dist <= radius;
      });

      if (withinRadius.length >= targetCount) {
        return { pandals: withinRadius, radiusUsed: finalRadius };
      }
    }

    return { pandals: accumulated, radiusUsed: finalRadius };
  }

  /**
   * 4. HIGH-FIDELITY DEDUPLICATION & MERGE ENGINE
   *
   * Priority:
   * 1. ECLIPSE_CURATED
   * 2. GOOGLE_EARTH (verified)
   * 3. GOOGLE_PLACES
   * 4. COMMUNITY_VERIFIED / USER_CONTRIBUTION / UNVERIFIED
   *
   * Matching Rules:
   * 1. Exact sourceId or id match.
   * 2. Distance < 35 meters.
   * 3. Normalized name match + distance < 400 meters.
   *
   * Anti-False-Merge:
   * Never merge different nearby pandals if their normalized names differ!
   */
  public deduplicateAndMerge(candidates: DiscoveredPandal[]): DiscoveredPandal[] {
    // Sort by source priority first
    const prioritized = [...candidates].sort((a, b) => {
      return this.getPriorityScore(a) - this.getPriorityScore(b);
    });

    const merged: DiscoveredPandal[] = [];

    for (const candidate of prioritized) {
      let matchIdx = -1;

      // Rule 1: Exact sourceId / ID match
      matchIdx = merged.findIndex(
        (e) => e.id === candidate.id || (e.sourceId && candidate.sourceId && e.sourceId === candidate.sourceId)
      );

      // Rule 2: Coordinate Proximity (< 35 meters: virtually identical spot)
      if (matchIdx === -1) {
        matchIdx = merged.findIndex((e) => {
          const dist = this.calculateDistanceInMeters(e.location, candidate.location);
          return dist < 35;
        });
      }

      // Rule 3: Normalized Name Match + Distance (< 400 meters)
      if (matchIdx === -1) {
        const candNorm = this.normalizePandalName(candidate.name);
        if (candNorm.length >= 4) {
          matchIdx = merged.findIndex((e) => {
            const eNorm = this.normalizePandalName(e.name);
            const isNameMatch =
              eNorm === candNorm ||
              eNorm.includes(candNorm) ||
              candNorm.includes(eNorm);

            if (!isNameMatch) return false;

            const dist = this.calculateDistanceInMeters(e.location, candidate.location);
            return dist < 400;
          });
        }
      }

      if (matchIdx === -1) {
        // Enforce Naktala safeguard on newly added record
        const safeguarded = this.applyNaktalaSafeguard(candidate);
        merged.push(safeguarded);
      } else {
        // Merge attributes into existing higher priority item
        const existing = merged[matchIdx];
        const lowerPriority = candidate;

        merged[matchIdx] = {
          ...existing,
          photos: existing.photos?.length ? existing.photos : lowerPriority.photos,
          images: existing.images?.length ? existing.images : lowerPriority.images,
          rating: existing.rating || lowerPriority.rating,
          userRatingCount: existing.userRatingCount || lowerPriority.userRatingCount,
          googleMapsUri: existing.googleMapsUri || lowerPriority.googleMapsUri,
          openingHours: existing.openingHours || lowerPriority.openingHours,
          description: existing.description || lowerPriority.description,
          theme: existing.theme || lowerPriority.theme,
          status: existing.status || lowerPriority.status,
        };
      }
    }

    return merged;
  }

  /**
   * Internal deduplicator for place items
   */
  private deduplicatePlaces(places: DiscoveredPandal[]): DiscoveredPandal[] {
    return this.deduplicateAndMerge(places);
  }

  /**
   * Normalizes a pandal name for fuzzy matching
   * Strips out generic terms: durga, puja, pandal, committee, sarbojanin, club, samiti
   */
  public normalizePandalName(name: string): string {
    return name
      .toLowerCase()
      .replace(/durga|puja|pandal|mandap|durgotsav|committee|sarbojanin|sarbajanin|club|sangha|samiti|association/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  private getPriorityScore(item: DiscoveredPandal): number {
    if (item.source === 'ECLIPSE_CURATED') return 1;
    if (item.source === 'GOOGLE_EARTH' && item.verificationStatus === 'VERIFIED') return 2;
    if (item.source === 'AGAMONI') return 2;
    if (item.source === 'GOOGLE_PLACES') return 3;
    return 4;
  }

  /**
   * Naktala Safeguard: Ensures that Naktala Udayan Sangha coordinates are strictly locked to verified values
   */
  private applyNaktalaSafeguard(item: DiscoveredPandal): DiscoveredPandal {
    const norm = this.normalizePandalName(item.name);
    const isNaktalaUdayan =
      (norm.includes('naktala') && norm.includes('udayan')) ||
      (item.name.toLowerCase().includes('naktala') && item.name.toLowerCase().includes('udayan')) ||
      item.id === 'pandal-naktala-udayan-sangha' ||
      item.id === 'agamoni-pandal-naktala-udayan-sangha';

    if (isNaktalaUdayan) {
      return {
        ...item,
        latitude: VERIFIED_NAKTALA_COORDINATES.lat,
        longitude: VERIFIED_NAKTALA_COORDINATES.lng,
        location: {
          lat: VERIFIED_NAKTALA_COORDINATES.lat,
          lng: VERIFIED_NAKTALA_COORDINATES.lng,
        },
        area: 'Naktala',
      };
    }
    return item;
  }

  public calculateDistanceInMeters(locA: Location, locB: Location): number {
    const R = 6371000;
    const dLat = ((locB.lat - locA.lat) * Math.PI) / 180;
    const dLng = ((locB.lng - locA.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((locA.lat * Math.PI) / 180) *
        Math.cos((locB.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private extractAreaFromAddress(address: string): string | null {
    if (!address) return null;
    const parts = address.split(',').map((p) => p.trim());
    if (parts.length >= 2) {
      const candidate = parts[parts.length - 2];
      if (!candidate.toLowerCase().includes('bengal') && !candidate.toLowerCase().includes('kolkata')) {
        return candidate;
      }
      return parts[0];
    }
    return parts[0] || null;
  }

  private extractAreaFromName(name: string): string | null {
    const match = name.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return null;
  }
}

export const pandalGridSearchEngine = PandalGridSearchEngine.getInstance();
