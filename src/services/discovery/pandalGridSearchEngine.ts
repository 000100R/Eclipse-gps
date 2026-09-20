import { Location } from '../../types';
import { DiscoveredPandal } from '../../types/discovery';
import { MapViewportBounds } from '../../types/intelligence';
import {
  extractPlaceCoordinates,
  validateAndNormalizeCoordinates,
  verifyPandalAreaMatch,
  VERIFIED_NAKTALA_COORDINATES,
} from '../../utils/coordinateValidation';
import {
  isDuplicatePandal,
  mergeDuplicatePandals,
  getRecordPriority,
} from '../../utils/pandalDeduplication';
import { normalizeGooglePlaceRecord } from '../../utils/googlePlacesNormalizer';

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
 * Kolkata Geographic Coverage Area specification
 */
export interface KolkataGeographicSearchArea {
  id: string;
  name: string;
  center: Location;
  radius: number; // in meters (overlapping with neighbors)
}

/**
 * Systematic Kolkata Metropolitan Coverage Areas (Requirement 2: Overlapping Geographic Search)
 */
export const KOLKATA_COVERAGE_AREAS: readonly KolkataGeographicSearchArea[] = [
  { id: 'central-kolkata', name: 'Central Kolkata', center: { lat: 22.5684, lng: 88.3580 }, radius: 3000 },
  { id: 'north-kolkata', name: 'North Kolkata', center: { lat: 22.5985, lng: 88.3678 }, radius: 3200 },
  { id: 'south-kolkata', name: 'South Kolkata', center: { lat: 22.5186, lng: 88.3585 }, radius: 3500 },
  { id: 'east-kolkata', name: 'East Kolkata', center: { lat: 22.5450, lng: 88.4000 }, radius: 3500 },
  { id: 'west-kolkata', name: 'West Kolkata / Riverfront', center: { lat: 22.5540, lng: 88.3380 }, radius: 3000 },
  { id: 'salt-lake-bidhannagar', name: 'Salt Lake / Bidhannagar', center: { lat: 22.5862, lng: 88.4116 }, radius: 3500 },
  { id: 'rajarhat-new-town', name: 'Rajarhat / New Town', center: { lat: 22.5898, lng: 88.4682 }, radius: 4500 },
  { id: 'behala', name: 'Behala', center: { lat: 22.4952, lng: 88.3188 }, radius: 3800 },
  { id: 'jadavpur', name: 'Jadavpur', center: { lat: 22.4955, lng: 88.3708 }, radius: 3000 },
  { id: 'tollygunge', name: 'Tollygunge', center: { lat: 22.4988, lng: 88.3468 }, radius: 3000 },
  { id: 'garia-patuli-naktala', name: 'Garia / Patuli / Naktala', center: { lat: 22.4640, lng: 88.3832 }, radius: 3500 },
  { id: 'dum-dum', name: 'Dum Dum', center: { lat: 22.6395, lng: 88.4190 }, radius: 3800 },
  { id: 'lake-town', name: 'Lake Town', center: { lat: 22.5998, lng: 88.4019 }, radius: 2800 },
  { id: 'maniktala', name: 'Maniktala', center: { lat: 22.5840, lng: 88.3760 }, radius: 2800 },
  { id: 'shyambazar', name: 'Shyambazar', center: { lat: 22.6025, lng: 88.3710 }, radius: 2800 },
  { id: 'barasat-fringe', name: 'Barasat-side Fringe', center: { lat: 22.6780, lng: 88.4480 }, radius: 5000 },
  { id: 'howrah-side', name: 'Howrah-side Locations', center: { lat: 22.5880, lng: 88.3280 }, radius: 4000 },
  { id: 'ballygunge-gariahat', name: 'Ballygunge / Gariahat', center: { lat: 22.5250, lng: 88.3660 }, radius: 2800 },
  { id: 'alipore-new-alipore', name: 'Alipore / New Alipore', center: { lat: 22.5150, lng: 88.3320 }, radius: 3000 },
  { id: 'kasba-ruby', name: 'Kasba / Ruby', center: { lat: 22.5186, lng: 88.3980 }, radius: 3200 },
];

/**
 * Multi-query searches required for high-recall Durga Puja and Bonedi Bari discovery
 * Systematically covers:
 * - Durga Puja (pandal, pujo, mandap, celebration, festival)
 * - Durga Pujo (pujo pandal, pujo committee, pujo club, pujo samiti, pujo sangha)
 * - Puja committee (durga puja committee, sharad utsav committee, puja samity)
 * - Puja club (durga puja club, club durga pujo, local puja club)
 * - Puja samiti / samity (durga puja samiti, barowari samiti, sarbojanin samiti)
 * - Puja sangha (durga puja sangha, sarbojanin sangha, udayan/jubak sangha puja)
 * - Sarbojanin Puja / Sarbojanin Durgotsav / Barowari Puja
 * - Durgotsav / Durgotsab / Sharadotsav / Sharadiya Puja
 * - Bonedi Bari / Bonedi Barir Puja / Bonedi Bari Durga Puja
 * - Rajbari / Rajbari Durga Puja / Rajbari Puja
 * - Zamindar Bari / Zamindar Bari Durga Puja / Zamindari Puja
 * - Heritage Durga Puja / Heritage Bonedi Bari / Historic Puja
 * - Traditional Durga Puja / Traditional Bonedi Bari / Traditional Puja Mandap
 * - Family Durga Puja / Old Family Durga Puja / Family Barir Puja
 * Plus Bengali script equivalents for accurate local Google Places listings
 */
