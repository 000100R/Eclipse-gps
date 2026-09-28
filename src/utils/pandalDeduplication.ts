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

  // Extract distinct numerical or block identifier (e.g. "64", "68", "41", "76", "AA Block", "AB Block")
  const extractDistinctIdentifier = (name: string): string | null => {
    if (!name) return null;
    const blockMatch = name.match(/\b([a-z]{1,2})\s*[-_]?\s*block\b/i) || name.match(/\bblock\s*[-_]?\s*([a-z]{1,2})\b/i);
    if (blockMatch) {
      return `block_${blockMatch[1].toLowerCase()}`;
    }
    const numPallyMatch = name.match(/\b(\d{1,3})\s*[-_]?\s*(?:pally|palli|ward|er\s*palli)\b/i);
    if (numPallyMatch) {
      return `pally_${numPallyMatch[1]}`;
    }
    return null;
  };

  const id1 = extractDistinctIdentifier(existing.name || '');
  const id2 = extractDistinctIdentifier(candidate.name || '');
  if (id1 && id2 && id1 !== id2) {
    return { isDuplicate: false };
  }

  // Strict Category Partition: Never merge a Bonedi Bari with a community Puja Pandal
  const isBonediExisting =
    existing.category === 'BONEDI_BARI' ||
    (existing.name && /\b(?:rajbari|bonedi\s*bari)\b/i.test(existing.name));
  const isBonediCandidate =
    candidate.category === 'BONEDI_BARI' ||
    (candidate.name && /\b(?:rajbari|bonedi\s*bari)\b/i.test(candidate.name));

  if (isBonediExisting !== isBonediCandidate) {
    const normE = normalizePandalName(existing.name).normalized;
    const normC = normalizePandalName(candidate.name).normalized;
    const dist = calculateHaversineDistanceMeters(existing.location, candidate.location);
    if (!(normE === normC && dist < 15)) {
      return { isDuplicate: false };
    }
  }

  // Distinct branch identifiers (e.g. Boro vs Chhoto vs Mejo vs Majher vs Benaki vs Kalikingkar vs Aatchala)
  const branchPattern = /\b(boro|baro|chhoto|choto|mejo|sejo|majher|benaki|kalikingkar|aatchala)\b/i;
  const b1 = (existing.name || '').match(branchPattern);
  const b2 = (candidate.name || '').match(branchPattern);
  if (b1 && b2) {
    const k1 = b1[1].toLowerCase().replace('baro', 'boro').replace('choto', 'chhoto');
    const k2 = b2[1].toLowerCase().replace('baro', 'boro').replace('choto', 'chhoto');
    if (k1 !== k2) {
      return { isDuplicate: false };
    }
  } else if ((b1 && !b2) || (!b1 && b2)) {
    const dist = calculateHaversineDistanceMeters(existing.location, candidate.location);
    if (dist > 30) {
      return { isDuplicate: false };
    }
  }

  // Distinct family surnames and historical personal names in Bonedi Baris
  if (isBonediExisting && isBonediCandidate) {
    const familyPattern = /\b(mitra|chatterjee|seal|dutta|ghosh|daw|saha|sen|dey|mallick|haldar|mukherjee|banerjee|chandra|dhar|motilal|kundu|sardar|boral|dev|singhabahini|pal|chunder|bhaduri|pathak)\b/i;
    const f1 = (existing.name || '').match(familyPattern);
    const f2 = (candidate.name || '').match(familyPattern);
    if (f1 && f2 && f1[1].toLowerCase() !== f2[1].toLowerCase()) {
      return { isDuplicate: false };
    }

    const personalPattern = /\b(shib\s*krishna|narsingha|madan\s*mohan|haatkhola|chhatu\s*babu|khelat\s*ghosh|rani\s*rashmoni|gokul|akrur|girish|sisir|bipradas|jagat\s*ram|amarendra|baidyanath|badan\s*chand|durga\s*charan)\b/i;
    const p1 = (existing.name || '').match(personalPattern);
    const p2 = (candidate.name || '').match(personalPattern);
    if (p1 && p2 && p1[1].toLowerCase().replace(/\s+/g, '') !== p2[1].toLowerCase().replace(/\s+/g, '')) {
      return { isDuplicate: false };
    }
  }

  // Calculate Haversine distance
  const distance = calculateHaversineDistanceMeters(existing.location, candidate.location);

  // Generic Kolkata center fallback coords (22.5726, 88.3639) should not match by proximity alone
  const isGenericCoord = (loc: Location) =>
    Math.abs(loc.lat - 22.5726) < 0.001 && Math.abs(loc.lng - 88.3639) < 0.001;

  // 2. COORDINATE PROXIMITY (< 40 meters)
  if (distance < 40) {
    if (isGenericCoord(existing.location) || isGenericCoord(candidate.location)) {
      const rawE = (existing.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const rawC = (candidate.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (rawE.length >= 4 && rawC.length >= 4 && (rawE === rawC || rawE.includes(rawC) || rawC.includes(rawE))) {
        return { isDuplicate: true, matchReason: 'COORDINATE_PROXIMITY' };
      }
    } else {
      if (distance < 12) {
        return { isDuplicate: true, matchReason: 'COORDINATE_PROXIMITY' };
      }
      const normE = normalizePandalName(existing.name);
      const normC = normalizePandalName(candidate.name);
      const shared = normE.tokens.filter((t) => normC.tokens.includes(t));
      if (shared.length > 0 || stringSimilarityRatio(normE.normalized, normC.normalized) >= 0.55) {
        return { isDuplicate: true, matchReason: 'COORDINATE_PROXIMITY' };
      }
    }
  }

  // Raw cleaned alphanumeric comparison (strips punctuation and spaces)
  const rawCleanExisting = (existing.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const rawCleanCandidate = (candidate.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (rawCleanExisting.length >= 4 && rawCleanCandidate.length >= 4) {
    if (rawCleanExisting === rawCleanCandidate && distance < 2000) {
      return { isDuplicate: true, matchReason: 'NAME_AND_ADDRESS_SIMILARITY' };
    }

    // Strip generic festive keywords for core name comparison
    const stripFestive = (s: string) =>
      s.replace(/(durgapuja|durgopujo|durgotsav|durgotsab|pandal|puja|pujo|club|sangha|samiti|samity|association|committee|sarbojanin|sarbajanin)/g, '');
    const core1 = stripFestive(rawCleanExisting);
    const core2 = stripFestive(rawCleanCandidate);
    if (core1.length >= 5 && core2.length >= 5 && core1 === core2 && distance < 1500) {
      return { isDuplicate: true, matchReason: 'NAME_AND_ADDRESS_SIMILARITY' };
    }
  }

  // Name Normalization
  const normExisting = normalizePandalName(existing.name);
  const normCandidate = normalizePandalName(candidate.name);

  // If within 90 meters and share any significant token (length >= 3)
  if (distance < 90) {
    const shared = normExisting.tokens.filter((t) => normCandidate.tokens.includes(t));
    if (shared.length > 0 && stringSimilarityRatio(normExisting.normalized, normCandidate.normalized) >= 0.5) {
      return { isDuplicate: true, matchReason: 'COORDINATE_PROXIMITY' };
    }
  }

  // 3. NAME & ADDRESS SIMILARITY (Within reasonable geographic neighborhood)
  if (distance < 1500) {
    // Exact or high-fidelity compact name match
    if (normExisting.compact.length >= 4 && normCandidate.compact.length >= 4) {
      if (normExisting.compact === normCandidate.compact) {
        return { isDuplicate: true, matchReason: 'NAME_AND_ADDRESS_SIMILARITY' };
      }
      const minLen = Math.min(normExisting.compact.length, normCandidate.compact.length);
      const maxLen = Math.max(normExisting.compact.length, normCandidate.compact.length);
      if (
        minLen / maxLen >= 0.82 &&
        (normExisting.compact.includes(normCandidate.compact) || normCandidate.compact.includes(normExisting.compact))
      ) {
        return { isDuplicate: true, matchReason: 'NAME_AND_ADDRESS_SIMILARITY' };
      }
    }
  }

  if (distance < 800) {
    // High normalized string similarity within neighborhood
    if (normExisting.normalized.length >= 5 && normCandidate.normalized.length >= 5) {
      const similarity = stringSimilarityRatio(normExisting.normalized, normCandidate.normalized);
      if (similarity >= 0.82) {
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

    category:
      base.category === 'BONEDI_BARI' ||
      secondary.category === 'BONEDI_BARI' ||
      /\b(?:rajbari|bonedi\s*bari)\b/i.test(base.name) ||
      /\b(?:rajbari|bonedi\s*bari)\b/i.test(secondary.name)
        ? 'BONEDI_BARI'
        : base.category || secondary.category || 'PANDAL',
    pandalType:
      base.category === 'BONEDI_BARI' ||
      secondary.category === 'BONEDI_BARI' ||
      /\b(?:rajbari|bonedi\s*bari)\b/i.test(base.name) ||
      /\b(?:rajbari|bonedi\s*bari)\b/i.test(secondary.name)
        ? 'Bonedi Bari / Rajbari'
        : 'Puja Pandal',
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
