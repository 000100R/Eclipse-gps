/**
 * Eclipse GPS — useCrowdTrafficIntelligence Hook (Phase 13.7)
 * 
 * Provides reactive access to Eclipse Crowd and Traffic Intelligence data,
 * layer visibility status, and Smart Visit evaluation.
 */

import { useState, useEffect, useMemo } from 'react';
import { useAppState } from './AppStateProvider';
import { useIntelligenceGrid } from './useIntelligenceGrid';
import { crowdIntelligenceService } from '../services/intelligence/crowdIntelligenceService';
import { trafficIntelligenceService } from '../services/intelligence/trafficIntelligenceService';
import { smartVisitService } from '../services/intelligence/smartVisitService';
import {
  CrowdIntelligenceItem,
  TrafficIntelligenceItem,
  SmartVisitRecommendation,
} from '../types/crowdTraffic';
import { DiscoveredPandal } from '../types/discovery';

export function useCrowdTrafficIntelligence(selectedPandal?: DiscoveredPandal | any) {
  const { pandals, pandalCrowdCounts, pandalCrowdTrends, currentLocation } = useAppState();
  const { isLayerVisible, toggleLayer, setLayerVisibility } = useIntelligenceGrid();

  const isCrowdLayerVisible = isLayerVisible('CROWD');
  const isTrafficLayerVisible = isLayerVisible('TRAFFIC');

  // Reactively recompute crowd items when presence data or pandals update
  const crowdItems = useMemo<CrowdIntelligenceItem[]>(() => {
    return crowdIntelligenceService.getAllCrowdItems(
      pandals,
      pandalCrowdCounts,
      pandalCrowdTrends
    );
  }, [pandals, pandalCrowdCounts, pandalCrowdTrends]);

  // Reactively load traffic corridors
  const [trafficCorridors, setTrafficCorridors] = useState<TrafficIntelligenceItem[]>(() =>
    trafficIntelligenceService.getAllCorridors()
  );

  useEffect(() => {
    let isMounted = true;
    trafficIntelligenceService.syncAlerts().then(() => {
      if (isMounted) {
        setTrafficCorridors([...trafficIntelligenceService.getAllCorridors()]);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute crowd item for the currently selected pandal
  const selectedCrowdItem = useMemo<CrowdIntelligenceItem | null>(() => {
    if (!selectedPandal) return null;
    return crowdIntelligenceService.getCrowdForPandal(
      selectedPandal.id,
      selectedPandal,
      pandalCrowdCounts,
      pandalCrowdTrends
    );
  }, [selectedPandal, pandalCrowdCounts, pandalCrowdTrends]);

  // Compute traffic item for the currently selected pandal
  const selectedTrafficItem = useMemo<TrafficIntelligenceItem | null>(() => {
    if (!selectedPandal) return null;
    return trafficIntelligenceService.getTrafficNearPandal(
      selectedPandal.id,
      selectedPandal.location
    );
  }, [selectedPandal]);

  // Compute Smart Visit recommendation for selected pandal
  const smartVisit = useMemo<SmartVisitRecommendation | null>(() => {
    if (!selectedPandal) return null;
    return smartVisitService.calculateRecommendation(
      selectedPandal,
      pandals,
      pandalCrowdCounts,
      pandalCrowdTrends,
      currentLocation
    );
  }, [selectedPandal, pandals, pandalCrowdCounts, pandalCrowdTrends, currentLocation]);

  return {
    isCrowdLayerVisible,
    isTrafficLayerVisible,
    toggleCrowdLayer: () => toggleLayer('CROWD'),
    toggleTrafficLayer: () => toggleLayer('TRAFFIC'),
    setCrowdLayerVisibility: (visible: boolean) => setLayerVisibility('CROWD', visible),
    setTrafficLayerVisibility: (visible: boolean) => setLayerVisibility('TRAFFIC', visible),
    crowdItems,
    trafficCorridors,
    selectedCrowdItem,
    selectedTrafficItem,
    smartVisit,
  };
}
