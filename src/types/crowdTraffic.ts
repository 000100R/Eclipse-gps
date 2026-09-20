import { Location } from './index';

/**
 * Verified Data Provenance for Eclipse Crowd & Traffic Intelligence.
 * NEVER display fake "live" data.
 */
export type DataSourceType = 'LIVE' | 'ESTIMATED' | 'HISTORICAL' | 'UNAVAILABLE';

/**
 * Standard Eclipse Crowd Levels for Pandals
 */
export type CrowdStatusLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'HEAVY' | 'EXTREME' | 'UNAVAILABLE';

/**
 * Crowd Directional Trends
 */
export type CrowdTrend = 'RISING' | 'STABLE' | 'FALLING' | 'UNKNOWN';

/**
 * Data Confidence
 */
export type IntelligenceConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

/**
 * Discrete Crowd Intelligence Record associated with a specific Pandal
 */
export interface CrowdIntelligenceItem {
  id: string;
  pandalId: string;
  pandalName: string;
  location: Location;
  crowdLevel: CrowdStatusLevel;
  crowdTrend: CrowdTrend;
  activePresenceCount?: number;
  queueWaitMinutes?: number;
  source: DataSourceType;
  sourceLabel: string;
  confidence: IntelligenceConfidence;
  lastUpdated: number;
  historicalPeakWindow?: string;
  notes?: string;
}

/**
 * Standard Eclipse Traffic Status Levels:
 * CLEAR / MODERATE / HEAVY / UNAVAILABLE
 * (SLOW & CONGESTED retained for backwards compatibility)
 */
export type TrafficStatusLevel = 'CLEAR' | 'MODERATE' | 'HEAVY' | 'UNAVAILABLE' | 'SLOW' | 'CONGESTED';

export type TrafficCongestion = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';

/**
 * Discrete Traffic Intelligence Corridor / Road Area Record
 */
export interface TrafficIntelligenceItem {
  id: string;
  corridorName: string;
  affectedRoad: string;
  affectedArea: string;
  location: Location;
  status: TrafficStatusLevel;
  congestionLevel: TrafficCongestion;
  estimatedDelayMinutes: number;
  affectedPandalIds: string[];
  alternativeRoute?: string;
  source: DataSourceType;
  sourceLabel: string;
  lastUpdated: number;
  polyPoints?: Location[];
}

/**
 * Eclipse Smart Visit Decision Recommendation
 */
export interface SmartVisitRecommendation {
  status: 'RECOMMENDED' | 'CAUTION' | 'AVOID' | 'NEUTRAL';
  headline: string; // e.g. "Good time to visit", "Consider visiting later", "Heavy crowd — nearby alternatives available"
  description: string;
  crowdFactor: string;
  trafficFactor: string;
  timingFactor: string;
  calendarFactor: string;
  alternativePandal?: {
    id: string;
    name: string;
    crowdLevel: CrowdStatusLevel;
    distanceMeters?: number;
  };
  isDataAvailable: boolean;
}
