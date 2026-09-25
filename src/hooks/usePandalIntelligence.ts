/**
 * Eclipse GPS — usePandalIntelligence Hook (Phase 13.1)
 * 
 * Reactive integration between PandalIntelligenceProvider and React Map Views:
 * - Automatically fetches and synchronizes real pandal data when PANDALS layer is enabled.
 * - Hides/clears pandal markers when PANDALS layer is disabled.
 * - Performs debounced viewport-aware updates as the map pans or zooms.
 * - Clusters high-density markers at lower zooms using markerCluster.ts.
 * - Exposes empty state and search capabilities for Copilot.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DiscoveredPandal } from '../types/discovery';
import { Location } from '../types';
import { useIntelligenceGrid } from './useIntelligenceGrid';
import { pandalIntelligenceProvider } from '../services/intelligence/pandalIntelligenceProvider';
import { clusterMarkers, ClusterOrItem } from '../utils/markerCluster';

export function usePandalIntelligence(userLocation?: Location) {
  const { isLayerVisible, viewport, layers } = useIntelligenceGrid();
  const isPandalVisible = isLayerVisible('PANDALS');
  const pandalLayer = layers.PANDALS;

  const [pandals, setPandals] = useState<DiscoveredPandal[]>(() =>
    isPandalVisible ? pandalIntelligenceProvider.getData() : []
  );
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(pandalLayer?.loading));
  const [emptyMessage, setEmptyMessage] = useState<string | undefined>();
  const [lastError, setLastError] = useState<string | undefined>();

  const debounceTimerRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);
  const userLocationRef = useRef<Location | undefined>(userLocation);

  // Update user location ref and provider only if location actually shifted significantly
  useEffect(() => {
    userLocationRef.current = userLocation;
    if (userLocation) {
      pandalIntelligenceProvider.setUserLocation(userLocation);
    }
  }, [userLocation?.lat, userLocation?.lng]);

  const fetchPandalsForViewport = useCallback(async () => {
    if (!isPandalVisible) {
      setPandals(prev => (prev.length === 0 ? prev : []));
      setEmptyMessage(undefined);
      return;
    }

    setIsLoading(true);
    try {
      const results = await pandalIntelligenceProvider.load(
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
        setPandals(prev => {
          if (prev.length === results.length && prev.every((p, i) => p.id === results[i].id)) {
            return prev;
          }
          return results;
        });
        setEmptyMessage(pandalIntelligenceProvider.getEmptyMessage());
        setLastError(undefined);
        setIsLoading(false);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setLastError(err?.message || 'Failed to load pandals');
        setEmptyMessage(undefined);
        setIsLoading(false);
      }
    }
  }, [isPandalVisible, viewport.north, viewport.south, viewport.east, viewport.west, viewport.zoom]);

  // Viewport and visibility change effect with debounce
  useEffect(() => {
    isMountedRef.current = true;

    if (!isPandalVisible) {
      setPandals(prev => (prev.length === 0 ? prev : []));
      setEmptyMessage(undefined);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchPandalsForViewport();
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isPandalVisible, viewport.north, viewport.south, viewport.east, viewport.west, viewport.zoom, fetchPandalsForViewport]);

  // Scalable clustering: Compute clusters based on current zoom level
  const clusteredItems: ClusterOrItem<DiscoveredPandal>[] = useMemo(() => {
    if (!isPandalVisible || pandals.length === 0) {
      return [];
    }
    return clusterMarkers<DiscoveredPandal>(pandals, viewport.zoom, (p) => p.location);
  }, [isPandalVisible, pandals, viewport.zoom]);

  const sourceStats = useMemo(() => {
    let eclipseCount = 0;
    let googleEarthCount = 0;
    let googlePlacesCount = 0;
    for (const p of pandals) {
      if (p.source === 'ECLIPSE_CURATED') eclipseCount++;
      else if (p.source === 'GOOGLE_EARTH') googleEarthCount++;
      else if (p.source === 'GOOGLE_PLACES') googlePlacesCount++;
    }
    return {
      total: pandals.length,
      eclipseCount,
      googleEarthCount,
      googlePlacesCount,
    };
  }, [pandals]);

  const searchPandals = useCallback(
    async (query: string): Promise<DiscoveredPandal[]> => {
      return pandalIntelligenceProvider.search(query, userLocation, viewport);
    },
    [userLocation, viewport]
  );

  return {
    isPandalVisible,
    pandals,
    clusteredItems,
    isLoading,
    emptyMessage,
    lastError,
    sourceStats,
    refresh: fetchPandalsForViewport,
    searchPandals,
  };
}
