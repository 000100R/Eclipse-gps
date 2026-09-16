/**
 * Eclipse GPS Coordinate Validation & Geometry Engine
 * 
 * Enforces strict geographical boundaries, detects coordinate reversals (lat/lng vs lng/lat),
 * handles KML/GeoJSON geometry conversions, and prevents impossible or corrupted locations
 * from being placed on the Eclipse map.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Kolkata Metropolitan Area (KMA) and immediate festival regions
 * Durga Puja pandals in this system must strictly reside within these bounds.
 */
export const KOLKATA_BOUNDS = {
  minLat: 22.15,
  maxLat: 22.85,
  minLng: 88.05,
  maxLng: 88.65,
};

/**
 * Specific geographic boundary for Naktala / Garia (South Kolkata)
 */
export const NAKTALA_GARIA_BOUNDS = {
  minLat: 22.44,
  maxLat: 22.49,
  minLng: 22.44, // guard against typos
  maxLng: 88.39,
  actualMinLng: 88.34,
  actualMaxLng: 88.39,
};

export const VERIFIED_NAKTALA_COORDINATES: LatLng = {
  lat: 22.47449,
  lng: 88.36658,
};

export type VerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'PENDING' | 'COMMUNITY_VERIFIED';

/**
 * Detects latitude/longitude reversal, checks for numerical validity,
 * and confirms coordinates fall within valid Kolkata geographical boundaries.
 * 
 * Returns normalized { lat, lng } or null if coordinates are invalid or impossible.
 */
export function validateAndNormalizeCoordinates(
  rawLat: any,
  rawLng: any,
  contextName?: string
): LatLng | null {
  let lat = typeof rawLat === 'string' ? parseFloat(rawLat) : Number(rawLat);
  let lng = typeof rawLng === 'string' ? parseFloat(rawLng) : Number(rawLng);

  if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
    console.warn(`[CoordinateValidation] Invalid NaN/Infinite coordinates for "${contextName || 'Unknown'}": lat=${rawLat}, lng=${rawLng}`);
    return null;
  }

  // Reject (0, 0) - Null Island
  if (lat === 0 && lng === 0) {
    console.warn(`[CoordinateValidation] Rejected Null Island (0,0) for "${contextName || 'Unknown'}"`);
    return null;
  }

  // Check for Latitude/Longitude Reversal (e.g. lat=88.36, lng=22.47 from KML/GeoJSON format [lng, lat])
  if (lat >= 80.0 && lat <= 90.0 && lng >= 20.0 && lng <= 30.0) {
    console.warn(
      `[CoordinateValidation] Detected Latitude/Longitude REVERSAL for "${contextName || 'Unknown'}". Swapping lat (${lat}) and lng (${lng}).`
    );
    const temp = lat;
    lat = lng;
    lng = temp;
  }

  // Check Kolkata geographic bounding box
  if (
    lat < KOLKATA_BOUNDS.minLat ||
    lat > KOLKATA_BOUNDS.maxLat ||
    lng < KOLKATA_BOUNDS.minLng ||
    lng > KOLKATA_BOUNDS.maxLng
  ) {
    console.warn(
      `[CoordinateValidation] Coordinates out of Kolkata boundary for "${contextName || 'Unknown'}": lat=${lat}, lng=${lng}`
    );
    return null;
  }

  // Format with high precision (6 decimal places = ~0.1m accuracy)
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

/**
 * Extracts coordinates safely from varied provider structures (Google Places API New, Google Maps JS API, GeoJSON, OSM)
 * NEVER defaults to user location if coordinates are missing.
 */
export function extractPlaceCoordinates(place: any): LatLng | null {
  if (!place) return null;

  let candidateLat: any = null;
  let candidateLng: any = null;

  // Google Places API (New) format
  if (place.location && typeof place.location.latitude === 'number' && typeof place.location.longitude === 'number') {
    candidateLat = place.location.latitude;
    candidateLng = place.location.longitude;
  }
  // Google Maps JS API (geometry.location might have lat() / lng() functions)
  else if (place.geometry && place.geometry.location) {
    const loc = place.geometry.location;
    candidateLat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
    candidateLng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
  }
  // Direct properties
  else if (typeof place.latitude === 'number' && typeof place.longitude === 'number') {
    candidateLat = place.latitude;
    candidateLng = place.longitude;
  } else if (typeof place.lat === 'number' && typeof place.lng === 'number') {
    candidateLat = place.lat;
    candidateLng = place.lng;
  } else if (place.location && typeof place.location.lat === 'number' && typeof place.location.lng === 'number') {
    candidateLat = place.location.lat;
    candidateLng = place.location.lng;
  }

  if (candidateLat === null || candidateLng === null) {
    return null;
  }

  return validateAndNormalizeCoordinates(
    candidateLat,
    candidateLng,
    place.name || place.displayName?.text || 'Place'
  );
}

/**
 * Validates if coordinates are in the expected neighborhood/area for known sensitive pandals.
 * Specifically validates that Naktala Udayan Sangha is situated in Naktala/Garia.
 */
export function verifyPandalAreaMatch(
  pandalName: string,
  area: string,
  lat: number,
  lng: number
): { valid: boolean; correctedCoords?: LatLng; reason?: string } {
  const isNaktala =
    /naktala\s+udayan/i.test(pandalName) ||
    (/naktala/i.test(pandalName) && /udayan/i.test(pandalName)) ||
    (/naktala/i.test(area) && /udayan/i.test(pandalName));

  if (isNaktala) {
    const inNaktalaGaria =
      lat >= NAKTALA_GARIA_BOUNDS.minLat &&
      lat <= NAKTALA_GARIA_BOUNDS.maxLat &&
      lng >= NAKTALA_GARIA_BOUNDS.actualMinLng &&
      lng <= NAKTALA_GARIA_BOUNDS.actualMaxLng;

    if (!inNaktalaGaria) {
      console.error(
        `[CoordinateValidation] CRITICAL ERROR: Pandal "${pandalName}" claimed to be in Naktala but has coordinates (${lat}, ${lng}) outside Naktala/Garia boundary! Enforcing verified Naktala coordinates.`
      );
      return {
        valid: false,
        correctedCoords: VERIFIED_NAKTALA_COORDINATES,
        reason: 'Coordinates outside Naktala/Garia geographic region',
      };
    }
  }

  return { valid: true };
}

/**
 * Parses KML / KMZ <coordinates> string (format: "lng,lat,alt lng,lat,alt")
 * Automatically handles KML's standard longitude-first format and detects flips.
 */
export function parseKmlCoordinates(coordString: string): LatLng[] {
  if (!coordString || typeof coordString !== 'string') return [];

  const points: LatLng[] = [];
  const tokens = coordString.trim().split(/\s+/);

  for (const token of tokens) {
    const parts = token.split(',');
    if (parts.length >= 2) {
      // KML standard is: longitude, latitude, altitude
      const rawLng = parts[0];
      const rawLat = parts[1];
      const valid = validateAndNormalizeCoordinates(rawLat, rawLng, 'KML Point');
      if (valid) {
        points.push(valid);
      }
    }
  }

  return points;
}
