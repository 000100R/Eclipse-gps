/**
 * Eclipse GPS — Central Intelligence Layer Manager (Phase 13)
 * 
 * Manages layer registry, active states, visibility toggles, loading/error states,
 * item counts, and subscriber notifications for all Eclipse intelligence layers.
 * 
 * Clean, decoupled foundation ready for future data providers.
 */

import {
  IntelligenceLayer,
  IntelligenceLayerId,
  IntelligenceDataProvider,
} from '../../types/intelligence';

export type LayerChangeListener = (layers: IntelligenceLayer[]) => void;

export class IntelligenceLayerService {
  private layers: Map<IntelligenceLayerId, IntelligenceLayer> = new Map();
  private providers: Map<IntelligenceLayerId, IntelligenceDataProvider> = new Map();
  private subscribers: Set<LayerChangeListener> = new Set();

  constructor() {
    this.registerInitialLayers();
  }

  /**
   * Pre-register all initial Eclipse Intelligence Layers
   * Default state: PANDALS is enabled and visible (baseline experience);
   * other layers are initialized disabled until user toggles or future providers connect.
   */
  private registerInitialLayers(): void {
    const initialLayers: IntelligenceLayer[] = [
      {
        id: 'PANDALS',
        name: 'Pandals',
        description: 'Major and community Durga Puja pandals across Kolkata',
        enabled: true,
        visible: true,
        loading: false,
        error: null,
        itemCount: 0,
      },
      {
        id: 'BONEDI_BARI',
        name: 'Bonedi Bari',
        description: 'Heritage aristocratic family pujas with historic traditions',
        enabled: false,
        visible: false,
        loading: false,
        error: null,
        itemCount: 0,
      },
      {
        id: 'METRO',
        name: 'Metro',
        description: 'Kolkata Metro stations, operational gates & corridor routes',
        enabled: false,
        visible: false,
        loading: false,
        error: null,
        itemCount: 0,
      },
      {
        id: 'PUJA_CALENDAR',
        name: 'Puja Calendar',
        description: 'Verified Durga Puja ritual dates, astronomical Sandhi timings & festival periods',
        enabled: false,
        visible: false,
        loading: false,
        error: null,
        itemCount: 10,
      },
      {
        id: 'EVENTS',
        name: 'Events',
        description: 'Puja schedules, cultural programs, and pushpanjali timings',
        enabled: false,
        visible: false,
        loading: false,
        error: null,
        itemCount: 0,
      },
      {
        id: 'CROWD',
        name: 'Crowd',
        description: 'Real-time footfall density and queue wait times',
        enabled: false,
        visible: false,
        loading: false,
        error: null,
        itemCount: 25,
      },
      {
        id: 'TRAFFIC',
        name: 'Traffic',
        description: 'Police road advisories, one-way corridors & congestion',
        enabled: false,
        visible: false,
        loading: false,
        error: null,
        itemCount: 7,
      },
      {
        id: 'PARKING',
        name: 'Parking',
        description: 'Designated festival parking grounds and restrictions',
        enabled: false,
        visible: false,
        loading: false,
        error: null,
        itemCount: 0,
      },
      {
        id: 'WALKING_ROUTES',
        name: 'Walking Routes',
        description: 'Barricaded pedestrian channels & queue darshan paths',
        enabled: false,
        visible: false,
        loading: false,
        error: null,
        itemCount: 0,
      },
      {
        id: 'ALERTS',
        name: 'Alerts',
        description: 'Emergency advisories, medical aid & police assistance desks',
        enabled: false,
        visible: false,
        loading: false,
        error: null,
        itemCount: 0,
      },
    ];

    initialLayers.forEach((layer) => {
      this.layers.set(layer.id, layer);
    });
  }

  /**
   * Register a new or custom intelligence layer
   */
  public registerLayer(layer: IntelligenceLayer): void {
    this.layers.set(layer.id, { ...layer });
    this.notifySubscribers();
  }

  /**
   * Get all registered layers in insertion order
   */
  public getLayers(): IntelligenceLayer[] {
    return Array.from(this.layers.values()).map((layer) => ({ ...layer }));
  }

  /**
   * Get a specific layer by ID
   */
  public getLayer(id: IntelligenceLayerId): IntelligenceLayer | undefined {
    const layer = this.layers.get(id);
    return layer ? { ...layer } : undefined;
  }

