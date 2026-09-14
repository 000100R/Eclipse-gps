import React, { useEffect, useRef, useState } from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { CrowdBadge } from '../../components/ui/CrowdBadge';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { Navigation, Play, Plus, Check, Star, CornerDownRight, Locate, Camera, Map as MapIcon, Layers, Sun, Users, Compass } from 'lucide-react';
import { isFirebaseConfigured } from '../../services/firebase';
import { getPandalCrowdMetrics } from '../../utils/crowdUtils';

export const GoogleMapView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const streetViewRef = useRef<HTMLDivElement>(null);
  
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const gpsMarkerRef = useRef<google.maps.Marker | null>(null);
  const gpsAccuracyCircleRef = useRef<google.maps.Circle | null>(null);
  const streetViewPanoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const groupMarkersRef = useRef<google.maps.Marker[]>([]);
  const friendMarkersRef = useRef<google.maps.Marker[]>([]);

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
  } = useAppState();

  const [activeInstruction, setActiveInstruction] = useState<any>(null);
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
      const mapOptions: google.maps.MapOptions = {
        center: { lat: currentLocation.lat, lng: currentLocation.lng },
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

      // Track map center on pan
      map.addListener('idle', () => {
        const center = map.getCenter();
        if (center) {
          setMapCenter({ lat: center.lat(), lng: center.lng() });
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
        const panorama = new google.maps.StreetViewPanorama(streetViewRef.current, {
          position: { lat: currentLocation.lat, lng: currentLocation.lng },
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
      map.setMapTypeId('roadmap');
      map.setTilt(55); // WebGL Vector perspective tilt

      // Wait a frame and check vector capability
      setTimeout(() => {
        if (mapInstanceRef.current) {
          const isVector = mapInstanceRef.current.getRenderingType() === 'VECTOR';
          const hasMapId = !!mapId;
          if (!isVector || !hasMapId) {
            setIs3DSupported(false);
          } else {
            setIs3DSupported(true);
          }
        }
      }, 500);
    }
  }, [mapStyle, googleLoaded, mapId]);

  // Sync Traffic Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    const traffic = trafficLayerRef.current;
    if (!map || !traffic) return;

    if (showTraffic) {
      traffic.setMap(map);
    } else {
      traffic.setMap(null);
    }
  }, [showTraffic]);

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

    const addMarker = (item: any, type: 'pandal' | 'event' | 'search') => {
      let pinColorColor = '#10b981'; // Default green
      if (type === 'pandal') {
        if (item.crowdLevel === 'EXTREME') pinColorColor = '#f43f5e'; // rose
        else if (item.crowdLevel === 'HEAVY') pinColorColor = '#f97316'; // orange
        else if (item.crowdLevel === 'MODERATE') pinColorColor = '#fbbf24'; // amber
        else pinColorColor = '#34d399'; // green
      } else if (type === 'event') {
        pinColorColor = '#6366f1'; // indigo
      }

      // Safe Unicode Dot for custom map styling
      const pinSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="${encodeURIComponent(pinColorColor)}" stroke="black" stroke-width="2"/><circle cx="16" cy="16" r="4" fill="white"/></svg>`;

      const marker = new google.maps.Marker({
        position: { lat: item.location.lat, lng: item.location.lng },
        map,
        title: item.name,
        icon: {
          url: pinSvg,
          size: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 16),
        }
      });

      marker.addListener('click', () => {
        setSelectedItem(item);
      });

      markersRef.current.push(marker);
    };

    if (searchResults.length > 0) {
      searchResults.forEach(res => addMarker(res, res.type === 'pandal' ? 'pandal' : 'search'));
    } else {
      pandals.forEach(p => addMarker(p, 'pandal'));
      events.forEach(e => addMarker(e, 'event'));
    }

  }, [pandals, events, searchResults, googleLoaded]);

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

  // Render OSRM Polyline Path on Google Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !googleLoaded) return;

    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }

    if (!activeRoute || activeRoute.geometry.length === 0) return;

    const pathCoordinates = activeRoute.geometry.map(pt => ({
      lat: pt.lat,
      lng: pt.lng,
    }));

    const polyline = new google.maps.Polyline({
      path: pathCoordinates,
      geodesic: true,
      strokeColor: '#6366f1',
      strokeOpacity: 0.85,
      strokeWeight: 6,
      map: map,
    });

    routePolylineRef.current = polyline;

    // Smooth camera boundary fit
    const bounds = new google.maps.LatLngBounds();
    pathCoordinates.forEach(coord => bounds.extend(coord));
    map.fitBounds(bounds, {
      top: 100,
      bottom: 100,
      left: 60,
      right: 60,
    });

  }, [activeRoute, googleLoaded]);

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

      if (lockToHeading) {
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
      } else {
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
      {isNavigating && activeInstruction && (
        <div className="absolute top-24 left-4 right-4 z-10 max-w-md mx-auto">
          <GlassPanel className="p-4 border-l-4 border-l-indigo-500 shadow-2xl animate-fade-in">
            <div className="flex items-start space-x-3">
              <CornerDownRight className="text-indigo-400 mt-1 stroke-[2.5]" size={20} />
              <div className="flex-1">
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Active Navigation HUD (3D Vector)</p>
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

      {/* 6. Selected Item Drawer HUD */}
      {selectedItem && !isNavigating && (
        <div className="absolute bottom-24 left-4 right-4 z-10 max-w-md mx-auto">
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

            {svAvailabilityMsg && (
              <div className="mt-2.5 p-2 bg-neutral-950/80 text-rose-400 border border-rose-500/20 text-[10px] rounded-lg text-center font-bold tracking-wider uppercase animate-pulse">
                {svAvailabilityMsg}
              </div>
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
              <button
                onClick={() => toggleVisited(selectedItem.id)}
                className={`p-2 rounded-xl border transition-colors ${
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
