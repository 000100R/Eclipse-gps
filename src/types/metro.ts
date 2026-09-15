/**
 * Eclipse GPS — Metro Intelligence Types (Phase 13.3)
 * 
 * Typed data model for Kolkata Metro stations connecting with nearby
 * Durga Puja pandals and heritage Bonedi Baris.
 */

import { Location, Pandal } from './index';
import { BonediBari } from './bonediBari';

export type MetroLine =
  | 'Blue Line (North-South)'
  | 'Green Line (East-West)'
  | 'Purple Line (Joka-Majerhat)'
  | 'Orange Line (Kavi Subhash-Ruby)';

export interface MetroEntranceExit {
  gateNumber: string; // e.g. "Gate 1", "Gate 2"
  name: string;       // e.g. "Bhupen Bose Avenue", "Rashbehari Crossing"
  landmark?: string;
  accessibility?: boolean;
}

export interface NearbyPandalRef {
  id: string;
  name: string;
  distanceMeters: number;
  walkingMinutes: number;
  crowdLevel?: 'LOW' | 'MODERATE' | 'HEAVY' | 'EXTREME';
  theme?: string;
  location: Location;
  address?: string;
}

export interface NearbyBonediBariRef {
  id: string;
  name: string;
  family: string;
  distanceMeters: number;
  walkingMinutes: number;
  pujaSince: number;
  ageYears?: number;
  location: Location;
  address?: string;
}

export interface MetroStation {
  id: string;
  name: string;
  line: MetroLine | string;
  latitude: number;
  longitude: number;
  location: Location;
  entrancesExits?: MetroEntranceExit[];
  entrances?: MetroEntranceExit[]; // alias for compatibility
  nearbyPandalIds: string[];
  nearbyBonediBariIds: string[];

  // Dynamic / enriched fields
  nearbyPandals?: NearbyPandalRef[];
  nearbyBonediBaris?: NearbyBonediBariRef[];
  distance?: number; // In meters from user's current GPS location
  distanceFormatted?: string;
  estimatedWalkingTime?: string;
  estimatedTravelTime?: string;
  operationalHours?: string;
}
