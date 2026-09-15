/**
 * Eclipse GPS — useIntelligenceGrid React Hook (Phase 13)
 * 
 * Subscribes React components to the Intelligence Grid state,
 * active layers, viewport bounds, and provides layer toggling methods.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  IntelligenceGridState,
  IntelligenceLayer,
  IntelligenceLayerId,
  MapViewport,
  SelectedIntelligenceItem,
} from '../types/intelligence';
import { intelligenceLayerService } from '../services/intelligence/intelligenceLayerService';
import { intelligenceGridStore } from '../services/intelligence/intelligenceGridStore';

export function useIntelligenceGrid() {
  const [gridState, setGridState] = useState<IntelligenceGridState>(() =>
    intelligenceGridStore.getState()
  );

  useEffect(() => {
    // Sync initial state
    setGridState(intelligenceGridStore.getState());

    // Subscribe to store updates
    const unsubscribe = intelligenceGridStore.subscribe((newState) => {
      setGridState(newState);
    });

    return unsubscribe;
  }, []);

  const toggleLayer = useCallback((layerId: IntelligenceLayerId) => {
    intelligenceLayerService.toggleLayer(layerId);
  }, []);

  const enableLayer = useCallback((layerId: IntelligenceLayerId) => {
    intelligenceLayerService.enableLayer(layerId);
  }, []);

  const disableLayer = useCallback((layerId: IntelligenceLayerId) => {
    intelligenceLayerService.disableLayer(layerId);
  }, []);

  const setLayerVisibility = useCallback(
    (layerId: IntelligenceLayerId, visible: boolean) => {
      intelligenceLayerService.setLayerVisibility(layerId, visible);
    },
    []
  );

  const setSelectedItem = useCallback(
    (item: SelectedIntelligenceItem | null) => {
      intelligenceGridStore.setSelectedItem(item);
    },
    []
  );

  const setViewport = useCallback((viewport: MapViewport) => {
    intelligenceGridStore.setViewport(viewport);
  }, []);

  const layersList = Object.values(gridState.layers);

  return {
    state: gridState,
    layers: gridState.layers,
    layersList,
    activeLayers: gridState.activeLayers,
    layerVisibility: gridState.layerVisibility,
    selectedItem: gridState.selectedItem,
    viewport: gridState.viewport,
    lastDataRefreshTime: gridState.lastDataRefreshTime,
    toggleLayer,
    enableLayer,
    disableLayer,
    setLayerVisibility,
    setSelectedItem,
    setViewport,
    isLayerVisible: (layerId: IntelligenceLayerId) =>
      Boolean(gridState.layerVisibility[layerId]),
  };
}
