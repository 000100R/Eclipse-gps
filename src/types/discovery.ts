import { CrowdLevel, Location, Pandal, Event } from './index';

export type PandalSource =
  | 'GOOGLE_PLACES'
  | 'ECLIPSE_CURATED'
  | 'USER_CONTRIBUTION'
  | 'OSM_NOMINATIM'
  | 'OFFICIAL_COMMITTEE'
  | 'GOOGLE_EARTH'
  | 'AGAMONI';

export interface PandalDataSourceRecord {
  field?: string;
  source: string;
  timestamp?: number | string;
  note?: string;
}

export type EclipsePandalClassification =
  | 'PANDAL'
  | 'BONEDI_BARI'
  | 'POSSIBLE_PANDAL'
  | 'POSSIBLE_BONEDI_BARI'
  | 'OTHER';

export interface DiscoveredPandal {
  id: string;
  source: PandalSource;
  sourceId: string;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'PENDING' | 'COMMUNITY_VERIFIED' | 'EXTERNAL';
  name: string;
  latitude: number;
  longitude: number;
  location: Location;
  address: string;
  area: string;
  city?: string;
  category?: EclipsePandalClassification | string;
  classificationConfidence?: number;
  classificationReason?: string;
  isUncertain?: boolean;
  distance?: number; // in meters from user GPS
  estimatedTravelTime?: string; // e.g. "8 min"
  googleMapsUri?: string;
  placeTypes?: string[];
  photos?: string[];
  rating?: number;
  userRatingCount?: number;
  openingHours?: string;
  status?: string; // 'OPEN' | 'OPERATIONAL' | 'TEMPORARY'
  businessStatus?: string;
  website?: string;
  phone?: string;
  attributions?: Array<{ provider?: string; providerUri?: string }>;
  eventInfo?: {
    theme?: string;
    description?: string;
    organizer?: string;
    timings?: string;
  };
  crowdLevel?: CrowdLevel;
  crowdTrend?: 'RISING' | 'STEADY' | 'FALLING';
  confidence?: number; // 0.0 to 1.0

  // Full compatibility with existing Pandal model & Phase 13.4 Enrichment Layer
  zone?: string;
  theme?: string;
  themeDescription?: string;
  establishedYear?: number;
  landmark?: string;
  nearestMetro?: string;
  metroDistance?: string;
  bestVisitingTime?: string;
  bestVisitingPeriod?: string;
  entryGuide?: string;
  exitGuide?: string;
  accessibility?: boolean | string;
  organizer?: string;
  helpline?: string;
  officialWebsite?: string;
  lastVerifiedAt?: string | number;
  lastVerifiedTime?: string | number;
  dataSources?: PandalDataSourceRecord[];

  description?: string;
  images?: string[];
  verified?: boolean;
  visitedStatus?: boolean;
  favouriteStatus?: boolean;
  queueEstimate?: string;
  queueTimeMinutes?: number;
  parkingAvailability?: 'available' | 'limited' | 'none';
  parkingStatus?: 'easy' | 'moderate' | 'full';
  estimatedVisitDuration?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface DiscoveredEvent {
  id: string;
  name: string;
  type: 'durga_puja' | 'cultural' | 'dhak_performance' | 'immersion' | 'competition' | 'procession' | 'festival' | 'local_event' | 'concert' | 'fair' | 'sports';
  location: Location;
  address: string;
  area?: string;
  distance?: number;
  estimatedTravelTime?: string;
  description: string;
  image?: string;
  openingHours?: string;
  crowdLevel?: CrowdLevel;
  timings?: string;
  organizer?: string;
  source: 'ECLIPSE_CURATED' | 'ORGANIZER' | 'COMMUNITY' | 'PUBLIC_DATA';
  verified?: boolean;
}

export interface UserPandalSubmission {
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  area?: string;
  theme?: string;
  description?: string;
  eventTiming?: string;
  photos?: string[];
  crowdLevel?: CrowdLevel;
  isTemporary?: boolean;
  closureStatus?: boolean;
}

export interface PandalDiscoveryParams {
  query?: string;
  near?: Location;
  radius?: number; // in meters
  area?: string;
  mode?: 'nearby' | 'text' | 'area' | 'name' | 'all';
  sortBy?: 'recommended' | 'nearest' | 'fastest' | 'least_crowded';
  skipExternalSearch?: boolean;
}

export interface DiscoveryResult {
  pandals: DiscoveredPandal[];
  events: DiscoveredEvent[];
  searchRadius: number; // in meters
  queryText: string;
  centerLocation: Location;
  sourcesUsed: string[];
}
