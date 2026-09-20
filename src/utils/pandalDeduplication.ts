import { Location } from '../types';
import { DiscoveredPandal } from '../types/discovery';
import { VERIFIED_NAKTALA_COORDINATES } from './coordinateValidation';

/**
 * Common stopwords and generic festival terms to strip for name normalization
 */
const FESTIVAL_STOPWORDS = new Set([
  'durga',
  'puja',
  'pujo',
  'pujas',
  'pandal',
  'pandals',
  'mandap',
  'mandapam',
  'mandir',
  'durgotsav',
  'durgotsab',
  'durgotsava',
  'sharadotsav',
  'sharad',
  'sarbojanin',
  'sarbajanin',
  'sarbojanik',
  'sarbajanik',
  'committee',
  'club',
  'sangha',
  'shangha',
  'samiti',
  'samity',
  'association',
  'sammilani',
  'trust',
  'cultural',
  'foundation',
  'society',
  'celebration',
  'jubak',
  'yubak',
  'tarun',
  'o',
  'and',
  'the',
]);

/**
 * Distinctive Kolkata localities for address/neighborhood matching
 */
const KNOWN_LOCALITIES = [
  'sovabazar',
  'shobhabazar',
  'pathuriaghata',
  'jorasanko',
  'darjipara',
  'thanthania',
  'bowbazar',
  'bagbazar',
  'kumartuli',
  'shyambazar',
  'belgachia',
  'cossipore',
  'lake town',
  'dum dum',
  'salt lake',
  'bidhannagar',
  'new town',
  'rajarhat',
  'park street',
  'maidan',
  'bhowanipore',
  'bhawanipur',
  'kalighat',
  'chetla',
  'alipore',
  'new alipore',
  'behala',
  'barisha',
  'taratala',
  'ballygunge',
  'gariahat',
  'dhakuria',
  'jodhpur park',
  'jadavpur',
  'tollygunge',
  'ranikuthi',
  'bansdroni',
  'kudghat',
  'naktala',
  'garia',
  'patuli',
  'kendua',
  'santoshpur',
  'kasba',
  'ruby',
  'rashbehari',
  'hazra',
  'college street',
];

/**
 * Calculates Haversine distance in meters between two GPS coordinates
 */
