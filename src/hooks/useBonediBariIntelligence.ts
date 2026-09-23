/**
 * Eclipse GPS — useBonediBariIntelligence Hook (Phase 13.2)
 * 
 * Reactive hook connecting BonediBariIntelligenceProvider to React Map Views:
 * - Synchronizes real Bonedi Bari records when BONEDI_BARI layer is toggled.
 * - Viewport-aware debounced queries as map pans/zooms.
 * - Clusters heritage markers at lower zoom levels.
 * - Exposes search and retrieval methods for Copilot and Search HUD.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { BonediBari } from '../types/bonediBari';
import { Location } from '../types';
import { useIntelligenceGrid } from './useIntelligenceGrid';
import { bonediBariIntelligenceProvider } from '../services/intelligence/bonediBariIntelligenceProvider';
import { clusterMarkers, ClusterOrItem } from '../utils/markerCluster';

export function useBonediBariIntelligence(userLocation?: Location) {
  const { isLayerVisible, viewport, layers } = useIntelligenceGrid();
  const isBonediBariVisible = isLayerVisible('BONEDI_BARI');
  const bonediBariLayer = layers.BONEDI_BARI;

  const [bonediBaris, setBonediBaris] = useState<BonediBari[]>(() =>
    isBonediBariVisible ? bonediBariIntelligenceProvider.getData() : []
  );
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(bonediBariLayer?.loading));
  const [emptyMessage, setEmptyMessage] = useState<string | undefined>();
  const [lastError, setLastError] = useState<string | undefined>();

  const debounceTimerRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);
  const userLocationRef = useRef<Location | undefined>(userLocation);

  // Update user location in provider only if shifted significantly
  useEffect(() => {
    userLocationRef.current = userLocation;
    if (userLocation) {
      bonediBariIntelligenceProvider.setUserLocation(userLocation);
    }
  }, [userLocation?.lat, userLocation?.lng]);

  const fetchBonediBariForViewport = useCallback(async () => {
    if (!isBonediBariVisible) {
      setBonediBaris([]);
      setEmptyMessage(undefined);
      return;
    }

    setIsLoading(true);
    try {
      const results = await bonediBariIntelligenceProvider.load(
        {
          north: viewport.north,
          south: viewport.south,
          east: viewport.east,
          west: viewport.west,
        },
        viewport.zoom,
        userLocationRef.current
      );

      if (isMountedRef.current) {
        setBonediBaris(prev => {
          if (prev.length === results.length && prev.every((b, i) => b.id === results[i].id)) {
            return prev;
          }
          return results;
        });
        setEmptyMessage(bonediBariIntelligenceProvider.getEmptyMessage());
        setLastError(undefined);
        setIsLoading(false);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setLastError(err?.message || 'Failed to load Bonedi Bari records');
        setEmptyMessage(undefined);
        setIsLoading(false);
      }
    }
  }, [
    isBonediBariVisible,
    viewport.north,
    viewport.south,
    viewport.east,
    viewport.west,
    viewport.zoom,
  ]);

  // Debounced viewport and visibility effect
  useEffect(() => {
    isMountedRef.current = true;

    if (!isBonediBariVisible) {
      setBonediBaris([]);
      setEmptyMessage(undefined);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchBonediBariForViewport();
    }, 200);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    isBonediBariVisible,
    viewport.north,
    viewport.south,
    viewport.east,
    viewport.west,
    viewport.zoom,
    fetchBonediBariForViewport,
  ]);

  // Clustering for Bonedi Bari markers at lower zooms
  const clusteredItems: ClusterOrItem<BonediBari>[] = useMemo(() => {
    if (!isBonediBariVisible || bonediBaris.length === 0) {
      return [];
    }
    return clusterMarkers<BonediBari>(bonediBaris, viewport.zoom, (b) => b.location);
  }, [isBonediBariVisible, bonediBaris, viewport.zoom]);

  const searchBonediBari = useCallback(
    async (query: string): Promise<BonediBari[]> => {
      return bonediBariIntelligenceProvider.search(query, userLocation, viewport);
    },
    [userLocation, viewport]
  );

  return {
    isBonediBariVisible,
    bonediBaris,
    clusteredItems,
    isLoading,
    emptyMessage,
    lastError,
    searchBonediBari,
    refetch: fetchBonediBariForViewport,
  };
}
