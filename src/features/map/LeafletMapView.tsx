import React, { useEffect, useRef, useState } from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { CrowdBadge } from '../../components/ui/CrowdBadge';
import { Navigation, Play, Plus, Check, Star, CornerDownRight, Locate, HelpCircle, Users, Compass } from 'lucide-react';
import { isFirebaseConfigured } from '../../services/firebase';
import { getPandalCrowdMetrics } from '../../utils/crowdUtils';
import { intelligenceGridStore } from '../../services/intelligence/intelligenceGridStore';
import { intelligenceLayerService } from '../../services/intelligence/intelligenceLayerService';
import { useIntelligenceGrid } from '../../hooks/useIntelligenceGrid';
import { usePandalIntelligence } from '../../hooks/usePandalIntelligence';
import { useBonediBariIntelligence } from '../../hooks/useBonediBariIntelligence';
import { useMetroIntelligence } from '../../hooks/useMetroIntelligence';
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
import L from 'leaflet';

export const LeafletMapView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const activeTilesRef = useRef<L.Layer[]>([]);
  const markersGroupRef = useRef<L.FeatureGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const gpsMarkerRef = useRef<L.Marker | null>(null);
  const gpsAccuracyCircleRef = useRef<L.Circle | null>(null);
  const groupMarkersRef = useRef<L.LayerGroup | null>(null);
  const friendMarkersRef = useRef<L.LayerGroup | null>(null);
  const crowdLayerRef = useRef<L.LayerGroup | null>(null);
  const trafficLayerRef = useRef<L.LayerGroup | null>(null);
  const metroGateLayerRef = useRef<L.LayerGroup | null>(null);

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
  } = usePandalIntelligence(currentLocation || undefined);
  const {
    bonediBaris,
    isBonediBariVisible,
    isLoading: isBonediBariLoading,
  } = useBonediBariIntelligence(currentLocation || undefined);
  const {
    metroStations,
    isMetroVisible,
    isLoading: isMetroLoading,
  } = useMetroIntelligence(currentLocation || undefined);

  // Keep intelligence layer item counts synchronized
  useEffect(() => {
    intelligenceLayerService.updateItemCount('PANDALS', intelligencePandals.length || pandals.length);
  }, [intelligencePandals.length, pandals.length]);

  useEffect(() => {
    intelligenceLayerService.updateItemCount('BONEDI_BARI', bonediBaris.length);
  }, [bonediBaris.length]);

  useEffect(() => {
    intelligenceLayerService.updateItemCount('METRO', metroStations.length);
  }, [metroStations.length]);

  useEffect(() => {
    intelligenceLayerService.updateItemCount('EVENTS', events.length);
  }, [events.length]);

  useEffect(() => {
    const activeCrowd = crowdIntelligenceService.getAllCrowdItems(pandals, pandalCrowdCounts, pandalCrowdTrends)
      .filter(c => c.crowdLevel !== 'UNAVAILABLE').length;
    intelligenceLayerService.updateItemCount('CROWD', activeCrowd);
  }, [pandals.length, pandalCrowdCounts, pandalCrowdTrends]);

  useEffect(() => {
    intelligenceLayerService.updateItemCount('TRAFFIC', trafficIntelligenceService.getAllCorridors().length);
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return;

    // 100% free OpenStreetMap tiles with custom dark theme filter applied via CSS
    const darkTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      className: 'map-tiles-dark'
    });

    const initialCenter: [number, number] = currentLocation
      ? [currentLocation.lat, currentLocation.lng]
      : [22.5697, 88.3639];

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: 14,
      zoomControl: false,
    });

    mapInstanceRef.current = map;

    // Update Intelligence Grid viewport bounds & zoom
    const updateViewport = () => {
      try {
        const bounds = map.getBounds();
        intelligenceGridStore.setViewport({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
          zoom: map.getZoom(),
        });
      } catch (e) {
        // Bounds may not be ready immediately on first tick
      }
    };

    updateViewport();

    // Track map center and viewport on pan / move
    map.on('moveend', () => {
      const center = map.getCenter();
      setMapCenter({ lat: center.lat, lng: center.lng });
      updateViewport();
    });

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
      updateViewport();
    });
    
    // Abstract the setView into our AppState mapRef
    setMapRef({
      setView: (coords: [number, number], zoom?: number) => {
        map.setView(coords, zoom || map.getZoom());
      },
      fitBounds: (bounds: [[number, number], [number, number]], options?: any) => {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, ...options });
      },
    });

    // Feature group to hold active catalog markers
    const markersGroup = L.featureGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    // Layer group to hold live group safety markers
    const groupMarkers = L.layerGroup().addTo(map);
    groupMarkersRef.current = groupMarkers;

    // Layer group to hold live friend location markers
    const friendMarkers = L.layerGroup().addTo(map);
    friendMarkersRef.current = friendMarkers;

    // Layer group to hold crowd intensity circles and badges
    const crowdLayer = L.layerGroup().addTo(map);
    crowdLayerRef.current = crowdLayer;

    // Layer group to hold arterial traffic corridors and advisory markers
    const trafficLayer = L.layerGroup().addTo(map);
    trafficLayerRef.current = trafficLayer;

    // Layer group to hold Metro Gate Intelligence (station, exit gates, walking route)
    const metroGateLayer = L.layerGroup().addTo(map);
    metroGateLayerRef.current = metroGateLayer;

    // Resize observer handling
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      setMapRef(null);
    };
  }, []);

  // Dynamic MapStyle tile switcher (Standard, Satellite, Hybrid, 3D)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Clear any active tile layers
    activeTilesRef.current.forEach((layer) => {
      map.removeLayer(layer);
    });
    activeTilesRef.current = [];

    // 2. Create and add new layer(s) based on mapStyle
    const layersToAdd: L.Layer[] = [];

    if (mapStyle === 'standard') {
      const standardLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
        className: 'map-tiles-dark'
      });
      layersToAdd.push(standardLayer);
    } else if (mapStyle === 'satellite') {
      const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19
      });
      layersToAdd.push(satelliteLayer);
    } else if (mapStyle === 'hybrid') {
      const baseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
      });
      const labelLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CartoDB',
        maxZoom: 19
      });
      layersToAdd.push(baseLayer, labelLayer);
    } else if (mapStyle === '3d') {
      // 3D mode in Leaflet tilts the map container and overlays hybrid styling
      const hybridBase = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
      });
      const labelLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CartoDB',
        maxZoom: 19
      });
      layersToAdd.push(hybridBase, labelLayer);
    }

    // Add new layers to map and save references
    layersToAdd.forEach((layer) => {
      layer.addTo(map);
      activeTilesRef.current.push(layer);
    });

    // 3. Handle 3D Tilt CSS Transform
    if (mapStyle === '3d') {
      if (containerRef.current) {
        containerRef.current.style.transform = 'perspective(900px) rotateX(42deg) scale(1.18)';
        containerRef.current.style.transformOrigin = 'bottom center';
        containerRef.current.style.transition = 'transform 0.4s ease-out';
      }
    } else {
      if (containerRef.current) {
        containerRef.current.style.transform = 'none';
        containerRef.current.style.transition = 'transform 0.4s ease-out';
      }
    }
  }, [mapStyle, mapInstanceRef.current]);

  // Update User GPS Marker and Accuracy Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !currentLocation) return;

    // 1. Accuracy Circle
    if (gpsAccuracyCircleRef.current) {
      map.removeLayer(gpsAccuracyCircleRef.current);
    }
    if (gpsAccuracy && gpsAccuracy < 1500) {
      const circle = L.circle([currentLocation.lat, currentLocation.lng], {
        radius: gpsAccuracy,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
        weight: 1,
      }).addTo(map);
      gpsAccuracyCircleRef.current = circle;
    }

    // 2. Pulse GPS marker
    if (gpsMarkerRef.current) {
      map.removeLayer(gpsMarkerRef.current);
    }

    const gpsHtml = `
      <div class="relative flex items-center justify-center w-6 h-6">
        <div class="absolute w-5 h-5 bg-blue-500/30 rounded-full animate-ping"></div>
        <div class="absolute w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full shadow-lg shadow-blue-500/50"></div>
      </div>
    `;

    const gpsIcon = L.divIcon({
      html: gpsHtml,
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const marker = L.marker([currentLocation.lat, currentLocation.lng], {
      icon: gpsIcon,
      zIndexOffset: 1000,
    }).addTo(map);
    gpsMarkerRef.current = marker;

  }, [currentLocation, gpsAccuracy]);

  // Update Markers for Catalog items
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    // Custom marker icon drawer helper
    const addMarkerToGroup = (item: any, type: 'pandal' | 'event' | 'bonedi_bari' | 'metro' | 'search') => {
      let pinColor = 'bg-emerald-500 shadow-emerald-500/50';
      if (type === 'metro') {
        const lineStr = ((item.line || '') + ' ' + (item.lines || []).join(' ')).toLowerCase();
        if (lineStr.includes('green') || lineStr.includes('east-west')) {
          pinColor = 'bg-emerald-600 shadow-emerald-500/60 ring-2 ring-emerald-400';
        } else if (lineStr.includes('purple') || lineStr.includes('joka')) {
          pinColor = 'bg-purple-600 shadow-purple-500/60 ring-2 ring-purple-400';
        } else if (lineStr.includes('yellow') || lineStr.includes('airport')) {
          pinColor = 'bg-amber-500 shadow-amber-500/60 ring-2 ring-amber-400';
        } else {
          pinColor = 'bg-blue-600 shadow-blue-500/60 ring-2 ring-blue-400';
        }
      } else if (type === 'bonedi_bari') {
        pinColor = 'bg-amber-500 shadow-amber-500/50';
      } else if (type === 'pandal') {
        if (item.crowdLevel === 'EXTREME') pinColor = 'bg-rose-500 shadow-rose-500/50 animate-pulse';
        else if (item.crowdLevel === 'HEAVY') pinColor = 'bg-orange-500 shadow-orange-500/50';
        else if (item.crowdLevel === 'MODERATE') pinColor = 'bg-amber-400 shadow-amber-400/50';
        else pinColor = 'bg-emerald-400 shadow-emerald-400/50';
      } else if (type === 'event') {
        pinColor = 'bg-indigo-500 shadow-indigo-500/50';
      }

      const isVisited = visitedIds.includes(item.id);
      const isMetro = type === 'metro';

      const html = `
        <div class="relative flex flex-col items-center justify-center group pointer-events-auto">
          <!-- Text Label -->
          <div class="absolute -top-7 ${isMetro ? 'bg-blue-950/90 text-blue-200 border-blue-700/80' : 'bg-neutral-950/90 text-neutral-200 border-neutral-800/80'} text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-md whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none">
            ${isMetro ? '🚇 ' + item.name.replace(/metro/i, '').trim() : item.name.split(' ')[0]}
          </div>
          <!-- Pulse Dot / Icon -->
          <div class="w-5 h-5 rounded-full ${pinColor} border-2 border-neutral-950 flex items-center justify-center relative shadow-lg cursor-pointer text-[10px] text-white font-bold">
            ${isMetro ? 'M' : (isVisited ? '<div class="w-1.5 h-1.5 rounded-full bg-white"></div>' : '')}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([item.location.lat, item.location.lng], { icon });
      marker.on('click', () => {
        setSelectedItem(item);
      });
      markersGroup.addLayer(marker);
    };

    // Plot search results or default catalogs respecting Intelligence Grid layer visibility
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
      addMarkerToGroup(res, markerType as any);
    });

    // Select pandals to render: search pandals if present, else AppState/Intelligence pandals when layer is visible
    const targetPandals = searchPandals.length > 0
      ? searchPandals
      : (isPandalVisible ? (pandals.length > 0 ? pandals : intelligencePandals) : []);

    if (targetPandals.length > 0) {
      const zoom = map.getZoom();
      const clustered = clusterMarkers(targetPandals, zoom, (p: any) => p.location);
      clustered.forEach(entry => {
        if (entry.isCluster) {
          const cluster = entry.cluster;
          const clusterHtml = `
            <div class="relative flex items-center justify-center cursor-pointer group pointer-events-auto">
              <div class="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-extrabold flex items-center justify-center border-2 border-slate-950 shadow-xl shadow-amber-500/40 text-xs transition-transform group-hover:scale-110">
                ${cluster.count}
              </div>
              <div class="absolute -top-6 bg-slate-900/90 text-[10px] font-semibold text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                ${cluster.count} Pandals
              </div>
            </div>
          `;
          const clusterIcon = L.divIcon({
            html: clusterHtml,
            className: '',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });
          const clusterMarker = L.marker([cluster.location.lat, cluster.location.lng], { icon: clusterIcon });
          clusterMarker.on('click', () => {
            const z = map.getZoom();
            map.setView([cluster.location.lat, cluster.location.lng], Math.min(17, z + 2));
          });
          markersGroup.addLayer(clusterMarker);
        } else {
          addMarkerToGroup(entry.item, 'pandal');
        }
      });
    }

    if (searchResults.length === 0) {
      if (isBonediBariVisible) {
        bonediBaris.forEach(b => addMarkerToGroup(b, 'bonedi_bari'));
      }
      if (isMetroVisible) {
        metroStations.forEach(m => addMarkerToGroup(m, 'metro'));
      }
      if (isLayerVisible('EVENTS')) {
        events.forEach(e => addMarkerToGroup(e, 'event'));
      }
    }

  }, [currentZoom, pandals, searchResults, isPandalVisible, isBonediBariVisible, isMetroVisible, bonediBaris, metroStations, events, visitedIds, layerVisibility.EVENTS, layerVisibility.METRO, intelligencePandals]);

  // Render group members and meeting point on Leaflet Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const groupMarkers = groupMarkersRef.current;
    if (!map || !groupMarkers) return;

    groupMarkers.clearLayers();

    if (!activeGroup) return;

    // 1. Draw meeting point if set
    if (activeGroup.meetingPoint && activeGroup.meetingPoint.lat !== 0) {
      const mpHtml = `
        <div class="relative flex flex-col items-center justify-center">
          <div class="absolute -top-7 bg-indigo-900 text-[10px] font-bold text-white px-2 py-0.5 rounded-md border border-indigo-700 shadow-lg whitespace-nowrap">
            🚩 Meeting Point
          </div>
          <div class="w-5 h-5 rounded-full bg-indigo-500 border-2 border-neutral-950 flex items-center justify-center shadow-lg shadow-indigo-500/50">
            <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
          </div>
        </div>
      `;
      const mpIcon = L.divIcon({
        html: mpHtml,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      const mpMarker = L.marker([activeGroup.meetingPoint.lat, activeGroup.meetingPoint.lng], { icon: mpIcon });
      groupMarkers.addLayer(mpMarker);
    }

    // 2. Draw group members
    activeGroup.members?.forEach((member: any) => {
      // Don't draw ourselves since we have the main GPS pulse marker
      if (member.userId === userId) return;
      if (!member.sharingEnabled || !member.latitude || !member.longitude) return;

      const memberHtml = `
        <div class="relative flex flex-col items-center justify-center">
          <div class="absolute -top-7 bg-emerald-950/90 text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-800/80 shadow-md whitespace-nowrap">
            👥 ${member.displayName}
          </div>
          <div class="w-6 h-6 rounded-full bg-emerald-500 border-2 border-neutral-950 flex items-center justify-center shadow-lg shadow-emerald-500/50 font-bold text-white text-[10px]">
            ${member.displayName.slice(0, 2).toUpperCase()}
          </div>
        </div>
      `;
      const memberIcon = L.divIcon({
        html: memberHtml,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      const memberMarker = L.marker([member.latitude, member.longitude], { icon: memberIcon });
      groupMarkers.addLayer(memberMarker);
    });

  }, [activeGroup, userId]);

  // Draw live friend markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const friendMarkers = friendMarkersRef.current;
    if (!map || !friendMarkers) return;

    friendMarkers.clearLayers();
    if (isLostInCrowdActive) return;

    friendsList.forEach((friend) => {
      const loc = friendsLocations[friend.friendId];
      if (!loc || !loc.sharingEnabled) return;

      // Filter out stale locations (> 120 seconds old)
      const isStale = Date.now() - loc.timestamp > 120000;
      if (isStale) return;

      const friendHtml = `
        <div class="relative flex flex-col items-center justify-center">
          <div class="absolute w-12 h-12 rounded-full bg-emerald-500/20 animate-ping duration-1000"></div>
          <div class="absolute -top-7 bg-emerald-950/95 text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-800/80 shadow-md whitespace-nowrap z-[1000]">
            🟢 ${friend.friendName}
          </div>
          <div class="w-7 h-7 rounded-full bg-emerald-500 border-2 border-neutral-950 flex items-center justify-center shadow-lg shadow-emerald-500/50 font-bold text-white text-[10px] relative z-20">
            ${friend.friendName.slice(0, 2).toUpperCase()}
          </div>
        </div>
      `;

      const friendIcon = L.divIcon({
        html: friendHtml,
        className: '',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });

      const marker = L.marker([loc.lat, loc.lng], { icon: friendIcon });
      friendMarkers.addLayer(marker);
    });

  }, [friendsList, friendsLocations, isLostInCrowdActive]);

  // Draw Crowd Intelligence Layer (halos + status badges)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const crowdLayer = crowdLayerRef.current;
    if (!map || !crowdLayer) return;

    crowdLayer.clearLayers();
    if (!isLayerVisible('CROWD')) return;

    const crowdItems = crowdIntelligenceService.getAllCrowdItems(
      pandals,
      pandalCrowdCounts,
      pandalCrowdTrends
    );

    crowdItems.forEach((item) => {
      if (item.crowdLevel === 'UNAVAILABLE') return;

      const radius = item.crowdLevel === 'HEAVY' ? 260 : item.crowdLevel === 'HIGH' ? 200 : item.crowdLevel === 'MODERATE' ? 140 : 90;
      const color = item.crowdLevel === 'HEAVY' ? '#f43f5e' : item.crowdLevel === 'HIGH' ? '#f97316' : item.crowdLevel === 'MODERATE' ? '#f59e0b' : '#10b981';
      const opacity = item.crowdLevel === 'HEAVY' ? 0.28 : item.crowdLevel === 'HIGH' ? 0.22 : 0.16;

      // 1. Density circle halo
      const circle = L.circle([item.location.lat, item.location.lng], {
        radius,
        color,
        fillColor: color,
        fillOpacity: opacity,
        weight: item.crowdLevel === 'HEAVY' ? 2 : 1.5,
        interactive: false,
      });
      crowdLayer.addLayer(circle);

      // 2. Crowd HUD pill badge above pandal
      const trendSymbol = item.crowdTrend === 'RISING' ? '↑' : item.crowdTrend === 'FALLING' ? '↓' : '→';
      const badgeHtml = `
        <div class="relative flex flex-col items-center pointer-events-auto cursor-pointer" style="transform: translate(-50%, -100%);">
          <div class="px-2 py-0.5 rounded-full text-[9px] font-bold shadow-lg border flex items-center gap-1 whitespace-nowrap"
               style="background: rgba(10, 10, 15, 0.94); color: ${color}; border-color: ${color};">
            <span>👥 ${item.crowdLevel} ${trendSymbol}</span>
            <span class="text-[8px] opacity-75 font-mono">(${item.source})</span>
          </div>
        </div>
      `;
      const badgeIcon = L.divIcon({
        html: badgeHtml,
        className: '',
        iconSize: [0, 0],
      });
      const badgeMarker = L.marker([item.location.lat, item.location.lng], { icon: badgeIcon });
      badgeMarker.on('click', () => {
        const matched = pandals.find(p => p.id === item.pandalId);
        if (matched) setSelectedItem(matched);
      });
      crowdLayer.addLayer(badgeMarker);
    });
  }, [isLayerVisible('CROWD'), pandals, pandalCrowdCounts, pandalCrowdTrends, layerVisibility.CROWD]);

  // Draw Traffic Intelligence Layer (corridors + advisory markers)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const trafficLayer = trafficLayerRef.current;
    if (!map || !trafficLayer) return;

    trafficLayer.clearLayers();
    if (!isLayerVisible('TRAFFIC')) return;

    const corridors = trafficIntelligenceService.getAllCorridors();

    corridors.forEach((corridor) => {
      const color = corridor.status === 'CONGESTED' ? '#f43f5e' : corridor.status === 'SLOW' ? '#f59e0b' : '#10b981';
      const weight = corridor.status === 'CONGESTED' ? 7 : corridor.status === 'SLOW' ? 6 : 5;

      // 1. Draw corridor polyline if coordinates available
      if (corridor.polyPoints && corridor.polyPoints.length > 1) {
        const polyline = L.polyline(
          corridor.polyPoints.map(p => [p.lat, p.lng]),
          {
            color,
            weight,
            opacity: 0.85,
            dashArray: corridor.status === 'SLOW' ? '8, 6' : undefined,
          }
        );
        polyline.bindTooltip(
          `<strong>${corridor.corridorName}</strong><br/>Status: <b>${corridor.status}</b> (${corridor.estimatedDelayMinutes > 0 ? `+${corridor.estimatedDelayMinutes}m delay` : 'Flowing'})<br/>Advisory: ${corridor.alternativeRoute || 'Normal festival flow'}`,
          { sticky: true }
        );
        trafficLayer.addLayer(polyline);
      }

      // 2. Draw traffic advisory node marker
      const delayBadge = corridor.estimatedDelayMinutes > 0 ? `+${corridor.estimatedDelayMinutes}m` : 'Flowing';
      const markerHtml = `
        <div class="relative flex flex-col items-center pointer-events-auto cursor-pointer">
          <div class="px-2 py-0.5 rounded-md text-[10px] font-bold shadow-md border flex items-center gap-1 whitespace-nowrap"
               style="background: rgba(10, 10, 15, 0.95); color: ${color}; border-color: ${color};">
            <span>🚗 ${corridor.status}</span>
            <span class="font-mono text-[9px] opacity-80">${delayBadge}</span>
          </div>
        </div>
      `;
      const markerIcon = L.divIcon({
        html: markerHtml,
        className: '',
        iconSize: [60, 24],
        iconAnchor: [30, 12],
      });
      const tMarker = L.marker([corridor.location.lat, corridor.location.lng], { icon: markerIcon });
      tMarker.bindPopup(`
        <div style="color: #fff; font-size: 12px; max-width: 240px;">
          <h4 style="font-weight: bold; margin-bottom: 4px; color: ${color};">${corridor.corridorName}</h4>
          <p style="margin: 2px 0;">Road: ${corridor.affectedRoad}</p>
          <p style="margin: 2px 0;">Status: <b>${corridor.status}</b> (${delayBadge})</p>
          ${corridor.alternativeRoute ? `<p style="margin: 4px 0 0 0; color: #aaa; font-size: 11px;">Advisory: ${corridor.alternativeRoute}</p>` : ''}
          <div style="margin-top: 6px; font-size: 9px; color: #888;">Provenance: ${corridor.source} (${corridor.sourceLabel})</div>
        </div>
      `);
      trafficLayer.addLayer(tMarker);
    });
  }, [isLayerVisible('TRAFFIC'), layerVisibility.TRAFFIC]);

  // Metro Gate Intelligence Layer: Station, Exit Gates, Recommended Gate, Walking Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    const gateLayer = metroGateLayerRef.current;
    if (!map || !gateLayer) return;

    gateLayer.clearLayers();

    if (!activeMetroGateIntelligence || !activeMetroGateIntelligence.hasVerifiedGates) {
      return;
    }

    const { station, targetPandal, allGateRoutes, recommendedGate, activeGateRoute } = activeMetroGateIntelligence;
    const currentRoute = activeGateRoute || recommendedGate;
    const boundsPoints: [number, number][] = [];

    // 1. Station Marker
    const stationLoc = station.location;
    boundsPoints.push([stationLoc.lat, stationLoc.lng]);
    const stationIcon = L.divIcon({
      className: 'metro-station-marker',
      html: `
        <div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center;">
          <div style="background: rgba(3, 7, 18, 0.95); border: 1.5px solid #2563eb; color: #93c5fd; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); white-space: nowrap; margin-bottom: 4px;">
            🚇 ${station.name}
          </div>
          <div style="width: 32px; height: 32px; border-radius: 10px; background: #2563eb; border: 2.5px solid #ffffff; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 900; font-size: 14px; box-shadow: 0 0 16px rgba(37, 99, 235, 0.6);">
            M
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
    const stationMarker = L.marker([stationLoc.lat, stationLoc.lng], { icon: stationIcon, zIndexOffset: 800 });
    stationMarker.bindPopup(`<b>${station.name} Metro Station</b><br/>${station.line}`);
    gateLayer.addLayer(stationMarker);

    // 2. Gate Markers
    allGateRoutes.forEach((gateOpt) => {
      const isRecommended = gateOpt.isRecommended;
      const isCurrentActive = currentRoute && currentRoute.gate.gateNumber === gateOpt.gate.gateNumber;
      const gateLat = gateOpt.gate.latitude ?? gateOpt.gate.location?.lat ?? stationLoc.lat;
      const gateLng = gateOpt.gate.longitude ?? gateOpt.gate.location?.lng ?? stationLoc.lng;
      const gateCoords: [number, number] = [gateLat, gateLng];
      boundsPoints.push(gateCoords);

      const gateIcon = L.divIcon({
        className: 'metro-gate-marker',
        html: `
          <div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            ${
              isRecommended
                ? `<div style="background: #064e3b; border: 1.5px solid #10b981; color: #6ee7b7; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 9999px; box-shadow: 0 0 12px rgba(16, 185, 129, 0.6); white-space: nowrap; margin-bottom: 3px;">
                     ★ RECOMMENDED EXIT: ${gateOpt.gate.gateNumber}
                   </div>`
                : `<div style="background: rgba(15, 23, 42, 0.9); border: 1px solid #64748b; color: #cbd5e1; font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 9999px; white-space: nowrap; margin-bottom: 2px;">
                     ${gateOpt.gate.gateNumber}
                   </div>`
            }
            <div style="
              width: ${isRecommended ? '32px' : '26px'};
              height: ${isRecommended ? '32px' : '26px'};
              border-radius: 9999px;
              background: ${isRecommended ? '#10b981' : isCurrentActive ? '#0284c7' : '#1e293b'};
              border: ${isRecommended || isCurrentActive ? '2.5px solid #ffffff' : '2px solid #94a3b8'};
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: ${isRecommended ? '0 0 16px rgba(16, 185, 129, 0.8)' : '0 4px 8px rgba(0,0,0,0.4)'};
              font-size: ${isRecommended ? '14px' : '12px'};
            ">
              🚪
            </div>
            <div style="background: rgba(0,0,0,0.85); color: #e2e8f0; font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 4px; margin-top: 2px; white-space: nowrap;">
              ${gateOpt.walkingDistanceFormatted}
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      const gateMarker = L.marker(gateCoords, {
        icon: gateIcon,
        zIndexOffset: isRecommended ? 950 : 850,
      });

      gateMarker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
          <div style="font-weight: 800; font-size: 13px; color: ${isRecommended ? '#059669' : '#1e293b'};">
            ${isRecommended ? '★ ' : ''}${gateOpt.gate.gateNumber} ${gateOpt.gate.name ? `(${gateOpt.gate.name})` : ''}
          </div>
          ${gateOpt.gate.landmark ? `<div style="color: #64748b; font-size: 11px;">Towards ${gateOpt.gate.landmark}</div>` : ''}
          <div style="margin-top: 6px; padding: 4px 8px; background: #f1f5f9; border-radius: 6px; font-weight: 700;">
            🚶 ${gateOpt.walkingDistanceFormatted} • ${gateOpt.walkingTimeFormatted}
          </div>
        </div>
      `);

      gateMarker.on('click', () => {
        setActiveMetroGateIntelligence({
          ...activeMetroGateIntelligence,
          activeGateRoute: gateOpt,
        });
      });

      gateLayer.addLayer(gateMarker);
    });

    // 3. Walking Route Polyline from Recommended (or selected) Exit to Pandal
    if (currentRoute && currentRoute.geometry && currentRoute.geometry.length > 0) {
      const latlngs = currentRoute.geometry.map((p) => [p.lat, p.lng] as [number, number]);
      latlngs.forEach((coord) => boundsPoints.push(coord));

      // Dark emerald casing line
      const casing = L.polyline(latlngs, {
        color: '#064e3b',
        weight: 8,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round',
      });

      // Luminous neon emerald walking dashed route
      const walkingLine = L.polyline(latlngs, {
        color: '#10b981',
        weight: 4,
        opacity: 1,
        dashArray: '8, 8',
        lineCap: 'round',
        lineJoin: 'round',
      });

      walkingLine.bindTooltip(
        `<b>Exit ${currentRoute.gate.gateNumber} Walking Route</b><br/>${currentRoute.walkingDistanceFormatted} • ${currentRoute.walkingTimeFormatted}`,
        { sticky: true }
      );

      gateLayer.addLayer(casing);
      gateLayer.addLayer(walkingLine);
    }

    // 4. Target Pandal Marker
    const pandalLoc =
      'location' in targetPandal && targetPandal.location
        ? targetPandal.location
        : { lat: (targetPandal as any).latitude, lng: (targetPandal as any).longitude };
    boundsPoints.push([pandalLoc.lat, pandalLoc.lng]);

    const pandalIcon = L.divIcon({
      className: 'metro-target-pandal-marker',
      html: `
        <div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center;">
          <div style="background: rgba(3, 7, 18, 0.95); border: 1.5px solid #d97706; color: #fde68a; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); white-space: nowrap; margin-bottom: 4px;">
            🛕 ${targetPandal.name}
          </div>
          <div style="width: 32px; height: 32px; border-radius: 9999px; background: #f59e0b; border: 2.5px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 16px rgba(245, 158, 11, 0.7); font-size: 16px;">
            🛕
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    const pandalMarker = L.marker([pandalLoc.lat, pandalLoc.lng], {
      icon: pandalIcon,
      zIndexOffset: 900,
    });
    pandalMarker.bindPopup(`<b>${targetPandal.name}</b><br/>Destination Pandal`);
    gateLayer.addLayer(pandalMarker);

    // 5. Fit bounds to comfortably display station, all gates, route, and pandal
    if (boundsPoints.length > 1) {
      try {
        map.fitBounds(boundsPoints, {
          padding: [60, 60],
          maxZoom: 17,
        });
      } catch (e) {
        console.warn('[LeafletMapView] Error fitting bounds to metro gate intelligence:', e);
      }
    }
  }, [activeMetroGateIntelligence]);

  // Handle activeRoute Polyline Draw and flyBounds
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    if (!activeRoute || activeRoute.geometry.length === 0) return;

    const layers: L.Layer[] = [];

    // Draw alternative routes (behind primary route)
    if (activeRoute.alternatives && activeRoute.alternatives.length > 0) {
      activeRoute.alternatives.forEach((altRoute, idx) => {
        if (!altRoute.geometry || altRoute.geometry.length === 0) return;
        const altLatLngs = altRoute.geometry.map(pt => [pt.lat, pt.lng] as [number, number]);

        // Wider hit-area for easier tapping
        const hitArea = L.polyline(altLatLngs, {
          color: 'transparent',
          weight: 24,
          opacity: 0,
        });

        // Visible dashed alternative polyline
        const altPolyline = L.polyline(altLatLngs, {
          color: '#94a3b8',
          weight: 5,
          opacity: 0.75,
          dashArray: '6, 8',
          lineCap: 'round',
        });

        const distKm = altRoute.distance < 1000 
          ? `${Math.round(altRoute.distance)} m` 
          : `${(altRoute.distance / 1000).toFixed(1)} km`;
        const durMin = `${Math.max(1, Math.round(altRoute.duration / 60))} min`;

        altPolyline.bindTooltip(
          `<div style="font-family: inherit; font-size: 11px; font-weight: 600; padding: 2px 4px; color: #f1f5f9;">
            Alt ${idx + 1}: ${distKm} • ${durMin}<br/><span style="font-size: 9px; color: #94a3b8; font-weight: 400;">Tap to select route</span>
          </div>`,
          { sticky: true, className: 'leaflet-alt-tooltip' }
        );

        const onSelect = (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          selectAlternativeRoute(altRoute);
        };

        hitArea.on('click', onSelect);
        altPolyline.on('click', onSelect);

        layers.push(hitArea, altPolyline);
      });
    }

    const latlngs = activeRoute.geometry.map(pt => [pt.lat, pt.lng] as [number, number]);

    // Translucent path aura
    const backgroundPolyline = L.polyline(latlngs, {
      color: '#3b82f6',
      weight: 12,
      opacity: 0.2,
      lineCap: 'round',
    });

    // Glowing core path
    const polyline = L.polyline(latlngs, {
      color: '#6366f1',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
    });

    layers.push(backgroundPolyline, polyline);

    // Keep reference of polyline group
    const routeGroup = L.featureGroup(layers).addTo(map);
    routePolylineRef.current = routeGroup as any;

    // Fly bounds to fit whole route comfortably
    map.flyToBounds(routeGroup.getBounds(), {
      padding: [40, 40],
      maxZoom: 16,
    });

  }, [activeRoute, selectAlternativeRoute]);

  // Handle selectedItem focus panning
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedItem) return;
    map.setView([selectedItem.location.lat, selectedItem.location.lng], 16);
  }, [selectedItem]);

  // Navigate instructions tracker
  useEffect(() => {
    if (isNavigating && activeRoute && activeRoute.instructions.length > 0) {
      const idx = Math.min(currentStepIndex, activeRoute.instructions.length - 1);
      setActiveInstruction(activeRoute.instructions[idx]);

      const map = mapInstanceRef.current;
      if (map && currentLocation) {
        map.setView([currentLocation.lat, currentLocation.lng], 18);
      }
    } else {
      setActiveInstruction(null);
    }
  }, [isNavigating, activeRoute, currentStepIndex, currentLocation]);

  // Toggle Favorite
  const handleToggleFav = (item: any) => {
    if (isSaved(item.id)) {
      unsaveLocation(item.id);
    } else {
      saveLocation(item);
    }
  };

  // Smart Reroute Trigger Simulator (checks during drive)
  useEffect(() => {
    if (isNavigating && activeRoute && routeStops.length > 0) {
      const hasSreebhumi = routeStops.some(s => s.id === 'pandal-1');
      if (hasSreebhumi && !rerouteSuggestion) {
        const timer = setTimeout(() => {
          setRerouteSuggestion({
            show: true,
            originalId: 'pandal-1',
            reason: 'Eclipse GPS Traffic Engine: Sreebhumi Sporting Club has surged to EXTREME crowd levels. Entry delays exceed 1.5 hours.',
            replacementId: 'pandal-4',
            replacementName: 'Ballygunge Cultural Association',
          });
        }, 8000);
        return () => clearTimeout(timer);
      }
    }
  }, [isNavigating, activeRoute, routeStops, rerouteSuggestion]);

  return (
    <div className="absolute inset-0 w-full h-full z-0">
      <div ref={containerRef} className="w-full h-full" />

      {/* Floating Camera Controls HUD */}
      <div className="absolute top-24 right-4 z-10 flex flex-col space-y-2">
        {/* Zoom In */}
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className="w-10 h-10 flex items-center justify-center bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-xl text-neutral-300 hover:text-neutral-100 shadow-xl text-base font-bold transition-colors"
          title="Zoom In"
        >
          +
        </button>
        {/* Zoom Out */}
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className="w-10 h-10 flex items-center justify-center bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-xl text-neutral-300 hover:text-neutral-100 shadow-xl text-base font-bold transition-colors"
          title="Zoom Out"
        >
          -
        </button>

        {/* Locate Me */}
        <button
          onClick={() => {
            if (mapInstanceRef.current && currentLocation) {
              mapInstanceRef.current.setView([currentLocation.lat, currentLocation.lng], 16);
            }
          }}
          className="w-10 h-10 flex items-center justify-center bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-xl text-neutral-300 hover:text-neutral-100 shadow-xl transition-colors"
          title="Center on Current GPS Location"
        >
          <Locate size={15} />
        </button>
      </div>

      {/* GPS Status Indicator Overlay */}
      {gpsStatus === 'denied' && (
        <div className="absolute top-20 left-4 right-4 z-10 bg-rose-950/80 backdrop-blur-xs border border-rose-800/60 p-3 rounded-xl flex items-center justify-between text-rose-200">
          <p className="text-xs font-semibold">Location Denied. Operating in Kolkata Sandbox mode.</p>
          <button onClick={() => containerRef.current?.click()} className="text-[10px] bg-rose-900/60 hover:bg-rose-900 px-2 py-1 rounded-md uppercase font-bold tracking-wider">Dismiss</button>
        </div>
      )}

      {/* Navigation Active Dashboard HUD */}
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
              mapInstanceRef.current?.setView([22.5697, 88.3639], 14);
            }}
          />
        </div>
      )}

      {/* Selected Item Drawer HUD */}
      {selectedItem && !isNavigating && (
        <div className="absolute bottom-24 left-4 right-4 z-10 max-w-md mx-auto">
          {Boolean((selectedItem as any).line || (selectedItem as any).nearbyPandalIds) ? (
            <MetroIntelligenceCard
              metroStation={selectedItem as any}
              currentLocation={currentLocation}
              onClose={() => setSelectedItem(null)}
              onShowOnMap={(loc) => {
                mapInstanceRef.current?.setView([loc.lat, loc.lng], 16);
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
                mapInstanceRef.current?.setView([b.location.lat, b.location.lng], 16);
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
                mapInstanceRef.current?.setView([p.location.lat, p.location.lng], 16);
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
                    <span className="text-[10px] tracking-widest font-bold text-neutral-500 uppercase">
                      Event Venue
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

              <div className="flex items-center space-x-3 mt-4">
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
                  onClick={() => addStop(selectedItem)}
                  className="flex items-center justify-center space-x-2 py-2 px-4 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white font-bold tracking-wider text-xs rounded-xl transition-colors uppercase"
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
