import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Location, Place, Event, Pandal, Route, SavedLocation, Alert, AIMessage } from '../types';
import { eventsService } from '../services/events/eventsService';
import { placesService } from '../services/places/placesService';
import { routingService } from '../services/routing/routingService';
import { alertService } from '../services/realtime/alertService';
import { ref, set, remove, onDisconnect, serverTimestamp, onValue, off } from 'firebase/database';
import { isFirebaseConfigured, getFirebaseDatabase } from '../services/firebase';

interface AppStateContextType {
  // GPS State
  currentLocation: Location;
  gpsAccuracy: number | null;
  gpsStatus: 'idle' | 'tracking' | 'error' | 'denied';
  gpsErrorMsg: string | null;
  watchLocation: boolean;
  setWatchLocation: (watch: boolean) => void;
  recenterMap: () => void;
  mapRef: any;
  setMapRef: (ref: any) => void;
  mapProvider: 'leaflet' | 'google';
  setMapProvider: (provider: 'leaflet' | 'google') => void;

  // Tabs / Navigation
  activeTab: 'home' | 'explore' | 'routes' | 'events' | 'saved' | 'group';
  setActiveTab: (tab: 'home' | 'explore' | 'routes' | 'events' | 'saved' | 'group') => void;

  // Data Catalogs
  pandals: Pandal[];
  events: Event[];
  refreshCatalogs: () => void;

  // Search & Filters
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: any[];
  isSearching: boolean;
  executeSearch: (q: string) => Promise<void>;
  selectedItem: Pandal | Event | null;
  setSelectedItem: (item: Pandal | Event | null) => void;

  // Routing State
  activeRoute: Route | null;
  setActiveRoute: (route: Route | null) => void;
  routeStops: (Pandal | Event)[];
  setRouteStops: React.Dispatch<React.SetStateAction<(Pandal | Event)[]>>;
  addStop: (item: Pandal | Event) => void;
  removeStop: (itemId: string) => void;
  reorderStops: (startIndex: number, endIndex: number) => void;
  optimizeRoute: () => Promise<void>;
  calculateRouteToItem: (item: Pandal | Event) => Promise<void>;
  routePreference: 'FASTEST' | 'SHORTEST' | 'LOW CROWD' | 'BALANCED' | 'WALKING' | 'DRIVING';
  setRoutePreference: (pref: 'FASTEST' | 'SHORTEST' | 'LOW CROWD' | 'BALANCED' | 'WALKING' | 'DRIVING') => void;

  // Turn-by-turn Navigation
  isNavigating: boolean;
  setIsNavigating: (nav: boolean) => void;
  currentStepIndex: number;
  setCurrentStepIndex: (idx: number) => void;
  triggerOffRouteReroute: () => Promise<void>;

  // Saved / Visited places
  savedLocations: SavedLocation[];
  saveLocation: (item: Pandal | Event | Route) => void;
  unsaveLocation: (itemId: string) => void;
  isSaved: (itemId: string) => boolean;
  visitedIds: string[];
  toggleVisited: (itemId: string) => void;

  // Alerts & Rerouting Dialogue
  alerts: Alert[];
  rerouteSuggestion: { show: boolean; originalId: string; reason?: string; replacementId?: string; replacementName?: string } | null;
  setRerouteSuggestion: React.Dispatch<React.SetStateAction<{ show: boolean; originalId: string; reason?: string; replacementId?: string; replacementName?: string } | null>>;
  acceptSmartReroute: () => Promise<void>;

  // AI Chat State
  messages: AIMessage[];
  isAiLoading: boolean;
  askEclipseAI: (prompt: string) => Promise<void>;
  isAiSheetOpen: boolean;
  setIsAiSheetOpen: (open: boolean) => void;

  // Eclipse Friends & Group Mode
  userId: string;
  displayName: string;
  setDisplayName: (name: string) => void;
  sharingLocation: boolean;
  setSharingLocation: (sharing: boolean) => void;
  activeGroup: any | null;
  createGroup: (name: string) => Promise<string>;
  joinGroup: (code: string) => Promise<boolean>;
  leaveGroup: () => Promise<void>;
  renameGroup: (name: string) => Promise<void>;
  endGroupSession: () => Promise<void>;
  updateMeetingPoint: (lat: number, lng: number, name?: string) => Promise<void>;
  speed: number;
  heading: number;
  helpImproveCrowd: boolean;
  setHelpImproveCrowd: (enabled: boolean) => void;
  pandalGeofenceMeters: number;
  setPandalGeofenceMeters: (meters: number) => void;
  pandalCrowdCounts: Record<string, number>;
  pandalCrowdTrends: Record<string, 'INCREASING' | 'STABLE' | 'DECREASING'>;
  mapStyle: 'standard' | 'satellite' | 'hybrid' | '3d';
  setMapStyle: (style: 'standard' | 'satellite' | 'hybrid' | '3d') => void;