export const MULTI_QUERY_SEARCH_TERMS = [
  // 1. Durga Puja core & structural variations
  'Durga Puja',
  'Durga Puja pandal',
  'Durga Puja puja',
  'Durga Puja Kolkata',
  'Durga Puja mandap',
  'Durga Puja celebration',
  'Durga Puja ground',

  // 2. Durga Pujo variations (colloquial & common Google Maps naming)
  'Durga Pujo',
  'Durga Pujo pandal',
  'Durga Pujo Kolkata',
  'Durga Pujo mandap',
  'Kolkata Durga Pujo',

  // 3. Puja committee variations
  'Durga Puja committee',
  'Durga Pujo committee',
  'Puja committee',
  'Puja committee Kolkata',
  'Puja samity committee',
  'Sarbojanin Puja committee',
  'Sharad Utsav committee',

  // 4. Puja club variations
  'Durga Puja club',
  'Durga Pujo club',
  'Puja club',
  'Puja club Kolkata',
  'Club Durga Puja',
  'Club Durga Pujo',

  // 5. Puja samiti / samity variations
  'Durga Puja Samiti',
  'Durga Pujo Samiti',
  'Puja Samiti',
  'Puja Samiti Kolkata',
  'Durga Puja Samity',
  'Puja Samity',
  'Sarbojanin Puja Samiti',
  'Barowari Puja Samiti',

  // 6. Puja sangha variations
  'Durga Puja Sangha',
  'Durga Pujo Sangha',
  'Puja Sangha',
  'Puja Sangha Kolkata',
  'Sarbojanin Puja Sangha',
  'Jubak Sangha Durga Puja',
  'Tarun Sangha Durga Puja',

  // 7. Sarbojanin Puja & Barowari variations
  'Sarbojanin Durga Puja',
  'Sarbojanin Puja',
  'Sarbojanin Durgotsav',
  'Sarbojanin Durga Pujo',
  'Sarbajanin Durga Puja',
  'Sarbojanin Durgotsab',
  'Barowari Durga Puja',
  'Barowari Puja',

  // 8. Durgotsav / Durgotsab & Utsav variations
  'Durgotsav',
  'Durgotsab',
  'Durga Utsav',
  'Durga Puja Utsav',
  'Sharadotsav',
  'Sharadotsav Durga Puja',
  'Sharadiya Durga Puja',
  'Sharadiya Durgotsav',

  // 9. Bonedi Bari & Bonedi Barir Puja variations
  'Bonedi Bari Durga Puja',
  'Bonedi Barir Puja',
  'Bonedi Barir Durga Puja',
  'Bonedi Bari Puja',
  'Bonedi Bari Durga Pujo',
  'Bonedi Durga Puja',
  'Bonedi Bari Kolkata',
  'Kolkata Bonedi Bari Puja',
  'Barir Durga Puja',
  'Barir Puja Kolkata',

  // 10. Rajbari variations
  'Rajbari Durga Puja',
  'Rajbari Puja',
  'Rajbari Durga Pujo',
  'Rajbari Kolkata',
  'Kolkata Rajbari Durga Puja',
  'Rajbari Barir Puja',

  // 11. Zamindar Bari variations
  'Zamindar Bari Durga Puja',
  'Zamindar Bari Puja',
  'Zamindar Bari Durga Pujo',
  'Zamindari Durga Puja',
  'Zamindar Barir Puja',

  // 12. Heritage Durga Puja variations
  'heritage Durga Puja',
  'heritage Durga Pujo',
  'heritage Puja Kolkata',
  'heritage Bonedi Bari',
  'historic Durga Puja',
  'historic Bonedi Bari Puja',

  // 13. Traditional Durga Puja variations
  'traditional Durga Puja',
  'traditional Durga Pujo',
  'traditional Puja Kolkata',
  'traditional Bonedi Bari',
  'traditional family Puja',
  'traditional Barir Puja',

  // 14. Family Durga Puja & Old family variations
  'family Durga Puja',
  'family Durga Pujo',
  'family Puja Kolkata',
  'old family Durga Puja',
  'old family Puja Kolkata',
  'old family Bonedi Bari',
  'aristocratic family Durga Puja',

  // 15. Bengali script queries (matching local Bengali Place titles on Google Maps)
  'দুর্গা পূজা',
  'দুর্গাপূজা',
  'দুর্গা পুজো',
  'দুর্গাপুজো',
  'দুর্গোৎসব',
  'সর্বজনীন দুর্গাপূজা',
  'সর্বজনীন দুর্গোৎসব',
  'সর্বজনীন দুর্গা পুজো',
  'বারোয়ারি দুর্গা পূজা',
  'পূজা কমিটি',
  'পূজা সমিতি',
  'পূজা সংঘ',
  'পূজা ক্লাব',
  'বনেদি বাড়ির পুজো',
  'বনেদি বাড়ি দুর্গা পূজা',
  'বনেদি বাড়ি দুর্গাপূজা',
  'বনেদি বাড়ির দুর্গাপূজা',
  'রাজবাড়ি দুর্গা পূজা',
  'রাজবাড়ির পুজো',
  'রাজবাড়ি দুর্গাপূজা',
  'জমিদার বাড়ি দুর্গা পূজা',
  'জমিদার বাড়ির পুজো',
  'ঐতিহ্যবাহী দুর্গাপূজা',
  'পারিবারিক দুর্গাপূজা',
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
      const queriesToRun: string[] = [];
      if (customQuery && customQuery.trim().length > 2) {
        queriesToRun.push(customQuery.trim());
      }
      for (const q of MULTI_QUERY_SEARCH_TERMS) {
        if (!queriesToRun.some((existing) => existing.toLowerCase() === q.toLowerCase())) {
          queriesToRun.push(q);
        }
      }

      // A. Run Text Searches in parallel batches of 3 to discover pandals and Bonedi Baris without overloading
      const BATCH_SIZE = 3;
      for (let b = 0; b < queriesToRun.length; b += BATCH_SIZE) {
        const batch = queriesToRun.slice(b, b + BATCH_SIZE);
        const batchPromises = batch.map((query) =>
          this.fetchServerPlacesSearch(query, cell.center, cell.radius).catch(() => [])
        );
        const batchResults = await Promise.all(batchPromises);
        for (const res of batchResults) {
          if (res && res.length > 0) {
            discoveredInCell.push(...res);
          }
        }
        if (b + BATCH_SIZE < queriesToRun.length) {
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
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
   * Helper: Calls /api/places/search with full pagination (Requirement 4)
   * Continues until all available pages allowed by the API are retrieved.
   */
  private async fetchServerPlacesSearch(
    query: string,
    center: Location,
    radius: number
  ): Promise<DiscoveredPandal[]> {
    const list: DiscoveredPandal[] = [];
    let pageToken: string | undefined = undefined;
    const MAX_PAGES = 3; // Google Places Text Search supports up to 3 pages
    let pageCount = 0;

    try {
      while (pageCount < MAX_PAGES) {
        pageCount++;
        const res = await fetch('/api/places/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            location: center,
            radius,
            pageToken,
          }),
        });

        if (!res.ok) break;
        const data = await res.json();
        if (!Array.isArray(data.places) || data.places.length === 0) break;

        for (const p of data.places) {
          const normalized = this.normalizeGooglePlace(p, center);
          if (normalized) list.push(normalized);
        }

        // Check if there is an additional page available
        if (data.nextPageToken && typeof data.nextPageToken === 'string') {
          pageToken = data.nextPageToken;
          // Google Places API recommends a small pause between page requests
          await new Promise((resolve) => setTimeout(resolve, 80));
        } else {
          // No more pages
          break;
        }
      }
    } catch (_) {}

    return list;
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
   * Delegates to unified normalizeGooglePlaceRecord
   */
  public normalizeGooglePlace(place: any, defaultCenter?: Location): DiscoveredPandal | null {
    return normalizeGooglePlaceRecord(place, defaultCenter);
  }

  /**
   * Systematic Kolkata Metropolitan Area Coverage (Prompt Requirement 2)
   * Discovers pandals & Bonedi Bari locations across all predefined overlapping zones:
   * Central, North, South, East, West, Salt Lake, Rajarhat, Behala, Jadavpur, Tollygunge,
   * Garia, Dum Dum, Lake Town, Maniktala, Shyambazar, Barasat fringe, Howrah, etc.
   */
  public async discoverKolkataMetropolitanCoverage(
    customQuery?: string
  ): Promise<DiscoveredPandal[]> {
    const coverageCells: GeographicGridCell[] = KOLKATA_COVERAGE_AREAS.map((area) => {
      const key = this.getCellKey(area.center.lat, area.center.lng, area.radius);
      return {
        id: `coverage-${area.id}-${key}`,
        key,
        center: area.center,
        radius: area.radius,
      };
    });

    const results = await this.executeGridSearch(coverageCells, customQuery);
    return this.deduplicateAndMerge(results);
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
    // Sort by authority priority first (ECLIPSE_CURATED, AGAMONI, GOOGLE_EARTH, GOOGLE_PLACES, etc.)
    const prioritized = [...candidates].sort((a, b) => {
      return getRecordPriority(a) - getRecordPriority(b);
    });

    const merged: DiscoveredPandal[] = [];

    for (const candidate of prioritized) {
      const matchIdx = merged.findIndex(
        (existing) => isDuplicatePandal(existing, candidate).isDuplicate
      );

      if (matchIdx === -1) {
        // Enforce Naktala safeguard on newly added record
        const safeguarded = this.applyNaktalaSafeguard(candidate);
        merged.push(safeguarded);
      } else {
        // Merge attributes into existing higher priority item
        merged[matchIdx] = mergeDuplicatePandals(merged[matchIdx], candidate);
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
