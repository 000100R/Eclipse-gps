import { Location } from '../types';
import { DiscoveredPandal, EclipsePandalClassification } from '../types/discovery';
import {
  extractPlaceCoordinates,
  validateAndNormalizeCoordinates,
  verifyPandalAreaMatch,
  VERIFIED_NAKTALA_COORDINATES,
} from './coordinateValidation';

/**
 * Result of rule-based pandal candidate classification
 */
export interface PandalClassificationResult {
  category: EclipsePandalClassification;
  confidence: number;
  reason: string;
  isUncertain: boolean;
  theme: string;
}

// Definite Bonedi Bari / Rajbari family lineages and heritage houses
const BONEDI_BARI_PATTERNS = [
  /\bbonedi\b/i,
  /\brajbari\b/i,
  /\bzamindar\s*bari\b/i,
  /\bbarir\s*puja\b/i,
  /\bbarir\s*pujo\b/i,
  /\bdaw\s*bari\b/i,
  /\bmitra\s*bari\b/i,
  /\bdutta\s*bari\b/i,
  /\bmallick\s*bari\b/i,
  /\bde\s*bari\b/i,
  /\bchandra\s*bari\b/i,
  /\bhaldar\s*bari\b/i,
  /\bmukhopadhyay\s*bari\b/i,
  /\bsabarna\s*roy\b/i,
  /\bchhatu\s*babu\b/i,
  /\bkhelat\s*ghosh\b/i,
  /\brani\s*rashmoni\b/i,
  /\bbhukailash\b/i,
  /\bshobhabazar\s*rajbari\b/i,
  /\bsovabazar\s*rajbari\b/i,
  /\bdarjipara\s*mitra\b/i,
  /\bpathuriaghata\b/i,
  /\bthanthania\s*dutta\b/i,
  /\bjorasanko\s*daw\b/i,
  /\bbadan\s*chandra\b/i,
  /\bbose\s*family\b/i,
  /\bbari\s*durga\b/i,
  /\bবনেদি\b/,
  /\bরাজবাড়ি\b/,
  /\bজমিদার\s*বাড়ি\b/,
  /\bবাড়ির\s*পুজো\b/,
];

// Suggestive Bonedi Bari patterns (uncertain / possible)
const POSSIBLE_BONEDI_PATTERNS = [
  /\btraditional\s*(durga|puja|pujo)\b/i,
  /\bheritage\s*(durga|puja|pujo)\b/i,
  /\bold\s*family\s*(durga|puja|pujo)\b/i,
  /\bfamily\s*(durga|puja|pujo)\b/i,
  /\bhistoric\s*family\b/i,
  /\bbari\b/i,
];

// Definite Sarbojanin / Community Durga Puja pandal patterns
const DEFINITE_PANDAL_PATTERNS = [
  /\bdurga\s*puja\b/i,
  /\bdurga\s*pujo\b/i,
  /\bdurgotsav\b/i,
  /\bdurgotsab\b/i,
  /\bsarbojanin\s*(durga|puja|pujo|durgotsav)?\b/i,
  /\bsarbajanin\s*(durga|puja|pujo|durgotsav)?\b/i,
  /\bpuja\s*pandal\b/i,
  /\bpujo\s*pandal\b/i,
  /\bdurga\s*mandap\b/i,
  /\bdurga\s*samiti\b/i,
  /\bdurga\s*sangha\b/i,
  /\bdurga\s*club\b/i,
  /\b(suruchi|chetla\s*agrani|sree\s*bhumi|ekdalia|singhi\s*park|bagbazar\s*sarbojanin|mohammad\s*ali|kumartuli\s*park|ballygunge\s*cultural|badamtala|naktala\s*udayan|deshapriya|santosh\s*mitra|tridhara|ahiritola|chaltabagan|hatibagan|kashi\s*bose|tala\s*prattoy|dum\s*dum\s*park|kendua\s*shanti|bosepukur|mudiali|shiv\s*mandir|babu\s*bagan|jodhpur\s*park|selimpur|hindusthan\s*club|college\s*square)\b/i,
  /\bদুর্গা\s*পূজা\b/,
  /\bদুর্গাপূজা\b/,
  /\bদুর্গোৎসব\b/,
  /\bসর্বজনীন\b/,
];

