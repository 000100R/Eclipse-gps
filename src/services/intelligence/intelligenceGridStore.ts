/**
 * Eclipse GPS — Central Intelligence Grid State & Viewport Store (Phase 13)
 * 
 * Tracks:
 * - Active layers & layer visibility
 * - Selected intelligence item
 * - Current map viewport bounds (north, south, east, west)
 * - Current map zoom level
 * - Last data refresh time
 * 
 * Provides reactive pub/sub and synchronous access.
 * Does NOT initiate network requests or fake data generation.
 */

import {
  IntelligenceGridState,
  IntelligenceLayer,
  IntelligenceLayerId,
  MapViewport,
  MapViewportBounds,
  SelectedIntelligenceItem,
} from '../../types/intelligence';
import { intelligenceLayerService } from './intelligenceLayerService';

export type GridStateListener = (state: IntelligenceGridState) => void;

// Default initial viewport: Kolkata Central festive core
const DEFAULT_VIEWPORT: MapViewport = {
  north: 22.6200,
  south: 22.4500,
  east: 88.4300,
  west: 88.3000,
  zoom: 14,
};

export class IntelligenceGridStore {
  private viewport: MapViewport = { ...DEFAULT_VIEWPORT };
  private selectedItem: SelectedIntelligenceItem | null = null;
  private lastDataRefreshTime: number | null = null;
  private subscribers: Set<GridStateListener> = new Set();

  constructor() {
    // Listen to changes in the underlying layer service
    intelligenceLayerService.subscribe(() => {
      this.notifySubscribers();
    });
  }

  /**
   * Get full consolidated snapshot of Intelligence Grid state
   */
  public getState(): IntelligenceGridState {
    const layersList = intelligenceLayerService.getLayers();
    const layersRecord = {} as Record<IntelligenceLayerId, IntelligenceLayer>;
    const visibilityMap = {} as Record<IntelligenceLayerId, boolean>;
    const activeLayers: IntelligenceLayerId[] = [];

    layersList.forEach((layer) => {
      layersRecord[layer.id] = layer;
      const isVisible = layer.enabled && layer.visible;
      visibilityMap[layer.id] = isVisible;
      if (isVisible) {
        activeLayers.push(layer.id);
      }
    });

    return {
      layers: layersRecord,
      activeLayers,
      layerVisibility: visibilityMap,
      selectedItem: this.selectedItem ? { ...this.selectedItem } : null,
      viewport: { ...this.viewport },
      lastDataRefreshTime: this.lastDataRefreshTime,
    };
  }

  /**
   * Update the map viewport state (north, south, east, west, zoom)
   * Called whenever the map is panned or zoomed.
   * Does NOT trigger data fetching in Phase 13.
   */
  public setViewport(viewport: MapViewport): void {
    const hasChanged =
      Math.abs(this.viewport.north - viewport.north) > 0.0001 ||
      Math.abs(this.viewport.south - viewport.south) > 0.0001 ||
      Math.abs(this.viewport.east - viewport.east) > 0.0001 ||
      Math.abs(this.viewport.west - viewport.west) > 0.0001 ||
      this.viewport.zoom !== viewport.zoom;

    if (hasChanged) {
      this.viewport = { ...viewport };
      this.notifySubscribers();
    }
  }

  /**
   * Convenience helper to update bounds and optional zoom
   */
  public updateViewportBounds(bounds: MapViewportBounds, zoom?: number): void {
    this.setViewport({
      north: bounds.north,
      south: bounds.south,
      east: bounds.east,
      west: bounds.west,
      zoom: zoom !== undefined ? zoom : this.viewport.zoom,
    });
  }

  /**
   * Get current map viewport
   */
  public getViewport(): MapViewport {
    return { ...this.viewport };
  }

  /**
   * Set or clear the currently selected intelligence item
   */
  public setSelectedItem(item: SelectedIntelligenceItem | null): void {
    this.selectedItem = item ? { ...item } : null;
    this.notifySubscribers();
  }

  /**
   * Get currently selected intelligence item
   */
  public getSelectedItem(): SelectedIntelligenceItem | null {
    return this.selectedItem ? { ...this.selectedItem } : null;
  }

  /**
   * Record a data refresh timestamp
   */
  public setLastDataRefreshTime(timestamp: number = Date.now()): void {
    this.lastDataRefreshTime = timestamp;
    this.notifySubscribers();
  }

  /**
   * Subscribe to state updates
   */
  public subscribe(listener: GridStateListener): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notifySubscribers(): void {
    const state = this.getState();
    this.subscribers.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('[IntelligenceGridStore] Error in subscriber listener:', err);
      }
    });
  }
}

export const intelligenceGridStore = new IntelligenceGridStore();
