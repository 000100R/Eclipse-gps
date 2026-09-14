import React, { useEffect, useRef, useState } from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { CrowdBadge } from '../../components/ui/CrowdBadge';
import { Navigation, Play, Plus, Check, Star, CornerDownRight, Locate, HelpCircle, Users, Compass } from 'lucide-react';
import { isFirebaseConfigured } from '../../services/firebase';
import { getPandalCrowdMetrics } from '../../utils/crowdUtils';
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
    isNavigating,
    setIsNavigating,
    currentStepIndex,
    setCurrentStepIndex,
    routeStops,
    addStop,
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
  } = useAppState();

  const [activeInstruction, setActiveInstruction] = useState<any>(null);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return;

    // 100% free OpenStreetMap tiles with custom dark theme filter applied via CSS
    const darkTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      className: 'map-tiles-dark'
    });

    const map = L.map(containerRef.current, {
      center: [currentLocation.lat, currentLocation.lng],
      zoom: 14,
      zoomControl: false,
    });

    mapInstanceRef.current = map;

    // Track map center on pan
    map.on('moveend', () => {
      const center = map.getCenter();
      setMapCenter({ lat: center.lat, lng: center.lng });
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
    const addMarkerToGroup = (item: any, type: 'pandal' | 'event' | 'search') => {
      let pinColor = 'bg-emerald-500 shadow-emerald-500/50';
      if (type === 'pandal') {
        if (item.crowdLevel === 'EXTREME') pinColor = 'bg-rose-500 shadow-rose-500/50 animate-pulse';
        else if (item.crowdLevel === 'HEAVY') pinColor = 'bg-orange-500 shadow-orange-500/50';
        else if (item.crowdLevel === 'MODERATE') pinColor = 'bg-amber-400 shadow-amber-400/50';
        else pinColor = 'bg-emerald-400 shadow-emerald-400/50';
      } else if (type === 'event') {
        pinColor = 'bg-indigo-500 shadow-indigo-500/50';
      }

      const isVisited = visitedIds.includes(item.id);

      const html = `
        <div class="relative flex flex-col items-center justify-center group pointer-events-auto">
          <!-- Text Label -->
          <div class="absolute -top-7 bg-neutral-950/90 text-[10px] font-bold text-neutral-200 px-2 py-0.5 rounded-md border border-neutral-800/80 shadow-md whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none">
            ${item.name.split(' ')[0]}
          </div>
          <!-- Pulse Dot -->
          <div class="w-4 h-4 rounded-full ${pinColor} border-2 border-neutral-950 flex items-center justify-center relative shadow-lg cursor-pointer">
            ${isVisited ? '<div class="w-1.5 h-1.5 rounded-full bg-white"></div>' : ''}
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

    // Plot search results or default catalogs
    if (searchResults.length > 0) {
      searchResults.forEach(res => addMarkerToGroup(res, res.type === 'pandal' ? 'pandal' : 'search'));
    } else {
      pandals.forEach(p => addMarkerToGroup(p, 'pandal'));
      events.forEach(e => addMarkerToGroup(e, 'event'));
    }

  }, [pandals, events, searchResults, visitedIds]);

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

  // Handle activeRoute Polyline Draw and flyBounds
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    if (!activeRoute || activeRoute.geometry.length === 0) return;

    const latlngs = activeRoute.geometry.map(pt => [pt.lat, pt.lng] as [number, number]);

    // Translucent path aura
    const backgroundPolyline = L.polyline(latlngs, {
      color: '#3b82f6',
      weight: 12,
      opacity: 0.2,
      lineCap: 'round',
    }).addTo(map);

    // Glowing core path
    const polyline = L.polyline(latlngs, {
      color: '#6366f1',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
    }).addTo(map);

    // Keep reference of polyline group
    const routeGroup = L.featureGroup([backgroundPolyline, polyline]).addTo(map);
    routePolylineRef.current = routeGroup as any;

    // Fly bounds to fit whole route comfortably
    map.flyToBounds(routeGroup.getBounds(), {
      padding: [40, 40],
      maxZoom: 16,
    });

  }, [activeRoute]);

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
      if (map) {
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
      {isNavigating && activeInstruction && (
        <div className="absolute top-24 left-4 right-4 z-10 max-w-md mx-auto">
          <GlassPanel className="p-4 border-l-4 border-l-indigo-500 shadow-2xl animate-fade-in">
            <div className="flex items-start space-x-3">
              <CornerDownRight className="text-indigo-400 mt-1 stroke-[2.5]" size={20} />
              <div className="flex-1">
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Next Instruction (2D Map)</p>
                <p className="text-sm font-semibold text-neutral-200 mt-0.5 leading-snug">{activeInstruction.text}</p>
                <div className="flex items-center space-x-3 mt-3 text-xs text-neutral-400">
                  <span>In {(activeInstruction.distance).toFixed(0)}m</span>
                  <span className="w-1 h-1 bg-neutral-700 rounded-full" />
                  <span>ETA: {Math.ceil(activeRoute!.duration / 60)} mins</span>
                  <span className="w-1 h-1 bg-neutral-700 rounded-full" />
                  <span>Remaining: {(activeRoute!.distance / 1000).toFixed(1)} km</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-800/40 mt-4 pt-3">
              <button
                id="btn-nav-step-forward"
                onClick={() => {
                  if (currentStepIndex < activeRoute!.instructions.length - 1) {
                    setCurrentStepIndex(currentStepIndex + 1);
                  } else {
                    setIsNavigating(false);
                    setSelectedItem(null);
                  }
                }}
                className="text-[11px] bg-indigo-600 hover:bg-indigo-500 font-bold tracking-wider text-white px-3 py-1.5 rounded-lg uppercase flex items-center space-x-1"
              >
                <span>Step Forward</span>
              </button>
              <button
                id="btn-nav-trigger-offroute"
                onClick={triggerOffRouteReroute}
                className="text-[11px] hover:bg-neutral-800 text-neutral-400 font-bold tracking-wider px-3 py-1.5 rounded-lg uppercase border border-neutral-800"
              >
                Reroute
              </button>
              <button
                id="btn-nav-stop"
                onClick={() => setIsNavigating(false)}
                className="text-[11px] bg-rose-950 hover:bg-rose-900 font-bold tracking-wider text-rose-200 px-3 py-1.5 rounded-lg uppercase"
              >
                Stop
              </button>
            </div>
          </GlassPanel>
        </div>
      )}

      {/* Selected Item Drawer HUD */}
      {selectedItem && !isNavigating && (
        <div className="absolute bottom-24 left-4 right-4 z-10 max-w-md mx-auto">
          <GlassPanel className="p-4 transition-all duration-300">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] tracking-widest font-bold text-neutral-500 uppercase">
                    {selectedItem.theme ? 'Durga Puja Pandal' : 'Event Venue'}
                  </span>
                  {selectedItem.crowdLevel && <CrowdBadge level={selectedItem.crowdLevel} />}
                </div>
                <h4 className="text-base font-bold text-neutral-100 truncate mt-1">{selectedItem.name}</h4>
                <p className="text-xs text-neutral-400 mt-1 truncate">{selectedItem.address}</p>
                {selectedItem.theme && (
                  <p className="text-xs text-indigo-400 mt-1 font-semibold italic">Theme: {selectedItem.theme}</p>
                )}
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

            {/* Live Crowd Intelligence Block */}
            {isFirebaseConfigured() && (
              <div className="mt-3 p-2.5 bg-neutral-950/60 rounded-xl border border-neutral-800/40 text-[11px] flex flex-col space-y-1">
                <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Users size={10} /> Live Crowd Intelligence
                </span>
                {(() => {
                  const metrics = getPandalCrowdMetrics(selectedItem.id, pandalCrowdCounts, pandalCrowdTrends);
                  if (!metrics.available) {
                    return <p className="text-neutral-500 italic mt-0.5">Live crowd data unavailable</p>;
                  }
                  return (
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-neutral-200 font-semibold">👥 {metrics.count} Eclipse users nearby</span>
                      <span className="flex items-center space-x-1.5">
                        <span className={`font-bold ${metrics.levelColorClass}`}>{metrics.levelLabel}</span>
                        <span className="text-neutral-400 font-semibold">• {metrics.trendLabel}</span>
                      </span>
                    </div>
                  );
                })()}
              </div>
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
              <button
                onClick={() => toggleVisited(selectedItem.id)}
                className={`p-2.5 rounded-xl border transition-colors ${
                  visitedIds.includes(selectedItem.id)
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Check size={14} className="stroke-[3]" />
              </button>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
};