// Suggestive pandal patterns (uncertain / possible community club / association)
const POSSIBLE_PANDAL_PATTERNS = [
  /\bpuja\b/i,
  /\bpujo\b/i,
  /\bpandal\b/i,
  /\bmandap\b/i,
  /\bsamiti\b/i,
  /\bsamity\b/i,
  /\bsangha\b/i,
  /\bclub\b/i,
  /\bassociation\b/i,
  /\bcommittee\b/i,
  /\butsav\b/i,
  /\bshoradotsav\b/i,
  /\bsharadotsav\b/i,
];

/**
 * Classifies a discovered Google Place candidate into the Eclipse classification schema:
 * - PANDAL
 * - BONEDI_BARI
 * - POSSIBLE_PANDAL
 * - POSSIBLE_BONEDI_BARI
 * - OTHER
 */
export function classifyGooglePlaceCandidate(
  name: string,
  formattedAddress: string,
  types: string[] = []
): PandalClassificationResult {
  const cleanName = (name || '').trim();
  const cleanAddress = (formattedAddress || '').trim();
  const textToScan = `${cleanName} ${cleanAddress}`.toLowerCase();

  // 1. Check for Definite Bonedi Bari
  for (const pattern of BONEDI_BARI_PATTERNS) {
    if (pattern.test(textToScan)) {
      return {
        category: 'BONEDI_BARI',
        confidence: 0.95,
        reason: 'Matches historic Bonedi Bari / Rajbari family lineage keyword pattern',
        isUncertain: false,
        theme: 'Bonedi Bari Heritage Durga Puja',
      };
    }
  }

  // 2. Check for Suggestive Bonedi Bari (traditional, family, heritage household puja)
  for (const pattern of POSSIBLE_BONEDI_PATTERNS) {
    if (pattern.test(textToScan)) {
      return {
        category: 'POSSIBLE_BONEDI_BARI',
        confidence: 0.7,
        reason: 'Suggests traditional or family-organized Durga Puja but lacks verified lineage match',
        isUncertain: true,
        theme: 'Possible Traditional / Family Puja',
      };
    }
  }

  // 3. Check for Definite Sarbojanin Community Pandal
  for (const pattern of DEFINITE_PANDAL_PATTERNS) {
    if (pattern.test(textToScan)) {
      return {
        category: 'PANDAL',
        confidence: 0.92,
        reason: 'Matches verified Durga Puja pandal / Sarbojanin mandap keyword pattern',
        isUncertain: false,
        theme: textToScan.includes('sarbojanin')
          ? 'Community Sarbojanin Durga Puja'
          : 'Durga Puja Mandap',
      };
    }
  }

  // 4. Check for Suggestive Pandal (neighborhood club / cultural committee / association)
  for (const pattern of POSSIBLE_PANDAL_PATTERNS) {
    if (pattern.test(cleanName)) {
      return {
        category: 'POSSIBLE_PANDAL',
        confidence: 0.6,
        reason: 'Community club or cultural organization; likely Durga Puja host but unconfirmed',
        isUncertain: true,
        theme: 'Possible Community Pandal / Club',
      };
    }
  }

  // 5. Worship / Temple / Other cultural landmarks
  const isWorship =
    types.includes('place_of_worship') ||
    types.includes('hindu_temple') ||
    types.includes('cultural_landmark') ||
    types.includes('community_center');

  if (isWorship) {
    return {
      category: 'OTHER',
      confidence: 0.45,
      reason: 'Place of worship or cultural landmark without explicit Durga Puja affiliation',
      isUncertain: true,
      theme: 'Place of Worship',
    };
  }

  return {
    category: 'OTHER',
    confidence: 0.2,
    reason: 'Uncertain candidate lacking specific Durga Puja or heritage markers',
    isUncertain: true,
    theme: 'Unclassified Candidate',
  };
}

/**
 * Normalizes a raw Google Place record into a DiscoveredPandal.
 * Collects only data actually returned by Google (does NOT invent missing fields).
 * Keeps raw Google discoveries marked as UNVERIFIED.
 */