  /**
   * Check if a layer is currently visible
   */
  public isLayerVisible(id: IntelligenceLayerId): boolean {
    const layer = this.layers.get(id);
    return Boolean(layer && layer.enabled && layer.visible);
  }

  /**
   * Return a dictionary of layerId -> boolean visibility
   */
  public getLayerVisibilityMap(): Record<IntelligenceLayerId, boolean> {
    const map = {} as Record<IntelligenceLayerId, boolean>;
    this.layers.forEach((layer, id) => {
      map[id] = layer.enabled && layer.visible;
    });
    return map;
  }

  /**
   * Get list of currently active (enabled + visible) layer IDs
   */
  public getActiveLayerIds(): IntelligenceLayerId[] {
    const active: IntelligenceLayerId[] = [];
    this.layers.forEach((layer, id) => {
      if (layer.enabled && layer.visible) {
        active.push(id);
      }
    });
    return active;
  }

  /**
   * Enable a layer
   */
  public enableLayer(id: IntelligenceLayerId): void {
    const layer = this.layers.get(id);
    if (layer && !layer.enabled) {
      layer.enabled = true;
      layer.visible = true;
      this.notifySubscribers();
    }
  }

  /**
   * Disable a layer
   */
  public disableLayer(id: IntelligenceLayerId): void {
    const layer = this.layers.get(id);
    if (layer && layer.enabled) {
      layer.enabled = false;
      layer.visible = false;
      this.notifySubscribers();
    }
  }

  /**
   * Toggle a layer's enabled and visible state
   */
  public toggleLayer(id: IntelligenceLayerId): void {
    const layer = this.layers.get(id);
    if (layer) {
      const nextState = !layer.enabled;
      layer.enabled = nextState;
      layer.visible = nextState;
      this.notifySubscribers();
    }
  }

  /**
   * Explicitly set layer visibility without disabling registration
   */
  public setLayerVisibility(id: IntelligenceLayerId, visible: boolean): void {
    const layer = this.layers.get(id);
    if (layer) {
      layer.visible = visible;
      if (visible) {
        layer.enabled = true;
      }
      this.notifySubscribers();
    }
  }

  /**
   * Update the loading status of a layer
   */
  public updateLoadingState(id: IntelligenceLayerId, loading: boolean): void {
    const layer = this.layers.get(id);
    if (layer && layer.loading !== loading) {
      layer.loading = loading;
      this.notifySubscribers();
    }
  }

  /**
   * Update the error message of a layer
   */
  public updateErrorState(id: IntelligenceLayerId, error: string | null): void {
    const layer = this.layers.get(id);
    if (layer && layer.error !== error) {
      layer.error = error;
      this.notifySubscribers();
    }
  }

  /**
   * Update the displayed item count for a layer
   */
  public updateItemCount(id: IntelligenceLayerId, count: number): void {
    const layer = this.layers.get(id);
    if (layer && layer.itemCount !== count) {
      layer.itemCount = Math.max(0, count);
      this.notifySubscribers();
    }
  }

  /**
   * Register a future data provider for a layer
   */
  public registerProvider(provider: IntelligenceDataProvider): void {
    this.providers.set(provider.layerId, provider);
  }

  /**
   * Get the registered data provider for a layer
   */
  public getProvider(layerId: IntelligenceLayerId): IntelligenceDataProvider | undefined {
    return this.providers.get(layerId);
  }

  /**
   * Check if a layer has a registered and available data provider
   */
  public hasProvider(layerId: IntelligenceLayerId): boolean {
    const p = this.providers.get(layerId);
    return Boolean(p && p.isAvailable());
  }

  /**
   * Subscribe to layer state updates
   */
  public subscribe(listener: LayerChangeListener): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  /**
   * Notify all registered subscribers of state changes
   */
  private notifySubscribers(): void {
    const current = this.getLayers();
    this.subscribers.forEach((listener) => {
      try {
        listener(current);
      } catch (err) {
        console.error('[IntelligenceLayerService] Error in subscriber listener:', err);
      }
    });
  }
}

// Global singleton instance for the app
export const intelligenceLayerService = new IntelligenceLayerService();
