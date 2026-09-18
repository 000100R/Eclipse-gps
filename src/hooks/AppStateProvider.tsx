import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Location, Place, Event, Pandal, Route, SavedLocation, Alert, AIMessage, VisitedPandalRecord } from '../types';
import { eventsService } from '../services/events/eventsService';
import { visitedPandalsService } from '../services/visited/visitedPandalsService';
import { placesService } from '../services/places/placesService';
import { routingService } from '../services/routing/routingService';
import { alertService } from '../services/realtime/alertService';
import { pandalDiscoveryService } from '../services/discovery/pandalDiscoveryService';
import { pandalIntelligenceProvider } from '../services/intelligence/pandalIntelligenceProvider';
import { bonediBariIntelligenceProvider } from '../services/intelligence/bonediBariIntelligenceProvider';
import { metroIntelligenceProvider } from '../services/intelligence/metroIntelligenceProvider';
import { pujaCalendarIntelligenceProvider } from '../services/intelligence/pujaCalendarIntelligenceProvider';
import { crowdIntelligenceService } from '../services/intelligence/crowdIntelligenceService';
import { trafficIntelligenceService } from '../services/intelligence/trafficIntelligenceService';
import { smartVisitService } from '../services/intelligence/smartVisitService';
import { intelligenceLayerService } from '../services/intelligence/intelligenceLayerService';
import { curatedEclipsePandals } from '../data/curatedPandals';
import { curatedBonediBariList } from '../data/curatedBonediBari';
import { SmartRoutePlan, StartLocationOption, DestinationItem, PujaRouteSession } from '../types/smartRoute';
import { MetroGateIntelligenceResult } from '../types/metro';
import { smartPujaRoutePlannerService } from '../services/routing/smartPujaRoutePlannerService';
import { travelDistanceService } from '../services/gps/travelDistanceService';
import { ref, set, remove, onDisconnect, serverTimestamp, onValue, off } from 'firebase/database';
import { isFirebaseConfigured, getFirebaseDatabase } from '../services/firebase';
import {
  FriendRelation,
  FriendRequest,
  FriendLocation,
  listenToIncomingRequests,
  listenToOutgoingRequests,
  listenToFriends,
  listenToFriendLocation,
  publishLiveLocation,
  clearLiveLocation
} from '../services/realtime/friendsService';
import {
  PujaGroup,
  GroupMember,
  GroupInvite,
  GroupLocation,
  createPujaGroup as createPujaGroupFb,
  inviteFriendToGroup as inviteFriendToGroupFb,
  respondToGroupInvite as respondToGroupInviteFb,
  removeGroupMember as removeGroupMemberFb,
  leavePujaGroup as leavePujaGroupFb,
  renamePujaGroup as renamePujaGroupFb,
  deletePujaGroup as deletePujaGroupFb,
  updateGroupSharingState as updateGroupSharingStateFb,
  publishGroupLocation as publishGroupLocationFb,
  clearGroupLocation as clearGroupLocationFb,
  listenToUserGroupInvites,
  listenToMyGroups,
  listenToGroupMembers,
  listenToGroupLocations
} from '../services/realtime/groupService';

interface AppStateContextType {
  // GPS State
  currentLocation: Location | null;
  hasValidGps: boolean;
  gpsAccuracy: number | null;
  gpsStatus: 'idle' | 'prompt' | 'requesting' | 'tracking' | 'error' | 'denied';
  gpsErrorMsg: string | null;
  permissionState: 'prompt' | 'granted' | 'denied' | 'unknown';
  watchLocation: boolean;
  setWatchLocation: (watch: boolean) => void;
  requestLocation: () => void;
  retryLocation: () => void;
  recenterMap: () => void;
  mapRef: any;
  setMapRef: (ref: any) => void;
  mapProvider: 'leaflet' | 'google';
  setMapProvider: (provider: 'leaflet' | 'google') => void;

  // Tabs / Navigation
  activeTab: 'home' | 'explore' | 'routes' | 'events' | 'saved' | 'group' | 'visited' | 'journey';
  setActiveTab: (tab: 'home' | 'explore' | 'routes' | 'events' | 'saved' | 'group' | 'visited' | 'journey') => void;
  eventsSubTab: 'PANJIKA' | 'CALENDAR' | 'CULTURAL';
  setEventsSubTab: (tab: 'PANJIKA' | 'CALENDAR' | 'CULTURAL') => void;
  openPanjika: () => void;

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
  addStop: (item: Pandal | Event | any) => void;
  removeStop: (itemId: string) => void;
  reorderStops: (startIndex: number, endIndex: number) => void;
  optimizeRoute: () => Promise<void>;
  calculateRouteToItem: (item: Pandal | Event | any) => Promise<void>;
  selectAlternativeRoute: (route: Route) => void;
  routePreference: 'FASTEST' | 'SHORTEST' | 'LOW CROWD' | 'BALANCED' | 'WALKING' | 'DRIVING';
  setRoutePreference: (pref: 'FASTEST' | 'SHORTEST' | 'LOW CROWD' | 'BALANCED' | 'WALKING' | 'DRIVING') => void;
  travelMode: 'walking' | 'driving';
  setTravelMode: (mode: 'walking' | 'driving') => Promise<void>;

  // Turn-by-turn Navigation
  isNavigating: boolean;
  setIsNavigating: (nav: boolean) => void;
  currentStepIndex: number;
  setCurrentStepIndex: (idx: number) => void;
  triggerOffRouteReroute: () => Promise<void>;

  // Metro Gate Intelligence
  activeMetroGateIntelligence: MetroGateIntelligenceResult | null;
  setActiveMetroGateIntelligence: (result: MetroGateIntelligenceResult | null) => void;

  // Saved / Visited places
  savedLocations: SavedLocation[];
  saveLocation: (item: Pandal | Event | Route) => void;
  unsaveLocation: (itemId: string) => void;
  isSaved: (itemId: string) => boolean;
  visitedIds: string[];
  visitedRecords: VisitedPandalRecord[];
  toggleVisited: (itemId: string) => void;
  removeVisitedRecord: (pandalId: string) => void;
  totalDistanceTravelledMeters: number;

  // Smart Puja Route Planner (Phase 13.8)
  smartRoutePlan: SmartRoutePlan | null;
  setSmartRoutePlan: React.Dispatch<React.SetStateAction<SmartRoutePlan | null>>;
  savedSmartRoutes: SmartRoutePlan[];
  saveSmartRoute: (plan: SmartRoutePlan) => void;
  deleteSmartRoute: (planId: string) => void;
  applySmartRoute: (plan: SmartRoutePlan) => void;

