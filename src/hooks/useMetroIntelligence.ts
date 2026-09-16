/**
 * Eclipse GPS — useMetroIntelligence Hook (Phase 13.3)
 * 
 * Reactive hook connecting MetroIntelligenceProvider to React Map Views:
 * - Synchronizes Kolkata Metro station records when METRO layer is toggled.
 * - Viewport-aware queries as map pans/zooms.
 * - Exposes search and retrieval methods for Copilot and UI Cards.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { MetroStation, MetroLineCategory } from '../types/metro';
import { Location } from '../types';
import { useIntelligenceGrid } from './useIntelligenceGrid';
import { metroIntelligenceProvider } from '../services/intelligence/metroIntelligenceProvider';

export function useMetroIntelligence(userLocation?: Location) {
  const { isLayerVisible, viewport, layers } = useIntelligenceGrid();
  const isMetroVisible = isLayerVisible('METRO');
  const metroLayer = layers.METRO;

  const [activeLineFilter, setActiveLineFilterState] = useState<MetroLineCategory>(() =>
    metroIntelligenceProvider.getLineFilter()
  );

  const [metroStations, setMetroStations] = useState<MetroStation[]>(() =>
    isMetroVisible ? metroIntelligenceProvider.getData() : []
  );
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(metroLayer?.loading));
  const [lastError, setLastError] = useState<string | undefined>();

  const debounceTimerRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);

  // Update user location in provider
  useEffect(() => {
    if (userLocation) {
      metroIntelligenceProvider.setUserLocation(userLocation);
    }
  }, [userLocation]);

  const fetchMetroForViewport = useCallback(async () => {
    if (!isMetroVisible) {
      setMetroStations([]);
      return;
    }

    setIsLoading(true);
    try {
      const results = await metroIntelligenceProvider.load(
        {
          north: viewport.north,
          south: viewport.south,
          east: viewport.east,
          west: viewport.west,
        },
        viewport.zoom,
        userLocation
      );

      if (isMountedRef.current) {
        setMetroStations(results);
        setLastError(undefined);
        setIsLoading(false);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setLastError(err?.message || 'Failed to load Metro stations');
        setIsLoading(false);
      }
    }
  }, [
    isMetroVisible,
    viewport.north,
    viewport.south,
    viewport.east,
    viewport.west,
    viewport.zoom,
    userLocation,
  ]);

  // Subscribe to line filter changes
  useEffect(() => {
    const unsubscribe = metroIntelligenceProvider.subscribeLineFilter((newFilter) => {
      setActiveLineFilterState(newFilter);
      fetchMetroForViewport();
    });
    return unsubscribe;
  }, [fetchMetroForViewport]);

  const setLineFilter = useCallback((filter: MetroLineCategory) => {
    metroIntelligenceProvider.setLineFilter(filter);
  }, []);

  // Debounced viewport and visibility effect
  useEffect(() => {
    isMountedRef.current = true;

    if (!isMetroVisible) {
      setMetroStations([]);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchMetroForViewport();
    }, 200);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isMetroVisible, fetchMetroForViewport]);

  // Cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    metroStations,
    isMetroVisible,
    isLoading,
    lastError,
    activeLineFilter,
    setLineFilter,
    lineCounts: metroIntelligenceProvider.getLineCounts(),
    refresh: fetchMetroForViewport,
  };
}
