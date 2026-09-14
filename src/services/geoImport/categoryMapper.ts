/**
 * Category Mapper for Google Earth Import
 * 
 * Maps KML/KMZ folder hierarchies, placemark names, descriptions, and geometry
 * types to normalized Eclipse categories.
 */

import { EclipseGeoCategory, GeometryType } from '../../types/geoImport';

export interface CategoryInferenceInput {
  name: string;
  description?: string;
  folderHierarchy: string[];
  geometryType: GeometryType;
  extendedData?: Record<string, string>;
  categoryOverride?: EclipseGeoCategory;
}

export function inferEclipseGeoCategory(input: CategoryInferenceInput): {
  category: EclipseGeoCategory;
  confidence: number;
  reason: string;
} {
  // If explicitly overridden by user options
  if (input.categoryOverride) {
    return {
      category: input.categoryOverride,
      confidence: 1.0,
      reason: 'Manual category override',
    };
  }

  // Check extended data if user or tool stored an explicit category tag
  if (input.extendedData) {
    const rawCat = input.extendedData['category'] || input.extendedData['Category'] || input.extendedData['type'];
    if (rawCat) {
      const normalized = normalizeCategoryString(rawCat);
      if (normalized) {
        return {
          category: normalized,
          confidence: 0.95,
          reason: `ExtendedData tag: "${rawCat}"`,
        };
      }
    }
  }

  const folderCombined = input.folderHierarchy.join(' / ').toLowerCase();
  const nameLower = input.name.toLowerCase();
  const descLower = (input.description || '').toLowerCase();

  // 1. BONEDI BARI (Traditional / Heritage Household pujas)
  const bonediKeywords = [
    'bonedi',
    'bonedibari',
    'bonedi bari',
    'rajbari',
    'zamindar',
    'jamidar',
    'household puja',
    'family puja',
    'heritage puja',
    'traditional puja',
    'daw bari',
    'thakur bari',
    'mallick bari',
    'laha bari',
    'sabarna roy choudhury',
    'shovabazar rajbari',
    'sovabazar rajbari',
    'pathuriaghata',
    'khelat ghosh',
    'chatu babu',
    'hatu babu',
    'darjipara mitra bari',
    'rani rashmoni',
    'bowbazar chandra bari',
    'dutta bari',
  ];

  for (const kw of bonediKeywords) {
    if (folderCombined.includes(kw) || nameLower.includes(kw)) {
      return {
        category: 'BONEDI_BARI',
        confidence: 0.9,
        reason: `Matched bonedi bari identifier: "${kw}"`,
      };
    }
  }

  // 2. METRO EXIT (Gates, Entry/Exits)
  const metroExitKeywords = [
    'metro gate',
    'metro exit',
    'metro entry',
    'station exit',
    'gate no',
    'gate number',
    'exit gate',
    'entry gate',
    'subway gate',
    'subway exit',
  ];

  for (const kw of metroExitKeywords) {
    if (folderCombined.includes(kw) || nameLower.includes(kw)) {
      return {
        category: 'METRO_EXIT',
        confidence: 0.9,
        reason: `Matched metro exit identifier: "${kw}"`,
      };
    }
  }

  // Also check if name has "gate 1", "gate 2", etc. in a metro station context
  if (
    (/\bgate\s*[0-9a-f]+\b/i.test(nameLower) || /\bexit\s*[0-9a-f]+\b/i.test(nameLower)) &&
    (folderCombined.includes('metro') || descLower.includes('metro'))
  ) {
    return {
      category: 'METRO_EXIT',
      confidence: 0.85,
      reason: 'Matched gate/exit pattern in metro context',
    };
  }

  // 3. METRO STATION
  const metroStationKeywords = [
    'metro station',
    'metro stn',
    'subway station',
    'metro stops',
    'metro stop',
    'kolkata metro',
  ];

  for (const kw of metroStationKeywords) {
    if (folderCombined.includes(kw) || nameLower.includes(kw)) {
      return {
        category: 'METRO_STATION',
        confidence: 0.9,
        reason: `Matched metro station identifier: "${kw}"`,
      };
    }
  }

  // Check known Kolkata metro station names
  const knownMetroStations = [
    'dakshineswar', 'baranagar', 'noapara', 'dum dum', 'belgachia', 'shyambazar',
    'shovabazar sutanuti', 'girish park', 'mahatma gandhi road', 'm.g. road', 'mg road',
    'central', 'chandni chowk', 'esplanade', 'park street', 'maidan', 'netaji bhavan',
    'jatin das park', 'kalighat', 'rabindra sarobar', 'mahanayak uttam kumar', 'netaji',
    'masterda surya sen', 'gitanjali', 'kavi nazrul', 'shahid khudiram', 'kavi subhash',
    'sealdah metro', 'phoolbagan', 'salt lake stadium', 'bengal chemical', 'city centre',
    'central park', 'karunamoyee', 'salt lake sector v', 'sector v', 'howrah maidan',
    'howrah railway station', 'taratala', 'behala bazar', 'behala chowrasta', 'joka',
    'kavi subhash metro', 'kavi nazrul metro', 'gitanjali metro'
  ];

  if (folderCombined.includes('metro')) {
    for (const stn of knownMetroStations) {
      if (nameLower.includes(stn)) {
        return {
          category: 'METRO_STATION',
          confidence: 0.85,
          reason: `Matched Kolkata metro station name: "${stn}" in metro folder`,
        };
      }
    }
  }

  // 4. PARKING
  const parkingKeywords = [
    'parking',
    'car park',
    'vehicle stand',
    'bike stand',
    'two-wheeler parking',
    'two wheeler parking',
    'parking lot',
    'car parking',
    'valet parking',
    'parking zone',
  ];

  for (const kw of parkingKeywords) {
    if (folderCombined.includes(kw) || nameLower.includes(kw)) {
      return {
        category: 'PARKING',
        confidence: 0.9,
        reason: `Matched parking identifier: "${kw}"`,
      };
    }
  }

  // 5. WALKING ROUTE (LineString or pedestrian paths)
  const walkingKeywords = [
    'walking route',
    'walking path',
    'pedestrian',
    'queue line',
    'darshan line',
    'vip queue',
    'crowd corridor',
    'footpath',
    'barricade route',
    'entry line',
    'exit corridor',
    'parikrama',
  ];

  for (const kw of walkingKeywords) {
    if (folderCombined.includes(kw) || nameLower.includes(kw)) {
      return {
        category: 'WALKING_ROUTE',
        confidence: 0.88,
        reason: `Matched walking route identifier: "${kw}"`,
      };
    }
  }

  // If geometry is LineString and in a pedestrian context
  if (input.geometryType === 'LineString' && (folderCombined.includes('walk') || descLower.includes('walk') || descLower.includes('pedestrian'))) {
    return {
      category: 'WALKING_ROUTE',
      confidence: 0.82,
      reason: 'LineString geometry with walking context',
    };
  }

  // 6. ROAD / CORRIDOR
  const roadKeywords = [
    'road',
    'street',
    'sarani',
    'avenue',
    'lane',
    'bypass',
    'flyover',
    'connector',
    'traffic corridor',
    'thoroughfare',
    'artery',
  ];

  for (const kw of roadKeywords) {
    if (folderCombined.includes(kw)) {
      return {
        category: 'ROAD',
        confidence: 0.85,
        reason: `Matched road folder identifier: "${kw}"`,
      };
    }
  }

  if (input.geometryType === 'LineString') {
    for (const kw of roadKeywords) {
      if (nameLower.includes(kw)) {
        return {
          category: 'ROAD',
          confidence: 0.8,
          reason: `LineString geometry matching road keyword: "${kw}"`,
        };
      }
    }
    // Default LineString without pedestrian context to ROAD
    return {
      category: 'ROAD',
      confidence: 0.65,
      reason: 'LineString geometry classified as road/pathway',
    };
  }

  // 7. EVENT
  const eventKeywords = [
    'event',
    'carnival',
    'aarti',
    'dhunuchi',
    'sindoor khela',
    'cultural program',
    'visarjan',
    'immersion',
    'procession',
    'concert',
    'stage program',
    'inauguration',
  ];

  for (const kw of eventKeywords) {
    if (folderCombined.includes(kw) || nameLower.includes(kw)) {
      return {
        category: 'EVENT',
        confidence: 0.85,
        reason: `Matched event identifier: "${kw}"`,
      };
    }
  }

  // 8. LANDMARK
  const landmarkKeywords = [
    'landmark',
    'monument',
    'hospital',
    'police assistance booth',
    'police station',
    'thana',
    'medical camp',
    'first aid',
    'ghat',
    'museum',
    'bridge',
    'temple',
    'church',
    'mosque',
    'stadium',
    'park',
    'square',
  ];

  for (const kw of landmarkKeywords) {
    if (folderCombined.includes(kw)) {
      return {
        category: 'LANDMARK',
        confidence: 0.8,
        reason: `Matched landmark folder identifier: "${kw}"`,
      };
    }
  }

  // 9. PANDAL (Durga Puja pandals, Sarbojanin, Clubs, Sanghas)
  const pandalKeywords = [
    'pandal',
    'puja',
    'durgotsav',
    'sarbojanin',
    'sarbajanin',
    'barowari',
    'mandap',
    'sangha',
    'club',
    'samiti',
    'association',
    'utsav',
    'utsab',
    'communal puja',
  ];

  for (const kw of pandalKeywords) {
    if (folderCombined.includes(kw) || nameLower.includes(kw)) {
      return {
        category: 'PANDAL',
        confidence: 0.85,
        reason: `Matched pandal identifier: "${kw}"`,
      };
    }
  }

  // If folder indicates Durga Puja in any way
  if (
    folderCombined.includes('durga') ||
    folderCombined.includes('puja') ||
    folderCombined.includes('kolkata') ||
    folderCombined.includes('north kolkata') ||
    folderCombined.includes('south kolkata') ||
    folderCombined.includes('salt lake')
  ) {
    return {
      category: 'PANDAL',
      confidence: 0.7,
      reason: 'Located in regional festive folder hierarchy',
    };
  }

  return {
    category: 'OTHER',
    confidence: 0.5,
    reason: 'No explicit category match found; categorized as OTHER',
  };
}