  // Multi-Pandal Puja Route Navigation Session
  pujaRouteSession: PujaRouteSession | null;
  setPujaRouteSession: React.Dispatch<React.SetStateAction<PujaRouteSession | null>>;
  startPujaRouteNavigation: (stops: DestinationItem[]) => Promise<void>;
  advancePujaRouteToNextStop: () => Promise<void>;
  endPujaRoute: () => void;

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
  shareLocationWithFriends: boolean;
  setShareLocationWithFriends: (share: boolean) => void;
  friendsList: FriendRelation[];
  friendsLocations: Record<string, FriendLocation>;
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  activeGroup: any | null;
  setActiveGroup: (group: any | null) => void;
  groupsList: PujaGroup[];
  groupInvites: GroupInvite[];
  groupMembers: GroupMember[];
  groupLocations: Record<string, GroupLocation>;
  groupSharingEnabled: boolean;
  createPujaGroup: (name: string) => Promise<string>;
  inviteFriendToGroup: (friendId: string, friendName: string) => Promise<void>;
  respondToGroupInvite: (groupId: string, accept: boolean) => Promise<void>;
  removeGroupMember: (memberId: string) => Promise<void>;
  leavePujaGroup: () => Promise<void>;
  renamePujaGroup: (newName: string) => Promise<void>;
  deletePujaGroup: () => Promise<void>;
  updateGroupSharingState: (sharingEnabled: boolean) => Promise<void>;
  createGroup: (name: string) => Promise<string>;
  joinGroup: (code: string) => Promise<boolean>;
  leaveGroup: () => Promise<void>;
  renameGroup: (name: string) => Promise<void>;
  endGroupSession: () => Promise<void>;
  updateMeetingPoint: (lat: number, lng: number, name?: string) => Promise<void>;
  speed: number;
  heading: number;
  calculateDistanceInMeters: (loc1: Location, loc2: Location) => number;
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
  discoveryCenter: Location | null;
  setDiscoveryCenter: (loc: Location | null) => void;
  mapCenter: Location | null;
  setMapCenter: (loc: Location | null) => void;
  isDiscovering: boolean;
  triggerDiscovery: () => void;
  submitUserPandal: (pandal: Partial<Pandal>) => void;
  userPandals: Pandal[];
  isLostInCrowdActive: boolean;
  setIsLostInCrowdActive: (active: boolean) => void;
  executeAIActionOnMap: (actionType: string, params: any) => Promise<{ pandals?: any[]; error?: string }>;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

// Default center reference for boundaries
const KOLKATA_CENTER: Location = { lat: 22.5697, lng: 88.3639 };

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [hasValidGps, setHasValidGps] = useState<boolean>(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'prompt' | 'requesting' | 'tracking' | 'error' | 'denied'>('prompt');
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
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

  const [activeTab, setActiveTab] = useState<'home' | 'explore' | 'routes' | 'events' | 'saved' | 'group' | 'visited' | 'journey'>('home');
  const [eventsSubTab, setEventsSubTab] = useState<'PANJIKA' | 'CALENDAR' | 'CULTURAL'>('PANJIKA');

  const openPanjika = useCallback(() => {
    setActiveTab('events');
    setEventsSubTab('PANJIKA');
  }, []);

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
  const [activeMetroGateIntelligence, setActiveMetroGateIntelligence] = useState<MetroGateIntelligenceResult | null>(null);

  // Saved / Visited Lists
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [visitedIds, setVisitedIds] = useState<string[]>(() => eventsService.getVisited());
  const [visitedRecords, setVisitedRecords] = useState<VisitedPandalRecord[]>(() => {
    return visitedPandalsService.getRecords();
  });
  const [totalDistanceTravelledMeters, setTotalDistanceTravelledMeters] = useState<number>(() => {
    return travelDistanceService.getDistanceMeters();
  });

  useEffect(() => {
    const unsubscribe = travelDistanceService.subscribe((dist) => {
      setTotalDistanceTravelledMeters(dist);
    });
    return unsubscribe;
  }, []);

  // Smart Puja Route Planner (Phase 13.8)
  const [smartRoutePlan, setSmartRoutePlan] = useState<SmartRoutePlan | null>(null);
  const [savedSmartRoutes, setSavedSmartRoutes] = useState<SmartRoutePlan[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('eclipse_saved_smart_routes') || '[]');
    } catch {
      return [];
    }
  });

  const saveSmartRoute = (plan: SmartRoutePlan) => {
    setSavedSmartRoutes(prev => {
      const filtered = prev.filter(p => p.id !== plan.id);
      const updated = [plan, ...filtered];
      localStorage.setItem('eclipse_saved_smart_routes', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteSmartRoute = (planId: string) => {
    setSavedSmartRoutes(prev => {
      const updated = prev.filter(p => p.id !== planId);
      localStorage.setItem('eclipse_saved_smart_routes', JSON.stringify(updated));
      return updated;
    });
  };

  const applySmartRoute = (plan: SmartRoutePlan) => {
    setSmartRoutePlan(plan);
    const stopsItems = plan.stops.map(s => s.rawItem || {
      id: s.id,
      name: s.name,
      location: s.location,
      address: s.address,
      theme: s.theme,
    });
    setRouteStops(stopsItems);
    if (plan.osrmRoute) {
      setActiveRoute(plan.osrmRoute);
    }
    setActiveTab('routes');
  };

  // Multi-Pandal Puja Route Navigation Session
  const [pujaRouteSession, setPujaRouteSession] = useState<PujaRouteSession | null>(() => {
    try {
      const saved = localStorage.getItem('eclipse_puja_route_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (pujaRouteSession) {
        localStorage.setItem('eclipse_puja_route_session', JSON.stringify(pujaRouteSession));
      } else {
        localStorage.removeItem('eclipse_puja_route_session');
      }
    } catch (e) {
      console.warn('Failed to sync pujaRouteSession to localStorage:', e);
    }
  }, [pujaRouteSession]);

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

  // Group & Preference States (Defaulting to WALKING for pandal-hopping)
  const [routePreference, setRoutePreference] = useState<'FASTEST' | 'SHORTEST' | 'LOW CROWD' | 'BALANCED' | 'WALKING' | 'DRIVING'>('WALKING');
  
  const travelMode: 'walking' | 'driving' = routePreference === 'DRIVING' ? 'driving' : 'walking';

  const setTravelMode = async (mode: 'walking' | 'driving') => {
    setRoutePreference(mode === 'walking' ? 'WALKING' : 'DRIVING');
  };
  
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
  const [shareLocationWithFriends, setShareLocationWithFriendsState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('eclipse_gps_shareLocationWithFriends') === 'true';
  });

  const [friendsList, setFriendsList] = useState<FriendRelation[]>([]);
  const [friendsLocations, setFriendsLocations] = useState<Record<string, FriendLocation>>({});
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);

  const setShareLocationWithFriends = (share: boolean) => {
    if (share) {
      if (typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => {
            setWatchLocation(true);
            setShareLocationWithFriendsState(true);
            localStorage.setItem('eclipse_gps_shareLocationWithFriends', 'true');
          },
          (err) => {
            console.warn('Geolocation permission error:', err);
          }
        );
      } else {
        setShareLocationWithFriendsState(true);
        localStorage.setItem('eclipse_gps_shareLocationWithFriends', 'true');
      }
    } else {
      setShareLocationWithFriendsState(false);
      localStorage.setItem('eclipse_gps_shareLocationWithFriends', 'false');
    }
  };

  const [activeGroupState, setActiveGroup] = useState<any | null>(null);
  const [isLostInCrowdActive, setIsLostInCrowdActive] = useState<boolean>(false);
  const [groupsList, setGroupsList] = useState<PujaGroup[]>([]);
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupLocations, setGroupLocations] = useState<Record<string, GroupLocation>>({});

  const activeGroup = activeGroupState ? {
    ...activeGroupState,
    members: groupMembers.map(member => {
      const loc = groupLocations[member.userId];
      return {
        userId: member.userId,
        displayName: member.userName,
        userName: member.userName,
        sharingEnabled: member.sharingEnabled,
        latitude: loc ? loc.lat : undefined,
        longitude: loc ? loc.lng : undefined,
        speed: 0,
        heading: 0,
        accuracy: loc ? loc.accuracy : 0,
        lastUpdated: loc ? loc.timestamp : member.joinedAt,
      };
    })
  } : null;
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
  const [discoverySort, setDiscoverySort] = useState<'recommended' | 'nearest' | 'fastest' | 'least_crowded'>('nearest');
  const [discoveryCenter, setDiscoveryCenter] = useState<Location | null>(null);
  const [mapCenter, setMapCenter] = useState<Location | null>(null);
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [userPandals, setUserPandals] = useState<Pandal[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('eclipse_gps_user_pandals');
    return saved ? JSON.parse(saved) : [];
  });

  const lastDiscoveryCenterRef = useRef<Location | null>(null);

  // Core Nearby Pandal Discovery Engine (delegates to centralized pandalDiscoveryService)
  const discoverNearbyPandals = async (center: Location | null, radiusKm: number, sortBy: string) => {
    if (!center || !hasValidGps) return;
    setIsDiscovering(true);
    try {
      const radiusMeters = radiusKm * 1000;
      const result = await pandalDiscoveryService.discoverPandals({
        near: center,
        radius: radiusMeters,
        sortBy: sortBy as any,
      });

      // Include user-submitted local additions if any
      const effectiveRadiusMeters = result.searchRadius || radiusMeters;
      const userPandalsInRadius = userPandals.filter(up => {
        const dist = calculateDistanceInMeters(center, up.location);
        return dist <= effectiveRadiusMeters;
      }).map(up => ({
        ...up,
        distance: calculateDistanceInMeters(center, up.location),
        favouriteStatus: savedLocations.some(sl => sl.itemId === up.id),
        visitedStatus: visitedIds.includes(up.id),
      }));

      const hydratedPandals = result.pandals.map(p => ({
        ...p,
        distance: p.distance ?? calculateDistanceInMeters(center, p.location),
        favouriteStatus: savedLocations.some(sl => sl.itemId === p.id),
        visitedStatus: visitedIds.includes(p.id),
      }));

      const merged = [...hydratedPandals, ...(userPandalsInRadius as any[])];
      if (sortBy === 'nearest') {
        // 2. First find the nearest candidates using the existing geographic-distance search
        merged.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

        // 3. Take only the closest 10 candidates
        const closestCandidates = merged.slice(0, 10);
        const remainingCandidates = merged.slice(10);

        // 4. Use the EXISTING OSRM routing service to calculate walking distance and walking time for those candidates
        const routedCandidates = await Promise.all(
          closestCandidates.map(async (candidate) => {
            try {
              const route = await routingService.calculateRoute(
                center,
                candidate.location,
                [],
                false,
                'foot'
              );
              if (route && !route.id.startsWith('route-fallback-') && typeof route.distance === 'number') {
                const walkingMeters = Math.round(route.distance);
                const walkingMinutes = Math.max(1, Math.round(route.duration / 60));
                return {
                  ...candidate,
                  distance: walkingMeters,
                  estimatedTravelTime: `${walkingMinutes} min walk`,
                };
              }
            } catch (err) {
              // If walking-route data is unavailable, keep the existing geographic distance
            }
            return candidate;
          })
        );

        // 5. Display/sort those 10 candidates by actual walking distance when available
        routedCandidates.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
        setPandals([...routedCandidates, ...remainingCandidates]);
      } else {
        setPandals(merged);
      }
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
    if (!currentLocation) return;
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
      sourceId: `user-pandal-${Date.now()}`,
      verificationStatus: 'COMMUNITY_VERIFIED',
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

  // Puja Group Handlers
  const createPujaGroup = async (name: string): Promise<string> => {
    try {
      const gid = await createPujaGroupFb(name, userId, displayName);
      // Select the newly created group as active
      localStorage.setItem('eclipse_gps_activeGroupId', gid);
      // Fetch details immediately to transition UI smoothly
      if (!isFirebaseConfigured()) {
        try {
          const localGroups = JSON.parse(localStorage.getItem('local_groups') || '{}');
          const val = localGroups[gid];
          if (val) setActiveGroup(val);
        } catch (e) {
          console.error('Local fallback fetch failed:', e);
        }
      } else {
        const groupRef = ref(getFirebaseDatabase(), `groups/${gid}`);
        onValue(groupRef, (snap) => {
          const val = snap.val();
          if (val) setActiveGroup(val);
        }, { onlyOnce: true });
      }
      return gid;
    } catch (err) {
      console.error('Error in createPujaGroup handler:', err);
      throw err;
    }
  };

  const inviteFriendToGroup = async (friendId: string, friendName: string): Promise<void> => {
    if (!activeGroup) return;
    try {
      await inviteFriendToGroupFb(
        activeGroup.id,
        activeGroup.name,
        userId,
        displayName,
        friendId,
        friendName
      );
    } catch (err) {
      console.error('Error in inviteFriendToGroup handler:', err);
    }
  };

  const respondToGroupInvite = async (groupId: string, accept: boolean): Promise<void> => {
    try {
      await respondToGroupInviteFb(userId, displayName, groupId, accept);
      if (accept) {
        localStorage.setItem('eclipse_gps_activeGroupId', groupId);
        if (!isFirebaseConfigured()) {
          try {
            const localGroups = JSON.parse(localStorage.getItem('local_groups') || '{}');
            const val = localGroups[groupId];
            if (val) setActiveGroup(val);
          } catch (e) {
            console.error('Local fallback fetch failed:', e);
          }
        } else {
          const groupRef = ref(getFirebaseDatabase(), `groups/${groupId}`);
          onValue(groupRef, (snap) => {
            const val = snap.val();
            if (val) setActiveGroup(val);
          }, { onlyOnce: true });
        }
      }
    } catch (err) {
      console.error('Error responding to group invitation:', err);
    }
  };

  const removeGroupMember = async (memberId: string): Promise<void> => {
    if (!activeGroup) return;
    try {
      await removeGroupMemberFb(activeGroup.id, memberId);
    } catch (err) {
      console.error('Error removing group member:', err);
    }
  };

  const leavePujaGroup = async (): Promise<void> => {
    if (!activeGroup) return;
    try {
      await leavePujaGroupFb(activeGroup.id, userId);
    } catch (err) {
      console.error('Error leaving group:', err);
    } finally {
      setActiveGroup(null);
      localStorage.removeItem('eclipse_gps_activeGroupId');
    }
  };

  const renamePujaGroup = async (newName: string): Promise<void> => {
    if (!activeGroup) return;
    try {
      await renamePujaGroupFb(activeGroup.id, newName);
      setActiveGroup((prev: any) => prev ? { ...prev, name: newName } : null);
    } catch (err) {
      console.error('Error renaming puja group:', err);
    }
  };

  const deletePujaGroup = async (): Promise<void> => {
    if (!activeGroup) return;
    try {
      await deletePujaGroupFb(activeGroup.id);
    } catch (err) {
      console.error('Error deleting puja group:', err);
    } finally {
      setActiveGroup(null);
      localStorage.removeItem('eclipse_gps_activeGroupId');
    }
  };

  const updateGroupSharingState = async (sharingEnabled: boolean): Promise<void> => {
    if (!activeGroup) return;
    try {
      await updateGroupSharingStateFb(activeGroup.id, userId, sharingEnabled);
    } catch (err) {
      console.error('Error updating group sharing state:', err);
    }
  };

  // Re-map legacy wrappers for absolute backward-compatibility safety
  const createGroup = createPujaGroup;
  const joinGroup = async (code: string): Promise<boolean> => {
    localStorage.setItem('eclipse_gps_activeGroupId', code);
    if (!isFirebaseConfigured()) {
      try {
        const localGroups = JSON.parse(localStorage.getItem('local_groups') || '{}');
        const val = localGroups[code];
        if (val) {
          setActiveGroup(val);
          const members = JSON.parse(localStorage.getItem('local_members') || '{}');
          if (!members[code]) members[code] = {};
          members[code][userId] = {
            userId,
            userName: displayName,
            role: 'member',
            joinedAt: Date.now(),
            sharingEnabled: true
          };
          localStorage.setItem('local_members', JSON.stringify(members));
          return true;
        }
      } catch (e) {
        console.error('Local fallback join failed:', e);
      }
      return false;
    }
    try {
      const groupRef = ref(getFirebaseDatabase(), `groups/${code}`);
      onValue(groupRef, async (snap) => {
        const val = snap.val();
        if (val) {
          setActiveGroup(val);
          const memberRef = ref(getFirebaseDatabase(), `groupMembers/${code}/${userId}`);
          const memberData: GroupMember = {
            userId,
            userName: displayName,
            role: 'member',
            joinedAt: Date.now(),
            sharingEnabled: false
          };
          await set(memberRef, memberData);
        }
      }, { onlyOnce: true });
      return true;
    } catch (err) {
      console.error('Error joining group legacy code:', err);
      return false;
    }
  };
  const leaveGroup = leavePujaGroup;
  const renameGroup = renamePujaGroup;
  const endGroupSession = deletePujaGroup;
  const updateMeetingPoint = async (lat: number, lng: number, name?: string) => {
    if (!activeGroup) return;
    try {
      if (!isFirebaseConfigured()) {
        try {
          const localGroups = JSON.parse(localStorage.getItem('local_groups') || '{}');
          if (localGroups[activeGroup.id]) {
            localGroups[activeGroup.id].meetingPoint = { lat, lng, name: name || '' };
            localStorage.setItem('local_groups', JSON.stringify(localGroups));
            setActiveGroup(localGroups[activeGroup.id]);
          }
        } catch (e) {
          console.error('Local fallback meeting point failed:', e);
        }
        return;
      }
      const mpRef = ref(getFirebaseDatabase(), `groups/${activeGroup.id}/meetingPoint`);
      await set(mpRef, { lat, lng, name });
    } catch (err) {
      console.error('Error updating meeting point on Firebase:', err);
    }
  };

  // Listen to Puja Groups list
  useEffect(() => {
    if (!isFirebaseConfigured() || !userId) return;
    return listenToMyGroups(userId, (groups) => {
      setGroupsList(groups);
      
      const savedActiveGroupId = localStorage.getItem('eclipse_gps_activeGroupId');
      if (savedActiveGroupId) {
        const found = groups.find(g => g.id === savedActiveGroupId);
        if (found) {
          setActiveGroup(found);
        } else {
          setActiveGroup(null);
          localStorage.removeItem('eclipse_gps_activeGroupId');
        }
      }
    });
  }, [userId]);

  // Listen to user group invites
  useEffect(() => {
    if (!isFirebaseConfigured() || !userId) return;
    return listenToUserGroupInvites(userId, (invites) => {
      setGroupInvites(invites);
    });
  }, [userId]);

  // Listen to active group members and active group locations
  useEffect(() => {
    if (!isFirebaseConfigured() || !activeGroup) {
      setGroupMembers([]);
      setGroupLocations({});
      return;
    }

    const unsubMembers = listenToGroupMembers(activeGroup.id, (members) => {
      setGroupMembers(members);
    });

    const unsubLocations = listenToGroupLocations(activeGroup.id, (locs) => {
      setGroupLocations(locs);
    });

    return () => {
      unsubMembers();
      unsubLocations();
    };
  }, [activeGroup]);

  // Keep route updated if navigating to a moving group member in Lost-in-Crowd mode
  useEffect(() => {
    if (!isNavigating || routeStops.length !== 1) return;
    const dest = routeStops[0];
    if (!dest.id || !dest.id.startsWith('member-')) return;
    
    const targetUserId = dest.id.replace('member-', '');
    const currentLoc = groupLocations[targetUserId];
    if (!currentLoc) return;
    
    const isStale = Date.now() - currentLoc.timestamp > 120000;
    if (isStale) return; // do not use stale location for navigation
    
    const currentLat = currentLoc.lat;
    const currentLng = currentLoc.lng;
    
    // If different from what we are currently routing to, recalculate the route!
    if (dest.location.lat !== currentLat || dest.location.lng !== currentLng) {
      const updatedMemberItem: any = {
        ...dest,
        location: { lat: currentLat, lng: currentLng },
        latitude: currentLat,
        longitude: currentLng,
      };
      
      const osrmProfile = routePreference === 'DRIVING' ? 'driving' : 'foot';
      routingService.calculateRoute(
        currentLocation,
        { lat: currentLat, lng: currentLng },
        [],
        false,
        osrmProfile
      ).then(calculatedRoute => {
        setRouteStops([updatedMemberItem]);
        setActiveRoute(calculatedRoute);
      }).catch(err => {
        console.error('Failed to update live member route:', err);
      });
    }
  }, [groupLocations, isNavigating, routeStops, currentLocation, routePreference]);

  // Synchronize custom local identity with public user registry in Firebase RTDB
  useEffect(() => {
    if (isFirebaseConfigured() && userId && displayName) {
      import('../services/realtime/friendsService').then(({ syncUserProfile }) => {
        syncUserProfile(userId, displayName).catch((err) => {
          console.error('Failed to sync user profile with Firebase:', err);
        });
      });
    }
  }, [userId, displayName]);

  // Listen to incoming requests, outgoing requests, and friends
  useEffect(() => {
    if (!isFirebaseConfigured() || !userId) return;

    const unsubIncoming = listenToIncomingRequests(userId, (requests) => {
      setIncomingRequests(requests);
    });
    const unsubOutgoing = listenToOutgoingRequests(userId, (requests) => {
      setOutgoingRequests(requests);
    });
    const unsubFriends = listenToFriends(userId, (friends) => {
      setFriendsList(friends);
    });

    return () => {
      unsubIncoming();
      unsubOutgoing();
      unsubFriends();
    };
  }, [userId]);

  // Listen to live locations of friends
  useEffect(() => {
    if (!isFirebaseConfigured() || !userId || friendsList.length === 0) {
      setFriendsLocations({});
      return;
    }

    const unsubscribes: (() => void)[] = [];

    friendsList.forEach((friend) => {
      const unsub = listenToFriendLocation(friend.friendId, (loc) => {
        setFriendsLocations((prev) => {
          if (!loc) {
            const copy = { ...prev };
            delete copy[friend.friendId];
            return copy;
          }
          return {
            ...prev,
            [friend.friendId]: loc,
          };
        });
      });
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [friendsList, userId]);

  const lastPublishedFriendLocRef = useRef<Location | null>(null);

  // Publish our live location to friends
  useEffect(() => {
    const handleFriendLocationPublishing = async () => {
      if (!isFirebaseConfigured() || !userId) return;

      if (!shareLocationWithFriends) {
        // Stop sharing / Clear location immediately
        await clearLiveLocation(userId);
        lastPublishedFriendLocRef.current = null;
        return;
      }

      if (!currentLocation || !hasValidGps || gpsStatus !== 'tracking') {
        return;
      }

      // Movement threshold check: 5 meters
      let shouldPublish = false;
      if (!lastPublishedFriendLocRef.current) {
        shouldPublish = true;
      } else {
        const dist = calculateDistanceInMeters(lastPublishedFriendLocRef.current, currentLocation);
        if (dist >= 5) {
          shouldPublish = true;
        }
      }

      if (shouldPublish) {
        try {
          await publishLiveLocation(userId, currentLocation.lat, currentLocation.lng, gpsAccuracy, true);
          lastPublishedFriendLocRef.current = currentLocation;
        } catch (err) {
          console.error('Error publishing live location to friends:', err);
        }
      }
    };

    handleFriendLocationPublishing();

    // Clean up on unmount or when userId / shareLocationWithFriends changes
    return () => {
      if (isFirebaseConfigured() && userId) {
        clearLiveLocation(userId).catch((err) => {
          console.error('Failed to clean up location on unmount:', err);
        });
      }
    };
  }, [shareLocationWithFriends, currentLocation, userId, gpsAccuracy, gpsStatus]);

  // Publish live location to group if sharing is enabled
  const myMemberRecord = groupMembers.find(m => m.userId === userId);
  const groupSharingEnabled = myMemberRecord ? !!myMemberRecord.sharingEnabled : false;

  useEffect(() => {
    if (!isFirebaseConfigured() || !userId || !activeGroup || !groupSharingEnabled) {
      if (activeGroup) {
        clearGroupLocationFb(activeGroup.id, userId).catch(err => {
          console.error('Failed to clear group location on pause:', err);
        });
      }
      return;
    }

    if (!currentLocation || !hasValidGps || gpsStatus !== 'tracking') {
      return;
    }

    // Publish to group locations
    publishGroupLocationFb(
      activeGroup.id,
      userId,
      currentLocation.lat,
      currentLocation.lng,
      gpsAccuracy,
      groupSharingEnabled
    ).catch(err => {
      console.error('Failed to publish group location:', err);
    });

    return () => {
      if (activeGroup) {
        clearGroupLocationFb(activeGroup.id, userId).catch(err => {
          console.error('Failed to clear group location on cleanup:', err);
        });
      }
    };
  }, [activeGroup, groupSharingEnabled, currentLocation, userId, gpsAccuracy, gpsStatus]);

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

  // Request location from browser/device
  const requestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setHasValidGps(false);
      setCurrentLocation(null);
      setGpsStatus('error');
      setGpsErrorMsg('HTML5 Geolocation is not supported by your browser or device.');
      return;
    }

    setGpsStatus('requesting');
    setGpsErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: Location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setPermissionState('granted');
        setCurrentLocation(loc);
        setHasValidGps(true);
        setGpsStatus('tracking');
        setGpsAccuracy(pos.coords.accuracy);
        setSpeed(pos.coords.speed || 0);
        setHeading(pos.coords.heading || 0);
        setGpsErrorMsg(null);
        travelDistanceService.recordPosition(pos);
        setDiscoveryCenter(loc);
        lastDiscoveryCenterRef.current = loc;
      },
      (err) => {
        console.warn('GPS location acquisition error:', err);
        setHasValidGps(false);
        setCurrentLocation(null);
        if (err.code === 1) {
          // PERMISSION_DENIED
          setPermissionState('denied');
          setGpsStatus('denied');
          setGpsErrorMsg('Location permission was denied. Eclipse GPS requires your real location to navigate.');
        } else if (err.code === 2) {
          // POSITION_UNAVAILABLE
          setPermissionState('granted');
          setGpsStatus('error');
          setGpsErrorMsg('Waiting for your location... GPS position unavailable. Please ensure location/GPS services are enabled on your device.');
        } else if (err.code === 3) {
          // TIMEOUT
          setPermissionState('granted');
          setGpsStatus('error');
          setGpsErrorMsg('Waiting for your location... GPS request timed out.');
        } else {
          setGpsStatus('error');
          setGpsErrorMsg(err.message || 'Unable to retrieve your real-time GPS location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }, []);

  const retryLocation = useCallback(() => {
    requestLocation();
  }, [requestLocation]);

  // Check initial permission status on app startup
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setPermissionState('denied');
      setGpsStatus('error');
      setGpsErrorMsg('HTML5 Geolocation is not supported by your device.');
      return;
    }

    let permissionObj: PermissionStatus | null = null;

    if (typeof navigator.permissions !== 'undefined' && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          permissionObj = status;
          setPermissionState(status.state as 'prompt' | 'granted' | 'denied');

          const handlePermissionChange = () => {
            setPermissionState(status.state as 'prompt' | 'granted' | 'denied');
            if (status.state === 'denied') {
              setHasValidGps(false);
              setCurrentLocation(null);
              setGpsStatus('denied');
              setGpsErrorMsg('Location access is blocked. Please allow location access in your browser settings.');
            } else if (status.state === 'prompt') {
              setHasValidGps(false);
              setCurrentLocation(null);
              setGpsStatus('prompt');
              setGpsErrorMsg(null);
            } else if (status.state === 'granted') {
              // Permission was granted, request position fix immediately
              requestLocation();
            }
          };

          status.addEventListener('change', handlePermissionChange);

          if (status.state === 'granted') {
            requestLocation();
          } else if (status.state === 'denied') {
            setHasValidGps(false);
            setCurrentLocation(null);
            setGpsStatus('denied');
            setGpsErrorMsg('Location access was denied. Please allow location access in your browser settings.');
          } else {
            // 'prompt': Show Location Required screen with Enable Location button
            setHasValidGps(false);
            setCurrentLocation(null);
            setGpsStatus('prompt');
          }
        })
        .catch((err) => {
          console.warn('Error querying geolocation permission:', err);
          setPermissionState('prompt');
          setGpsStatus('prompt');
        });
    } else {
      setPermissionState('prompt');
      setGpsStatus('prompt');
    }

    return () => {
      if (permissionObj) {
        permissionObj.onchange = null;
      }
    };
  }, [requestLocation]);

  // Coordinate significant movement and automatic discovery trigger
  useEffect(() => {
    if (!currentLocation || !hasValidGps) return;
    if (!lastDiscoveryCenterRef.current) {
      lastDiscoveryCenterRef.current = currentLocation;
      setDiscoveryCenter(currentLocation);
      return;
    }
    const dist = calculateDistanceInMeters(currentLocation, lastDiscoveryCenterRef.current);
    if (dist > 50) {
      lastDiscoveryCenterRef.current = currentLocation;
      setDiscoveryCenter(currentLocation);
    }
  }, [currentLocation, hasValidGps]);

  // Trigger discovery on discoveryCenter, discoveryRadius, or discoverySort changes
  useEffect(() => {
    if (!discoveryCenter || !hasValidGps) return;
    discoverNearbyPandals(discoveryCenter, discoveryRadius, discoverySort);
  }, [discoveryCenter, discoveryRadius, discoverySort, hasValidGps]);

  // Continuous Geolocation Tracking when valid GPS is active
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;

    if (hasValidGps && watchLocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentLocation(loc);
          travelDistanceService.recordPosition(position);
          setGpsAccuracy(position.coords.accuracy);
          setSpeed(position.coords.speed || 0);
          setHeading(position.coords.heading || 0);
          setGpsErrorMsg(null);
          setGpsStatus('tracking');
        },
        (error) => {
          console.warn('Geolocation Watch Position error:', error);
          if (error.code === 1) {
            // Revoked during session
            setPermissionState('denied');
            setHasValidGps(false);
            setCurrentLocation(null);
            setGpsStatus('denied');
            setGpsErrorMsg('Eclipse GPS cannot be used without location access. Please enable location access to continue.');
          } else if (error.code === 2 || error.code === 3) {
            // Disabled or unavailable
            setHasValidGps(false);
            setCurrentLocation(null);
            setGpsStatus('error');
            setGpsErrorMsg('Waiting for your location... GPS signal lost or location services disabled on device.');
          }
          setGpsAccuracy(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [hasValidGps, watchLocation]);

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

      if (!currentLocation || !hasValidGps || gpsStatus !== 'tracking') {
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
                counts[session.pandalId] = (counts[session.pandalId] || 0) + 1;
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
    setVisitedRecords(visitedPandalsService.getRecords());
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
    const isNowVisited = eventsService.toggleVisited(itemId);
    setVisitedIds(eventsService.getVisited());

    if (isNowVisited) {
      const allCandidates = pandalDiscoveryService.getLocalCandidates();
      const match = allCandidates.find((p) => p.id === itemId);
      if (match) {
        visitedPandalsService.recordVisit(match);
      } else {
        visitedPandalsService.recordVisit({
          id: itemId,
          name: itemId,
        });
      }
    } else {
      visitedPandalsService.removeRecord(itemId);
    }
    setVisitedRecords(visitedPandalsService.getRecords());
    refreshCatalogs();
  };

  const removeVisitedRecord = (pandalId: string) => {
    visitedPandalsService.removeRecord(pandalId);
    setVisitedRecords(visitedPandalsService.getRecords());
    setVisitedIds(eventsService.getVisited());
    refreshCatalogs();
  };

  // Geofence visit detection: automatically marks a pandal as VISITED when user's GPS enters within ~75m
  useEffect(() => {
    if (gpsStatus !== 'tracking' || !currentLocation || !hasValidGps) {
      return;
    }
    const candidates = pandalDiscoveryService.getLocalCandidates();
    const newlyVisited = visitedPandalsService.checkGpsGeofence(currentLocation, candidates, 75);
    if (newlyVisited.length > 0) {
      setVisitedRecords(visitedPandalsService.getRecords());
      setVisitedIds(eventsService.getVisited());
    }
  }, [currentLocation, gpsStatus]);

  // Recalculate route whenever routePreference changes
  useEffect(() => {
    const osrmProfile: 'foot' | 'driving' = routePreference === 'DRIVING' ? 'driving' : 'foot';
    if (routeStops.length > 0) {
      triggerReroute(routeStops);
      setCurrentStepIndex(0);
    } else if (activeRoute && (activeRoute.origin || currentLocation) && activeRoute.destination) {
      routingService.calculateRoute(
        currentLocation || activeRoute.origin,
        activeRoute.destination,
        activeRoute.waypoints || [],
        3,
        osrmProfile
      ).then(calculatedRoute => {
        setActiveRoute(calculatedRoute);
        setCurrentStepIndex(0);
      }).catch(err => {
        console.error('Failed to recalculate route on mode change:', err);
      });
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
      const osrmProfile = routePreference === 'DRIVING' ? 'driving' : 'foot';
      const calculatedRoute = await routingService.calculateRoute(
        currentLocation,
        destItem.location,
        waypointsList,
        3,
        osrmProfile
      );
      setActiveRoute(calculatedRoute);
      setCurrentStepIndex(0);
    } catch (err) {
      console.error('Failed to trigger road route calculation:', err);
    }
  };

  // Direct simple routing to a place/event
  const calculateRouteToItem = async (item: Pandal | Event | any) => {
    setRouteStops([item]);
    try {
      const osrmProfile = routePreference === 'DRIVING' ? 'driving' : 'foot';
      const calculatedRoute = await routingService.calculateRoute(
        currentLocation,
        item.location,
        [],
        3,
        osrmProfile
      );
      setActiveRoute(calculatedRoute);
      setCurrentStepIndex(0);
      setActiveTab('home');
    } catch (e) {
      console.error('Failed to calculate direct route:', e);
    }
  };

  // Start multi-pandal Puja Route navigation using existing routing logic
  const startPujaRouteNavigation = async (stops: DestinationItem[]) => {
    if (!stops || stops.length === 0) return;

    const session: PujaRouteSession = {
      isActive: true,
      stops,
      currentStopIndex: 0,
      completedStopIds: [],
    };
    setPujaRouteSession(session);

    const firstStop = stops[0];
    const osrmProfile = routePreference === 'DRIVING' ? 'driving' : 'foot';
    const originLoc = currentLocation || firstStop.location;

    setRouteStops([firstStop as any]);
    setSelectedItem(firstStop as any);
    setCurrentStepIndex(0);

    try {
      const calculatedRoute = await routingService.calculateRoute(
        originLoc,
        firstStop.location,
        [],
        3,
        osrmProfile
      );
      setActiveRoute(calculatedRoute);
      setIsNavigating(true);
      setActiveTab('home');
    } catch (err) {
      console.error('Failed to calculate route for first puja stop, using direct fallback:', err);
      await calculateRouteToItem(firstStop);
      setIsNavigating(true);
      setActiveTab('home');
    }
  };

  // Advance to next stop in the Puja Route and automatically start navigation
  const advancePujaRouteToNextStop = async () => {
    if (!pujaRouteSession || !pujaRouteSession.isActive) return;

    const { stops, currentStopIndex, completedStopIds } = pujaRouteSession;
    const currentStop = stops[currentStopIndex];

    // 1. Mark current stop as completed
    const updatedCompletedIds = completedStopIds.includes(currentStop.id)
      ? completedStopIds
      : [...completedStopIds, currentStop.id];

    if (currentStop.id) {
      if (!eventsService.getVisited().includes(currentStop.id)) {
        eventsService.toggleVisited(currentStop.id);
        setVisitedIds(eventsService.getVisited());
      }
      const candidates = pandalDiscoveryService.getLocalCandidates();
      const match = candidates.find(p => p.id === currentStop.id);
      visitedPandalsService.recordVisit(match || { id: currentStop.id, name: currentStop.name });
      setVisitedRecords(visitedPandalsService.getRecords());
    }

    const nextIndex = currentStopIndex + 1;

    // Check if all stops are completed
    if (nextIndex >= stops.length) {
      setPujaRouteSession({
        ...pujaRouteSession,
        currentStopIndex: stops.length - 1,
        completedStopIds: updatedCompletedIds,
      });
      return;
    }

    // 2. Automatically start navigation to the next pandal
    const nextStop = stops[nextIndex];
    const osrmProfile = routePreference === 'DRIVING' ? 'driving' : 'foot';
    const originLoc = currentLocation || currentStop.location;

    setPujaRouteSession({
      isActive: true,
      stops,
      currentStopIndex: nextIndex,
      completedStopIds: updatedCompletedIds,
    });

    setRouteStops([nextStop as any]);
    setSelectedItem(nextStop as any);
    setCurrentStepIndex(0);

    try {
      const calculatedRoute = await routingService.calculateRoute(
        originLoc,
        nextStop.location,
        [],
        3,
        osrmProfile
      );
      setActiveRoute(calculatedRoute);
      setIsNavigating(true);
    } catch (err) {
      console.error('Failed to calculate route to next puja stop, using direct fallback:', err);
      await calculateRouteToItem(nextStop);
      setIsNavigating(true);
    }
  };

  // End Puja Route navigation
  const endPujaRoute = () => {
    if (pujaRouteSession && pujaRouteSession.isActive) {
      const currentStop = pujaRouteSession.stops[pujaRouteSession.currentStopIndex];
      if (currentStop && !pujaRouteSession.completedStopIds.includes(currentStop.id)) {
        if (!eventsService.getVisited().includes(currentStop.id)) {
          eventsService.toggleVisited(currentStop.id);
          setVisitedIds(eventsService.getVisited());
        }
        const candidates = pandalDiscoveryService.getLocalCandidates();
        const match = candidates.find(p => p.id === currentStop.id);
        visitedPandalsService.recordVisit(match || { id: currentStop.id, name: currentStop.name });
        setVisitedRecords(visitedPandalsService.getRecords());
      }
    }
    setPujaRouteSession(null);
    setIsNavigating(false);
    setSelectedItem(null);
  };

  // Select an alternative route to make it the active navigation route
  const selectAlternativeRoute = (selectedAltRoute: Route) => {
    if (!activeRoute) return;

    // Combine current active route and all alternatives into one pool
    const allRoutes = [activeRoute, ...(activeRoute.alternatives || [])];

    // Find the matching chosen route
    const newActive = allRoutes.find(r => r.id === selectedAltRoute.id) || selectedAltRoute;
    const remainingAlternatives = allRoutes.filter(r => r.id !== newActive.id);

    const updatedRoute: Route = {
      ...newActive,
      alternatives: remainingAlternatives,
    };

    setActiveRoute(updatedRoute);
    setCurrentStepIndex(0);
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

      const osrmProfile = routePreference === 'DRIVING' ? 'driving' : 'foot';
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
        let errDetail = `Server returned status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.error) errDetail = errData.error;
        } catch (_) {}
        throw new Error(errDetail);
      }

      const data = await response.json();
      
      let discoveredPandals: any[] | undefined = undefined;
      let discoveredBonediBaris: any[] | undefined = undefined;
      let finalContent = data.text || "I processed your request.";

      // Map action trigger execution!
      if (data.action) {
        const actionResult = await executeAIActionOnMap(data.action, data.parameters || {});
        if (actionResult?.error) {
          finalContent = actionResult.error;
        } else {
          if (actionResult?.pandals && actionResult.pandals.length > 0) {
            discoveredPandals = actionResult.pandals;
          }
          if (actionResult?.bonediBaris && actionResult.bonediBaris.length > 0) {
            discoveredBonediBaris = actionResult.bonediBaris;
          }
        }
      }

      const assistantMsg: AIMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: finalContent,
        action: data.action ? { type: data.action, parameters: data.parameters || {} } : undefined,
        timestamp: Date.now(),
        discoveredPandals,
        discoveredBonediBaris,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      console.error('Failed to communicate with secure server-side Gemini route:', e);
      let friendlyMessage = `I am currently experiencing a brief delay connecting to the AI service. All map layers, Bonedi Bari heritage houses, and pandals are fully functional—you can search or tap on any item directly!`;
      if (e?.message) {
        if (e.message.includes('503') || e.message.includes('high demand') || e.message.includes('unavailable')) {
          friendlyMessage = `The AI model is experiencing a temporary surge in demand. Local pandal intelligence and heritage navigation remain active—feel free to ask again in a moment!`;
        } else if (e.message.includes('429') || e.message.includes('quota')) {
          friendlyMessage = `AI rate limit reached temporarily. You can still use the interactive map, Bonedi Bari heritage explorer, and route planner!`;
        }
      }
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: friendlyMessage,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI-Map orchestration engine
  const executeAIActionOnMap = async (actionType: string, params: any): Promise<{ pandals?: any[]; bonediBaris?: any[]; error?: string }> => {
    switch (actionType) {
      case 'SEARCH_METRO': {
        // Automatically activate METRO layer in Intelligence Grid
        intelligenceLayerService.setLayerVisibility('METRO', true);

        const queryTerm = params.stationName || params.name || params.query || '';
        let matchedStation = queryTerm ? metroIntelligenceProvider.getStationByNameOrQuery(queryTerm) : undefined;
        let metroResults: any[] = [];

        if (matchedStation) {
          metroResults = [matchedStation];
        } else {
          metroResults = await metroIntelligenceProvider.search(queryTerm || 'metro', currentLocation);
          if (metroResults.length > 0) {
            matchedStation = metroResults[0];
          }
        }

        if (metroResults.length > 0) {
          setSearchResults(metroResults as any);
          setActiveTab('home');

          if (matchedStation) {
            setSelectedItem(matchedStation as any);
            if (mapRef) {
              if (mapRef.setView) {
                mapRef.setView([matchedStation.location.lat, matchedStation.location.lng], 16);
              } else if (mapRef.setCenter) {
                mapRef.setCenter({ lat: matchedStation.location.lat, lng: matchedStation.location.lng });
                mapRef.setZoom(16);
              }
            }
          }
        }

        return { pandals: matchedStation?.nearbyPandals as any };
      }

      case 'SEARCH_BONEDI_BARI': {
        // Automatically activate Bonedi Bari layer in Intelligence Grid
        intelligenceLayerService.setLayerVisibility('BONEDI_BARI', true);

        const queryTerm = params.name || params.query || params.nearMetro || params.area || '';
        const bonediResults = await bonediBariIntelligenceProvider.search(queryTerm || 'bonedi bari', currentLocation);

        if (bonediResults.length > 0) {
          // If tour requested or query mentions tour, generate optimized route through these heritage houses
          if (params.isTour || (queryTerm && queryTerm.toLowerCase().includes('tour'))) {
            const tourStops = bonediResults.slice(0, 5);
            setRouteStops(tourStops as any);
            try {
              const destItem = tourStops[tourStops.length - 1];
              const stopsToOptimize = tourStops.slice(0, -1).map(s => ({
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
                return tourStops.find(s => s.id === wp.itemId)!;
              });

              setRouteStops([...reorderedWaypoints, destItem] as any);
              setActiveRoute(result.optimizedRoute);
            } catch (tourErr) {
              console.warn('Failed to calculate automated Bonedi Bari tour route:', tourErr);
            }
          }

          setSearchResults(bonediResults as any);
          setActiveTab('home');

          if (bonediResults.length === 1) {
            const single = bonediResults[0];
            setSelectedItem(single as any);
            if (mapRef) {
              if (mapRef.setView) {
                mapRef.setView([single.location.lat, single.location.lng], 16);
              } else if (mapRef.setCenter) {
                mapRef.setCenter({ lat: single.location.lat, lng: single.location.lng });
                mapRef.setZoom(16);
              }
            }
          } else if (mapRef) {
            const lats = bonediResults.map(p => p.location.lat);
            const lngs = bonediResults.map(p => p.location.lng);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);
            if (mapRef.fitBounds) {
              mapRef.fitBounds([[minLat, minLng], [maxLat, maxLng]]);
            }
          }
        }

        return { bonediBaris: bonediResults };
      }

      case 'VIEW_PUJA_CALENDAR': {
        // Automatically activate Puja Calendar layer in Intelligence Grid
        intelligenceLayerService.setLayerVisibility('PUJA_CALENDAR', true);

        // Switch to events tab to reveal the dedicated Puja Calendar view
        setActiveTab('events');

        const dayQuery = params.day || params.query || '';
        let pandalResults: any[] = [];
        if (dayQuery) {
          const events = await pujaCalendarIntelligenceProvider.search(dayQuery, currentLocation);
          if (events.length > 0) {
            setSearchResults(events as any);
            const firstWithLocation = events.find(e => e.associatedLocations && e.associatedLocations.length > 0);
            if (firstWithLocation && firstWithLocation.associatedLocations) {
              pandalResults = firstWithLocation.associatedLocations.map((p, idx) => ({
                id: `fest-loc-${idx}-${p.name.toLowerCase().replace(/\s+/g, '-')}`,
                name: p.name,
                address: p.type ? `Venue Type: ${p.type}` : 'Festival Venue',
                location: { lat: p.lat, lng: p.lng },
                category: 'pandal',
              }));
            }
          }
        }

        return { pandals: pandalResults.length > 0 ? pandalResults : undefined };
      }

      case 'QUERY_CROWD_INTELLIGENCE': {
        // Automatically activate CROWD layer in Intelligence Grid
        intelligenceLayerService.setLayerVisibility('CROWD', true);
        setActiveTab('home');

        const queryTerm = (params.pandalName || params.name || params.query || '').toLowerCase();
        const allCrowd = crowdIntelligenceService.getAllCrowdItems(pandals, pandalCrowdCounts, pandalCrowdTrends);

        let filteredPandals: any[] = [];
        if (queryTerm) {
          // Specific pandal crowd check
          const match = pandals.find(p => p.name.toLowerCase().includes(queryTerm));
          if (match) {
            filteredPandals = [match];
            setSelectedItem(match);
            if (mapRef) {
              if (mapRef.setView) mapRef.setView([match.location.lat, match.location.lng], 16);
              else if (mapRef.setCenter) { mapRef.setCenter({ lat: match.location.lat, lng: match.location.lng }); mapRef.setZoom(16); }
            }
          }
        } else {
          // Find low/moderate crowd pandals
          const lowCrowdIds = new Set(
            allCrowd
              .filter(c => c.crowdLevel === 'LOW' || c.crowdLevel === 'MODERATE')
              .map(c => c.pandalId)
          );
          filteredPandals = pandals.filter(p => lowCrowdIds.has(p.id)).slice(0, 8);
          if (filteredPandals.length > 0 && mapRef) {
            const lats = filteredPandals.map(p => p.location.lat);
            const lngs = filteredPandals.map(p => p.location.lng);
            if (mapRef.fitBounds) {
              mapRef.fitBounds([[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]]);
            }
          }
        }

        if (filteredPandals.length > 0) {
          setSearchResults(filteredPandals as any);
        }

        return { pandals: filteredPandals };
      }

      case 'QUERY_TRAFFIC_INTELLIGENCE': {
        // Automatically activate TRAFFIC layer in Intelligence Grid
        intelligenceLayerService.setLayerVisibility('TRAFFIC', true);
        setActiveTab('home');

        const queryTerm = (params.corridorName || params.area || params.query || '').toLowerCase();
        const corridors = trafficIntelligenceService.getAllCorridors();

        let matchedCorridor = corridors[0];
        if (queryTerm) {
          const found = corridors.find(c =>
            c.corridorName.toLowerCase().includes(queryTerm) ||
            c.affectedRoad.toLowerCase().includes(queryTerm)
          );
          if (found) matchedCorridor = found;
        }

        if (matchedCorridor && mapRef) {
          if (mapRef.setView) mapRef.setView([matchedCorridor.location.lat, matchedCorridor.location.lng], 15);
          else if (mapRef.setCenter) {
            mapRef.setCenter({ lat: matchedCorridor.location.lat, lng: matchedCorridor.location.lng });
            mapRef.setZoom(15);
          }
        }

        // Find pandals near this traffic corridor
        const nearbyPandals = pandals.filter(p => {
          if (!matchedCorridor) return false;
          const d = Math.hypot(p.location.lat - matchedCorridor.location.lat, p.location.lng - matchedCorridor.location.lng);
          return d < 0.025; // ~2.5km
        }).slice(0, 5);

        if (nearbyPandals.length > 0) {
          setSearchResults(nearbyPandals as any);
        }

        return { pandals: nearbyPandals };
      }

      case 'SMART_VISIT_RECOMMENDATION': {
        // Turn on both CROWD and TRAFFIC layers
        intelligenceLayerService.setLayerVisibility('CROWD', true);
        intelligenceLayerService.setLayerVisibility('TRAFFIC', true);
        setActiveTab('home');

        const queryTerm = (params.pandalName || params.name || params.query || '').toLowerCase();
        let targetPandal = pandals[0];
        if (queryTerm) {
          const found = pandals.find(p => p.name.toLowerCase().includes(queryTerm));
          if (found) targetPandal = found;
        }

        if (targetPandal) {
          setSelectedItem(targetPandal);
          if (mapRef) {
            if (mapRef.setView) mapRef.setView([targetPandal.location.lat, targetPandal.location.lng], 16);
            else if (mapRef.setCenter) {
              mapRef.setCenter({ lat: targetPandal.location.lat, lng: targetPandal.location.lng });
              mapRef.setZoom(16);
            }
          }
        }

        return { pandals: targetPandal ? [targetPandal] : [] };
      }

      case 'SEARCH_NEARBY_PANDALS':
      case 'SEARCH_PANDALS_BY_NAME':
      case 'SEARCH_PANDALS_BY_AREA':
      case 'SEARCH_PANDALS': {
        const isNearbyRequest = actionType === 'SEARCH_NEARBY_PANDALS' || (!params.query && !params.name && !params.area);
        if (isNearbyRequest && (gpsStatus === 'denied' || gpsStatus === 'error')) {
          return {
            error: 'GPS location is unavailable. Please enable device location access to discover pandals near your exact location, or search by pandal name or neighborhood.',
            pandals: [],
          };
        }

        const queryTerm = isNearbyRequest ? '' : (params.name || params.query || '');
        const searchArea = actionType === 'SEARCH_PANDALS_BY_AREA' ? (params.area || params.query) : params.area;

        // Use the exact same discovery engine as the map for 100% parity
        const discoveryResult = await pandalDiscoveryService.discoverPandals({
          near: currentLocation,
          radius: params.radius || (discoveryRadius * 1000) || 5000,
          query: queryTerm,
          area: searchArea,
          sortBy: isNearbyRequest ? 'nearest' : (params.sortBy || discoverySort || 'nearest'),
          mode: actionType === 'SEARCH_PANDALS_BY_NAME' ? 'name' : actionType === 'SEARCH_PANDALS_BY_AREA' ? 'area' : 'nearby',
        });

        const resolvedPandals = discoveryResult.pandals;

        if (resolvedPandals.length > 0) {
          setPandals(resolvedPandals);
          setSearchResults(resolvedPandals);
          setActiveTab('home');

          if (resolvedPandals.length === 1) {
            const single = resolvedPandals[0];
            setSelectedItem(single);
            if (mapRef) {
              mapRef.setView([single.location.lat, single.location.lng], 16);
            }
          } else if (mapRef && mapRef.fitBounds) {
            const lats = resolvedPandals.map(p => p.location.lat);
            const lngs = resolvedPandals.map(p => p.location.lng);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);
            mapRef.fitBounds([[minLat, minLng], [maxLat, maxLng]]);
          }
        }

        return { pandals: resolvedPandals };
      }

      case 'SEARCH_EVENTS':
      case 'SEARCH_PLACES':
        if (params.query) {
          executeSearch(params.query);
          setActiveTab('home');
        }
        break;

      case 'SHOW_NEARBY':
        if (params.category === 'pandal') {
          return executeAIActionOnMap('SEARCH_NEARBY_PANDALS', params);
        }
        executeSearch(params.category || 'amenities');
        setActiveTab('home');
        break;

      case 'SHOW_LOCATION':
      case 'GET_EVENT_DETAILS':
      case 'GET_PLACE_DETAILS': {
        let item = params.itemId ? eventsService.getItemById(params.itemId) : null;
        if (!item) {
          const targetName = params.locationName || params.name || params.query;
          if (targetName) {
            item = pandals.find(p => p.name.toLowerCase().includes(targetName.toLowerCase())) ||
                   (curatedEclipsePandals.find(p => p.name.toLowerCase().includes(targetName.toLowerCase())) as any);
          }
        }
        if (item) {
          setSelectedItem(item);
          setActiveTab('home');
          if (mapRef) {
            mapRef.setView([item.location.lat, item.location.lng], 16);
          }
        }
        break;
      }

      case 'CREATE_ROUTE':
        if (params.destination) {
          const item = eventsService.getItemById(params.destination) ||
                       (pandals.find(p => p.id === params.destination) as any);
          if (item) {
            calculateRouteToItem(item);
          }
        }
        break;

      case 'OPTIMIZE_ROUTE': {
        const candidateIds = params.bonediBariIds || params.pandalIds;
        if (candidateIds && Array.isArray(candidateIds)) {
          const selectedItems = candidateIds
            .map(id => bonediBariIntelligenceProvider.getById(id) || eventsService.getItemById(id) || pandals.find(p => p.id === id))
            .filter(Boolean) as (any)[];

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
      }

      case 'SMART_PUJA_ROUTE': {
        const availableTime = Number(params.availableTimeMinutes) || 240;
        const mode = (params.transportMode as any) || 'MIXED';
        const priority = (params.priority as any) || 'MORE_PLACES';

        // 1. Resolve Start Location
        let startOption: StartLocationOption = {
          id: 'start-gps',
          name: 'Current Location (GPS)',
          location: currentLocation,
          type: 'GPS',
          subtitle: 'Live GPS Coordinates',
        };

        const startQuery = (params.startLocationQuery || params.origin || '').toLowerCase();
        if (startQuery) {
          const matchedStation = metroIntelligenceProvider.getStationByNameOrQuery(startQuery);
          if (matchedStation) {
            startOption = {
              id: `start-metro-${matchedStation.id}`,
              name: matchedStation.name,
              location: matchedStation.location,
              type: 'METRO',
              subtitle: matchedStation.line,
            };
          } else {
            const friendMatch = friendsList.find(f => f.friendName.toLowerCase().includes(startQuery));
            if (friendMatch && friendsLocations[friendMatch.friendId]) {
              const fl = friendsLocations[friendMatch.friendId];
              startOption = {
                id: `start-friend-${friendMatch.friendId}`,
                name: `${friendMatch.friendName}'s Location`,
                location: { lat: fl.lat, lng: fl.lng },
                type: 'FRIEND',
                subtitle: 'Friend Live Location',
              };
            }
          }
        }

        // 2. Resolve Candidate Destinations
        let candidateItems: DestinationItem[] = [];
        const requestedIds = [...(params.pandalIds || []), ...(params.bonediBariIds || [])];

        if (requestedIds.length > 0) {
          candidateItems = requestedIds
            .map(id => smartPujaRoutePlannerService.getDestinationById(id))
            .filter(Boolean) as DestinationItem[];
        }

        // Add requested Bonedi Baris if instructed
        const bonediCount = Number(params.addBonediBarisCount) || 0;
        if (bonediCount > 0) {
          const allBonedi = curatedBonediBariList.map(b => smartPujaRoutePlannerService.toDestinationItem(b));
          for (const b of allBonedi) {
            if (!candidateItems.some(c => c.id === b.id)) {
              candidateItems.push(b);
              if (candidateItems.filter(c => c.type === 'bonedi_bari').length >= bonediCount) break;
            }
          }
        }

        // Remove most crowded stop if requested (only when trustworthy data exists!)
        if (params.removeMostCrowded && candidateItems.length > 1) {
          let mostCrowdedIdx = -1;
          let maxWait = -1;
          candidateItems.forEach((c, idx) => {
            const crowd = crowdIntelligenceService.getCrowdForPandal(c.id, c.rawItem);
            if (crowd && crowd.crowdLevel !== 'UNAVAILABLE' && (crowd.queueWaitMinutes || 0) > maxWait) {
              maxWait = crowd.queueWaitMinutes || 0;
              mostCrowdedIdx = idx;
            }
          });
          if (mostCrowdedIdx !== -1) {
            candidateItems.splice(mostCrowdedIdx, 1);
          }
        }

        // If no stops or too few stops, auto-select prominent pandals near start location
        if (candidateItems.length < 2) {
          const allPandals = smartPujaRoutePlannerService.getAllDestinations().filter(d => d.type === 'pandal');
          allPandals.sort((a, b) => {
            const da = metroIntelligenceProvider.calculateDistanceInMeters(startOption.location, a.location);
            const db = metroIntelligenceProvider.calculateDistanceInMeters(startOption.location, b.location);
            return da - db;
          });
          candidateItems = allPandals.slice(0, 4);
        }

        // 3. Plan and Optimize Smart Route
        try {
          const plan = await smartPujaRoutePlannerService.planSmartRoute({
            startLocation: startOption,
            destinations: candidateItems,
            availableTimeMinutes: availableTime,
            preferredTransport: mode,
            priority,
          });

          setSmartRoutePlan(plan);
          applySmartRoute(plan);
          setActiveTab('routes');

          if (mapRef && plan.fullGeometry.length > 0) {
            const lats = plan.fullGeometry.map(p => p.lat);
            const lngs = plan.fullGeometry.map(p => p.lng);
            if (mapRef.fitBounds) {
              mapRef.fitBounds([[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]]);
            }
          }

          return { pandals: plan.stops.map(s => s.rawItem || s) };
        } catch (planErr) {
          console.error('[SmartPujaRoute] Planning error:', planErr);
        }
        break;
      }

      case 'NAVIGATE_TO': {
        let item = params.itemId ? (bonediBariIntelligenceProvider.getById(params.itemId) || eventsService.getItemById(params.itemId)) : null;
        if (!item) {
          const targetName = params.locationName || params.name || params.query || params.destination;
          if (targetName) {
            const bonediMatch = bonediBariIntelligenceProvider.getData().find(b => b.name.toLowerCase().includes(targetName.toLowerCase()));
            item = (bonediMatch as any) || pandals.find(p => p.name.toLowerCase().includes(targetName.toLowerCase())) ||
                   (curatedEclipsePandals.find(p => p.name.toLowerCase().includes(targetName.toLowerCase())) as any);
          }
        }
        if (item) {
          await calculateRouteToItem(item);
          setIsNavigating(true);
          setActiveTab('home');
        }
        break;
      }

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
        hasValidGps,
        gpsAccuracy,
        gpsStatus,
        gpsErrorMsg,
        permissionState,
        watchLocation,
        setWatchLocation,
        requestLocation,
        retryLocation,
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
        selectAlternativeRoute,
        routePreference,
        setRoutePreference,
        travelMode,
        setTravelMode,

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
        visitedRecords,
        toggleVisited,
        removeVisitedRecord,
        totalDistanceTravelledMeters,

        // Smart Puja Route Planner (Phase 13.8)
        smartRoutePlan,
        setSmartRoutePlan,
        savedSmartRoutes,
        saveSmartRoute,
        deleteSmartRoute,
        applySmartRoute,

        // Multi-Pandal Puja Route Navigation Session
        pujaRouteSession,
        setPujaRouteSession,
        startPujaRouteNavigation,
        advancePujaRouteToNextStop,
        endPujaRoute,

        alerts,
        rerouteSuggestion,
        setRerouteSuggestion,
        acceptSmartReroute,

        messages,
        isAiLoading,
        askEclipseAI,
        executeAIActionOnMap,
        isAiSheetOpen,
        setIsAiSheetOpen,

        userId,
        displayName,
        setDisplayName,
        sharingLocation,
        setSharingLocation,
        shareLocationWithFriends,
        setShareLocationWithFriends,
        friendsList,
        friendsLocations,
        incomingRequests,
        outgoingRequests,
        activeGroup,
        setActiveGroup,
        groupsList,
        groupInvites,
        groupMembers,
        groupLocations,
        groupSharingEnabled,
        createPujaGroup,
        inviteFriendToGroup,
        respondToGroupInvite,
        removeGroupMember,
        leavePujaGroup,
        renamePujaGroup,
        deletePujaGroup,
        updateGroupSharingState,
        createGroup,
        joinGroup,
        leaveGroup,
        renameGroup,
        endGroupSession,
        updateMeetingPoint,
        speed,
        heading,
        calculateDistanceInMeters,
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
        isLostInCrowdActive,
        setIsLostInCrowdActive,

        // Metro Gate Intelligence
        activeMetroGateIntelligence,
        setActiveMetroGateIntelligence,

        // Bengali Panjika & Events
        eventsSubTab,
        setEventsSubTab,
        openPanjika,
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