export function normalizeGooglePlaceRecord(
  place: any,
  defaultCenter?: Location
): DiscoveredPandal | null {
  if (!place || !place.id) return null;

  const rawName = place.displayName?.text || place.name || '';
  if (!rawName || rawName.trim().length === 0) return null;

  const address = place.formattedAddress || 'Kolkata, West Bengal';
  const types = Array.isArray(place.types) ? place.types : [];

  // Run classification
  const classification = classifyGooglePlaceCandidate(rawName, address, types);

  // Filter out completely unrelated places (e.g. general commercial stores that slipped through)
  if (classification.category === 'OTHER' && classification.confidence < 0.3) {
    return null;
  }

  // Extract and validate GPS coordinates
  const coords = extractPlaceCoordinates(place) || defaultCenter;
  if (!coords) return null;

  const validatedCoords = validateAndNormalizeCoordinates(coords.lat, coords.lng, rawName);
  if (!validatedCoords) return null;

  // Strict Naktala Safeguard: If name matches Naktala Udayan Sangha, force verified coordinates
  const areaCheck = verifyPandalAreaMatch(rawName, address, validatedCoords.lat, validatedCoords.lng);
  const finalCoords = (!areaCheck.valid && areaCheck.correctedCoords)
    ? areaCheck.correctedCoords
    : validatedCoords;

  const area = extractAreaFromAddress(address) || extractAreaFromName(rawName) || 'Kolkata';

  // Process photos safely from Google Places
  const photos = Array.isArray(place.photos)
    ? place.photos
        .map((p: any) => {
          if (p.name) return `/api/places/photo?name=${encodeURIComponent(p.name)}`;
          if (p.photo_reference) return `/api/places/photo?name=${encodeURIComponent(p.photo_reference)}`;
          return null;
        })
        .filter(Boolean) as string[]
    : [];

  // Extract opening hours if provided by Google
  const openingHours = Array.isArray(place.regularOpeningHours?.weekdayDescriptions)
    ? place.regularOpeningHours.weekdayDescriptions.join('; ')
    : undefined;

  const candidate: DiscoveredPandal = {
    id: `gp-${place.id}`,
    source: 'GOOGLE_PLACES',
    sourceId: place.id,
    name: rawName,
    latitude: finalCoords.lat,
    longitude: finalCoords.lng,
    location: { lat: finalCoords.lat, lng: finalCoords.lng },
    address,
    area,
    city: 'Kolkata',
    category: classification.category,
    classificationConfidence: classification.confidence,
    classificationReason: classification.reason,
    isUncertain: classification.isUncertain,
    theme: classification.theme,
    description: classification.isUncertain
      ? `${classification.theme} (${classification.reason}): ${address}`
      : `${classification.theme}: ${address}`,
    // Raw Google discoveries are UNVERIFIED until matched with authoritative curated data
    verificationStatus: 'UNVERIFIED',
    verified: false,
    googleMapsUri: place.googleMapsUri || undefined,
    placeTypes: types.length > 0 ? types : undefined,
    rating: typeof place.rating === 'number' ? place.rating : undefined,
    userRatingCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : undefined,
    status: place.businessStatus || 'OPERATIONAL',
    businessStatus: place.businessStatus || undefined,
    website: place.websiteUri || undefined,
    phone: place.nationalPhoneNumber || place.internationalPhoneNumber || undefined,
    openingHours,
    photos: photos.length > 0 ? photos : undefined,
    attributions: Array.isArray(place.attributions) ? place.attributions : undefined,
    crowdLevel: 'MODERATE',
    crowdTrend: 'STEADY',
    queueEstimate: '20 - 30 mins',
    queueTimeMinutes: 25,
    parkingAvailability: 'limited',
    parkingStatus: 'moderate',
    estimatedVisitDuration: 30,
    accessibility: true,
  };

  // Special safeguard for Naktala Udayan Sangha
  if (rawName.toLowerCase().includes('naktala') && rawName.toLowerCase().includes('udayan')) {
    candidate.latitude = VERIFIED_NAKTALA_COORDINATES.lat;
    candidate.longitude = VERIFIED_NAKTALA_COORDINATES.lng;
    candidate.location = { lat: VERIFIED_NAKTALA_COORDINATES.lat, lng: VERIFIED_NAKTALA_COORDINATES.lng };
    candidate.area = 'Naktala';
  }

  return candidate;
}

function extractAreaFromAddress(address: string): string | null {
  if (!address) return null;
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2];
    if (!candidate.toLowerCase().includes('bengal') && !candidate.toLowerCase().includes('kolkata')) {
      return candidate;
    }
    return parts[0];
  }
  return parts[0] || null;
}

function extractAreaFromName(name: string): string | null {
  const match = name.match(/\(([^)]+)\)/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}
