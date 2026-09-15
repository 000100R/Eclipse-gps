/**
 * Eclipse GPS — Bonedi Bari Intelligence Types (Phase 13.2)
 * 
 * Typed data model for Kolkata's heritage aristocratic family Durga Puja houses (Bonedi Bari).
 */

import { Location } from './index';

export type BonediBariSource = 'CURATED_HERITAGE' | 'COMMUNITY' | 'EXTERNAL';

export type BonediBariVerificationStatus = 'VERIFIED' | 'UNVERIFIED';

export interface BonediBari {
  id: string;
  name: string;
  family: string;
  address: string;
  latitude: number;
  longitude: number;
  location: Location;
  pujaSince: number;
  year?: number;
  heritageDescription: string;
  nearestMetro: string;
  approximateWalkingDistance: string;
  source: BonediBariSource;
  verificationStatus: BonediBariVerificationStatus;

  // Enriched metrics & contextual helpers
  distance?: number; // In meters from user
  distanceFormatted?: string; // e.g. "1.2 km"
  estimatedTravelTime?: string; // e.g. "4 min drive • 12 min walk"
  walkingTimeToMetro?: string; // e.g. "5 mins"
  ageYears?: number; // Verified heritage age in years
  specialFeatures?: string[];
  zone?: 'North Kolkata' | 'Central Kolkata' | 'South Kolkata' | 'West / Behala';
}
