import React, { useEffect, useRef, useState } from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { CrowdBadge } from '../../components/ui/CrowdBadge';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { Navigation, Play, Plus, Check, Star, CornerDownRight, Locate, Camera, Map as MapIcon, Layers, Sun, Users, Compass } from 'lucide-react';
import { isFirebaseConfigured } from '../../services/firebase';
import { getPandalCrowdMetrics } from '../../utils/crowdUtils';
import { intelligenceGridStore } from '../../services/intelligence/intelligenceGridStore';
import { useIntelligenceGrid } from '../../hooks/useIntelligenceGrid';
import { usePandalIntelligence } from '../../hooks/usePandalIntelligence';
import { useBonediBariIntelligence } from '../../hooks/useBonediBariIntelligence';
import { useMetroIntelligence } from '../../hooks/useMetroIntelligence';
import { intelligenceLayerService } from '../../services/intelligence/intelligenceLayerService';
import { PandalIntelligenceCard } from './PandalIntelligenceCard';
import { BonediBariIntelligenceCard } from './BonediBariIntelligenceCard';
import { MetroIntelligenceCard } from './MetroIntelligenceCard';
import { PandalEmptyStateBanner } from './PandalEmptyStateBanner';
import { PandalCoverageBadge } from './PandalCoverageBadge';
import { LiveNavigationHUD } from '../navigation/LiveNavigationHUD';
import { RouteAlternativesBar } from '../navigation/RouteAlternativesBar';
import { crowdIntelligenceService } from '../../services/intelligence/crowdIntelligenceService';
import { trafficIntelligenceService } from '../../services/intelligence/trafficIntelligenceService';
import { clusterMarkers } from '../../utils/markerCluster';