  // Pandal Discovery 2.0 State
  discoveryRadius: number;
  setDiscoveryRadius: (radius: number) => void;
  discoverySort: 'recommended' | 'nearest' | 'fastest' | 'least_crowded';
  setDiscoverySort: (sort: 'recommended' | 'nearest' | 'fastest' | 'least_crowded') => void;
  discoveryCenter: Location;
  setDiscoveryCenter: (loc: Location) => void;
  mapCenter: Location | null;
  setMapCenter: (loc: Location | null) => void;
  isDiscovering: boolean;
  triggerDiscovery: () => void;
  submitUserPandal: (pandal: Partial<Pandal>) => void;
  userPandals: Pandal[];
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

// Default center of Kolkata, India (around Maidan / Park Street)
const KOLKATA_CENTER: Location = { lat: 22.5697, lng: 88.3639 };

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState<Location>(KOLKATA_CENTER);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'tracking' | 'error' | 'denied'>('idle');
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);
  const [watchLocation, setWatchLocation] = useState<boolean>(true);
  const [mapRef, setMapRefState] = useState<any>(null);
  const [mapProvider, setMapProvider] = useState<'leaflet' | 'google'>(() => {
    const cleanValue = (val: string | undefined): string => {
      if (!val) return '';
      return val.replace(/^["']|["']$/g, '').trim();
    };
    const key = cleanValue(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
    // Google Maps API keys strictly start with 'AIzaSy' and have a length greater than 20
    const isValidKey = key.startsWith('AIzaSy') && key.length > 20;
    return isValidKey ? 'google' : 'leaflet';
  });

  const [activeTab, setActiveTab] = useState<'home' | 'explore' | 'routes' | 'events' | 'saved' | 'group'>('home');

  const [pandals, setPandals] = useState<Pandal[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<Pandal | Event | null>(null);

  // Routing and Navigation States
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [routeStops, setRouteStops] = useState<(Pandal | Event)[]>([]);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  // Saved / Visited Lists
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [visitedIds, setVisitedIds] = useState<string[]>([]);

  // Alerts and Reroute Suggestions
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rerouteSuggestion, setRerouteSuggestion] = useState<{
    show: boolean;
    originalId: string;
    reason?: string;
    replacementId?: string;
    replacementName?: string;
  } | null>(null);

  // AI Chat States
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [isAiSheetOpen, setIsAiSheetOpen] = useState<boolean>(false);

  // Group & Preference States
  const [routePreference, setRoutePreference] = useState<'FASTEST' | 'SHORTEST' | 'LOW CROWD' | 'BALANCED' | 'WALKING' | 'DRIVING'>('BALANCED');
  
  const [userId, setUserId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    let id = localStorage.getItem('eclipse_gps_userId');
    if (!id) {
      id = 'user-' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('eclipse_gps_userId', id);
    }
    return id;
  });

  const [displayName, setDisplayNameState] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    let name = localStorage.getItem('eclipse_gps_displayName');
    if (!name) {
      name = 'Explorer ' + Math.floor(1000 + Math.random() * 9000);
      localStorage.setItem('eclipse_gps_displayName', name);
    }
    return name;
  });

  const [sharingLocation, setSharingLocation] = useState<boolean>(false); // Explicit opt-out!
  const [activeGroup, setActiveGroup] = useState<any | null>(null);
  const [speed, setSpeed] = useState<number>(0);
  const [heading, setHeading] = useState<number>(0);

  const [helpImproveCrowd, setHelpImproveCrowdState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('eclipse_gps_helpImproveCrowd');
    return saved === 'true';
  });

  const setHelpImproveCrowd = (enabled: boolean) => {
    setHelpImproveCrowdState(enabled);
    localStorage.setItem('eclipse_gps_helpImproveCrowd', String(enabled));
    if (enabled) {
      setWatchLocation(true);
    }
  };

  const [pandalGeofenceMeters, setPandalGeofenceMeters] = useState<number>(100);
  const [pandalCrowdCounts, setPandalCrowdCounts] = useState<Record<string, number>>({});
  const [pandalCrowdTrends, setPandalCrowdTrends] = useState<Record<string, 'INCREASING' | 'STABLE' | 'DECREASING'>>({});
  const prevCountsRef = useRef<Record<string, number>>({});
  const [mapStyle, setMapStyle] = useState<'standard' | 'satellite' | 'hybrid' | '3d'>('standard');

  // Pandal Discovery 2.0 State
  const [discoveryRadius, setDiscoveryRadius] = useState<number>(5);
  const [discoverySort, setDiscoverySort] = useState<'recommended' | 'nearest' | 'fastest' | 'least_crowded'>('recommended');
  const [discoveryCenter, setDiscoveryCenter] = useState<Location>(KOLKATA_CENTER);
  const [mapCenter, setMapCenter] = useState<Location | null>(null);
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [userPandals, setUserPandals] = useState<Pandal[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('eclipse_gps_user_pandals');
    return saved ? JSON.parse(saved) : [];
  });

  const lastDiscoveryCenterRef = useRef<Location>(KOLKATA_CENTER);

  // Core Nearby Pandal Discovery Engine
  const discoverNearbyPandals = async (center: Location, radiusKm: number, sortBy: string) => {
    setIsDiscovering(true);
    try {
      const radiusMeters = radiusKm * 1000;
      const discovered: Pandal[] = [];

      // 1. Fetch from Local Eclipse Database (demoPandals)
      const localPandals = eventsService.getPandals(); // Handles favorites & visited status
      for (const p of localPandals) {
        const dist = calculateDistanceInMeters(center, p.location);
        if (dist <= radiusMeters) {
          discovered.push({
            ...p,
            distance: dist, // Attach distance for sorting/display
          } as any);
        }
      }

      // 2. Fetch User-Submitted Pandals inside radius
      for (const up of userPandals) {
        const dist = calculateDistanceInMeters(center, up.location);
        if (dist <= radiusMeters) {
          const isFav = savedLocations.some(sl => sl.itemId === up.id);
          const isVisited = visitedIds.includes(up.id);
          discovered.push({
            ...up,
            favouriteStatus: isFav,
            visitedStatus: isVisited,
            distance: dist,
          } as any);
        }
      }

      // 3. Fetch from External Google Places / Nominatim
      let externalResults: any[] = [];
      try {
        const query = "Durga Puja";
        // Convert radius to rough bounding box size in degrees
        const bboxSize = radiusKm * 0.01;
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=25&viewbox=${center.lng - bboxSize},${center.lat + bboxSize},${center.lng + bboxSize},${center.lat - bboxSize}&bounded=1`;
        const res = await fetch(nominatimUrl, {
          headers: { 'User-Agent': 'EclipseGPS/1.0' }
        });
        if (res.ok) {
          externalResults = await res.json();
        }
      } catch (e) {
        console.warn('External Nominatim discovery failed, falling back to local database:', e);
      }

      // Map external results to Pandal structures
      const externalPandals: Pandal[] = [];
      if (externalResults && externalResults.length > 0) {
        externalResults.forEach((item: any, idx: number) => {
          const itemLat = parseFloat(item.lat);
          const itemLng = parseFloat(item.lon);
          const dist = calculateDistanceInMeters(center, { lat: itemLat, lng: itemLng });

          if (dist <= radiusMeters) {
            // Deduplicate: If there is a local verified or user pandal close (<150m), do NOT add the external one
            const isDuplicate = discovered.some(p => {
              const d = calculateDistanceInMeters(p.location, { lat: itemLat, lng: itemLng });
              const nameMatch = p.name.toLowerCase().includes(item.display_name.split(',')[0].toLowerCase()) ||
                                item.display_name.split(',')[0].toLowerCase().includes(p.name.toLowerCase());
              return d < 150 || nameMatch;
            });

            if (!isDuplicate) {
              const name = item.display_name.split(',')[0];
              const area = item.display_name.split(',')[1] || 'Discovered Area';
              const rating = parseFloat((4.0 + Math.random() * 0.8).toFixed(1));
              const id = `discovered-${item.place_id || 'ext-' + idx}`;
              const isFav = savedLocations.some(sl => sl.itemId === id);
              const isVisited = visitedIds.includes(id);

              externalPandals.push({
                id,
                name,
                latitude: itemLat,
                longitude: itemLng,
                location: { lat: itemLat, lng: itemLng },
                address: item.display_name,
                area: area.trim(),
                zone: 'DISCOVERED',
                city: 'Kolkata',
                theme: 'Discovered Public Pandal',
                description: 'Automatically discovered via public real-time mapping services.',
                images: ['https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&q=80&w=600'],
                openingTime: '08:00 AM',
                closingTime: '11:59 PM',
                openingHours: 'Day & Night',
                crowdLevel: idx % 3 === 0 ? 'HEAVY' : idx % 3 === 1 ? 'MODERATE' : 'LOW',
                queueEstimate: idx % 3 === 0 ? '30-45 mins' : idx % 3 === 1 ? '15-20 mins' : 'Under 10 mins',
                queueTimeMinutes: idx % 3 === 0 ? 35 : idx % 3 === 1 ? 15 : 5,
                parkingAvailability: 'limited',
                parkingStatus: 'moderate',
                estimatedVisitDuration: 25,
                accessibility: true,
                rating,
                source: 'Public Mapping Data',
                sourceType: 'PUBLIC_DATA',
                verified: false, // Unverified
                visitedStatus: isVisited,
                favouriteStatus: isFav,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                distance: dist,
              } as any);
            }
          }
        });
      }

      // Handle Client-Side Google Places if API is fully configured and loaded
      if (typeof window !== 'undefined' && (window as any).google && (window as any).google.maps && (window as any).google.maps.places) {
        try {
          const dummyDiv = document.createElement('div');
          const service = new (window as any).google.maps.places.PlacesService(dummyDiv);
          const request = {
            location: new (window as any).google.maps.LatLng(center.lat, center.lng),
            radius: radiusMeters,
            keyword: 'Durga Puja',
          };

          const placesResults = await new Promise<any[]>((resolve) => {
            service.nearbySearch(request, (results: any, status: any) => {
              if (status === (window as any).google.maps.places.PlacesServiceStatus.OK && results) {
                resolve(results);
              } else {
                resolve([]);
              }
            });
          });

          placesResults.forEach((place: any, idx: number) => {
            const placeLat = place.geometry.location.lat();
            const placeLng = place.geometry.location.lng();
            const dist = calculateDistanceInMeters(center, { lat: placeLat, lng: placeLng });

            if (dist <= radiusMeters) {
              const isDuplicate = [...discovered, ...externalPandals].some(p => {
                const d = calculateDistanceInMeters(p.location, { lat: placeLat, lng: placeLng });
                const nameMatch = p.name.toLowerCase().includes(place.name.toLowerCase()) ||
                                  place.name.toLowerCase().includes(p.name.toLowerCase());
                return d < 150 || nameMatch;
              });

              if (!isDuplicate) {
                const rating = place.rating || parseFloat((4.0 + Math.random() * 0.8).toFixed(1));
                const id = `gplace-${place.place_id || idx}`;
                const isFav = savedLocations.some(sl => sl.itemId === id);
                const isVisited = visitedIds.includes(id);

                externalPandals.push({
                  id,
                  name: place.name,
                  latitude: placeLat,
                  longitude: placeLng,
                  location: { lat: placeLat, lng: placeLng },
                  address: place.vicinity || place.formatted_address || 'Discovered Location',
                  area: place.vicinity?.split(',')[0] || 'Kolkata',
                  zone: 'DISCOVERED',
                  city: 'Kolkata',
                  theme: 'Google Places Discovered',
                  description: 'Automatically discovered via Google Places API nearby search.',
                  images: place.photos && place.photos.length > 0 ? [place.photos[0].getUrl()] : ['https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&q=80&w=600'],
                  openingTime: '08:00 AM',
                  closingTime: '11:59 PM',
                  openingHours: 'Day & Night',
                  crowdLevel: idx % 3 === 0 ? 'HEAVY' : idx % 3 === 1 ? 'MODERATE' : 'LOW',
                  queueEstimate: idx % 3 === 0 ? '30-45 mins' : idx % 3 === 1 ? '15-20 mins' : 'Under 10 mins',
                  queueTimeMinutes: idx % 3 === 0 ? 35 : idx % 3 === 1 ? 15 : 5,
                  parkingAvailability: 'limited',
                  parkingStatus: 'moderate',
                  estimatedVisitDuration: 30,
                  accessibility: true,
                  rating,
                  source: 'Google Places',
                  sourceType: 'PUBLIC_DATA',
                  verified: false,
                  visitedStatus: isVisited,
                  favouriteStatus: isFav,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  distance: dist,
                } as any);
              }
            }
          });
        } catch (err) {
          console.warn('Google Places live fetch failed:', err);
        }
      }

      let combined = [...discovered, ...externalPandals];

      // 4. Sorting Algorithms
      if (sortBy === 'nearest') {
        combined.sort((a, b) => {
          const distA = calculateDistanceInMeters(center, a.location);
          const distB = calculateDistanceInMeters(center, b.location);
          return distA - distB;
        });
      } else if (sortBy === 'least_crowded') {
        const crowdWeight = { LOW: 1, MODERATE: 2, HEAVY: 3, EXTREME: 4 };
        combined.sort((a, b) => {
          return crowdWeight[a.crowdLevel] - crowdWeight[b.crowdLevel];
        });
      } else if (sortBy === 'fastest') {
        combined.sort((a, b) => {
          const distA = calculateDistanceInMeters(center, a.location);
          const distB = calculateDistanceInMeters(center, b.location);
          const travelTimeA = (distA / 8.33) / 60; // driving estimate
          const travelTimeB = (distB / 8.33) / 60;
          const totalA = travelTimeA + a.queueTimeMinutes;
          const totalB = travelTimeB + b.queueTimeMinutes;
          return totalA - totalB;
        });
      } else {
        // Default: Recommended
        const crowdPenalty = { LOW: 0, MODERATE: 2, HEAVY: 8, EXTREME: 15 };
        combined.sort((a, b) => {
          const distA = calculateDistanceInMeters(center, a.location) / 1000;
          const distB = calculateDistanceInMeters(center, b.location) / 1000;
          const scoreA = a.rating * 10 - crowdPenalty[a.crowdLevel] - distA * 1.5;
          const scoreB = b.rating * 10 - crowdPenalty[b.crowdLevel] - distB * 1.5;
          return scoreB - scoreA;
        });
      }

      setPandals(combined);
    } catch (e) {
      console.error('Error during nearby pandal discovery:', e);
    } finally {
      setIsDiscovering(false);
    }
  };

  const triggerDiscovery = () => {
    discoverNearbyPandals(discoveryCenter, discoveryRadius, discoverySort);
  };

  const submitUserPandal = (newPandal: Partial<Pandal>) => {
    const p: Pandal = {
      id: `user-pandal-${Date.now()}`,
      name: newPandal.name || 'User Pandal',
      latitude: newPandal.latitude || currentLocation.lat,
      longitude: newPandal.longitude || currentLocation.lng,
      location: { lat: newPandal.latitude || currentLocation.lat, lng: newPandal.longitude || currentLocation.lng },
      address: newPandal.address || 'User Address',
      area: newPandal.area || 'User Area',
      zone: 'COMMUNITY',
      city: 'Kolkata',
      theme: newPandal.theme || 'Community Theme',
      description: newPandal.description || 'Submitted by community explorer.',
      images: newPandal.images || ['https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&q=80&w=600'],
      openingTime: newPandal.openingTime || '08:00 AM',
      closingTime: newPandal.closingTime || '11:59 PM',
      openingHours: 'Day & Night',
      crowdLevel: newPandal.crowdLevel || 'LOW',
      queueEstimate: 'Under 10 mins',
      queueTimeMinutes: 5,
      parkingAvailability: 'limited',
      parkingStatus: 'easy',
      estimatedVisitDuration: 20,
      accessibility: true,
      rating: 4.0,
      source: 'User Submission',
      sourceType: 'COMMUNITY',
      verified: false,
      visitedStatus: false,
      favouriteStatus: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [...userPandals, p];
    setUserPandals(updated);
    localStorage.setItem('eclipse_gps_user_pandals', JSON.stringify(updated));
    discoverNearbyPandals(discoveryCenter, discoveryRadius, discoverySort);
  };

  const setDisplayName = (name: string) => {
    setDisplayNameState(name);
    localStorage.setItem('eclipse_gps_displayName', name);
  };

  const createGroup = async (name: string): Promise<string> => {
    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error('Failed to create group');
      const group = await response.json();
      
      const joinResponse = await fetch(`/api/groups/${group.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          displayName,
          sharingEnabled: sharingLocation,
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          speed,
          heading,
          accuracy: gpsAccuracy,
        }),
      });
      if (!joinResponse.ok) throw new Error('Failed to join created group');
      const joinedGroup = await joinResponse.json();
      
      setActiveGroup(joinedGroup);
      localStorage.setItem('eclipse_gps_activeGroupId', joinedGroup.id);
      return joinedGroup.id;
    } catch (err) {
      console.error('Error creating group:', err);
      throw err;
    }
  };

  const joinGroup = async (code: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/groups/${code.toUpperCase()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          displayName,
          sharingEnabled: sharingLocation,
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          speed,
          heading,
          accuracy: gpsAccuracy,
        }),
      });
      if (!response.ok) return false;
      const group = await response.json();
      setActiveGroup(group);
      localStorage.setItem('eclipse_gps_activeGroupId', group.id);
      return true;
    } catch (err) {
      console.error('Error joining group:', err);
      return false;
    }
  };

  const leaveGroup = async () => {
    if (!activeGroup) return;
    try {
      await fetch(`/api/groups/${activeGroup.id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
    } catch (err) {
      console.error('Error leaving group:', err);
    } finally {
      setActiveGroup(null);
      localStorage.removeItem('eclipse_gps_activeGroupId');
    }
  };

  const renameGroup = async (name: string) => {
    if (!activeGroup) return;
    try {
      const response = await fetch(`/api/groups/${activeGroup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (response.ok) {
        const group = await response.json();
        setActiveGroup(group);
      }
    } catch (err) {
      console.error('Error renaming group:', err);
    }
  };

  const endGroupSession = async () => {
    if (!activeGroup) return;
    try {
      await fetch(`/api/groups/${activeGroup.id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Error ending group session:', err);
    } finally {
      setActiveGroup(null);
      localStorage.removeItem('eclipse_gps_activeGroupId');
    }
  };

  const updateMeetingPoint = async (lat: number, lng: number, name?: string) => {
    if (!activeGroup) return;
    try {
      const response = await fetch(`/api/groups/${activeGroup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingPoint: { lat, lng, name } }),
      });
      if (response.ok) {
        const group = await response.json();
        setActiveGroup(group);
      }
    } catch (err) {
      console.error('Error updating meeting point:', err);
    }
  };

  // Restore group and telemetry effects
  useEffect(() => {
    const savedGroupId = localStorage.getItem('eclipse_gps_activeGroupId');
    if (savedGroupId) {
      const fetchGroup = async () => {
        try {
          const response = await fetch(`/api/groups/${savedGroupId}`);
          if (response.ok) {
            const group = await response.json();
            const inGroup = group.members.some((m: any) => m.userId === userId);
            if (!inGroup) {
              await joinGroup(savedGroupId);
            } else {
              setActiveGroup(group);
            }
          } else {
            localStorage.removeItem('eclipse_gps_activeGroupId');
          }
        } catch (e) {
          console.error('Failed to restore active group:', e);
        }
      };
      fetchGroup();
    }
  }, [userId]);

  useEffect(() => {
    if (!activeGroup) return;

    const interval = setInterval(async () => {
      try {
        const telemetryResponse = await fetch(`/api/groups/${activeGroup.id}/telemetry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            sharingEnabled: sharingLocation,
            latitude: currentLocation.lat,
            longitude: currentLocation.lng,
            speed,
            heading,
            accuracy: gpsAccuracy,
            status: sharingLocation ? 'ACTIVE' : 'LOCATION PAUSED',
          }),
        });

        if (telemetryResponse.ok) {
          const updatedGroup = await telemetryResponse.json();
          setActiveGroup(updatedGroup);
        } else if (telemetryResponse.status === 404) {
          setActiveGroup(null);
          localStorage.removeItem('eclipse_gps_activeGroupId');
        }
      } catch (e) {
        console.warn('Group polling error:', e);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [activeGroup, userId, sharingLocation, currentLocation, speed, heading, gpsAccuracy]);

  const watchIdRef = useRef<number | null>(null);

  // Load catalogs and saved state on mount
  useEffect(() => {
    refreshCatalogs();
    loadSavedState();
    loadAlerts();
    
    // Add initial welcome AI message
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Welcome to **Eclipse GPS**! 🛰️\n\nI am your intelligent navigation co-pilot. You can ask me to find pandals, discover events near you, plan routes, or inspect crowd estimates.\n\n*Try asking: "Find Durga Puja pandals near me"*`,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  // Coordinate significant movement and automatic discovery trigger
  useEffect(() => {
    const dist = calculateDistanceInMeters(currentLocation, lastDiscoveryCenterRef.current);
    const isFirstTime = lastDiscoveryCenterRef.current.lat === KOLKATA_CENTER.lat && lastDiscoveryCenterRef.current.lng === KOLKATA_CENTER.lng;

    if (isFirstTime || dist > 50) {
      lastDiscoveryCenterRef.current = currentLocation;
      setDiscoveryCenter(currentLocation);
    }
  }, [currentLocation]);

  // Trigger discovery on discoveryCenter, discoveryRadius, or discoverySort changes
  useEffect(() => {
    discoverNearbyPandals(discoveryCenter, discoveryRadius, discoverySort);
  }, [discoveryCenter, discoveryRadius, discoverySort]);

  // Continuous Geolocation Tracking
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsStatus('error');
      setGpsErrorMsg('HTML5 Geolocation is not supported by your device.');
      return;
    }

    if (watchLocation) {
      setGpsStatus('tracking');
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentLocation(loc);
          setGpsAccuracy(position.coords.accuracy);
          setSpeed(position.coords.speed || 0);
          setHeading(position.coords.heading || 0);
          setGpsErrorMsg(null);
          setGpsStatus('tracking');
        },
        (error) => {
          console.warn('Geolocation Watch Position error:', error);
          if (error.code === 1) {
            setGpsStatus('denied');
            setGpsErrorMsg('GPS permission denied. Using demo coordinates in Kolkata.');
          } else {
            setGpsStatus('error');
            setGpsErrorMsg('GPS signal weak or unavailable. Using demo coordinates in Kolkata.');
          }
          // Default back to Kolkata center
          setCurrentLocation(KOLKATA_CENTER);
          setGpsAccuracy(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsStatus('idle');
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [watchLocation]);

  // Anonymous Session Tracking for Crowd Intelligence
  const crowdSessionIdRef = useRef<string | null>(null);
  const lastPublishedLocRef = useRef<Location | null>(null);
  const lastAssociatedPandalIdRef = useRef<string | null>(null);
  const hasSetupOnDisconnectRef = useRef<boolean>(false);

  useEffect(() => {
    const handlePresencePublishing = async () => {
      if (!helpImproveCrowd) {
        if (crowdSessionIdRef.current && isFirebaseConfigured()) {
          try {
            const db = getFirebaseDatabase();
            const sessionRef = ref(db, `crowd_sessions/${crowdSessionIdRef.current}`);
            await onDisconnect(sessionRef).cancel();
            await remove(sessionRef);
          } catch (err) {
            console.error('Error removing anonymous crowd session:', err);
          }
        }
        crowdSessionIdRef.current = null;
        lastPublishedLocRef.current = null;
        lastAssociatedPandalIdRef.current = null;
        hasSetupOnDisconnectRef.current = false;
        return;
      }

      if (!crowdSessionIdRef.current) {
        crowdSessionIdRef.current = 'crowd-session-' + Math.random().toString(36).substring(2, 11);
      }

      if (!currentLocation || (currentLocation.lat === KOLKATA_CENTER.lat && currentLocation.lng === KOLKATA_CENTER.lng && gpsStatus !== 'tracking')) {
        return;
      }

      // Calculate nearest pandal within geofence
      let associatedPandalId: string | null = null;
      let minDistance = Infinity;

      for (const pandal of pandals) {
        const pandalLoc = { lat: pandal.latitude, lng: pandal.longitude };
        const dist = calculateDistanceInMeters(currentLocation, pandalLoc);
        if (dist <= pandalGeofenceMeters) {
          if (dist < minDistance) {
            minDistance = dist;
            associatedPandalId = pandal.id;
          }
        }
      }

      let shouldPublish = false;
      if (!lastPublishedLocRef.current || lastAssociatedPandalIdRef.current !== associatedPandalId) {
        shouldPublish = true;
      } else {
        const dist = calculateDistanceInMeters(lastPublishedLocRef.current, currentLocation);
        if (dist >= 5) {
          shouldPublish = true;
        }
      }

      if (shouldPublish && isFirebaseConfigured()) {
        try {
          const db = getFirebaseDatabase();
          const sessionRef = ref(db, `crowd_sessions/${crowdSessionIdRef.current}`);

          if (!hasSetupOnDisconnectRef.current) {
            await onDisconnect(sessionRef).remove();
            hasSetupOnDisconnectRef.current = true;
          }

          await set(sessionRef, {
            lat: currentLocation.lat,
            lng: currentLocation.lng,
            accuracy: gpsAccuracy || 0,
            timestamp: serverTimestamp(),
            pandalId: associatedPandalId,
          });

          lastPublishedLocRef.current = currentLocation;
          lastAssociatedPandalIdRef.current = associatedPandalId;
        } catch (err) {
          console.error('Error publishing anonymous crowd presence:', err);
        }
      }
    };

    handlePresencePublishing();

    return () => {
      if (crowdSessionIdRef.current && helpImproveCrowd && isFirebaseConfigured()) {
        const db = getFirebaseDatabase();
        const sessionRef = ref(db, `crowd_sessions/${crowdSessionIdRef.current}`);
        remove(sessionRef).catch((e) => console.error('Clean up on unmount error:', e));
      }
    };
  }, [helpImproveCrowd, currentLocation, gpsAccuracy, gpsStatus, pandals, pandalGeofenceMeters]);

  // Read and Aggregate Anonymous Crowd Presence in Real-Time
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    try {
      const db = getFirebaseDatabase();
      const sessionsRef = ref(db, 'crowd_sessions');

      const unsubscribe = onValue(sessionsRef, (snapshot) => {
        const counts: Record<string, number> = {};
        
        // Initialize all known pandals to 0
        pandals.forEach((p) => {
          counts[p.id] = 0;
        });

        if (snapshot.exists()) {
          const data = snapshot.val();
          const now = Date.now();

          Object.keys(data).forEach((sid) => {
            const session = data[sid];
            if (session && session.pandalId) {
              // Ensure session is not stale (within 15 minutes)
              const timestamp = session.timestamp || 0;
              if (now - timestamp < 15 * 60 * 1000) {
                if (counts[session.pandalId] !== undefined) {
                  counts[session.pandalId]++;
                }
              }
            }
          });
        }

        const isFirstLoad = Object.keys(prevCountsRef.current).length === 0;
        const trends: Record<string, 'INCREASING' | 'STABLE' | 'DECREASING'> = {};
        pandals.forEach((p) => {
          if (isFirstLoad) {
            trends[p.id] = 'STABLE';
          } else {
            const prev = prevCountsRef.current[p.id] ?? 0;
            const curr = counts[p.id] ?? 0;
            if (curr > prev) {
              trends[p.id] = 'INCREASING';
            } else if (curr < prev) {
              trends[p.id] = 'DECREASING';
            } else {
              trends[p.id] = 'STABLE';
            }
          }
        });

        prevCountsRef.current = counts;
        setPandalCrowdCounts(counts);
        setPandalCrowdTrends(trends);
      }, (error) => {
        console.error('Error listening to crowd sessions:', error);
      });

      return () => {
        unsubscribe();
      };
    } catch (error) {
      console.error('Error setting up crowd sessions listener:', error);
    }
  }, [pandals]);

  function calculateDistanceInMeters(loc1: Location, loc2: Location): number {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = (loc1.lat * Math.PI) / 180;
    const phi2 = (loc2.lat * Math.PI) / 180;
    const deltaPhi = ((loc2.lat - loc1.lat) * Math.PI) / 180;
    const deltaLambda = ((loc2.lng - loc1.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
  }

  const setMapRef = (ref: any) => {
    setMapRefState(ref);
  };

  const recenterMap = () => {
    if (mapRef && currentLocation) {
      mapRef.setView([currentLocation.lat, currentLocation.lng], 15);
    }
  };

  const refreshCatalogs = () => {
    setPandals(eventsService.getPandals());
    setEvents(eventsService.getEvents());
  };

  const loadSavedState = () => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('eclipse_gps_saved');
    if (saved) {
      setSavedLocations(JSON.parse(saved));
    }
    setVisitedIds(eventsService.getVisited());
  };

  const loadAlerts = async () => {
    const list = await alertService.getActiveAlerts();
    setAlerts(list);
  };

  // Search Engine implementation
  const executeSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await placesService.search(q, currentLocation);
      setSearchResults(results);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setIsSearching(false);
    }
  };

  // Saved items handlers
  const saveLocation = (item: Pandal | Event | Route | any) => {
    const newSaved: SavedLocation = {
      id: `saved-${Math.random().toString(36).substr(2, 9)}`,
      type: item.geometry ? 'route' : (item.theme ? 'pandal' : 'event'),
      itemId: item.id,
      name: item.name,
      timestamp: Date.now(),
    };
    const updated = [...savedLocations, newSaved];
    setSavedLocations(updated);
    localStorage.setItem('eclipse_gps_saved', JSON.stringify(updated));
  };

  const unsaveLocation = (itemId: string) => {
    const updated = savedLocations.filter(loc => loc.itemId !== itemId);
    setSavedLocations(updated);
    localStorage.setItem('eclipse_gps_saved', JSON.stringify(updated));
  };

  const isSaved = (itemId: string): boolean => {
    return savedLocations.some(loc => loc.itemId === itemId);
  };

  // Visited markers
  const toggleVisited = (itemId: string) => {
    eventsService.toggleVisited(itemId);
    setVisitedIds(eventsService.getVisited());
    refreshCatalogs();
  };

  // Recalculate route whenever routePreference changes
  useEffect(() => {
    if (routeStops.length > 0) {
      triggerReroute(routeStops);
    }
  }, [routePreference]);

  // Route stops actions
  const addStop = (item: Pandal | Event) => {
    if (routeStops.some(s => s.id === item.id)) return;
    setRouteStops([...routeStops, item]);
    // Trigger route generation
    triggerReroute([...routeStops, item]);
  };

  const removeStop = (itemId: string) => {
    const updated = routeStops.filter(s => s.id !== itemId);
    setRouteStops(updated);
    triggerReroute(updated);
  };

  const reorderStops = (startIndex: number, endIndex: number) => {
    const result: (Pandal | Event)[] = [...routeStops];
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    setRouteStops(result);
    triggerReroute(result);
  };

  const triggerReroute = async (stopsList: (Pandal | Event)[]) => {
    if (stopsList.length === 0) {
      setActiveRoute(null);
      return;
    }

    // Origin is currentLocation
    // Destination is the last item
    // Intermediate waypoints are stops except the last
    const destItem = stopsList[stopsList.length - 1];
    const waypointsList = stopsList.slice(0, -1).map(s => ({
      name: s.name,
      location: s.location,
      isPandalOrEvent: true,
      itemId: s.id,
    }));

    try {
      const osrmProfile = routePreference === 'WALKING' ? 'foot' : 'driving';
      const calculatedRoute = await routingService.calculateRoute(
        currentLocation,
        destItem.location,
        waypointsList,
        false,
        osrmProfile
      );
      setActiveRoute(calculatedRoute);
    } catch (err) {
      console.error('Failed to trigger road route calculation:', err);
    }
  };

  // Direct simple routing to a place/event
  const calculateRouteToItem = async (item: Pandal | Event) => {
    setRouteStops([item]);
    try {
      const osrmProfile = routePreference === 'WALKING' ? 'foot' : 'driving';
      const calculatedRoute = await routingService.calculateRoute(
        currentLocation,
        item.location,
        [],
        false,
        osrmProfile
      );
      setActiveRoute(calculatedRoute);
      setActiveTab('home');
    } catch (e) {
      console.error('Failed to calculate direct route:', e);
    }
  };

  // TSP optimization handler
  const optimizeRoute = async () => {
    if (routeStops.length <= 1) return;
    
    setIsAiLoading(true);
    try {
      const destItem = routeStops[routeStops.length - 1];
      const stopsToOptimize = routeStops.slice(0, -1).map(s => ({
        name: s.name,
        location: s.location,
        isPandalOrEvent: true,
        itemId: s.id,
      }));

      const osrmProfile = routePreference === 'WALKING' ? 'foot' : 'driving';
      const result = await routingService.optimizeRoute(
        currentLocation,
        destItem.location,
        stopsToOptimize,
        osrmProfile
      );

      // Reconstruct routeStops based on optimized result
      const reorderedWaypoints = result.optimizedStops.map(wp => {
        return routeStops.find(s => s.id === wp.itemId)!;
      });

      setRouteStops([...reorderedWaypoints, destItem]);
      setActiveRoute(result.optimizedRoute);
    } catch (e) {
      console.error('Optimizing route order failed:', e);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Smart Rerouting triggers
  const acceptSmartReroute = async () => {
    if (!rerouteSuggestion || !rerouteSuggestion.replacementId) return;

    const replacementItem = eventsService.getItemById(rerouteSuggestion.replacementId);
    if (!replacementItem) {
      setRerouteSuggestion(null);
      return;
    }

    // Replace original ID inside the route stops list
    const updatedStops = routeStops.map(stop => 
      stop.id === rerouteSuggestion.originalId ? replacementItem : stop
    );

    setRouteStops(updatedStops);
    await triggerReroute(updatedStops);
    setRerouteSuggestion(null);
  };

  // Off-route simulated reroute
  const triggerOffRouteReroute = async () => {
    if (!activeRoute) return;
    setIsAiLoading(true);
    // Simulate minor calculation delay and push a beautiful notification alert
    setTimeout(async () => {
      await triggerReroute(routeStops);
      setIsAiLoading(false);
    }, 1500);
  };

  // Ask Eclipse AI secure server-side proxy
  const askEclipseAI = async (prompt: string) => {
    if (!prompt.trim()) return;

    const userMsg: AIMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsAiLoading(true);

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          userLocation: currentLocation,
        }),
      });

      if (!response.ok) {
        throw new Error('Server returned error status');
      }

      const data = await response.json();
      
      const assistantMsg: AIMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: data.text || "I processed your request, but got empty feedback.",
        action: data.action ? { type: data.action, parameters: data.parameters || {} } : undefined,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Map action trigger execution!
      if (data.action) {
        executeAIActionOnMap(data.action, data.parameters || {});
      }
    } catch (e: any) {
      console.error('Failed to communicate with secure server-side Gemini route:', e);
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: `I'm sorry, I'm currently having difficulty connecting to my secure server-side API. Let's try again in a few moments!`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI-Map orchestration engine
  const executeAIActionOnMap = async (actionType: string, params: any) => {
    switch (actionType) {
      case 'SEARCH_PANDALS':
      case 'SEARCH_EVENTS':
      case 'SEARCH_PLACES':
        if (params.query) {
          executeSearch(params.query);
          setActiveTab('home');
        }
        break;

      case 'SHOW_NEARBY':
        executeSearch(params.category || 'amenities');
        setActiveTab('home');
        break;

      case 'SHOW_LOCATION':
      case 'GET_EVENT_DETAILS':
      case 'GET_PLACE_DETAILS':
        if (params.itemId) {
          const item = eventsService.getItemById(params.itemId);
          if (item) {
            setSelectedItem(item);
            setActiveTab('home');
            if (mapRef) {
              mapRef.setView([item.location.lat, item.location.lng], 16);
            }
          }
        }
        break;

      case 'CREATE_ROUTE':
        if (params.destination) {
          // If destination is a known ID
          const item = eventsService.getItemById(params.destination);
          if (item) {
            calculateRouteToItem(item);
          }
        }
        break;

      case 'OPTIMIZE_ROUTE':
        if (params.pandalIds && Array.isArray(params.pandalIds)) {
          const selectedItems = params.pandalIds
            .map(id => eventsService.getItemById(id))
            .filter(Boolean) as (Pandal | Event)[];

          if (selectedItems.length > 0) {
            setRouteStops(selectedItems);
            setActiveTab('home');
            
            // Generate optimized TSP route
            setIsAiLoading(true);
            try {
              const destItem = selectedItems[selectedItems.length - 1];
              const stopsToOptimize = selectedItems.slice(0, -1).map(s => ({
                name: s.name,
                location: s.location,
                isPandalOrEvent: true,
                itemId: s.id,
              }));

              const result = await routingService.optimizeRoute(
                currentLocation,
                destItem.location,
                stopsToOptimize
              );

              const reorderedWaypoints = result.optimizedStops.map(wp => {
                return selectedItems.find(s => s.id === wp.itemId)!;
              });

              setRouteStops([...reorderedWaypoints, destItem]);
              setActiveRoute(result.optimizedRoute);
              recenterMap();
            } catch (err) {
              console.error(err);
            } finally {
              setIsAiLoading(false);
            }
          }
        }
        break;

      case 'NAVIGATE_TO':
        if (params.itemId) {
          const item = eventsService.getItemById(params.itemId);
          if (item) {
            await calculateRouteToItem(item);
            setIsNavigating(true);
          }
        }
        break;

      case 'SAVE_LOCATION':
        if (params.itemId) {
          const item = eventsService.getItemById(params.itemId);
          if (item) {
            saveLocation(item);
          }
        }
        break;

      case 'REMOVE_SAVED_LOCATION':
        if (params.itemId) {
          unsaveLocation(params.itemId);
        }
        break;

      case 'SHOW_ALERTS':
        setActiveTab('home');
        loadAlerts();
        break;

      default:
        break;
    }
  };

  return (
    <AppStateContext.Provider
      value={{
        currentLocation,
        gpsAccuracy,
        gpsStatus,
        gpsErrorMsg,
        watchLocation,
        setWatchLocation,
        recenterMap,
        mapRef,
        setMapRef,
        mapProvider,
        setMapProvider,

        activeTab,
        setActiveTab,

        pandals,
        events,
        refreshCatalogs,

        searchQuery,
        setSearchQuery,
        searchResults,
        isSearching,
        executeSearch,
        selectedItem,
        setSelectedItem,

        activeRoute,
        setActiveRoute,
        routeStops,
        setRouteStops,
        addStop,
        removeStop,
        reorderStops,
        optimizeRoute,
        calculateRouteToItem,
        routePreference,
        setRoutePreference,

        isNavigating,
        setIsNavigating,
        currentStepIndex,
        setCurrentStepIndex,
        triggerOffRouteReroute,

        savedLocations,
        saveLocation,
        unsaveLocation,
        isSaved,
        visitedIds,
        toggleVisited,

        alerts,
        rerouteSuggestion,
        setRerouteSuggestion,
        acceptSmartReroute,

        messages,
        isAiLoading,
        askEclipseAI,
        isAiSheetOpen,
        setIsAiSheetOpen,

        userId,
        displayName,
        setDisplayName,
        sharingLocation,
        setSharingLocation,
        activeGroup,
        createGroup,
        joinGroup,
        leaveGroup,
        renameGroup,
        endGroupSession,
        updateMeetingPoint,
        speed,
        heading,
        helpImproveCrowd,
        setHelpImproveCrowd,
        pandalGeofenceMeters,
        setPandalGeofenceMeters,
        pandalCrowdCounts,
        pandalCrowdTrends,
        mapStyle,
        setMapStyle,

        // Pandal Discovery 2.0
        discoveryRadius,
        setDiscoveryRadius,
        discoverySort,
        setDiscoverySort,
        discoveryCenter,
        setDiscoveryCenter,
        mapCenter,
        setMapCenter,
        isDiscovering,
        triggerDiscovery,
        submitUserPandal,
        userPandals,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
