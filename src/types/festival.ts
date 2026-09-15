/**
 * Eclipse GPS — Festival Intelligence & Puja Calendar Types (Phase 13.6)
 * 
 * Typed data structures for Bengal Durga Puja ritual timings, festival events,
 * and provenance tracking.
 */

export type PujaDayType =
  | 'MAHALAYA'
  | 'SHASHTHI'
  | 'SAPTAMI'
  | 'ASHTAMI'
  | 'SANDHI_PUJA'
  | 'NAVAMI'
  | 'DASHAMI'
  | 'SINDOOR_KHELA'
  | 'VISARJAN'
  | 'CARNIVAL'
  | 'OTHER';

export type FestivalCategory =
  | 'RITUAL'
  | 'AARTI'
  | 'DARSHAN'
  | 'CULTURAL'
  | 'IMMERSION'
  | 'COMMUNITY'
  | 'CARNIVAL';

export type FestivalVerificationStatus =
  | 'VERIFIED'
  | 'COMMUNITY'
  | 'EXTERNAL';

export interface FestivalEvent {
  id: string;
  name: string;
  bengaliName?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // e.g. "06:00 AM" or "17:45"
  endTime: string;   // e.g. "11:30 AM" or "21:00"
  description: string;
  category: FestivalCategory;
  location?: string;
  source: string; // e.g. "Bisuddhasiddhanta Panjika", "Kolkata Police Advisory"
  verificationStatus: FestivalVerificationStatus;
  
  // Bengal / Kolkata Context
  year: number;
  pujaDay: PujaDayType;
  tithi?: string;           // e.g. "Maha Ashtami Shukla Paksha", "Maha Navami Sandhikshan"
  significance?: string;    // Cultural & ritual background
  ritualNotes?: string;     // e.g. "108 lotus offerings & 108 earthen lamps"
  recommendedPandals?: string[]; // IDs or names of pandals/bonedi baris renowned for this ritual
  associatedLocations?: {
    name: string;
    lat: number;
    lng: number;
    type?: 'pandal' | 'bonedi_bari' | 'ghat' | 'carnival';
  }[];
}

export type CalendarPeriodFilter = 'ALL' | 'TODAY' | 'UPCOMING' | 'COMPLETED';