export const GoogleMapView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const streetViewRef = useRef<HTMLDivElement>(null);
  
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const altPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const gpsMarkerRef = useRef<google.maps.Marker | null>(null);
  const gpsAccuracyCircleRef = useRef<google.maps.Circle | null>(null);
  const streetViewPanoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const groupMarkersRef = useRef<google.maps.Marker[]>([]);
  const friendMarkersRef = useRef<google.maps.Marker[]>([]);
  const crowdCirclesRef = useRef<google.maps.Circle[]>([]);
  const trafficPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const trafficMarkersRef = useRef<google.maps.Marker[]>([]);
  const metroGateObjectsRef = useRef<{ markers: google.maps.Marker[]; polylines: google.maps.Polyline[] }>({ markers: [], polylines: [] });

  const {
    currentLocation,
    gpsAccuracy,
    gpsStatus,
    pandals,
    events,
    searchResults,
    setMapRef,
    selectedItem,
    setSelectedItem,
    activeRoute,
    selectAlternativeRoute,
    isNavigating,
    setIsNavigating,
    currentStepIndex,
    setCurrentStepIndex,
    routeStops,
    addStop,
    calculateRouteToItem,
    isSaved,
    saveLocation,
    unsaveLocation,
    toggleVisited,
    visitedIds,
    triggerOffRouteReroute,
    rerouteSuggestion,
    setRerouteSuggestion,
    mapProvider,
    setMapProvider,
    activeGroup,
    friendsList,
    friendsLocations,
    userId,
    pandalCrowdCounts,
    pandalCrowdTrends,
    mapStyle,
    setMapStyle,
    setMapCenter,
    isLostInCrowdActive,
    activeMetroGateIntelligence,
    setActiveMetroGateIntelligence,
  } = useAppState();

  const [activeInstruction, setActiveInstruction] = useState<any>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(14);
  const { isLayerVisible, layerVisibility } = useIntelligenceGrid();
  const {
    isPandalVisible,
    pandals: intelligencePandals,
    clusteredItems,
    isLoading: isPandalLoading,
    emptyMessage: pandalEmptyMessage,
  } = usePandalIntelligence(currentLocation);
  const {
    bonediBaris,
    isBonediBariVisible,
    isLoading: isBonediBariLoading,
  } = useBonediBariIntelligence(currentLocation);
  const {
    metroStations,
    isMetroVisible,
    isLoading: isMetroLoading,
  } = useMetroIntelligence(currentLocation);

  // Keep intelligence layer item counts synchronized
  useEffect(() => {
    intelligenceLayerService.updateItemCount('METRO', metroStations.length);
  }, [metroStations.length]);

  useEffect(() => {
    const activeCrowd = crowdIntelligenceService.getAllCrowdItems(pandals, pandalCrowdCounts, pandalCrowdTrends)
      .filter(c => c.crowdLevel !== 'UNAVAILABLE').length;
    intelligenceLayerService.updateItemCount('CROWD', activeCrowd);
  }, [pandals.length, pandalCrowdCounts, pandalCrowdTrends]);

  useEffect(() => {
    intelligenceLayerService.updateItemCount('TRAFFIC', trafficIntelligenceService.getAllCorridors().length);
  }, []);
  const [googleLoaded, setGoogleLoaded] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<boolean>(false);

  // Map settings
  const [showTraffic, setShowTraffic] = useState<boolean>(true);
  const [showStreetView, setShowStreetView] = useState<boolean>(false);
  const [is3DSupported, setIs3DSupported] = useState<boolean>(true);
  const [lockToHeading, setLockToHeading] = useState<boolean>(true);
  const [svAvailabilityMsg, setSvAvailabilityMsg] = useState<string | null>(null);

  const cleanValue = (val: string | undefined): string => {
    if (!val) return '';
    return val.replace(/^["']|["']$/g, '').trim();
  };

  const apiKey = cleanValue(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  const mapId = cleanValue(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID);

  // Load Google Maps Script
  useEffect(() => {
    if (!apiKey) {
      setLoadError('Google Maps API key is missing.');
      return;
    }

    // Intercept Google Maps Authentication Failures (Invalid API Key, Billing, etc.)
    const originalAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      console.warn('Google Maps authentication failed (InvalidKeyMapError). Falling back to Leaflet Map Engine.');
      setAuthError(true);
      setMapProvider('leaflet');
      if (originalAuthFailure) {
        try {
          originalAuthFailure();
        } catch (e) {}
      }
    };

    try {
      setOptions({
        key: apiKey,
        v: 'weekly',
        mapIds: mapId ? [mapId] : [],
      });

      // Import the core maps library to trigger script load
      importLibrary('maps')
        .then(() => {
          setGoogleLoaded(true);
        })
        .catch((err: any) => {
          console.error('Google Maps SDK loading failed:', err);
          setLoadError('Failed to load Google Maps SDK.');
          setMapProvider('leaflet');
        });
    } catch (err: any) {
      console.error('Error configuring Google Maps SDK Loader:', err);
      setLoadError('Failed to load Google Maps SDK.');
      setMapProvider('leaflet');
    }

    return () => {
      (window as any).gm_authFailure = originalAuthFailure;
    };
  }, [apiKey]);

  // Initialize Map Instance
  useEffect(() => {
    if (!googleLoaded || !containerRef.current || mapInstanceRef.current) return;

    try {
      const initialMapTypeId = mapStyle === 'satellite' ? 'satellite' : mapStyle === 'hybrid' ? 'hybrid' : 'roadmap';
      const initialCenter = currentLocation
        ? { lat: currentLocation.lat, lng: currentLocation.lng }
        : { lat: 22.5697, lng: 88.3639 };
      const mapOptions: google.maps.MapOptions = {
        center: initialCenter,
        zoom: 14,
        mapTypeId: initialMapTypeId,
        mapId: mapId,
        tilt: mapStyle === '3d' ? 55 : 0,
        heading: 0,
        disableDefaultUI: true, // Custom HUD overlays
        gestureHandling: 'greedy',
      };

      const map = new google.maps.Map(containerRef.current, {
        ...mapOptions,
        // Force vector rendering features for buildings to support genuine 3D perspectives
        renderingType: 'VECTOR' as any,
      });

      mapInstanceRef.current = map;

      // Track map center and update intelligence viewport on pan / zoom
      map.addListener('idle', () => {
        const center = map.getCenter();
        if (center) {
          setMapCenter({ lat: center.lat(), lng: center.lng() });
        }
        const bounds = map.getBounds();
        const zoom = map.getZoom() || 14;
        setCurrentZoom(zoom);
        if (bounds) {
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          intelligenceGridStore.setViewport({
            north: ne.lat(),
            south: sw.lat(),
            east: ne.lng(),
            west: sw.lng(),
            zoom,
          });
        }
      });

      // Add a map click listener to support tapping any supported location on the map
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          setSelectedItem({
            id: `pin-${lat.toFixed(5)}-${lng.toFixed(5)}`,
            name: 'Dropped Pin',
            address: `${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E`,
            location: { lat, lng },
            description: 'Tapped custom map location. Select View Street below to see real-world Street View imagery if available.'
          });
        }
      });

      // Inject custom abstraction into the global context
      setMapRef({
        setView: (coords: [number, number], zoom?: number) => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter({ lat: coords[0], lng: coords[1] });
            if (zoom !== undefined) {
              mapInstanceRef.current.setZoom(zoom);
            }
          }
        },
        fitBounds: (bounds: [[number, number], [number, number]]) => {
          if (mapInstanceRef.current && window.google?.maps) {
            const gBounds = new google.maps.LatLngBounds(
              { lat: bounds[0][0], lng: bounds[0][1] },
              { lat: bounds[1][0], lng: bounds[1][1] }
            );
            mapInstanceRef.current.fitBounds(gBounds);
          }
        }
      });

      // Bind Traffic Layer by default
      const traffic = new google.maps.TrafficLayer();
      trafficLayerRef.current = traffic;
      if (showTraffic) {
        traffic.setMap(map);
      }

      // Initialize Street View panel hidden
      if (streetViewRef.current) {
        const initialPos = currentLocation
          ? { lat: currentLocation.lat, lng: currentLocation.lng }
          : { lat: 22.5697, lng: 88.3639 };
        const panorama = new google.maps.StreetViewPanorama(streetViewRef.current, {
          position: initialPos,
          pov: { heading: 165, pitch: 0 },
          visible: false,
          disableDefaultUI: true,
        });
        streetViewPanoramaRef.current = panorama;
        map.setStreetView(panorama);
      }

    } catch (e) {
      console.error('Error creating Google Maps instance:', e);
      setLoadError('Error initializing Map View Canvas.');
    }

    return () => {
      // Clear references
      setMapRef(null);
      mapInstanceRef.current = null;
    };
  }, [googleLoaded]);

  // Sync Map Layout Toggles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (mapStyle === 'standard') {
      map.setMapTypeId('roadmap');
      map.setTilt(0);
      map.setHeading(0);
    } else if (mapStyle === 'satellite') {
      map.setMapTypeId('satellite');
      map.setTilt(0);
      map.setHeading(0);
    } else if (mapStyle === 'hybrid') {
      map.setMapTypeId('hybrid');
      map.setTilt(0);
      map.setHeading(0);
    } else if (mapStyle === '3d') {
      const isVector = map.getRenderingType() === 'VECTOR';
      const hasValidMapId = !!mapId;
      if (isVector && hasValidMapId) {
        map.setMapTypeId('roadmap');
        map.setTilt(55); // WebGL Vector perspective tilt
        setIs3DSupported(true);
      } else {
        // True 3D is not supported by current configuration; do not fake 3D view
        map.setMapTypeId('roadmap');
        map.setTilt(0);
        map.setHeading(0);
        setIs3DSupported(false);
        setMapStyle('standard');
      }
    }
  }, [mapStyle, googleLoaded, mapId]);

  // Sync Traffic Layer (Google native traffic + Eclipse festival corridors)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const traffic = trafficLayerRef.current;
    if (!map) return;

    // 1. Google Native Traffic Layer
    if (traffic) {
      if (showTraffic || isLayerVisible('TRAFFIC')) {
        traffic.setMap(map);
      } else {
        traffic.setMap(null);
      }
    }

    // 2. Clear old festival traffic corridor polylines and markers
    trafficPolylinesRef.current.forEach((p) => p.setMap(null));
    trafficPolylinesRef.current = [];
    trafficMarkersRef.current.forEach((m) => m.setMap(null));
    trafficMarkersRef.current = [];

    if (!isLayerVisible('TRAFFIC') || !window.google?.maps) return;

    // 3. Draw Eclipse Puja festival arterial corridors
    const corridors = trafficIntelligenceService.getAllCorridors();
    corridors.forEach((c) => {
      const isHeavy = c.status === 'CONGESTED' || c.status === 'HEAVY';
      const isModerate = c.status === 'SLOW' || c.status === 'MODERATE';
      const isClear = c.status === 'CLEAR';

      const color = isHeavy ? '#f43f5e' : isModerate ? '#f59e0b' : isClear ? '#10b981' : '#737373';
      const weight = isHeavy ? 7 : isModerate ? 6 : 5;
      const statusLabel = isHeavy ? 'Heavy' : isModerate ? 'Moderate' : isClear ? 'Clear' : 'Unavailable';

      if (c.polyPoints && c.polyPoints.length > 1) {
        const polyline = new google.maps.Polyline({
          path: c.polyPoints.map((p) => ({ lat: p.lat, lng: p.lng })),
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.85,
          strokeWeight: weight,
          map,
        });
        trafficPolylinesRef.current.push(polyline);
      }

      // Corridor advisory marker
      const delayText = c.estimatedDelayMinutes > 0 ? `+${c.estimatedDelayMinutes}m delay` : 'Clear Flow';
      const tMarker = new google.maps.Marker({
        position: { lat: c.location.lat, lng: c.location.lng },
        map,
        title: `${c.corridorName}: ${statusLabel} (${delayText})`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: '#000000',
          strokeWeight: 2,
        },
      });
      trafficMarkersRef.current.push(tMarker);
    });
  }, [showTraffic, isLayerVisible('TRAFFIC'), layerVisibility.TRAFFIC, googleLoaded]);

  // Sync Crowd Intelligence Layer (halos around pandals)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old crowd circles
    crowdCirclesRef.current.forEach((c) => c.setMap(null));
    crowdCirclesRef.current = [];

    if (!isLayerVisible('CROWD') || !window.google?.maps) return;

    const crowdItems = crowdIntelligenceService.getAllCrowdItems(
      pandals,
      pandalCrowdCounts,
      pandalCrowdTrends
    );

    crowdItems.forEach((item) => {
      if (item.crowdLevel === 'UNAVAILABLE') return;

      const radius = item.crowdLevel === 'EXTREME' ? 320 : item.crowdLevel === 'HEAVY' ? 260 : item.crowdLevel === 'HIGH' ? 200 : item.crowdLevel === 'MODERATE' ? 140 : 90;
      const color = item.crowdLevel === 'EXTREME' ? '#e11d48' : item.crowdLevel === 'HEAVY' ? '#f43f5e' : item.crowdLevel === 'HIGH' ? '#f97316' : item.crowdLevel === 'MODERATE' ? '#f59e0b' : '#10b981';
      const opacity = item.crowdLevel === 'EXTREME' ? 0.35 : item.crowdLevel === 'HEAVY' ? 0.28 : item.crowdLevel === 'HIGH' ? 0.22 : 0.16;

      const circle = new google.maps.Circle({
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: opacity,
        map,
        center: { lat: item.location.lat, lng: item.location.lng },
        radius,
      });

      crowdCirclesRef.current.push(circle);
    });
  }, [isLayerVisible('CROWD'), layerVisibility.CROWD, pandals, pandalCrowdCounts, pandalCrowdTrends, googleLoaded]);

  // Sync GPS Marker & Accuracy Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !currentLocation || !googleLoaded) return;

    const latLng = { lat: currentLocation.lat, lng: currentLocation.lng };

    // 1. Accuracy Circle
    if (gpsAccuracyCircleRef.current) {
      gpsAccuracyCircleRef.current.setMap(null);
    }
    if (gpsAccuracy && gpsAccuracy < 1500) {
      gpsAccuracyCircleRef.current = new google.maps.Circle({
        strokeColor: '#3b82f6',
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
        map,
        center: latLng,
        radius: gpsAccuracy,
      });
    }

    // 2. Pulse GPS marker
    if (gpsMarkerRef.current) {
      gpsMarkerRef.current.setMap(null);
    }

    // Embed glowing custom pulse HTML
    const pinAnchor = new google.maps.Point(12, 12);
    gpsMarkerRef.current = new google.maps.Marker({
      position: latLng,
      map,
      zIndex: 1000,
      icon: {
        url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="%233b82f6" fill-opacity="0.3"/><circle cx="12" cy="12" r="4" fill="%233b82f6" stroke="white" stroke-width="2"/></svg>',
        size: new google.maps.Size(24, 24),
        anchor: pinAnchor,
      }
    });

  }, [currentLocation, gpsAccuracy, googleLoaded]);

  // Sync Catalog Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !googleLoaded) return;

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const addMarker = (item: any, type: 'pandal' | 'event' | 'bonedi_bari' | 'metro' | 'search') => {
      let pinColorColor = '#10b981'; // Default green
      if (type === 'metro') {
        const lineStr = ((item.line || '') + ' ' + (item.lines || []).join(' ')).toLowerCase();
        if (lineStr.includes('green') || lineStr.includes('east-west')) {
          pinColorColor = '#059669'; // Green Line
        } else if (lineStr.includes('purple') || lineStr.includes('joka')) {
          pinColorColor = '#9333ea'; // Purple Line
        } else if (lineStr.includes('yellow') || lineStr.includes('airport')) {
          pinColorColor = '#d97706'; // Yellow Line
        } else {
          pinColorColor = '#2563eb'; // Blue Line
        }
      } else if (type === 'bonedi_bari') {
        pinColorColor = '#f59e0b'; // Amber heritage color
      } else if (type === 'pandal') {
        if (item.crowdLevel === 'EXTREME') pinColorColor = '#f43f5e'; // rose
        else if (item.crowdLevel === 'HEAVY') pinColorColor = '#f97316'; // orange
        else if (item.crowdLevel === 'MODERATE') pinColorColor = '#fbbf24'; // amber
        else pinColorColor = '#34d399'; // green
      } else if (type === 'event') {
        pinColorColor = '#6366f1'; // indigo
      }

      // Safe Unicode / SVG for custom map styling
      const pinSvg = type === 'metro'
        ? `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" fill="${encodeURIComponent(pinColorColor)}" stroke="%23ffffff" stroke-width="2.5"/><text x="18" y="23" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="900" fill="%23ffffff" text-anchor="middle">M</text></svg>`
        : `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="${encodeURIComponent(pinColorColor)}" stroke="black" stroke-width="2"/><circle cx="16" cy="16" r="4" fill="white"/></svg>`;

      const marker = new google.maps.Marker({
        position: { lat: item.location.lat, lng: item.location.lng },
        map,
        title: item.name,
        icon: {
          url: pinSvg,
          size: new google.maps.Size(36, 36),
          anchor: new google.maps.Point(18, 18),
        }
      });

      marker.addListener('click', () => {
        setSelectedItem(item);
      });

      markersRef.current.push(marker);
    };

    const searchPandals: any[] = [];
    const searchNonPandals: any[] = [];

    if (searchResults.length > 0) {
      searchResults.forEach(res => {
        const isMetro = (res as any).line || (res as any).entrancesExits || res.type === 'metro';
        const isBonedi = (res as any).pujaSince || (res as any).family;
        const isPandal = !isMetro && !isBonedi && (res.type === 'pandal' || res.category === 'pandal' || (!res.type && res.location));
        if (isPandal) {
          searchPandals.push(res);
        } else {
          searchNonPandals.push(res);
        }
      });
    }

    // Render non-pandal search results directly
    searchNonPandals.forEach(res => {
      const isMetro = (res as any).line || (res as any).entrancesExits || res.type === 'metro';
      const markerType = isMetro
        ? 'metro'
        : ((res as any).pujaSince || (res as any).family ? 'bonedi_bari' : 'search');
      addMarker(res, markerType as any);
    });

    // Select pandals to render: search pandals if present, else AppState/Intelligence pandals when layer is visible
    const targetPandals = searchPandals.length > 0
      ? searchPandals
      : (isPandalVisible ? (pandals.length > 0 ? pandals : intelligencePandals) : []);

    if (targetPandals.length > 0) {
      const zoom = map.getZoom() || 14;
      const clustered = clusterMarkers(targetPandals, zoom, (p: any) => p.location);
      clustered.forEach(entry => {
        if (entry.isCluster) {
          const cluster = entry.cluster;
          const clusterSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="%23f59e0b" stroke="%230f172a" stroke-width="2.5"/><text x="18" y="22" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="900" fill="%230f172a" text-anchor="middle">${cluster.count}</text></svg>`;
          const clusterMarker = new google.maps.Marker({
            position: { lat: cluster.location.lat, lng: cluster.location.lng },
            map,
            title: `${cluster.count} Durga Puja Pandals (Click to zoom)`,
            zIndex: 50,
            icon: {
              url: clusterSvg,
              size: new google.maps.Size(36, 36),
              anchor: new google.maps.Point(18, 18),
            },
          });

          clusterMarker.addListener('click', () => {
            const currentZoomLevel = map.getZoom() || 13;
            map.setCenter({ lat: cluster.location.lat, lng: cluster.location.lng });
            map.setZoom(Math.min(17, currentZoomLevel + 2));
          });

          markersRef.current.push(clusterMarker);
        } else {
          addMarker(entry.item, 'pandal');
        }
      });
    }

    if (searchResults.length === 0) {
      if (isBonediBariVisible) {
        bonediBaris.forEach(b => addMarker(b, 'bonedi_bari'));
      }
      if (isMetroVisible) {
        metroStations.forEach(m => addMarker(m, 'metro'));
      }
      if (isLayerVisible('EVENTS')) {
        events.forEach(e => addMarker(e, 'event'));
      }
    }

  }, [currentZoom, pandals, searchResults, googleLoaded, isPandalVisible, isBonediBariVisible, isMetroVisible, bonediBaris, metroStations, events, visitedIds, layerVisibility.EVENTS, layerVisibility.METRO, intelligencePandals]);

  // Sync Group Markers (members + meeting point) on Google Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !googleLoaded) return;

    // Clear old group markers
    groupMarkersRef.current.forEach(m => m.setMap(null));
    groupMarkersRef.current = [];

    if (!activeGroup) return;

    // 1. Plot meeting point marker
    if (activeGroup.meetingPoint && activeGroup.meetingPoint.lat !== 0) {
      const mpSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="10" fill="%236366f1" stroke="white" stroke-width="2"/><polygon points="18,12 24,15 18,18" fill="white"/></svg>`;
      const mpMarker = new google.maps.Marker({
        position: { lat: activeGroup.meetingPoint.lat, lng: activeGroup.meetingPoint.lng },
        map,
        title: activeGroup.meetingPoint.name || 'Meeting Point',
        icon: {
          url: mpSvg,
          size: new google.maps.Size(36, 36),
          anchor: new google.maps.Point(18, 18),
        }
      });
      groupMarkersRef.current.push(mpMarker);
    }

    // 2. Plot group members
    activeGroup.members?.forEach((member: any) => {
      if (member.userId === userId) return; // Already plotted as GPS pulse
      if (!member.sharingEnabled || !member.latitude || !member.longitude) return;

      const memberSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="%2310b981" stroke="white" stroke-width="2"/><text x="16" y="20" font-family="sans-serif" font-size="10" font-weight="bold" fill="white" text-anchor="middle">${encodeURIComponent(member.displayName.slice(0, 2).toUpperCase())}</text></svg>`;
      const mMarker = new google.maps.Marker({
        position: { lat: member.latitude, lng: member.longitude },
        map,
        title: member.displayName,
        icon: {
          url: memberSvg,
          size: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 16),
        }
      });
      groupMarkersRef.current.push(mMarker);
    });

  }, [activeGroup, googleLoaded, userId]);

  // Sync Friend Markers on Google Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !googleLoaded) return;

    // Clear old friend markers
    friendMarkersRef.current.forEach(m => m.setMap(null));
    friendMarkersRef.current = [];

    if (isLostInCrowdActive) return;

    friendsList.forEach((friend) => {
      const loc = friendsLocations[friend.friendId];
      if (!loc || !loc.sharingEnabled) return;

      // Filter out stale locations (> 120 seconds old)
      const isStale = Date.now() - loc.timestamp > 120000;
      if (isStale) return;

      const friendSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" fill="%2310b981" stroke="white" stroke-width="2"/><text x="18" y="22" font-family="sans-serif" font-size="10" font-weight="bold" fill="white" text-anchor="middle">${encodeURIComponent(friend.friendName.slice(0, 2).toUpperCase())}</text></svg>`;

      const fMarker = new google.maps.Marker({
        position: { lat: loc.lat, lng: loc.lng },
        map,
        title: `🟢 Friend: ${friend.friendName}`,
        icon: {
          url: friendSvg,
          size: new google.maps.Size(36, 36),
          anchor: new google.maps.Point(18, 18),
        }
      });
      friendMarkersRef.current.push(fMarker);
    });

  }, [friendsList, friendsLocations, googleLoaded, isLostInCrowdActive]);

  // Render OSRM Polyline Path and Alternatives on Google Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !googleLoaded) return;

    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }

    altPolylinesRef.current.forEach(p => p.setMap(null));
    altPolylinesRef.current = [];

    if (!activeRoute || activeRoute.geometry.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    // 1. Render alternative routes (dashed style, lower opacity, tap-to-select)
    if (activeRoute.alternatives && activeRoute.alternatives.length > 0) {
      activeRoute.alternatives.forEach((altRoute) => {
        if (!altRoute.geometry || altRoute.geometry.length === 0) return;
        const altCoords = altRoute.geometry.map(pt => ({ lat: pt.lat, lng: pt.lng }));
        altCoords.forEach(c => bounds.extend(c));

        const altPolyline = new google.maps.Polyline({
          path: altCoords,
          geodesic: true,
          strokeColor: '#94a3b8',
          strokeOpacity: 0.75,
          strokeWeight: 5,
          zIndex: 5,
          map: map,
        });

        altPolyline.addListener('click', () => {
          selectAlternativeRoute(altRoute);
        });

        altPolylinesRef.current.push(altPolyline);
      });
    }

    // 2. Render primary active route
    const pathCoordinates = activeRoute.geometry.map(pt => ({
      lat: pt.lat,
      lng: pt.lng,
    }));
    pathCoordinates.forEach(coord => bounds.extend(coord));

    const polyline = new google.maps.Polyline({
      path: pathCoordinates,
      geodesic: true,
      strokeColor: '#6366f1',
      strokeOpacity: 0.85,
      strokeWeight: 6,
      zIndex: 10,
      map: map,
    });

    routePolylineRef.current = polyline;

    // Smooth camera boundary fit
    map.fitBounds(bounds, {
      top: 100,
      bottom: 100,
      left: 60,
      right: 60,
    });

  }, [activeRoute, selectAlternativeRoute, googleLoaded]);

  // Metro Gate Intelligence Layer: Station, Exit Gates, Recommended Gate, Walking Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !googleLoaded) return;

    // Clear previous gate markers and polylines
    metroGateObjectsRef.current.markers.forEach((m) => m.setMap(null));
    metroGateObjectsRef.current.polylines.forEach((p) => p.setMap(null));
    metroGateObjectsRef.current = { markers: [], polylines: [] };

    if (!activeMetroGateIntelligence || !activeMetroGateIntelligence.hasVerifiedGates) {
      return;
    }

    const { station, targetPandal, allGateRoutes, recommendedGate, activeGateRoute } = activeMetroGateIntelligence;
    const currentRoute = activeGateRoute || recommendedGate;
    const bounds = new google.maps.LatLngBounds();

    // 1. Station Marker
    const stationLoc = { lat: station.location.lat, lng: station.location.lng };
    bounds.extend(stationLoc);
    const stationSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="%232563eb" stroke="%23ffffff" stroke-width="2.5"/><text x="18" y="23" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="900" fill="%23ffffff" text-anchor="middle">M</text></svg>`;
    const stationMarker = new google.maps.Marker({
      position: stationLoc,
      map,
      title: `${station.name} Metro Station (${station.line})`,
      zIndex: 800,
      icon: {
        url: stationSvg,
        scaledSize: new google.maps.Size(36, 36),
        anchor: new google.maps.Point(18, 18),
      },
    });
    metroGateObjectsRef.current.markers.push(stationMarker);

    // 2. Gate Markers
    allGateRoutes.forEach((gateOpt) => {
      const isRecommended = gateOpt.isRecommended;
      const isCurrentActive = currentRoute && currentRoute.gate.gateNumber === gateOpt.gate.gateNumber;
      const gateLat = gateOpt.gate.latitude ?? gateOpt.gate.location?.lat ?? station.location.lat;
      const gateLng = gateOpt.gate.longitude ?? gateOpt.gate.location?.lng ?? station.location.lng;
      const gatePos = { lat: gateLat, lng: gateLng };
      bounds.extend(gatePos);

      const gateSvg = isRecommended
        ? `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%2310b981" stroke="%23ffffff" stroke-width="3"/><text x="20" y="26" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="900" fill="%23ffffff" text-anchor="middle">🚪</text></svg>`
        : isCurrentActive
        ? `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34"><circle cx="17" cy="17" r="15" fill="%230284c7" stroke="%23ffffff" stroke-width="2.5"/><text x="17" y="22" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="900" fill="%23ffffff" text-anchor="middle">🚪</text></svg>`
        : `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="13" fill="%231e293b" stroke="%2394a3b8" stroke-width="2"/><text x="15" y="19" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold" fill="%23cbd5e1" text-anchor="middle">${encodeURIComponent(gateOpt.gate.gateNumber.replace(/Gate\s*/i, 'G'))}</text></svg>`;

      const gateMarker = new google.maps.Marker({
        position: gatePos,
        map,
        title: `${isRecommended ? 'RECOMMENDED EXIT: ' : ''}${gateOpt.gate.gateNumber} (${gateOpt.walkingDistanceFormatted} • ${gateOpt.walkingTimeFormatted})`,
        zIndex: isRecommended ? 950 : 850,
        icon: {
          url: gateSvg,
          scaledSize: isRecommended ? new google.maps.Size(40, 40) : new google.maps.Size(30, 30),
          anchor: isRecommended ? new google.maps.Point(20, 20) : new google.maps.Point(15, 15),
        },
      });

      gateMarker.addListener('click', () => {
        setActiveMetroGateIntelligence({
          ...activeMetroGateIntelligence,
          activeGateRoute: gateOpt,
        });
      });

      metroGateObjectsRef.current.markers.push(gateMarker);
    });

    // 3. Walking Route Polyline
    if (currentRoute && currentRoute.geometry && currentRoute.geometry.length > 0) {
      const pathCoordinates = currentRoute.geometry.map((pt) => {
        bounds.extend(pt);
        return { lat: pt.lat, lng: pt.lng };
      });

      const walkingPolyline = new google.maps.Polyline({
        path: pathCoordinates,
        geodesic: true,
        strokeColor: '#10b981',
        strokeOpacity: 0.95,
        strokeWeight: 5,
        zIndex: 900,
        map,
      });

      metroGateObjectsRef.current.polylines.push(walkingPolyline);
    }

    // 4. Target Pandal Marker
    const pandalLat = (targetPandal as any).location?.lat ?? (targetPandal as any).latitude;
    const pandalLng = (targetPandal as any).location?.lng ?? (targetPandal as any).longitude;
    const pandalPos = { lat: pandalLat, lng: pandalLng };
    bounds.extend(pandalPos);

    const pandalSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="%23f59e0b" stroke="%23ffffff" stroke-width="2.5"/><text x="18" y="24" font-family="system-ui, -apple-system, sans-serif" font-size="16" text-anchor="middle">🛕</text></svg>`;
    const pandalMarker = new google.maps.Marker({
      position: pandalPos,
      map,
      title: `${targetPandal.name} (Destination Pandal)`,
      zIndex: 920,
      icon: {
        url: pandalSvg,
        scaledSize: new google.maps.Size(36, 36),
        anchor: new google.maps.Point(18, 18),
      },
    });
    metroGateObjectsRef.current.markers.push(pandalMarker);

    // 5. Fit bounds to comfortably display station, all gates, route, and pandal
    try {
      map.fitBounds(bounds, {
        top: 80,
        bottom: 80,
        left: 60,
        right: 60,
      });
    } catch (e) {
      console.warn('[GoogleMapView] Error fitting bounds to metro gate intelligence:', e);
    }
  }, [activeMetroGateIntelligence, googleLoaded]);

  // Sync selectedItem focus view
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedItem) return;

    map.panTo({ lat: selectedItem.location.lat, lng: selectedItem.location.lng });
    map.setZoom(16);

    // Sync Street View Panorama center if open
    const panorama = streetViewPanoramaRef.current;
    if (panorama && showStreetView) {
      panorama.setPosition({ lat: selectedItem.location.lat, lng: selectedItem.location.lng });
    }
  }, [selectedItem]);

  // Turn-by-Turn GPS HUD Tracking with immersive tilt perspective rotation
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (isNavigating && activeRoute && activeRoute.instructions.length > 0) {
      const idx = Math.min(currentStepIndex, activeRoute.instructions.length - 1);
      setActiveInstruction(activeRoute.instructions[idx]);

      if (lockToHeading && currentLocation) {
        // Move camera close to current location
        map.panTo({ lat: currentLocation.lat, lng: currentLocation.lng });

        if (mapStyle === '3d') {
          map.setZoom(18);
          map.setTilt(55);
        } else {
          map.setZoom(16);
          map.setTilt(0);
          map.setHeading(0);
        }

        // Rotate camera heading dynamically in 3D Mode for ultimate navigation realism!
        if (mapStyle === '3d' && activeRoute.geometry.length > 1) {
          const nextCoordIndex = Math.min(currentStepIndex + 1, activeRoute.geometry.length - 1);
          const currentCoord = currentLocation;
          const nextCoord = activeRoute.geometry[nextCoordIndex];

          // Math formula to calculate compass heading between coordinates
          if (currentCoord && nextCoord) {
            const dy = nextCoord.lat - currentCoord.lat;
            const dx = Math.cos((currentCoord.lat * Math.PI) / 180) * (nextCoord.lng - currentCoord.lng);
            let headingAngle = (Math.atan2(dx, dy) * 180) / Math.PI;
            if (headingAngle < 0) headingAngle += 360;
            
            map.setHeading(headingAngle);
          }
        } else {
          map.setHeading(0); // Restore default north if not in 3D
        }
      }
    } else {
      setActiveInstruction(null);
      if (mapStyle !== '3d') {
        map.setHeading(0); // Restore default north
      }
    }
  }, [isNavigating, activeRoute, currentStepIndex, currentLocation, mapStyle, lockToHeading]);

  // Toggle Favorite
  const handleToggleFav = (item: any) => {
    if (isSaved(item.id)) {
      unsaveLocation(item.id);
    } else {
      saveLocation(item);
    }
  };

  const handleOpenStreetView = () => {
    if (!selectedItem) return;
    const svService = new google.maps.StreetViewService();
    const latLng = { lat: selectedItem.location.lat, lng: selectedItem.location.lng };
    
    setSvAvailabilityMsg("Checking imagery...");
    
    svService.getPanorama({ location: latLng, radius: 100 }, (data, status) => {
      if (status === google.maps.StreetViewStatus.OK && data && data.location) {
        setSvAvailabilityMsg(null);
        setShowStreetView(true);
        const panorama = streetViewPanoramaRef.current;
        if (panorama) {
          panorama.setPosition(latLng);
        }
      } else {
        setSvAvailabilityMsg("Street View unavailable at this location");
        setTimeout(() => setSvAvailabilityMsg(null), 3500);
      }
    });
  };

  // Sync Street View Visibilities
  useEffect(() => {
    const panorama = streetViewPanoramaRef.current;
    if (!panorama) return;

    if (showStreetView) {
      panorama.setVisible(true);
      if (selectedItem) {
        panorama.setPosition({ lat: selectedItem.location.lat, lng: selectedItem.location.lng });
      } else if (currentLocation) {
        panorama.setPosition({ lat: currentLocation.lat, lng: currentLocation.lng });
      }
    } else {
      panorama.setVisible(false);
    }
  }, [showStreetView]);

  if (loadError || authError) {
    return (
      <div className="absolute inset-0 z-0 flex flex-col items-center justify-center bg-neutral-950 p-6 text-center space-y-5 animate-fade-in">
        <div className="p-1 px-3 bg-rose-500/10 border border-rose-500/20 rounded-full text-[10px] font-bold text-rose-400 uppercase tracking-widest animate-pulse">
          Authentication Refused
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-neutral-100">Google Maps Loading Failure</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
            {loadError || "The provided Google Maps API key or configuration was rejected by the service (InvalidKeyMapError)."}
          </p>
        </div>
        
        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-2xl max-w-sm space-y-3 shadow-2xl">
          <p className="text-[11px] text-neutral-500 leading-normal">
            You can run the application immediately with our secondary high-performance navigation map layer.
          </p>
          <button
            onClick={() => setMapProvider('leaflet')}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold tracking-wider text-xs rounded-xl uppercase transition-all duration-200 shadow-lg shadow-indigo-600/15"
          >
            Switch to Leaflet Map Engine
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full z-0 flex flex-col md:flex-row">
      {/* 1. Main interactive WebGL Google Map */}
      <div ref={containerRef} className="flex-1 h-full w-full" />

      {/* 2. Embedded Authentic Street View Layer (Split View HUD) */}
      {showStreetView && (
        <div 
          ref={streetViewRef} 
          className="absolute inset-x-0 top-20 h-48 z-10 border-b border-neutral-800 bg-black md:relative md:inset-auto md:h-full md:w-96 md:border-b-0 md:border-l md:border-neutral-900" 
        />
      )}

      {/* 3. Layer / Map Settings Controller HUD */}
      <div className="absolute top-36 left-4 z-10 flex flex-col space-y-2 max-w-[170px]">
        <GlassPanel className="p-2 flex flex-col space-y-2 border border-neutral-800/80 shadow-2xl">
          {/* Traffic Switcher */}
          <div className="flex flex-col space-y-1 pt-1">
            <button
              onClick={() => setShowTraffic(!showTraffic)}
              className={`w-full text-center py-1 text-[8px] font-bold rounded-lg uppercase tracking-wider ${
                showTraffic ? 'bg-indigo-900/40 border border-indigo-700/60 text-indigo-300' : 'bg-neutral-950 text-neutral-500'
              }`}
            >
              Traffic Overlay: {showTraffic ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Street View Toggle Button */}
          <div className="flex flex-col space-y-1 border-t border-neutral-800/40 pt-2">
            <button
              id="btn-toggle-streetview"
              onClick={() => setShowStreetView(!showStreetView)}
              className={`w-full flex items-center justify-center space-x-1 py-1 text-[8px] font-bold rounded-lg uppercase tracking-wider ${
                showStreetView ? 'bg-rose-900/40 border border-rose-700/60 text-rose-300' : 'bg-neutral-950 text-neutral-400'
              }`}
            >
              <Camera size={9} />
              <span>Street View: {showStreetView ? 'OPEN' : 'CLOSE'}</span>
            </button>
          </div>
        </GlassPanel>
      </div>

      {/* 4. Google Maps Default Camera Controls */}
      <div className="absolute top-24 right-4 z-10 flex flex-col space-y-2">
        <button
          onClick={() => mapInstanceRef.current?.setZoom((mapInstanceRef.current.getZoom() || 14) + 1)}
          className="w-10 h-10 flex items-center justify-center bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-xl text-neutral-300 hover:text-neutral-100 shadow-xl text-base font-bold transition-colors"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={() => mapInstanceRef.current?.setZoom((mapInstanceRef.current.getZoom() || 14) - 1)}
          className="w-10 h-10 flex items-center justify-center bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-xl text-neutral-300 hover:text-neutral-100 shadow-xl text-base font-bold transition-colors"
          title="Zoom Out"
        >
          -
        </button>

        {/* Locate Me */}
        <button
          onClick={() => {
            if (mapInstanceRef.current && currentLocation) {
              mapInstanceRef.current.panTo({ lat: currentLocation.lat, lng: currentLocation.lng });
              mapInstanceRef.current.setZoom(16);
            }
          }}
          className="w-10 h-10 flex items-center justify-center bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-xl text-neutral-300 hover:text-neutral-100 shadow-xl transition-colors"
          title="Center on Current GPS Location"
        >
          <Locate size={15} />
        </button>

        {/* Reset North / Compass */}
        <button
          onClick={() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setHeading(0);
            }
          }}
          className="w-10 h-10 flex items-center justify-center bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-xl text-neutral-300 hover:text-neutral-100 shadow-xl transition-colors text-xs font-bold font-mono tracking-wider"
          title="Reset Camera to Face True North"
        >
          N
        </button>

        {/* Heading Lock Toggle (Visible when navigating) */}
        {isNavigating && (
          <button
            onClick={() => setLockToHeading(!lockToHeading)}
            className={`w-10 h-10 flex flex-col items-center justify-center backdrop-blur-md border rounded-xl shadow-xl transition-all duration-300 ${
              lockToHeading
                ? 'bg-indigo-600/90 border-indigo-500 text-white'
                : 'bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
            title={lockToHeading ? "Tracking Lock on travel direction" : "Free Look mode active"}
          >
            <Compass size={14} />
            <span className="text-[6px] font-black tracking-tighter uppercase mt-0.5">
              {lockToHeading ? 'LOCK' : 'FREE'}
            </span>
          </button>
        )}
      </div>

      {/* 5. Navigation Active Dashboard HUD */}
      {isNavigating && activeRoute && (
        <div className="absolute top-24 left-4 right-4 z-10 max-w-md mx-auto pointer-events-auto space-y-2">
          <LiveNavigationHUD />
          {activeRoute.alternatives && activeRoute.alternatives.length > 0 && (
            <RouteAlternativesBar />
          )}
        </div>
      )}

      {/* Route Preview Alternatives (when route is calculated but before active navigation is started) */}
      {!isNavigating && activeRoute && activeRoute.alternatives && activeRoute.alternatives.length > 0 && (
        <div className="absolute top-24 left-4 right-4 z-10 max-w-md mx-auto pointer-events-auto">
          <RouteAlternativesBar />
        </div>
      )}

      {/* Pandal Coverage Badge (Requirement 8) */}
      {isPandalVisible && intelligencePandals.length > 0 && searchResults.length === 0 && (
        <div className="absolute top-20 left-4 z-10">
          <PandalCoverageBadge
            pandals={intelligencePandals}
            isLoading={isPandalLoading}
          />
        </div>
      )}

      {/* Pandal Empty State Banner (Requirement 10) */}
      {isPandalVisible && clusteredItems.length === 0 && !isPandalLoading && searchResults.length === 0 && (
        <div className="absolute top-20 left-4 z-10">
          <PandalEmptyStateBanner
            onRecenterKolkata={() => {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.setCenter({ lat: 22.5697, lng: 88.3639 });
                mapInstanceRef.current.setZoom(14);
              }
            }}
          />
        </div>
      )}

      {/* 6. Selected Item Drawer HUD */}
      {selectedItem && !isNavigating && (
        <div className="absolute bottom-24 left-4 right-4 z-10 max-w-md mx-auto">
          {Boolean((selectedItem as any).line || (selectedItem as any).nearbyPandalIds) ? (
            <MetroIntelligenceCard
              metroStation={selectedItem as any}
              currentLocation={currentLocation}
              onClose={() => setSelectedItem(null)}
              onShowOnMap={(loc) => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.setCenter({ lat: loc.lat, lng: loc.lng });
                  mapInstanceRef.current.setZoom(16);
                }
              }}
              onNavigateToStation={async (station) => {
                await calculateRouteToItem(station);
                setIsNavigating(true);
                setCurrentStepIndex(0);
              }}
              onNavigateToPuja={async (_station, item) => {
                await calculateRouteToItem(item);
                setIsNavigating(true);
                setCurrentStepIndex(0);
              }}
              onAddStop={(item) => addStop(item)}
            />
          ) : Boolean((selectedItem as any).pujaSince || (selectedItem as any).family) ? (
            <BonediBariIntelligenceCard
              bonediBari={selectedItem as any}
              currentLocation={currentLocation}
              onClose={() => setSelectedItem(null)}
              onShowOnMap={(b) => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.setCenter({ lat: b.location.lat, lng: b.location.lng });
                  mapInstanceRef.current.setZoom(16);
                }
              }}
              onNavigate={async () => {
                setIsNavigating(true);
                setCurrentStepIndex(0);
              }}
              onAddStop={(b) => addStop(b)}
              isFavorite={isSaved(selectedItem.id)}
              onToggleFavorite={() => handleToggleFav(selectedItem)}
              isVisited={visitedIds.includes(selectedItem.id)}
              onToggleVisited={() => toggleVisited(selectedItem.id)}
            />
          ) : Boolean((selectedItem as any).source || (selectedItem as any).theme || (selectedItem as any).zone || (selectedItem as any).address || (selectedItem as any).area || (selectedItem as any).sourceId) ? (
            <PandalIntelligenceCard
              pandal={selectedItem}
              currentLocation={currentLocation}
              onClose={() => setSelectedItem(null)}
              onShowOnMap={(p) => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.setCenter({ lat: p.location.lat, lng: p.location.lng });
                  mapInstanceRef.current.setZoom(16);
                }
              }}
              onNavigate={async () => {
                setIsNavigating(true);
                setCurrentStepIndex(0);
              }}
              onAddStop={(p) => addStop(p)}
              isFavorite={isSaved(selectedItem.id)}
              onToggleFavorite={() => handleToggleFav(selectedItem)}
              isVisited={visitedIds.includes(selectedItem.id)}
              onToggleVisited={() => toggleVisited(selectedItem.id)}
            />
          ) : (
            <GlassPanel className="p-4 transition-all duration-300">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] tracking-widest font-bold text-indigo-400 uppercase">
                      Google Maps Place
                    </span>
                    {selectedItem.crowdLevel && <CrowdBadge level={selectedItem.crowdLevel} />}
                  </div>
                  <h4 className="text-base font-bold text-neutral-100 truncate mt-1">{selectedItem.name}</h4>
                  <p className="text-xs text-neutral-400 mt-1 truncate">{selectedItem.address}</p>
                </div>
                <button
                  onClick={() => handleToggleFav(selectedItem)}
                  className="p-2 rounded-xl border border-neutral-800/80 bg-neutral-900/60 text-neutral-400 hover:text-rose-500 hover:border-rose-500/30 transition-colors"
                >
                  <Star size={16} fill={isSaved(selectedItem.id) ? '#ef4444' : 'none'} className={isSaved(selectedItem.id) ? 'text-rose-500' : ''} />
                </button>
              </div>

              {selectedItem.description && (
                <p className="text-[11px] text-neutral-400 mt-3 leading-relaxed border-t border-neutral-800/40 pt-2 line-clamp-2">
                  {selectedItem.description}
                </p>
              )}

              <div className="flex items-center space-x-2 mt-4">
                <button
                  onClick={() => {
                    setIsNavigating(true);
                    setCurrentStepIndex(0);
                  }}
                  className="flex-1 flex items-center justify-center space-x-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold tracking-wider text-xs rounded-xl transition-colors uppercase"
                >
                  <Navigation size={13} className="fill-white" />
                  <span>Navigate</span>
                </button>
                
                <button
                  onClick={handleOpenStreetView}
                  className="flex items-center justify-center space-x-2 py-2 px-3 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-rose-400 hover:border-rose-500/30 font-bold tracking-wider text-xs rounded-xl transition-colors uppercase"
                  title="View Street level imagery"
                >
                  <Camera size={13} />
                  <span>View Street</span>
                </button>

                <button
                  onClick={() => addStop(selectedItem)}
                  className="flex items-center justify-center space-x-2 py-2 px-3 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white font-bold tracking-wider text-xs rounded-xl transition-colors uppercase"
                >
                  <Plus size={13} />
                  <span>Add Stop</span>
                </button>
              </div>
            </GlassPanel>
          )}
        </div>
      )}
    </div>
  );
};