function normalizeCategoryString(str: string): EclipseGeoCategory | null {
  const s = str.trim().toUpperCase().replace(/[\s_-]+/g, '_');
  const validCategories: EclipseGeoCategory[] = [
    'PANDAL',
    'BONEDI_BARI',
    'METRO_STATION',
    'METRO_EXIT',
    'EVENT',
    'PARKING',
    'ROAD',
    'WALKING_ROUTE',
    'LANDMARK',
    'OTHER',
  ];

  if (validCategories.includes(s as EclipseGeoCategory)) {
    return s as EclipseGeoCategory;
  }

  if (s.includes('BONEDI') || s.includes('RAJBARI')) return 'BONEDI_BARI';
  if (s.includes('METRO') && (s.includes('EXIT') || s.includes('GATE'))) return 'METRO_EXIT';
  if (s.includes('METRO') || s.includes('STATION')) return 'METRO_STATION';
  if (s.includes('PARKING')) return 'PARKING';
  if (s.includes('WALK') || s.includes('PEDESTRIAN')) return 'WALKING_ROUTE';
  if (s.includes('ROAD') || s.includes('STREET')) return 'ROAD';
  if (s.includes('EVENT')) return 'EVENT';
  if (s.includes('LANDMARK')) return 'LANDMARK';
  if (s.includes('PANDAL') || s.includes('PUJA')) return 'PANDAL';

  return null;
}
