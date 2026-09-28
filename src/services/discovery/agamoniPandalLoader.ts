import agamoniRaw from '../../data/pandals/2026/agamoniPandals2026.json';
import { DiscoveredPandal } from '../../types/discovery';
import { validateAndNormalizeCoordinates, verifyPandalAreaMatch } from '../../utils/coordinateValidation';

let cachedAgamoniPandals: DiscoveredPandal[] | null = null;

export function loadAgamoniPandals(): DiscoveredPandal[] {
  if (cachedAgamoniPandals) {
    return cachedAgamoniPandals;
  }

  const list: DiscoveredPandal[] = [];

  for (const item of (agamoniRaw as any[])) {
    const coords = validateAndNormalizeCoordinates(item.lat, item.lng, item.name);
    if (!coords) continue;

    const areaCheck = verifyPandalAreaMatch(item.name, item.area || item.locality || '', coords.lat, coords.lng);
    const finalCoords = (!areaCheck.valid && areaCheck.correctedCoords) ? areaCheck.correctedCoords : coords;

    const isAgamoniBonedi =
      /\b(?:rajbari|thakurbari)\b/i.test(item.name) ||
      (/\bbari\b/i.test(item.name) && !/\b(?:sarbojanin|club|sangha|samiti|samity|committee|association|pally)\b/i.test(item.name));

    list.push({
      id: item.id,
      name: item.name,
      latitude: finalCoords.lat,
      longitude: finalCoords.lng,
      location: { lat: finalCoords.lat, lng: finalCoords.lng },
      address: item.address || `${item.area || 'Kolkata'}, Kolkata`,
      area: item.area || item.locality || 'Kolkata',
      city: 'Kolkata',
      source: 'AGAMONI',
      sourceId: item.id,
      category: isAgamoniBonedi ? 'BONEDI_BARI' : 'PANDAL',
      pandalType: isAgamoniBonedi ? 'Bonedi Bari / Rajbari' : 'Puja Pandal',
      verificationStatus: 'VERIFIED',
      rating: 4.8,
      userRatingCount: 500,
      description: item.themeDescription || item.theme || item.bengaliName,
      theme: item.theme,
      themeDescription: item.themeDescription,
      landmark: item.landmark || undefined,
      nearestMetro: item.nearestMetro || undefined,
      metroDistance: item.metroDistance ? `${item.metroDistance}m` : undefined,
      establishedYear: item.establishedYear || undefined,
      bestVisitingTime: item.bestVisitingTime || undefined,
      accessibility: item.accessibility !== false,
      organizer: item.organizer || undefined,
      officialWebsite: item.officialWebsite || undefined,
      lastVerifiedAt: item.lastVerifiedAt || '2026-09-01T00:00:00.000Z',
      verified: true,
      crowdLevel: 'MODERATE',
      confidence: 0.95,
      photos: [],
      images: [],
    });
  }

  cachedAgamoniPandals = list;
  return list;
}
