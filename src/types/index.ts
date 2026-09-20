export type CrowdLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'HEAVY' | 'EXTREME' | 'UNAVAILABLE';

export type ReportSource = 'LIVE API' | 'COMMUNITY REPORT' | 'ORGANIZER' | 'DEMO' | 'AI ESTIMATE' | 'UNAVAILABLE';

export interface Location {
  lat: number;
  lng: number;
}

export interface TrafficStatus {
  routeId: string;
  level: 'low' | 'moderate' | 'heavy' | 'jam';
  lastUpdated: number;
}

export interface User {
  id: string;
  name: string;
  email?: string;
}

export interface Place {
  id: string;
  name: string;
  type: 'place' | 'restaurant' | 'parking' | 'landmark';
  location: Location;
  address: string;
  description: string;
  rating?: number;
  image?: string;
  crowdLevel: CrowdLevel;
  parkingStatus: 'easy' | 'moderate' | 'full';
  openingHours?: string;
}

export interface Pandal {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  location: Location; // Keep for backwards compatibility
  address: string;
  area: string;
  zone: string; // Keep for backwards compatibility
  city: string;
  theme: string;
  themeDescription?: string;
  establishedYear?: number;
  landmark?: string;
  nearestMetro?: string;
  metroDistance?: string;
  bestVisitingTime?: string;
  entryGuide?: string;
  exitGuide?: string;
  organizer?: string;
  helpline?: string;
  officialWebsite?: string;
  lastVerifiedAt?: string | number;
  dataSources?: any[];
  description: string;
  images: string[];
  photos?: string[];
  openingTime: string;
  closingTime: string;
  openingHours: string; // Keep for backwards compatibility
  crowdLevel: CrowdLevel;
  queueEstimate: string; // e.g. "15 mins", "1.5 hours"
  queueTimeMinutes: number; // Keep for backwards compatibility
  parkingAvailability: 'available' | 'limited' | 'none';
  parkingStatus: 'easy' | 'moderate' | 'full'; // Keep for backwards compatibility
  estimatedVisitDuration: number; // in minutes
  accessibility: boolean | string;
  rating: number;
  source: string;
  sourceType: 'VERIFIED' | 'ORGANIZER' | 'COMMUNITY' | 'PUBLIC_DATA' | 'AI_ESTIMATE' | 'DEMO';
  sourceId: string;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'PENDING' | 'COMMUNITY_VERIFIED' | 'EXTERNAL';
  verified: boolean;
  visitedStatus: boolean;
  favouriteStatus: boolean;
  distance?: number;
  estimatedTravelTime?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Event {
  id: string;
  name: string;
  type: 'durga_puja' | 'kali_puja' | 'concert' | 'exhibition' | 'fair' | 'cultural' | 'sports' | 'festival' | 'local_event' | 'other';
  location: Location;
  address: string;
  theme?: string;
  description: string;
  image?: string;
  openingHours?: string;
  crowdLevel: CrowdLevel;
  queueEstimate?: string;
  parkingStatus: 'easy' | 'moderate' | 'full';
  estimatedVisitDuration?: number; // minutes
  visitedStatus?: boolean;
  favouriteStatus?: boolean;
  category?: string;
}

export interface RouteWaypoint {
  name: string;
  location: Location;
  isPandalOrEvent?: boolean;
  itemId?: string;
}

export interface RouteInstruction {
  text: string;
  distance: number; // in meters
  duration: number; // in seconds
}

export interface Route {
  id: string;
  name: string;
  origin: Location;
  destination: Location;
  waypoints: RouteWaypoint[];
  geometry: Location[]; // polyline points
  distance: number; // total distance in meters
  duration: number; // total duration in seconds
  instructions: RouteInstruction[];
  alternatives?: Route[];
}

export interface SavedLocation {
  id: string;
  type: 'place' | 'event' | 'pandal' | 'route';
  itemId: string;
  name: string;
  timestamp: number;
}

export interface VisitedLocation {
  id: string;
  itemId: string;
  timestamp: number;
}

export interface CrowdReport {
  id: string;
  itemId: string;
  level: CrowdLevel;
  description: string;
  timestamp: number;
  source: ReportSource;
}

export interface ParkingLocation {
  id: string;
  name: string;
  location: Location;
  totalSpots: number;
  availableSpots: number;
  status: 'easy' | 'moderate' | 'full';
  distance?: number;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  type: 'traffic' | 'crowd' | 'closure' | 'weather' | 'emergency';
  itemId?: string;
  timestamp: number;
  active: boolean;
}

export type AIActionType =
  | 'SEARCH_NEARBY_PANDALS'
  | 'SEARCH_PANDALS_BY_NAME'
  | 'SEARCH_PANDALS_BY_AREA'
  | 'SEARCH_BONEDI_BARI'
  | 'SEARCH_PLACES'
  | 'SEARCH_EVENTS'
  | 'SEARCH_PANDALS'
  | 'SHOW_NEARBY'
  | 'SHOW_LOCATION'
  | 'CREATE_ROUTE'
  | 'OPTIMIZE_ROUTE'
  | 'SMART_PUJA_ROUTE'
  | 'NAVIGATE_TO'
  | 'UPDATE_ROUTE'
  | 'SAVE_LOCATION'
  | 'REMOVE_SAVED_LOCATION'
  | 'GET_PLACE_DETAILS'
  | 'GET_EVENT_DETAILS'
  | 'SHOW_ALERTS'
  | 'NO_ACTION';

export interface AIAction {
  type: AIActionType;
  parameters: {
    query?: string;
    name?: string;
    area?: string;
    nearMetro?: string;
    category?: string;
    locationName?: string;
    itemId?: string;
    origin?: string | Location;
    destination?: string | Location;
    waypoints?: (string | Location)[];
    radius?: number; // meters
    duration?: number; // minutes
    pandalIds?: string[];
    bonediBariIds?: string[];
    isTour?: boolean;
    [key: string]: any;
  };
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: AIAction;
  timestamp: number;
  discoveredPandals?: any[];
  discoveredBonediBaris?: any[];
  metroGateResult?: any;
}

export interface AIConversation {
  id: string;
  messages: AIMessage[];
}

export interface VisitedPandalRecord {
  pandalId: string;
  pandalName: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  firstVisitedAt: number;
  latestVisitedAt: number;
  visitCount: number;
}

export * from './geoImport';
export * from './intelligence';
export * from './bonediBari';
