import { Location, Route, CrowdLevel } from './index';

export type TransportMode = 'WALK' | 'METRO' | 'MIXED' | 'DRIVE';

export type RoutePriority = 'MORE_PLACES' | 'LESS_WALKING' | 'LESS_TRAFFIC' | 'LESS_CROWD';

export type StartLocationType = 'GPS' | 'METRO' | 'FRIEND' | 'CUSTOM';

export interface StartLocationOption {
  id: string;
  name: string;
  location: Location;
  type: StartLocationType;
  subtitle?: string;
  details?: string;
}

export interface DestinationItem {
  id: string;
  name: string;
  type: 'pandal' | 'bonedi_bari' | 'event' | 'place';
  location: Location;
  address: string;
  theme?: string;
  family?: string;
  zone?: string;
  nearestMetro?: string;
  rawItem?: any;
}

export interface PujaRouteSession {
  isActive: boolean;
  stops: DestinationItem[];
  currentStopIndex: number;
  completedStopIds: string[];
}

export interface MetroHopInfo {
  boardStation: string;
  deboardStation: string;
  lineName: string;
  lineColor: string;
  stopsCount: number;
  intermediateStations: string[];
  metroRideMinutes: number;
  walkToStationMeters: number;
  walkToStationMinutes: number;
  walkFromStationMeters: number;
  walkFromStationMinutes: number;
}

export interface SmartRouteLeg {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  distanceMeters: number;
  durationMinutes: number;
  transportMode: TransportMode;
  metroDetails?: MetroHopInfo;
  traffic?: {
    status: 'CLEAR' | 'MODERATE' | 'CONGESTED' | 'UNAVAILABLE';
    corridorName?: string;
    delayMinutes?: number;
    source: 'LIVE' | 'ESTIMATED' | 'UNAVAILABLE';
    sourceLabel?: string;
    isTrustworthy: boolean;
  };
  instructions: string[];
}

export interface SmartRouteStop {
  id: string;
  stopIndex: number;
  name: string;
  type: 'pandal' | 'bonedi_bari' | 'event' | 'place';
  location: Location;
  address: string;
  theme?: string;
  family?: string;
  legFromPrevious: SmartRouteLeg;
  estimatedArrival: string;
  estimatedDeparture: string;
  estimatedStayMinutes: number;
  crowd: {
    level: CrowdLevel;
    source: 'LIVE' | 'ESTIMATED' | 'HISTORICAL' | 'UNAVAILABLE';
    sourceLabel?: string;
    waitMinutes?: number;
    isTrustworthy: boolean;
  };
  traffic: {
    status: 'CLEAR' | 'MODERATE' | 'CONGESTED' | 'UNAVAILABLE';
    corridorName?: string;
    delayMinutes?: number;
    source: 'LIVE' | 'ESTIMATED' | 'UNAVAILABLE';
    isTrustworthy: boolean;
  };
  darshanStatus: {
    isOpen: boolean;
    statusText: string;
    hoursText?: string;
    ritualNotice?: string;
  };
  rawItem?: any;
}

export interface SmartRoutePlan {
  id: string;
  name: string;
  createdAt: number;
  startLocation: StartLocationOption;
  stops: SmartRouteStop[];
  totalDistanceMeters: number;
  totalTravelTimeMinutes: number;
  totalStayTimeMinutes: number;
  totalDurationMinutes: number;
  availableTimeMinutes: number;
  transportMode: TransportMode;
  priority: RoutePriority;
  isWithinBudget: boolean;
  timeDifferenceMinutes: number;
  metroHopsCount: number;
  totalWalkingMeters: number;
  fullGeometry: Location[];
  summary: string;
  osrmRoute?: Route;
}

export interface NearbySuggestion {
  id: string;
  name: string;
  type: 'pandal' | 'bonedi_bari';
  location: Location;
  address: string;
  theme?: string;
  family?: string;
  detourDistanceMeters: number;
  detourMinutes: number;
  nearStopIndex: number;
  nearStopName: string;
  reason: string;
  crowdLevel: CrowdLevel;
  rawItem: any;
}
