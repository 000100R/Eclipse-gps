/**
 * Eclipse GPS — Intelligence Grid Foundation Types (Phase 13)
 * 
 * Typed definitions for the Eclipse Intelligence Grid architecture:
 * Layer IDs, layer metadata, map viewport bounds, selected items,
 * and the generic data provider interface for future layers.
 */

export type IntelligenceLayerId =
  | 'PANDALS'
  | 'BONEDI_BARI'
  | 'METRO'
  | 'PUJA_CALENDAR'
  | 'EVENTS'
  | 'CROWD'
  | 'TRAFFIC'
  | 'PARKING'
  | 'WALKING_ROUTES'
  | 'ALERTS';

export interface IntelligenceLayer {
  id: IntelligenceLayerId;
  name: string;
  description: string;
  enabled: boolean;
  visible: boolean;
  loading: boolean;
  error: string | null;
  itemCount: number;
}

/**
 * Geographic bounding box coordinates for viewport-aware intelligence
 */
export interface MapViewportBounds {
  north: number; // Max Latitude
  south: number; // Min Latitude
  east: number;  // Max Longitude
  west: number;  // Min Longitude
}

/**
 * Full viewport state including zoom level
 */
export interface MapViewport extends MapViewportBounds {
  zoom: number;
}

/**
 * An item selected from any active intelligence layer on the map
 */
export interface SelectedIntelligenceItem {
  id: string;
  layerId: IntelligenceLayerId;
  name: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  data?: any;
}

/**
 * Complete snapshot of the Intelligence Grid state
 */
export interface IntelligenceGridState {
  layers: Record<IntelligenceLayerId, IntelligenceLayer>;
  activeLayers: IntelligenceLayerId[];
  layerVisibility: Record<IntelligenceLayerId, boolean>;
  selectedItem: SelectedIntelligenceItem | null;
  viewport: MapViewport;
  lastDataRefreshTime: number | null;
}

/**
 * Metadata descriptor for intelligence data providers
 */
export interface DataProviderMetadata {
  id: IntelligenceLayerId;
  name: string;
  sourceType:
    | 'curated'
    | 'places_api'
    | 'kml_import'
    | 'transit_gtfs'
    | 'realtime'
    | 'police_advisory'
    | 'custom';
  refreshIntervalMs?: number;
  isAvailable?: boolean;
}

/**
 * Generic interface for future intelligence data providers (Section 5)
 * 
 * Future providers implement this contract:
 * - PandalProvider
 * - BonediBariProvider
 * - MetroProvider
 * - EventProvider
 * - CrowdProvider
 * - TrafficProvider
 * - ParkingProvider
 * - WalkingRoutesProvider
 * - AlertsProvider
 */
export interface IntelligenceDataProvider<T = any> {
  readonly layerId: IntelligenceLayerId;
  readonly metadata: DataProviderMetadata;

  /**
   * Load or query data within specified geographic viewport bounds
   */
  load(bounds: MapViewportBounds, zoom?: number): Promise<T[]>;

  /**
   * Refresh current active viewport data
   */
  refresh(): Promise<T[]>;

  /**
   * Clear in-memory cached items for this provider
   */
  clear(): void;

  /**
   * Release resources, timers, or live subscriptions
   */
  destroy(): void;

  /**
   * Get cached data items currently held by provider
   */
  getData(): T[];

  /**
   * Check if the data provider source is configured/ready
   */
  isAvailable(): boolean;
}