export function calculateHaversineDistanceMeters(loc1: Location, loc2: Location): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((loc2.lat - loc1.lat) * Math.PI) / 180;
  const dLng = ((loc2.lng - loc1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((loc1.lat * Math.PI) / 180) *
      Math.cos((loc2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Extract clean Place ID from ID or URI string
 */
export function extractCleanPlaceId(item: { id?: string; sourceId?: string; googleMapsUri?: string }): string | null {
  if (item.sourceId) {
    const clean = item.sourceId.replace(/^(gp-|gplaces-|kml-|osm-|agamoni-)/, '');
    if (clean.length > 5 && !clean.startsWith('pandal-')) {
      return clean;
    }
  }

  if (item.id) {
    const clean = item.id.replace(/^(gp-|gplaces-|kml-|osm-|agamoni-)/, '');
    if (clean.length > 5 && clean.startsWith('ChIJ')) {
      return clean;
    }
  }

  if (item.googleMapsUri) {
    const queryMatch = item.googleMapsUri.match(/query_place_id=([A-Za-z0-9_-]+)/);
    if (queryMatch && queryMatch[1]) return queryMatch[1];

    const placeMatch = item.googleMapsUri.match(/place_id=([A-Za-z0-9_-]+)/);
    if (placeMatch && placeMatch[1]) return placeMatch[1];
  }

  return null;
}

/**
 * Normalizes pandal or Bonedi Bari name into searchable tokens and compact representation
 */
export function normalizePandalName(name: string): {
  normalized: string;
  compact: string;
  tokens: string[];
} {
  if (!name) return { normalized: '', compact: '', tokens: [] };

  const cleaned = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ').filter(Boolean);
  const filteredTokens = words.filter((w) => !FESTIVAL_STOPWORDS.has(w) && w.length >= 2);

  const normalized = filteredTokens.join(' ');
  const compact = filteredTokens.join('');

  return {
    normalized,
    compact,
    tokens: filteredTokens,
  };
}

/**
 * Computes Levenshtein edit distance between two strings
 */
export function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const v0 = new Array(s2.length + 1);
  const v1 = new Array(s2.length + 1);

  for (let i = 0; i <= s2.length; i++) {
    v0[i] = i;
  }

  for (let i = 0; i < s1.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < s2.length; j++) {
      const cost = s1[i] === s2[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= s2.length; j++) {
      v0[j] = v1[j];
    }
  }

  return v1[s2.length];
}

/**
 * Normalized string similarity (0.0 to 1.0) based on Levenshtein distance
 */
export function stringSimilarityRatio(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(s1, s2);
  return 1 - dist / maxLen;
}

/**
 * Checks address and neighborhood similarity between two records
 */
export function checkAddressLocalityMatch(
  addr1?: string,
  addr2?: string,
  area1?: string,
  area2?: string
): boolean {
  const combinedA = `${addr1 || ''} ${area1 || ''}`.toLowerCase();
  const combinedB = `${addr2 || ''} ${area2 || ''}`.toLowerCase();

  for (const locality of KNOWN_LOCALITIES) {
    if (combinedA.includes(locality) && combinedB.includes(locality)) {
      return true;
    }
  }

  return false;
}

export type DeduplicationMatchReason = 'PLACE_ID' | 'COORDINATE_PROXIMITY' | 'NAME_AND_ADDRESS_SIMILARITY';

/**
 * Evaluates whether an incoming candidate is a duplicate of an existing record
 * strictly checking:
 * 1. Place ID match
 * 2. Coordinates proximity (< 40m, or < 90m with partial token overlap)
 * 3. Name & Address similarity within geographic neighborhood (< 500m)
 */
export function isDuplicatePandal(
  existing: DiscoveredPandal,
  candidate: DiscoveredPandal
): { isDuplicate: boolean; matchReason?: DeduplicationMatchReason } {
  // 1. PLACE ID MATCH
  if (existing.id && candidate.id && existing.id === candidate.id) {
    return { isDuplicate: true, matchReason: 'PLACE_ID' };
  }

  if (existing.sourceId && candidate.sourceId && existing.sourceId === candidate.sourceId) {
    return { isDuplicate: true, matchReason: 'PLACE_ID' };
  }

  const existingPlaceId = extractCleanPlaceId(existing);
  const candidatePlaceId = extractCleanPlaceId(candidate);
  if (existingPlaceId && candidatePlaceId && existingPlaceId === candidatePlaceId) {
    return { isDuplicate: true, matchReason: 'PLACE_ID' };
  }

  // Calculate Haversine distance
  const distance = calculateHaversineDistanceMeters(existing.location, candidate.location);

  // 2. COORDINATE PROXIMITY (< 40 meters)
  // In urban Kolkata, two pandal pins within 40m represent the exact same pandal or Bonedi Bari gate/mandap
  if (distance < 40) {
    return { isDuplicate: true, matchReason: 'COORDINATE_PROXIMITY' };
  }

  // Name Normalization
  const normExisting = normalizePandalName(existing.name);
  const normCandidate = normalizePandalName(candidate.name);

  // If within 90 meters and share any significant token (length >= 3)
  if (distance < 90) {
    const shared = normExisting.tokens.filter((t) => normCandidate.tokens.includes(t));
    if (shared.length > 0) {
      return { isDuplicate: true, matchReason: 'COORDINATE_PROXIMITY' };
    }
  }

  // 3. NAME & ADDRESS SIMILARITY (Within reasonable geographic neighborhood < 500 meters)
  if (distance < 500) {
    // Exact or substring compact name match (e.g. "naktalaudayan" === "naktalaudayan")
    if (normExisting.compact.length >= 4 && normCandidate.compact.length >= 4) {
      if (
        normExisting.compact === normCandidate.compact ||
        normExisting.compact.includes(normCandidate.compact) ||
        normCandidate.compact.includes(normExisting.compact)
      ) {
        return { isDuplicate: true, matchReason: 'NAME_AND_ADDRESS_SIMILARITY' };
      }
    }

    // Token set intersection
    const sharedTokens = normExisting.tokens.filter((t) => normCandidate.tokens.includes(t));

    // If 2 or more distinct tokens match (e.g. ['khelat', 'ghosh'], ['singhi', 'park'], ['chaltabagan', 'lohabatti'])
    if (sharedTokens.length >= 2) {
      return { isDuplicate: true, matchReason: 'NAME_AND_ADDRESS_SIMILARITY' };
    }

    // If 1 key token matches AND address localities match
    if (sharedTokens.length >= 1) {
      const addressMatch = checkAddressLocalityMatch(
        existing.address,
        candidate.address,
        existing.area,
        candidate.area
      );
      if (addressMatch) {
        return { isDuplicate: true, matchReason: 'NAME_AND_ADDRESS_SIMILARITY' };
      }
    }

    // Levenshtein similarity on normalized string >= 0.78 within 350 meters
    if (distance < 350 && normExisting.normalized.length >= 5 && normCandidate.normalized.length >= 5) {
      const similarity = stringSimilarityRatio(normExisting.normalized, normCandidate.normalized);
      if (similarity >= 0.78) {
        return { isDuplicate: true, matchReason: 'NAME_AND_ADDRESS_SIMILARITY' };
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * Priority scoring for record authority:
 * 1. ECLIPSE_CURATED (Highest authority, authentic coordinates & history)
 * 2. AGAMONI (High authority festival registry)
 * 3. GOOGLE_EARTH (Verified satellite geo-import)
 * 4. GOOGLE_PLACES (Live dynamic provider)
 * 5. USER_CONTRIBUTION / OSM_NOMINATIM (Community / external)
 */
export function getRecordPriority(pandal: DiscoveredPandal): number {
  if (pandal.source === 'ECLIPSE_CURATED') return 1;
  if (pandal.source === 'AGAMONI') return 2;
  if (pandal.source === 'GOOGLE_EARTH' && pandal.verificationStatus === 'VERIFIED') return 3;
  if (pandal.source === 'GOOGLE_PLACES') return 4;
  return 5;
}

/**
 * Merge two duplicate records:
 * Retains authoritative verified source (Eclipse, Agamoni, Google Earth),
 * and enriches with live Google Places metadata (Google Maps URI, rating, photos, place ID).
 */
export function mergeDuplicatePandals(
  existing: DiscoveredPandal,
  candidate: DiscoveredPandal
): DiscoveredPandal {
  const existingPriority = getRecordPriority(existing);
  const candidatePriority = getRecordPriority(candidate);

  const base = existingPriority <= candidatePriority ? existing : candidate;
  const secondary = existingPriority <= candidatePriority ? candidate : existing;

  // Combine photos safely without duplicate URLs
  const existingPhotos = base.photos || [];
  const secondaryPhotos = secondary.photos || [];
  const combinedPhotos = [...existingPhotos];
  for (const ph of secondaryPhotos) {
    if (!combinedPhotos.includes(ph)) {
      combinedPhotos.push(ph);
    }
  }

  // Combined images
  const existingImages = base.images || [];
  const secondaryImages = secondary.images || [];
  const combinedImages = [...existingImages];
  for (const img of secondaryImages) {
    if (!combinedImages.includes(img)) {
      combinedImages.push(img);
    }
  }

  return {
    ...base,
    // Preserve authoritative coordinates & source
    latitude: base.latitude,
    longitude: base.longitude,
    location: { lat: base.latitude, lng: base.longitude },
    source: base.source,
    sourceId: base.sourceId || secondary.sourceId,
    verificationStatus:
      base.verificationStatus === 'VERIFIED' || secondary.verificationStatus === 'VERIFIED'
        ? 'VERIFIED'
        : base.verificationStatus,
    verified: base.verified || secondary.verified,

    category: base.category || secondary.category || 'PANDAL',
    theme: base.theme || secondary.theme,
    description: base.description || secondary.description,

    // Enrich with dynamic Google Places metadata
    googleMapsUri: secondary.googleMapsUri || base.googleMapsUri,
    rating: secondary.rating && secondary.rating > 0 ? Math.max(secondary.rating, base.rating || 0) : base.rating,
    userRatingCount: Math.max(secondary.userRatingCount || 0, base.userRatingCount || 0) || base.userRatingCount,
    photos: combinedPhotos.slice(0, 4),
    images: combinedImages.slice(0, 4),
    openingHours: base.openingHours || secondary.openingHours,
    status: base.status || secondary.status || 'OPERATIONAL',
    businessStatus: secondary.businessStatus || base.businessStatus,
    website: secondary.website || base.website,
    phone: secondary.phone || base.phone,
    placeTypes: Array.from(new Set([...(base.placeTypes || []), ...(secondary.placeTypes || [])])),
    attributions: [...(base.attributions || []), ...(secondary.attributions || [])].filter(
      (attr, idx, self) =>
        idx === self.findIndex((a) => a.provider === attr.provider && a.providerUri === attr.providerUri)
    ),

    // Preserve Naktala safeguard if applicable
    ...(base.name.toLowerCase().includes('naktala') && base.name.toLowerCase().includes('udayan')
      ? {
          latitude: VERIFIED_NAKTALA_COORDINATES.lat,
          longitude: VERIFIED_NAKTALA_COORDINATES.lng,
          location: { lat: VERIFIED_NAKTALA_COORDINATES.lat, lng: VERIFIED_NAKTALA_COORDINATES.lng },
        }
      : {}),
  };
}
