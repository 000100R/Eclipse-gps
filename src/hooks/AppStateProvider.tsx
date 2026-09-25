import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Location, Place, Event, Pandal, Route, SavedLocation, Alert, AIMessage, VisitedPandalRecord } from '../types';
import { eventsService } from '../services/events/eventsService';
import { visitedPandalsService } from '../services/visited/visitedPandalsService';
import { placesService } from '../services/places/placesService';
import { routingService, extractLocation } from '../services/routing/routingService';
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
import { MetroGateIntelligenceResult, MetroGateRouteOption } from '../types/metro';
import { smartPujaRoutePlannerService } from '../services/routing/smartPujaRoutePlannerService';
import { travelDistanceService } from '../services/gps/travelDistanceService';
import { hasValidGoogleMapsKey } from '../services/map/mapsConfig';
import { ref, set, remove, onDisconnect, serverTimestamp, onValue, off } from 'firebase/database';
import { isFirebaseConfigured, getFirebaseDatabase } from '../services/firebase';
import {
  FriendRelation,
  FriendRequest,
  FriendLocation,
  BlockedUser,
  LocationSharingMode,
  LocationSharingSettings,
  getOrCreateEclipseId,
  generateEclipseId,
  normalizeEclipseId,
  searchUserByEclipseId,
  sendFriendRequest as sendFriendRequestService,
  acceptFriendRequest as acceptFriendRequestService,
  rejectFriendRequest as rejectFriendRequestService,
  cancelFriendRequest as cancelFriendRequestService,
  removeFriend as removeFriendService,
  blockUser as blockUserService,
  unblockUser as unblockUserService,
  listenToIncomingRequests,
  listenToOutgoingRequests,
  listenToFriends,
  listenToBlockedUsers,
  listenToFriendLocation,
  publishLiveLocation,
  clearLiveLocation,
  syncUserProfile,
  getLocationSharingSettings,
  updateLocationSharingSettings,
  stopLocationSharing as stopLocationSharingService,
  toggleFriendSharingPermission as toggleFriendSharingPermissionService,
  setFriendSharingPermission as setFriendSharingPermissionService,
  listenToLocationSharingSettings,
  isFriendAuthorizedToReceiveLocation,
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
  isCalculatingRoute: boolean;
  routingError: string | null;
  clearRoutingError: () => void;
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
  stopNavigation: () => void;
  currentStepIndex: number;
  setCurrentStepIndex: (idx: number) => void;
  triggerOffRouteReroute: () => Promise<void>;

  // Metro Gate Intelligence
  activeMetroGateIntelligence: MetroGateIntelligenceResult | null;
  setActiveMetroGateIntelligence: (result: MetroGateIntelligenceResult | null) => void;
  startGateWalkingNavigation: (gateOpt: MetroGateRouteOption, targetPandal: any, stationName?: string) => void;

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
  eclipseId: string;
  displayName: string;
  setDisplayName: (name: string) => void;
  photoUrl: string;
  setPhotoUrl: (url: string) => void;
  sharingLocation: boolean;
  setSharingLocation: (sharing: boolean) => void;
  shareLocationWithFriends: boolean;
  setShareLocationWithFriends: (share: boolean) => void;
  locationSharingMode: LocationSharingMode;
  selectedFriendsToShare: string[];
  setLocationSharingMode: (mode: LocationSharingMode) => Promise<void>;
  toggleFriendLocationSharing: (friendId: string) => Promise<void>;
  setFriendLocationSharing: (friendId: string, allowed: boolean) => Promise<void>;
  stopLocationSharing: () => Promise<void>;
  friendsList: FriendRelation[];
  friendsLocations: Record<string, FriendLocation>;
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  blockedUsers: BlockedUser[];
  sendFriendRequestToUser: (receiverId: string, receiverName: string, receiverEclipseId: string, receiverPhotoUrl?: string) => Promise<{ success: boolean; error?: string }>;
  acceptFriendRequestAction: (req: FriendRequest) => Promise<{ success: boolean; error?: string }>;
  rejectFriendRequestAction: (req: FriendRequest) => Promise<{ success: boolean; error?: string }>;
  cancelFriendRequestAction: (req: FriendRequest) => Promise<{ success: boolean; error?: string }>;
  removeFriendAction: (friendId: string) => Promise<{ success: boolean }>;
  blockFriendAction: (friendId: string, friendName?: string, friendEclipseId?: string) => Promise<{ success: boolean }>;
  unblockFriendAction: (blockedId: string) => Promise<{ success: boolean }>;
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
  executeAIActionOnMap: (actionType: string, params: any) => Promise<{ pandals?: any[]; bonediBaris?: any[]; error?: string; message?: string; metroGateResult?: MetroGateIntelligenceResult }>;
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
    return hasValidGoogleMapsKey() ? 'google' : 'leaflet';
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
  const [isCalculatingRoute, setIsCalculatingRoute] = useState<boolean>(false);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const clearRoutingError = useCallback(() => setRoutingError(null), []);
  const routeRequestIdRef = useRef<number>(0);
  const isCalculatingRouteRef = useRef<boolean>(false);
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

  const [eclipseId, setEclipseIdState] = useState<string>(() => {
    return getOrCreateEclipseId();
  });

  const [photoUrl, setPhotoUrlState] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('eclipse_gps_photoUrl') || '';
  });

  const setPhotoUrl = (url: string) => {
    setPhotoUrlState(url);
    if (typeof window !== 'undefined') {
      localStorage.setItem('eclipse_gps_photoUrl', url);
    }
  };

  const [sharingLocation, setSharingLocation] = useState<boolean>(false); // Explicit opt-out!

  // Phase 9 Part 3A: Location sharing mode & explicit selection
  // Default state: Location sharing = OFF
  const [locationSharingMode, setLocationSharingModeState] = useState<LocationSharingMode>(() => {
    if (typeof window === 'undefined') return 'off';
    const saved = localStorage.getItem('eclipse_gps_location_sharing_mode');
    return (saved === 'all' || saved === 'selected') ? saved : 'off';
  });

  const [selectedFriendsToShare, setSelectedFriendsToShareState] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('eclipse_gps_selected_friends_sharing');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const shareLocationWithFriends = locationSharingMode === 'all' || (locationSharingMode === 'selected' && selectedFriendsToShare.length > 0);

  const setLocationSharingMode = async (mode: LocationSharingMode) => {
    setLocationSharingModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('eclipse_gps_location_sharing_mode', mode);
      localStorage.setItem('eclipse_gps_shareLocationWithFriends', mode !== 'off' ? 'true' : 'false');
    }
    if (userId) {
      await updateLocationSharingSettings(userId, {
        mode,
        selectedFriendIds: mode === 'off' ? [] : selectedFriendsToShare,
      });
    }
  };

  const setShareLocationWithFriends = async (share: boolean) => {
    if (share) {
      await setLocationSharingMode('all');
    } else {
      await stopLocationSharing();
    }
  };

  const toggleFriendLocationSharing = async (friendId: string) => {
    const isSelected = selectedFriendsToShare.includes(friendId);
    let newSelected: string[];
    if (isSelected) {
      newSelected = selectedFriendsToShare.filter((id) => id !== friendId);
    } else {
      newSelected = [...selectedFriendsToShare, friendId];
    }
    setSelectedFriendsToShareState(newSelected);
    setLocationSharingModeState('selected');
    if (typeof window !== 'undefined') {
      localStorage.setItem('eclipse_gps_location_sharing_mode', 'selected');
      localStorage.setItem('eclipse_gps_selected_friends_sharing', JSON.stringify(newSelected));
      localStorage.setItem('eclipse_gps_shareLocationWithFriends', newSelected.length > 0 ? 'true' : 'false');
    }
    if (userId) {
      await updateLocationSharingSettings(userId, {
        mode: 'selected',
        selectedFriendIds: newSelected,
      });
    }
  };

  const setFriendLocationSharing = async (friendId: string, allowed: boolean) => {
    let newSelected: string[];
    if (allowed) {
      newSelected = selectedFriendsToShare.includes(friendId)
        ? selectedFriendsToShare
        : [...selectedFriendsToShare, friendId];
    } else {
      newSelected = selectedFriendsToShare.filter((id) => id !== friendId);
    }
    setSelectedFriendsToShareState(newSelected);
    setLocationSharingModeState('selected');
    if (typeof window !== 'undefined') {
      localStorage.setItem('eclipse_gps_location_sharing_mode', 'selected');
      localStorage.setItem('eclipse_gps_selected_friends_sharing', JSON.stringify(newSelected));
      localStorage.setItem('eclipse_gps_shareLocationWithFriends', newSelected.length > 0 ? 'true' : 'false');
    }
    if (userId) {
      await updateLocationSharingSettings(userId, {
        mode: 'selected',
        selectedFriendIds: newSelected,
      });
    }
  };

  const stopLocationSharing = async () => {
    setLocationSharingModeState('off');
    setSelectedFriendsToShareState([]);
    if (typeof window !== 'undefined') {
      localStorage.setItem('eclipse_gps_location_sharing_mode', 'off');
      localStorage.setItem('eclipse_gps_selected_friends_sharing', JSON.stringify([]));
      localStorage.setItem('eclipse_gps_shareLocationWithFriends', 'false');
    }
    if (userId) {
      await stopLocationSharingService(userId);
    }
  };

  const [friendsList, setFriendsList] = useState<FriendRelation[]>([]);
  const [friendsLocations, setFriendsLocations] = useState<Record<string, FriendLocation>>({});
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);

  const sendFriendRequestToUser = async (receiverId: string, receiverName: string, receiverEclipseId: string, receiverPhotoUrl: string = '') => {
    return sendFriendRequestService(userId, displayName, receiverId, receiverName, eclipseId, receiverEclipseId, photoUrl, receiverPhotoUrl);
  };

  const acceptFriendRequestAction = async (req: FriendRequest) => {
    return acceptFriendRequestService(req);
  };

  const rejectFriendRequestAction = async (req: FriendRequest) => {
    return rejectFriendRequestService(req);
  };

  const cancelFriendRequestAction = async (req: FriendRequest) => {
    return cancelFriendRequestService(req);
  };

  const removeFriendAction = async (friendId: string) => {
    return removeFriendService(userId, friendId);
  };

  const blockFriendAction = async (friendId: string, friendName?: string, friendEclipseId?: string) => {
    return blockUserService(userId, friendId, friendName, friendEclipseId);
  };

  const unblockFriendAction = async (blockedId: string) => {
    return unblockUserService(userId, blockedId);
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
  const [mapStyle, setMapStyleState] = useState<'standard' | 'satellite' | 'hybrid' | '3d'>(() => {
    if (typeof window === 'undefined') return 'standard';
    try {
      const saved = localStorage.getItem('eclipse_gps_map_style');
      if (saved === 'standard' || saved === 'satellite' || saved === 'hybrid' || saved === '3d') {
        return saved;
      }
    } catch {
      // Ignore localStorage errors
    }
    return 'standard';
  });

  const setMapStyle = useCallback((style: 'standard' | 'satellite' | 'hybrid' | '3d') => {
    setMapStyleState(style);
    try {
      localStorage.setItem('eclipse_gps_map_style', style);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const DEFAULT_KOLKATA_CENTER: Location = { lat: 22.5726, lng: 88.3639 };

  // Pandal Discovery 2.0 State
  const [discoveryRadius, setDiscoveryRadius] = useState<number>(5);
  const [discoverySort, setDiscoverySort] = useState<'recommended' | 'nearest' | 'fastest' | 'least_crowded'>('nearest');
  const [discoveryCenter, setDiscoveryCenter] = useState<Location | null>(DEFAULT_KOLKATA_CENTER);
  const [mapCenter, setMapCenter] = useState<Location | null>(null);
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [userPandals, setUserPandals] = useState<Pandal[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('eclipse_gps_user_pandals');
    return saved ? JSON.parse(saved) : [];
  });

  const lastDiscoveryCenterRef = useRef<Location | null>(null);
  const isDiscoveringRef = useRef<boolean>(false);
  const lastDiscoveredParamsRef = useRef<{ center: Location; radiusKm: number; sortBy: string; timestamp: number } | null>(null);

  // Core Nearby Pandal Discovery Engine (delegates to centralized pandalDiscoveryService)
  const discoverNearbyPandals = async (center: Location | null, radiusKm: number, sortBy: string) => {
    if (!center) return;
    if (isDiscoveringRef.current) return;

    const now = Date.now();
    // Cache check: if within 250m and same radius/sort within 45s, skip redundant refetch
    if (lastDiscoveredParamsRef.current) {
      const prev = lastDiscoveredParamsRef.current;
      const distFromPrev = calculateDistanceInMeters(center, prev.center);
      if (distFromPrev < 250 && prev.radiusKm === radiusKm && prev.sortBy === sortBy && now - prev.timestamp < 45000) {
        return;
      }
    }

    isDiscoveringRef.current = true;
    setIsDiscovering(true);
    try {
      const radiusMeters = radiusKm * 1000;
      const result = await pandalDiscoveryService.discoverPandals({
        near: center,
        radius: radiusMeters,
        sortBy: sortBy as any,
      });

      lastDiscoveredParamsRef.current = {
        center,
        radiusKm,
        sortBy,
        timestamp: now,
      };

      // Include user-submitted local additions if any
      const effectiveRadiusMeters = result.searchRadius || radiusMeters;
      const userPandalsInRadius = userPandals.filter(up => {
        const dist = calculateDistanceInMeters(center, up.location);
        return dist <= effectiveRadiusMeters;
      }).map(up => {
        const directDist = Math.round(calculateDistanceInMeters(center, up.location));
        const travelTime =
          directDist < 1200
            ? `${Math.max(1, Math.round(directDist / 75))} min walk`
            : `${Math.max(3, Math.round((directDist / 1000) * 3.5 + 2))} min drive`;
        return {
          ...up,
          distance: directDist,
          estimatedTravelTime: travelTime,
          favouriteStatus: savedLocations.some(sl => sl.itemId === up.id),
          visitedStatus: visitedIds.includes(up.id),
        };
      });

      const hydratedPandals = result.pandals.map(p => {
        const directDist = typeof p.distance === 'number' ? Math.round(p.distance) : Math.round(calculateDistanceInMeters(center, p.location));
        let travelTime = p.estimatedTravelTime;
        if (!travelTime) {
          if (directDist < 1200) {
            const walkMins = Math.max(1, Math.round(directDist / 75));
            travelTime = `${walkMins} min walk`;
          } else {
            const driveMins = Math.max(3, Math.round((directDist / 1000) * 3.5 + 2));
            travelTime = `${driveMins} min drive`;
          }
        }
        return {
          ...p,
          distance: directDist,
          estimatedTravelTime: travelTime,
          favouriteStatus: savedLocations.some(sl => sl.itemId === p.id),
          visitedStatus: visitedIds.includes(p.id),
        };
      });

      const merged = [...hydratedPandals, ...(userPandalsInRadius as any[])];
      if (sortBy === 'nearest') {
        merged.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
      }
      setPandals(merged);
    } catch (e) {
      console.error('Error during nearby pandal discovery:', e);
    } finally {
      isDiscoveringRef.current = false;
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
  const lastMemberRerouteTimeRef = useRef<number>(0);
  useEffect(() => {
    if (!isNavigating || routeStops.length !== 1 || !currentLocation) return;
    const dest = routeStops[0];
    if (!dest.id || !dest.id.startsWith('member-')) return;
    
    const targetUserId = dest.id.replace('member-', '');
    const currentLoc = groupLocations[targetUserId];
    if (!currentLoc) return;
    
    const isStale = Date.now() - currentLoc.timestamp > 120000;
    if (isStale) return; // do not use stale location for navigation
    
    const currentLat = currentLoc.lat;
    const currentLng = currentLoc.lng;
    
    // Only recalculate if member's position moved by >= 15m and at least 10s passed
    const now = Date.now();
    const moveDist = calculateDistanceInMeters(
      { lat: dest.location.lat, lng: dest.location.lng },
      { lat: currentLat, lng: currentLng }
    );

    if (moveDist >= 15 && now - lastMemberRerouteTimeRef.current >= 10000 && !isCalculatingRouteRef.current) {
      lastMemberRerouteTimeRef.current = now;
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

  // Synchronize custom local identity with public user registry and Eclipse ID in Firestore
  useEffect(() => {
    if (userId && displayName && eclipseId) {
      syncUserProfile(userId, displayName, photoUrl, eclipseId).catch((err) => {
        console.warn('Failed to sync user profile with Firebase:', err);
      });
    }
  }, [userId, displayName, photoUrl, eclipseId]);

  // Listen to incoming requests, outgoing requests, friends, and blocked users
  useEffect(() => {
    if (!userId) return;

    const unsubIncoming = listenToIncomingRequests(userId, (requests) => {
      setIncomingRequests(requests);
    });
    const unsubOutgoing = listenToOutgoingRequests(userId, (requests) => {
      setOutgoingRequests(requests);
    });
    const unsubFriends = listenToFriends(userId, (friends) => {
      setFriendsList(friends);
    });
    const unsubBlocked = listenToBlockedUsers(userId, (blocked) => {
      setBlockedUsers(blocked);
    });
    const unsubSharing = listenToLocationSharingSettings(userId, (settings) => {
      setLocationSharingModeState(settings.mode);
      setSelectedFriendsToShareState(settings.selectedFriendIds || []);
      if (typeof window !== 'undefined') {
        localStorage.setItem('eclipse_gps_location_sharing_mode', settings.mode);
        localStorage.setItem('eclipse_gps_selected_friends_sharing', JSON.stringify(settings.selectedFriendIds || []));
        localStorage.setItem('eclipse_gps_shareLocationWithFriends', settings.enabled ? 'true' : 'false');
      }
    });

    return () => {
      unsubIncoming();
      unsubOutgoing();
      unsubFriends();
      unsubBlocked();
      unsubSharing();
    };
  }, [userId]);

  // Listen to live locations of friends (Phase 9 Part 3C)
  useEffect(() => {
    if (!userId || friendsList.length === 0) {
      setFriendsLocations({});
      return;
    }

    const unsubscribes: (() => void)[] = [];

    // Filter out blocked users
    const activeFriends = friendsList.filter(
      (friend) => !blockedUsers.some((b) => b.blockedId === friend.friendId)
    );

    // Prune locations for any friends who were removed or blocked
    setFriendsLocations((prev) => {
      const allowedIds = new Set(activeFriends.map((f) => f.friendId));
      let changed = false;
      const copy: Record<string, FriendLocation> = { ...prev };
      for (const id of Object.keys(copy)) {
        if (!allowedIds.has(id)) {
          delete copy[id];
          changed = true;
        }
      }
      return changed ? copy : prev;
    });

    activeFriends.forEach((friend) => {
      const unsub = listenToFriendLocation(
        friend.friendId,
        (loc) => {
          setFriendsLocations((prev) => {
            if (!loc) {
              if (!prev[friend.friendId]) return prev;
              const copy = { ...prev };
              delete copy[friend.friendId];
              return copy;
            }
            return {
              ...prev,
              [friend.friendId]: loc,
            };
          });
        },
        userId
      );
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [friendsList, blockedUsers, userId]);

  // Throttling references for Firebase live location updates (Phase 9 Part 3B)
  const lastPublishedFriendLocRef = useRef<Location | null>(null);
  const lastPublishedTimeRef = useRef<number>(0);
  const pendingPublishTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestLocationRef = useRef<Location | null>(null);
  latestLocationRef.current = currentLocation;

  // Publish our live location to Firestore for authorized friends
  useEffect(() => {
    // 1. Must have a logged in user
    if (!userId) return;

    // 2. Immediate Stop Sharing & Invalidation check
    const isSharingActive = shareLocationWithFriends && locationSharingMode !== 'off';

    if (!isSharingActive) {
      if (pendingPublishTimeoutRef.current) {
        clearTimeout(pendingPublishTimeoutRef.current);
        pendingPublishTimeoutRef.current = null;
      }
      if (lastPublishedFriendLocRef.current !== null || lastPublishedTimeRef.current !== 0) {
        lastPublishedFriendLocRef.current = null;
        lastPublishedTimeRef.current = 0;
        clearLiveLocation(userId).catch((err) => {
          console.warn('Error clearing live location on stop sharing:', err);
        });
      }
      return;
    }

    // 3. Valid GPS fix check (reusing existing GPS tracking system)
    if (!currentLocation || !hasValidGps || gpsStatus !== 'tracking') {
      return;
    }

    const now = Date.now();
    const timeSinceLastPublish = now - lastPublishedTimeRef.current;

    // Distance calculation since last write
    let distMoved = Infinity;
    if (lastPublishedFriendLocRef.current) {
      distMoved = calculateDistanceInMeters(lastPublishedFriendLocRef.current, currentLocation);
    }

    // Conservative Throttling Strategy:
    // - MIN_INTERVAL_MS: 10,000 ms (10 seconds) - never write faster than 10s
    // - MIN_DISTANCE_M: 10 meters - skip stationary noise
    // - KEEPALIVE_INTERVAL_MS: 60,000 ms (60 seconds) with >= 3 meters movement
    const MIN_INTERVAL_MS = 10000;
    const MIN_DISTANCE_M = 10;
    const KEEPALIVE_INTERVAL_MS = 60000;

    const isFirstPublish = !lastPublishedFriendLocRef.current;
    const isTimeElapsed = timeSinceLastPublish >= MIN_INTERVAL_MS;
    const hasMeaningfulMovement = distMoved >= MIN_DISTANCE_M;
    const isKeepaliveDue = timeSinceLastPublish >= KEEPALIVE_INTERVAL_MS && distMoved >= 3;

    if (isFirstPublish || (isTimeElapsed && (hasMeaningfulMovement || isKeepaliveDue))) {
      // Clear any pending queued update
      if (pendingPublishTimeoutRef.current) {
        clearTimeout(pendingPublishTimeoutRef.current);
        pendingPublishTimeoutRef.current = null;
      }

      lastPublishedTimeRef.current = now;
      lastPublishedFriendLocRef.current = currentLocation;

      publishLiveLocation(userId, currentLocation.lat, currentLocation.lng, gpsAccuracy, true, {
        mode: locationSharingMode,
        authorizedFriendIds: locationSharingMode === 'all' ? ['*'] : selectedFriendsToShare,
      }).catch((err) => {
        console.error('Error publishing live location to Firestore:', err);
      });
    } else if (hasMeaningfulMovement && !isTimeElapsed) {
      // Meaningful movement occurred, but cooldown is active: queue a trailing publish
      if (!pendingPublishTimeoutRef.current) {
        const remainingTime = Math.max(500, MIN_INTERVAL_MS - timeSinceLastPublish);
        pendingPublishTimeoutRef.current = setTimeout(() => {
          pendingPublishTimeoutRef.current = null;
          const loc = latestLocationRef.current;
          if (!loc || !shareLocationWithFriends || locationSharingMode === 'off') return;

          lastPublishedTimeRef.current = Date.now();
          lastPublishedFriendLocRef.current = loc;

          publishLiveLocation(userId, loc.lat, loc.lng, gpsAccuracy, true, {
            mode: locationSharingMode,
            authorizedFriendIds: locationSharingMode === 'all' ? ['*'] : selectedFriendsToShare,
          }).catch((err) => {
            console.error('Error publishing queued live location to Firestore:', err);
          });
        }, remainingTime);
      }
    }
  }, [
    shareLocationWithFriends,
    locationSharingMode,
    selectedFriendsToShare,
    currentLocation,
    userId,
    gpsAccuracy,
    gpsStatus,
    hasValidGps,
  ]);

  // Clean up location on unmount or sign-out
  useEffect(() => {
    return () => {
      if (pendingPublishTimeoutRef.current) {
        clearTimeout(pendingPublishTimeoutRef.current);
        pendingPublishTimeoutRef.current = null;
      }
      if (userId) {
        clearLiveLocation(userId).catch(() => {});
      }
    };
  }, [userId]);

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
  }, [activeGroup, groupSharingEnabled, currentLocation, userId, gpsAccuracy, gpsStatus]);

  // Clean up group location on unmount or group change
  useEffect(() => {
    return () => {
      if (activeGroup && userId) {
        clearGroupLocationFb(activeGroup.id, userId).catch(() => {});
      }
    };
  }, [activeGroup?.id, userId]);

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

  const isRequestingLocationRef = useRef<boolean>(false);

  // Request location from browser/device with fallback for Android 12+ Approximate location & indoor delays
  const requestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setHasValidGps(false);
      setCurrentLocation(null);
      setGpsStatus('error');
      setGpsErrorMsg('HTML5 Geolocation is not supported by your browser or device.');
      return;
    }

    if (isRequestingLocationRef.current) {
      return;
    }
    isRequestingLocationRef.current = true;

    setGpsStatus('requesting');
    setGpsErrorMsg(null);

    const onLocationSuccess = (pos: GeolocationPosition) => {
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
      isRequestingLocationRef.current = false;
    };

    // Attempt 1: High accuracy (Precise GPS fix on Android)
    navigator.geolocation.getCurrentPosition(
      onLocationSuccess,
      (err) => {
        console.warn('High-accuracy GPS location acquisition error:', err);
        // If user explicitly denied permission, stop immediately
        if (err.code === 1) {
          isRequestingLocationRef.current = false;
          setHasValidGps(false);
          setCurrentLocation(null);
          setPermissionState('denied');
          setGpsStatus('denied');
          setGpsErrorMsg('Location permission was denied. Eclipse GPS requires your real location to navigate.');
          return;
        }

        // On Android 12+, if user chose "Approximate" (coarse location only),
        // or if high-accuracy satellite fix times out (code 3) / is unavailable (code 2),
        // fall back to standard/low accuracy to obtain position immediately.
        navigator.geolocation.getCurrentPosition(
          onLocationSuccess,
          (fallbackErr) => {
            console.warn('Fallback low-accuracy location error:', fallbackErr);
            isRequestingLocationRef.current = false;
            setHasValidGps(false);
            setCurrentLocation(null);
            if (fallbackErr.code === 1) {
              setPermissionState('denied');
              setGpsStatus('denied');
              setGpsErrorMsg('Location permission was denied. Eclipse GPS requires your real location to navigate.');
            } else if (fallbackErr.code === 2) {
              setPermissionState('granted');
              setGpsStatus('error');
              setGpsErrorMsg('Waiting for your location... GPS position unavailable. Please ensure Location/GPS is turned ON in your phone settings.');
            } else if (fallbackErr.code === 3) {
              setPermissionState('granted');
              setGpsStatus('error');
              setGpsErrorMsg('Waiting for your location... GPS request timed out. Tap RETRY to acquire signal.');
            } else {
              setGpsStatus('error');
              setGpsErrorMsg(fallbackErr.message || 'Unable to retrieve your real-time GPS location.');
            }
          },
          {
            enableHighAccuracy: false,
            timeout: 12000,
            maximumAge: 60000,
          }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 9000,
        maximumAge: 10000,
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
              setGpsErrorMsg('Location access is blocked. Please allow location access in your device settings.');
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
            setGpsErrorMsg('Location access was denied. Please allow location access in your device settings.');
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

  // When app returns to foreground (e.g. user returns from device Settings after granting permission)
  useEffect(() => {
    const handleResume = () => {
      if (document.visibilityState === 'visible' && (!hasValidGps || gpsStatus !== 'tracking')) {
        if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
          navigator.permissions
            .query({ name: 'geolocation' as PermissionName })
            .then((status) => {
              if (status.state === 'granted') {
                setPermissionState('granted');
                requestLocation();
              }
            })
            .catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', handleResume);
    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', handleResume);
    };
  }, [hasValidGps, gpsStatus, requestLocation]);

  // Coordinate significant movement and automatic discovery trigger (250m threshold)
  useEffect(() => {
    if (!currentLocation || !hasValidGps) return;
    if (!lastDiscoveryCenterRef.current) {
      lastDiscoveryCenterRef.current = currentLocation;
      setDiscoveryCenter(currentLocation);
      return;
    }
    const dist = calculateDistanceInMeters(currentLocation, lastDiscoveryCenterRef.current);
    if (dist >= 250) {
      lastDiscoveryCenterRef.current = currentLocation;
      setDiscoveryCenter(currentLocation);
    }
  }, [currentLocation, hasValidGps]);

  // Trigger discovery on discoveryCenter, discoveryRadius, or discoverySort changes
  useEffect(() => {
    if (!discoveryCenter) return;
    discoverNearbyPandals(discoveryCenter, discoveryRadius, discoverySort);
  }, [discoveryCenter, discoveryRadius, discoverySort]);

  // Continuous Geolocation Tracking with throttling and stationary noise rejection
  const lastProcessedPosRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const lastStateUpdatePosRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const lastValidLocationRef = useRef<Location | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;

    if (hasValidGps && watchLocation) {
      // 1. Clear any prior watcher to strictly prevent duplicate watchers
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newLat = position.coords.latitude;
          const newLng = position.coords.longitude;
          const accuracy = position.coords.accuracy;
          const speedVal = position.coords.speed || 0;
          const headingVal = position.coords.heading || 0;
          const now = Date.now();

          // Reject unreasonable accuracy spikes (> 1500m when we already have a fix)
          if (accuracy > 1500 && lastValidLocationRef.current) {
            return;
          }

          const loc = { lat: newLat, lng: newLng };
          lastValidLocationRef.current = loc;
          travelDistanceService.recordPosition(position);

          // Fast direct dispatch for smooth 60fps marker gliding without React re-render cascades
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('eclipse-gps-tick', {
                detail: { lat: newLat, lng: newLng, accuracy, speed: speedVal, heading: headingVal },
              })
            );
          }

          // Stationary noise rejection & React state update throttling
          if (lastStateUpdatePosRef.current) {
            const distSinceState = calculateDistanceInMeters(
              { lat: newLat, lng: newLng },
              { lat: lastStateUpdatePosRef.current.lat, lng: lastStateUpdatePosRef.current.lng }
            );
            const timeSinceState = now - lastStateUpdatePosRef.current.time;

            // Reject poor-accuracy jump if we already have an accurate fix
            if (accuracy > 80 && (gpsAccuracy || 0) < 35 && distSinceState > 15) {
              return;
            }

            // If user moved less than 3.5 meters, they are stationary:
            // Do NOT re-render React application!
            if (distSinceState < 3.5) {
              return;
            }

            // While moving, throttle React state updates to at most once per 1200ms
            // unless significant movement (>= 8.0 meters) has occurred
            if (distSinceState < 8.0 && timeSinceState < 1200) {
              return;
            }
          }

          lastStateUpdatePosRef.current = { lat: newLat, lng: newLng, time: now };
          lastProcessedPosRef.current = { lat: newLat, lng: newLng, time: now };

          setCurrentLocation(loc);
          setGpsAccuracy(accuracy);
          setSpeed(speedVal);
          setHeading(headingVal);
          setGpsErrorMsg(null);
          setGpsStatus('tracking');
        },
        (error) => {
          console.warn('Geolocation Watch Position error:', error);
          if (error.code === 1) {
            // Permission explicitly revoked during session
            setPermissionState('denied');
            setHasValidGps(false);
            setCurrentLocation(null);
            setGpsStatus('denied');
            setGpsErrorMsg('Eclipse GPS cannot be used without location access. Please enable location access to continue.');
          } else {
            // Transient timeout (code 3) or temporary satellite obstruction (code 2):
            // Keep last valid location coordinates active rather than freezing or abruptly locking user out
            console.warn('Transient watchPosition signal obstruction:', error.message);
            if (lastValidLocationRef.current) {
              setCurrentLocation(lastValidLocationRef.current);
            }
            // Keep tracking status active so UI does not unmount or freeze
            setGpsStatus('tracking');
          }
          setGpsAccuracy(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000,
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
  }, [helpImproveCrowd, currentLocation, gpsAccuracy, gpsStatus, pandals, pandalGeofenceMeters]);

  // Clean up crowd session on unmount
  useEffect(() => {
    return () => {
      if (crowdSessionIdRef.current && isFirebaseConfigured()) {
        try {
          const db = getFirebaseDatabase();
          const sessionRef = ref(db, `crowd_sessions/${crowdSessionIdRef.current}`);
          remove(sessionRef).catch(() => {});
        } catch (_) {}
      }
    };
  }, []);

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
      mapRef.setView([currentLocation.lat, currentLocation.lng], 16);
    } else if (!hasValidGps || !currentLocation) {
      requestLocation();
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
    if (!stopsList || stopsList.length === 0) {
      setActiveRoute(null);
      return;
    }

    const currentRequestId = ++routeRequestIdRef.current;
    setIsCalculatingRoute(true);
    setRoutingError(null);

    const destItem = stopsList[stopsList.length - 1];
    const destLoc = extractLocation(destItem);
    if (!destLoc) {
      setRoutingError('Invalid destination location for route.');
      setIsCalculatingRoute(false);
      return;
    }

    const waypointsList = stopsList.slice(0, -1).map(s => ({
      name: s.name,
      location: extractLocation(s) || { lat: 22.5726, lng: 88.3639 },
      isPandalOrEvent: true,
      itemId: s.id,
    }));

    const originLoc = extractLocation(currentLocation) || lastValidLocationRef.current;
    if (!originLoc) {
      setRoutingError('GPS location not acquired yet. Please wait for GPS signal.');
      setIsCalculatingRoute(false);
      return;
    }

    try {
      const osrmProfile = routePreference === 'DRIVING' ? 'driving' : 'foot';
      const calculatedRoute = await routingService.calculateRoute(
        originLoc,
        destLoc,
        waypointsList,
        3,
        osrmProfile
      );
      if (currentRequestId === routeRequestIdRef.current) {
        setActiveRoute(calculatedRoute);
        setCurrentStepIndex(0);
      }
    } catch (err: any) {
      console.error('Failed to trigger road route calculation:', err);
    } finally {
      if (currentRequestId === routeRequestIdRef.current) {
        setIsCalculatingRoute(false);
      }
    }
  };

  // Direct simple routing to a place/event
  const calculateRouteToItem = async (item: Pandal | Event | any) => {
    if (!item || isCalculatingRouteRef.current) return;
    const destLoc = extractLocation(item);
    if (!destLoc) {
      console.warn('Cannot calculate route: destination location is invalid.');
      setRoutingError('Cannot calculate route: destination location is invalid.');
      setIsCalculatingRoute(false);
      return;
    }

    // Starting a new destination cleanly resets previous speech and puja route session
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPujaRouteSession(null);

    isCalculatingRouteRef.current = true;
    const currentRequestId = ++routeRequestIdRef.current;
    setIsCalculatingRoute(true);
    setRoutingError(null);
    setRouteStops([item]);
    setSelectedItem(item);

    const originLoc = extractLocation(currentLocation) || lastValidLocationRef.current;
    if (!originLoc) {
      setRoutingError('Waiting for GPS position to calculate route.');
      setIsCalculatingRoute(false);
      isCalculatingRouteRef.current = false;
      return;
    }

    try {
      const osrmProfile = routePreference === 'DRIVING' ? 'driving' : 'foot';
      const calculatedRoute = await routingService.calculateRoute(
        originLoc,
        destLoc,
        [],
        3,
        osrmProfile
      );

      if (currentRequestId === routeRequestIdRef.current) {
        setActiveRoute(calculatedRoute);
        setCurrentStepIndex(0);
        setIsNavigating(true);
        setActiveTab('home');
        setSelectedItem(null);
      }
    } catch (e: any) {
      if (currentRequestId === routeRequestIdRef.current) {
        console.warn('Failed to calculate direct route, using guaranteed direct fallback:', e);
        const fallback = (routingService as any).generateFallbackRoute?.(originLoc, destLoc, [], routePreference === 'DRIVING' ? 'driving' : 'foot') || {
          id: `direct-route-${Date.now()}`,
          name: `Direct Route to ${item.name || 'Destination'}`,
          origin: originLoc,
          destination: destLoc,
          waypoints: [],
          geometry: [originLoc, destLoc],
          distance: calculateDistanceInMeters(originLoc, destLoc),
          duration: Math.round(calculateDistanceInMeters(originLoc, destLoc) / 1.3),
          instructions: [
            { text: `Head towards ${item.name || 'destination'}`, distance: calculateDistanceInMeters(originLoc, destLoc), duration: 60 },
            { text: `Arrive at ${item.name || 'destination'}`, distance: 0, duration: 0 },
          ],
        };
        setActiveRoute(fallback);
        setCurrentStepIndex(0);
        setIsNavigating(true);
        setActiveTab('home');
        setSelectedItem(null);
      }
    } finally {
      if (currentRequestId === routeRequestIdRef.current) {
        setIsCalculatingRoute(false);
      }
      isCalculatingRouteRef.current = false;
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
    const destLoc = extractLocation(firstStop);
    if (!destLoc) return;

    const osrmProfile = routePreference === 'DRIVING' ? 'driving' : 'foot';
    const originLoc = extractLocation(currentLocation) || lastValidLocationRef.current || destLoc;

    setRouteStops([firstStop as any]);
    setSelectedItem(firstStop as any);
    setCurrentStepIndex(0);

    const currentRequestId = ++routeRequestIdRef.current;
    setIsCalculatingRoute(true);
    setRoutingError(null);

    try {
      const calculatedRoute = await routingService.calculateRoute(
        originLoc,
        destLoc,
        [],
        3,
        osrmProfile
      );
      if (currentRequestId === routeRequestIdRef.current) {
        setActiveRoute(calculatedRoute);
        setIsNavigating(true);
        setActiveTab('home');
        setSelectedItem(null);
      }
    } catch (err) {
      console.error('Failed to calculate route for first puja stop, using direct fallback:', err);
      if (currentRequestId === routeRequestIdRef.current) {
        await calculateRouteToItem(firstStop);
        setIsNavigating(true);
        setActiveTab('home');
      }
    } finally {
      if (currentRequestId === routeRequestIdRef.current) {
        setIsCalculatingRoute(false);
      }
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
    const destLoc = extractLocation(nextStop);
    if (!destLoc) return;

    const osrmProfile = routePreference === 'DRIVING' ? 'driving' : 'foot';
    const originLoc = extractLocation(currentLocation) || lastValidLocationRef.current || extractLocation(currentStop) || destLoc;

    setPujaRouteSession({
      isActive: true,
      stops,
      currentStopIndex: nextIndex,
      completedStopIds: updatedCompletedIds,
    });

    setRouteStops([nextStop as any]);
    setSelectedItem(nextStop as any);
    setCurrentStepIndex(0);

    const currentRequestId = ++routeRequestIdRef.current;
    setIsCalculatingRoute(true);

    try {
      const calculatedRoute = await routingService.calculateRoute(
        originLoc,
        destLoc,
        [],
        3,
        osrmProfile
      );
      if (currentRequestId === routeRequestIdRef.current) {
        setActiveRoute(calculatedRoute);
        setIsNavigating(true);
      }
    } catch (err) {
      console.error('Failed to calculate route to next puja stop, using direct fallback:', err);
      if (currentRequestId === routeRequestIdRef.current) {
        await calculateRouteToItem(nextStop);
        setIsNavigating(true);
      }
    } finally {
      if (currentRequestId === routeRequestIdRef.current) {
        setIsCalculatingRoute(false);
      }
    }
  };

  const stopNavigation = useCallback(() => {
    routeRequestIdRef.current++;
    isCalculatingRouteRef.current = false;
    setIsCalculatingRoute(false);
    setRoutingError(null);
    setIsNavigating(false);
    setActiveRoute(null);
    setPujaRouteSession(null);
    setCurrentStepIndex(0);
    setSelectedItem(null);
    setActiveTab('home');
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

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
    stopNavigation();
  };

  // Start walking navigation from a verified Metro entrance/exit gate to the pandal
  const startGateWalkingNavigation = (
    gateOpt: MetroGateRouteOption,
    targetPandalItem: any,
    stationName?: string
  ) => {
    const gateLoc: Location = gateOpt.gate.location || {
      lat: gateOpt.gate.latitude!,
      lng: gateOpt.gate.longitude!,
    };
    const pandalLoc: Location =
      targetPandalItem.location || {
        lat: targetPandalItem.latitude,
        lng: targetPandalItem.longitude,
      };

    const stName = stationName || 'Metro';
    const walkingRoute: Route = {
      id: `metro-walk-${gateOpt.gate.gateNumber}-${Date.now()}`,
      name: `Walk: ${stName} Gate ${gateOpt.gate.gateNumber} → ${targetPandalItem.name}`,
      origin: gateLoc,
      destination: pandalLoc,
      waypoints: [],
      geometry: gateOpt.geometry && gateOpt.geometry.length > 0 ? gateOpt.geometry : [gateLoc, pandalLoc],
      distance: gateOpt.distanceMeters,
      duration: gateOpt.walkingMinutes * 60,
      instructions: [
        {
          text: `Exit ${stName} via Gate ${gateOpt.gate.gateNumber}${gateOpt.gate.name ? ` (${gateOpt.gate.name})` : ''}${gateOpt.gate.landmark ? ` towards ${gateOpt.gate.landmark}` : ''}`,
          distance: 20,
          duration: 30,
        },
        {
          text: `Walk along pedestrian route towards ${targetPandalItem.name}`,
          distance: Math.max(0, gateOpt.distanceMeters - 20),
          duration: Math.max(0, gateOpt.walkingMinutes * 60 - 30),
        },
        {
          text: `Arrive at ${targetPandalItem.name}`,
          distance: 0,
          duration: 0,
        },
      ],
    };

    setRoutePreference('WALKING');
    setActiveRoute(walkingRoute);
    setIsNavigating(true);
    setCurrentStepIndex(0);
    setActiveTab('home');
    if (mapRef) {
      if (mapRef.setView) {
        mapRef.setView([gateLoc.lat, gateLoc.lng], 17);
      }
    }
  };

  // Select an alternative route to make it the active navigation route
  const selectAlternativeRoute = useCallback((selectedAltRoute: Route) => {
    setActiveRoute((currentActiveRoute) => {
      if (!currentActiveRoute) return null;
      const allRoutes = [currentActiveRoute, ...(currentActiveRoute.alternatives || [])];
      const newActive = allRoutes.find((r) => r.id === selectedAltRoute.id) || selectedAltRoute;
      const remainingAlternatives = allRoutes.filter((r) => r.id !== newActive.id);
      return {
        ...newActive,
        alternatives: remainingAlternatives,
      };
    });
    setCurrentStepIndex(0);
  }, []);

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

  // Off-route reroute calculation
  const triggerOffRouteReroute = useCallback(async () => {
    if (!activeRoute || !activeRoute.destination || isCalculatingRouteRef.current) return;
    const originLoc = extractLocation(currentLocation) || lastValidLocationRef.current;
    if (!originLoc) return;

    isCalculatingRouteRef.current = true;
    const currentRequestId = ++routeRequestIdRef.current;
    setIsCalculatingRoute(true);
    setRoutingError(null);

    try {
      const osrmProfile = routePreference === 'DRIVING' ? 'driving' : 'foot';
      const recalculated = await routingService.calculateRoute(
        originLoc,
        activeRoute.destination,
        activeRoute.waypoints || [],
        false,
        osrmProfile
      );
      if (currentRequestId === routeRequestIdRef.current) {
        setActiveRoute(recalculated);
        setCurrentStepIndex(0);
      }
    } catch (err: any) {
      console.warn('Reroute calculation failed:', err);
    } finally {
      if (currentRequestId === routeRequestIdRef.current) {
        setIsCalculatingRoute(false);
      }
      isCalculatingRouteRef.current = false;
    }
  }, [activeRoute, currentLocation, routePreference]);

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
      let metroGateResult: any | undefined = undefined;
      let finalContent = data.text || "I processed your request.";

      // Map action trigger execution!
      if (data.action) {
        const actionResult = await executeAIActionOnMap(data.action, data.parameters || {});
        if (actionResult?.error) {
          finalContent = actionResult.error;
        } else {
          if (actionResult?.message) {
            finalContent = actionResult.message;
          }
          if (actionResult?.pandals && actionResult.pandals.length > 0) {
            discoveredPandals = actionResult.pandals;
          }
          if (actionResult?.bonediBaris && actionResult.bonediBaris.length > 0) {
            discoveredBonediBaris = actionResult.bonediBaris;
          }
          if (actionResult?.metroGateResult) {
            metroGateResult = actionResult.metroGateResult;
          }
          if (data.action === 'NAVIGATE_TO_NEAREST_PANDAL' || data.action === 'NAVIGATE_TO') {
            setIsAiSheetOpen(false);
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
        metroGateResult,
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
  const executeAIActionOnMap = async (actionType: string, params: any): Promise<{ pandals?: any[]; bonediBaris?: any[]; error?: string; message?: string; metroGateResult?: MetroGateIntelligenceResult }> => {
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

      case 'SHOW_UNVISITED_PANDALS':
      case 'SEARCH_UNVISITED_PANDALS': {
        // Respect the existing Location Required gate:
        // Current valid GPS position is required for location-based unvisited discovery.
        if (!currentLocation || !hasValidGps || gpsStatus !== 'tracking') {
          return {
            error: 'GPS location is required to discover unvisited pandals near your current position. Please ensure location access is enabled and your device GPS position is acquired.',
            pandals: [],
          };
        }

        // Use the existing Smart Pandal Discovery system with user's valid GPS position
        const discoveryResult = await pandalDiscoveryService.discoverPandals({
          near: currentLocation,
          radius: params.radius || (discoveryRadius * 1000) || 5000,
          sortBy: 'nearest',
          mode: 'nearby',
          skipExternalSearch: true,
        });

        // Collect all visited IDs using the existing Visited Pandals data & records
        const visitedSet = new Set<string>([
          ...visitedIds,
          ...visitedPandalsService.getRecords().map(r => r.pandalId),
          ...eventsService.getVisited(),
        ]);

        let candidatePandals = [...discoveryResult.pandals];

        // If very few candidates found in initial radius, expand to all local candidates
        if (candidatePandals.length === 0) {
          const allLocal = pandalDiscoveryService.getLocalCandidates();
          if (allLocal.length > 0) {
            candidatePandals = allLocal.map(p => ({
              ...p,
              distance: calculateDistanceInMeters(currentLocation, p.location),
            }));
          }
        }

        // Filter: Show only pandals that the user has not visited
        let unvisited = candidatePandals.filter(p => !visitedSet.has(p.id) && !p.visitedStatus);

        // If all within current radius were visited, inspect broader verified catalog for unvisited ones
        if (unvisited.length === 0) {
          const allLocal = pandalDiscoveryService.getLocalCandidates();
          const unvisitedLocal = allLocal
            .filter(p => !visitedSet.has(p.id) && !p.visitedStatus)
            .map(p => ({
              ...p,
              distance: calculateDistanceInMeters(currentLocation, p.location),
            }));
          unvisitedLocal.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
          if (unvisitedLocal.length > 0) {
            unvisited = unvisitedLocal.slice(0, 25);
          }
        }

        // Sort them by real GPS distance, nearest-first
        unvisited.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

        if (unvisited.length === 0) {
          return {
            message: 'All Durga Puja pandals in this area have already been visited! Fantastic pandal hopping progress.',
            pandals: [],
          };
        }

        // Hydrate & reuse the existing Pandal cards/UI
        setPandals(unvisited);
        setSearchResults(unvisited);
        setActiveTab('home');

        if (unvisited.length > 0 && mapRef) {
          const first = unvisited[0];
          if (mapRef.setView) {
            mapRef.setView([first.location.lat, first.location.lng], 15);
          } else if (mapRef.setCenter) {
            mapRef.setCenter({ lat: first.location.lat, lng: first.location.lng });
            mapRef.setZoom(15);
          }
        }

        return {
          pandals: unvisited,
          message: `Found ${unvisited.length} unvisited Durga Puja pandals near your location, sorted nearest-first.`,
        };
      }

      case 'SEARCH_NEARBY_PANDALS':
      case 'SEARCH_PANDALS_BY_NAME':
      case 'SEARCH_PANDALS_BY_AREA':
      case 'SEARCH_PANDALS': {
        const isNearbyRequest = actionType === 'SEARCH_NEARBY_PANDALS' || (!params.query && !params.name && !params.area);
        const queryTerm = isNearbyRequest ? '' : (params.name || params.query || '');
        if (queryTerm.toLowerCase().includes('unvisited')) {
          return executeAIActionOnMap('SHOW_UNVISITED_PANDALS', params);
        }

        // Respect the existing Location Required gate:
        // Current valid GPS position is required for nearby pandal discovery.
        if (isNearbyRequest && (!currentLocation || !hasValidGps || gpsStatus !== 'tracking')) {
          return {
            error: 'GPS location is required to discover pandals near your current position. Please ensure location access is enabled and your device GPS position is acquired.',
            pandals: [],
          };
        }

        const searchArea = actionType === 'SEARCH_PANDALS_BY_AREA' ? (params.area || params.query) : params.area;

        // Use the existing Smart Pandal Discovery system with user's valid GPS position
        const discoveryResult = await pandalDiscoveryService.discoverPandals({
          near: currentLocation,
          radius: params.radius || (discoveryRadius * 1000) || 5000,
          query: queryTerm,
          area: searchArea,
          sortBy: isNearbyRequest ? 'nearest' : (params.sortBy || discoverySort || 'nearest'),
          mode: isNearbyRequest ? 'nearby' : (actionType === 'SEARCH_PANDALS_BY_NAME' ? 'name' : actionType === 'SEARCH_PANDALS_BY_AREA' ? 'area' : 'nearby'),
          skipExternalSearch: isNearbyRequest,
        });

        // Ensure nearest-first sorting strictly by distance
        const resolvedPandals = [...discoveryResult.pandals];
        if (isNearbyRequest) {
          resolvedPandals.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
        }

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
        if (params.category === 'unvisited' || params.category === 'unvisited_pandal') {
          return executeAIActionOnMap('SHOW_UNVISITED_PANDALS', params);
        }
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

      case 'NAVIGATE_TO_NEAREST_PANDAL': {
        // Respect the existing Location Required gate:
        // Real GPS location is required to calculate and navigate to the nearest pandal.
        if (!currentLocation || !hasValidGps || gpsStatus !== 'tracking') {
          return {
            error: 'GPS location is required to navigate to the nearest pandal. Please ensure location access is enabled and your device GPS position is acquired.',
            pandals: [],
          };
        }

        // Use the existing Smart Pandal Discovery system with user's valid GPS position
        const discoveryResult = await pandalDiscoveryService.discoverPandals({
          near: currentLocation,
          radius: params.radius || (discoveryRadius * 1000) || 5000,
          sortBy: 'nearest',
          mode: 'nearby',
          skipExternalSearch: true,
        });

        let candidatePandals = [...discoveryResult.pandals];
        if (candidatePandals.length === 0) {
          // If none within initial radius, fallback to all local verified pandals
          const allLocal = pandalDiscoveryService.getLocalCandidates();
          if (allLocal.length > 0) {
            candidatePandals = allLocal.map(p => ({
              ...p,
              distance: calculateDistanceInMeters(currentLocation, p.location),
            }));
          }
        }

        // Nearest-first sorting strictly by geodesic distance
        candidatePandals.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

        if (candidatePandals.length === 0) {
          return {
            error: 'No Durga Puja pandals found in the verified database.',
            pandals: [],
          };
        }

        const nearestPandal = candidatePandals[0];

        // 1. Automatically select that pandal
        setSelectedItem(nearestPandal as any);
        setPandals(candidatePandals);
        setSearchResults(candidatePandals);

        // 2. Start the existing navigation flow to that pandal
        // Reuses the existing Walking/Driving mode (routePreference), OSRM routing,
        // alternatives, rerouting, GPS follow mode, HUD, ETA, and voice navigation
        await calculateRouteToItem(nearestPandal);
        setIsNavigating(true);
        setActiveTab('home');

        if (mapRef) {
          if (mapRef.setView) {
            mapRef.setView([nearestPandal.location.lat, nearestPandal.location.lng], 16);
          } else if (mapRef.setCenter) {
            mapRef.setCenter({ lat: nearestPandal.location.lat, lng: nearestPandal.location.lng });
            mapRef.setZoom(16);
          }
        }

        const distKm = nearestPandal.distance !== undefined ? (nearestPandal.distance / 1000).toFixed(1) : null;
        const distInfo = distKm ? ` (${distKm} km away)` : '';
        const navMessage = `Navigating to ${nearestPandal.name}${distInfo}. Turn-by-turn navigation started.`;

        return {
          pandals: [nearestPandal],
          message: navMessage,
        };
      }

      case 'PLAN_PUJA_ROUTE': {
        // Respect the existing Location Required gate
        if (!currentLocation || !hasValidGps || gpsStatus !== 'tracking') {
          return {
            error: 'GPS location is required to plan your Puja route from your current position. Please ensure location access is enabled and your device GPS position is acquired.',
            pandals: [],
          };
        }

        // Switch to the existing Multi-Pandal Puja Route feature
        setActiveTab('routes');
        setIsAiSheetOpen(false);

        return {
          message: 'Opened the Multi-Pandal Puja Route planner from your real GPS position. Select your pandals from the catalog below, then optimize the route to see your ordered itinerary before starting navigation.',
          pandals: [],
        };
      }

      case 'METRO_GATE_INTELLIGENCE': {
        // Respect the existing Location Required gate
        if (!currentLocation || !hasValidGps || gpsStatus !== 'tracking') {
          return {
            error: 'GPS location is required to evaluate metro exit routes and navigation from your position. Please ensure location access is enabled and your device GPS position is acquired.',
            pandals: [],
          };
        }

        // 1. Resolve target pandal using selected/existing pandal or explicit reference
        let targetPandal: Pandal | null = null;
        if (selectedItem && (('crowd' in selectedItem || 'historicalSignificance' in selectedItem || 'nearestMetro' in selectedItem) || pandals.some(p => p.id === selectedItem.id))) {
          targetPandal = selectedItem as Pandal;
        } else if (params.pandalId) {
          targetPandal = pandals.find(p => p.id === params.pandalId) || (curatedEclipsePandals.find(p => p.id === params.pandalId) as any) || null;
        } else if (params.pandalName || params.name || params.query) {
          const rawQ = (params.pandalName || params.name || params.query) as string;
          const cleanQ = rawQ
            .toLowerCase()
            .replace(/which metro (exit|gate) (should i take )?(for )?/gi, '')
            .replace(/what metro (exit|gate) (should i take )?(for )?/gi, '')
            .replace(/best metro (exit|gate) (for )?/gi, '')
            .replace(/this pandal/gi, '')
            .trim();
          if (cleanQ) {
            targetPandal = pandals.find(p => p.name.toLowerCase().includes(cleanQ)) ||
                           (curatedEclipsePandals.find(p => p.name.toLowerCase().includes(cleanQ)) as any) || null;
          }
        }

        if (!targetPandal && selectedItem && 'location' in selectedItem) {
          targetPandal = selectedItem as any;
        }

        if (!targetPandal && routeStops.length > 0) {
          const found = routeStops.find(s => pandals.some(p => p.id === s.id) || 'historicalSignificance' in s || 'crowd' in s);
          if (found) {
            targetPandal = found as Pandal;
          }
        }

        if (!targetPandal) {
          return {
            error: 'No Durga Puja pandal is currently selected. Please select a pandal on the map or from the catalog first, or specify the pandal name (e.g. "Which metro exit should I take for College Square?").',
            pandals: [],
          };
        }

        setSelectedItem(targetPandal);

        // 2. Find nearby metro station for this pandal
        const nearestMetro = targetPandal.nearestMetro;
        const pandalLoc: Location = targetPandal.location || {
          lat: (targetPandal as any).latitude,
          lng: (targetPandal as any).longitude,
        };

        const matchedMetroStation = metroIntelligenceProvider.findStationForPandal(
          nearestMetro,
          pandalLoc
        );

        if (!matchedMetroStation) {
          return {
            error: `No Kolkata Metro station found within walking distance for ${targetPandal.name}.`,
            pandals: [targetPandal as any],
          };
        }

        // 3. Compute verified gate intelligence using existing Metro Gate Intelligence service
        const gateIntelligence = await metroIntelligenceProvider.calculateMetroGateIntelligence(
          matchedMetroStation,
          targetPandal
        );

        // 4. If verified gate data is unavailable, clearly say so
        if (!gateIntelligence.hasVerifiedGates || !gateIntelligence.recommendedGate || gateIntelligence.allGateRoutes.length === 0) {
          setActiveMetroGateIntelligence({
            hasVerifiedGates: false,
            station: matchedMetroStation,
            targetPandal,
            otherGates: [],
            allGateRoutes: [],
          });
          return {
            message: `The nearest metro station for **${targetPandal.name}** is **${matchedMetroStation.name}**. However, verified individual entrance/exit gate coordinates are not yet available for this station. Station-level coordinates are mapped, but gate-specific exit recommendations are unverified.`,
            pandals: [targetPandal as any],
          };
        }

        // 5. Activate verified gate intelligence on map
        setActiveMetroGateIntelligence(gateIntelligence);

        const rec = gateIntelligence.recommendedGate;
        const others = gateIntelligence.otherGates || [];

        let summaryMsg = `Recommended Metro Exit for **${targetPandal.name}**:\n` +
          `• Exit via **Gate ${rec.gate.gateNumber}${rec.gate.name ? ` (${rec.gate.name})` : ''}** of **${matchedMetroStation.name}**\n` +
          `• Real Walking Distance: **${rec.walkingDistanceFormatted}**\n` +
          `• Real Walking Time: **${rec.walkingTimeFormatted}**\n` +
          (rec.gate.landmark ? `• Orientation: Towards ${rec.gate.landmark}\n` : '');

        if (others.length > 0) {
          summaryMsg += `\nOther verified exits compared:\n` +
            others.map(g => `• Gate ${g.gate.gateNumber}${g.gate.name ? ` (${g.gate.name})` : ''}: ${g.walkingDistanceFormatted} (${g.walkingTimeFormatted})`).join('\n');
        }

        summaryMsg += `\n\nTap **"Start Walking Navigation"** below to begin turn-by-turn guidance from Gate ${rec.gate.gateNumber} directly to ${targetPandal.name}.`;

        return {
          message: summaryMsg,
          metroGateResult: gateIntelligence,
          pandals: [targetPandal as any],
        };
      }

      case 'NAVIGATE_TO': {
        const targetName = params.locationName || params.name || params.query || params.destination || '';
        if (typeof targetName === 'string') {
          const lower = targetName.toLowerCase();
          if (lower.includes('nearest pandal') || lower.includes('closest pandal') || lower === 'nearest') {
            return executeAIActionOnMap('NAVIGATE_TO_NEAREST_PANDAL', params);
          }
        }

        let item = params.itemId ? (bonediBariIntelligenceProvider.getById(params.itemId) || eventsService.getItemById(params.itemId)) : null;
        if (!item) {
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
        isCalculatingRoute,
        routingError,
        clearRoutingError,
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
        stopNavigation,
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
        eclipseId,
        displayName,
        setDisplayName,
        photoUrl,
        setPhotoUrl,
        sharingLocation,
        setSharingLocation,
        shareLocationWithFriends,
        setShareLocationWithFriends,
        locationSharingMode,
        selectedFriendsToShare,
        setLocationSharingMode,
        toggleFriendLocationSharing,
        setFriendLocationSharing,
        stopLocationSharing,
        friendsList,
        friendsLocations,
        incomingRequests,
        outgoingRequests,
        blockedUsers,
        sendFriendRequestToUser,
        acceptFriendRequestAction,
        rejectFriendRequestAction,
        cancelFriendRequestAction,
        removeFriendAction,
        blockFriendAction,
        unblockFriendAction,
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
        startGateWalkingNavigation,

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
