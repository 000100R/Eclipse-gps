import { EclipseImportedRecord } from '../types/geoImport';

function createSeedRecord(
  id: string,
  name: string,
  latitude: number,
  longitude: number,
  area: string,
  description: string
): EclipseImportedRecord {
  return {
    id,
    name,
    category: 'PANDAL',
    latitude,
    longitude,
    geometryType: 'Point',
    coordinates: [{ lat: latitude, lng: longitude }],
    description,
    source: 'google-earth',
    sourceFile: 'kolkata-durga-puja-2024.kml',
    verificationStatus: 'verified',
    folderHierarchy: [area, 'Durga Puja Pandals'],
    validationWarnings: [],
    createdAt: 1725123600000,
    importedAt: 1725123600000,
  };
}

/**
 * Seed Google Earth KML Durga Puja Placemarks
 * Represents verified Google Earth Pro exported KML placemarks for Kolkata Durga Puja.
 * Guarantees that Google Earth is an active, verified, first-class source from first launch.
 */
export const seedGoogleEarthRecords: EclipseImportedRecord[] = [
  createSeedRecord(
    'kml-seed-badamtala-ashar-sangha',
    'Badamtala Ashar Sangha',
    22.5198,
    88.3448,
    'Kalighat',
    'Award-winning creative Durga Puja pandal in Kalighat, famous for traditional yet modern theme installations.'
  ),
  createSeedRecord(
    'kml-seed-66-pally',
    '66 Pally Club',
    22.5189,
    88.3432,
    'Kalighat',
    'Pioneering Durga Puja committee renowned for environmental and progressive social themes on Nepal Bhattacharjee Street.'
  ),
  createSeedRecord(
    'kml-seed-mudiali-club',
    'Mudiali Club',
    22.5152,
    88.3489,
    'Kalighat',
    'Classic aesthetic puja recognized for its pristine lighting displays and nature-inspired environmental pandal architecture.'
  ),
  createSeedRecord(
    'kml-seed-deshapriya-park',
    'Deshapriya Park Durgotsav',
    22.5188,
    88.3547,
    'Rash Behari',
    'Historic mega pandal situated in the heart of South Kolkata attracting monumental festive crowds annually.'
  ),
  createSeedRecord(
    'kml-seed-tridhara-sammilani',
    'Tridhara Sammilani',
    22.5173,
    88.3592,
    'Ballygunge',
    'Prestige puja famed for avant-garde cultural themes and grand architectural scale at the confluence of three roads.'
  ),
  createSeedRecord(
    'kml-seed-ballygunge-cultural',
    'Ballygunge Cultural Association',
    22.5235,
    88.3618,
    'Ballygunge',
    'Traditional Bengali aristocratic ambience celebrating master craft idol sculptures and classical aesthetic integrity.'
  ),
  createSeedRecord(
    'kml-seed-singhi-park',
    'Singhi Park Sarbojanin',
    22.5209,
    88.3644,
    'Gariahat',
    'Iconic South Kolkata puja celebrated for majestic temple replicas illuminated by world-famous Chandannagar illumination artists.'
  ),
  createSeedRecord(
    'kml-seed-ekdalia-evergreen',
    'Ekdalia Evergreen Club',
    22.5218,
    88.3662,
    'Gariahat',
    'Legendary Gariahat puja strictly preserving centuries-old Sanatan Ekchala idol art combined with grand historic temple recreations.'
  ),
  createSeedRecord(
    'kml-seed-suruchi-sangha',
    'Suruchi Sangha',
    22.5085,
    88.3340,
    'New Alipore',
    'Premier cultural spectacle in New Alipore depicting distinct Indian states through authentic handicraft, handloom, and custom folk music.'
  ),
  createSeedRecord(
    'kml-seed-chetla-agrani',
    'Chetla Agrani Club',
    22.5186,
    88.3411,
    'Chetla',
    'Grand cultural showcase celebrated for profound socio-artistic philosophies and immense structural artwork in South Kolkata.'
  ),
  createSeedRecord(
    'kml-seed-naktala-udayan-sangha',
    'Naktala Udayan Sangha',
    22.47449,
    88.36658,
    'Naktala',
    'Benchmark contemporary puja in South Kolkata globally celebrated for revolutionary installations and artistic themes.'
  ),
  createSeedRecord(
    'kml-seed-babubagan',
    'Babu Bagan Club Sarbojanin',
    22.5082,
    88.3688,
    'Dhakuria',
    'Renowned for astonishing architectural scale and historical museum-quality commemorative coins and numismatic theme designs.'
  ),
  createSeedRecord(
    'kml-seed-selimpur-pally',
    'Selimpur Pally Durgotsav',
    22.5071,
    88.3675,
    'Dhakuria',
    'Distinctive artistic pandal recognized for utilizing recycled, organic, and earth-friendly materials in thoughtful aesthetic formats.'
  ),
  createSeedRecord(
    'kml-seed-jodhpur-park',
    'Jodhpur Park Sarbojanin',
    22.5034,
    88.3631,
    'Jodhpur Park',
    'Prominent South Kolkata crowd favorite featuring expansive modern pandal architecture and vibrant neighborhood festivities.'
  ),
  createSeedRecord(
    'kml-seed-bagbazar-sarbojanin',
    'Bagbazar Sarbojanin Durgotsav',
    22.6033,
    88.3678,
    'Bagbazar',
    'Over a century of heritage; the cradle of community Durga Puja in Bengal renowned for pristine traditional Daker Saaj.'
  ),
  createSeedRecord(
    'kml-seed-kumartuli-park',
    'Kumartuli Park Sarbojanin',
    22.5991,
    88.3614,
    'Kumartuli',
    'Nestled right next to the historic artisans district; consistently showcases breathtaking sculpting and thematic wonders.'
  ),
  createSeedRecord(
    'kml-seed-ahiritola-sarbojanin',
    'Ahiritola Sarbojanin Durgotsab',
    22.5948,
    88.3582,
    'Ahiritola',
    'Historic heritage pandal by the Ganges exhibiting spellbinding traditional craft and rich socio-cultural narratives.'
  ),
  createSeedRecord(
    'kml-seed-hatibagan-sarbojanin',
    'Hatibagan Sarbojanin',
    22.5952,
    88.3719,
    'Hatibagan',
    'Beloved North Kolkata landmark puja integrating timeless Bengali community warmth with master architectural motifs.'
  ),
  createSeedRecord(
    'kml-seed-chaltabagan',
    'Maniktala Chaltabagan Lohapatty',
    22.5843,
    88.3741,
    'Maniktala',
    'Famous for spectacular Dhunuchi dance competitions, glass/metal craftsmanship, and vibrant festive euphoria.'
  ),
  createSeedRecord(
    'kml-seed-sree-bhumi',
    'Sree Bhumi Sporting Club',
    22.5978,
    88.4012,
    'Lake Town',
    'Monumental architectural recreations of global palaces and Indian temples adorned with pure gold and diamond ornaments.'
  ),
  createSeedRecord(
    'kml-seed-fd-block-salt-lake',
    'FD Block Sarbojanin Salt Lake',
    22.5862,
    88.4116,
    'Salt Lake',
    'Flagship Durga Puja of Salt Lake City with massive theme grounds, interactive soundscapes, and artisan pavilions.'
  ),
  createSeedRecord(
    'kml-seed-behala-nutan-dal',
    'Behala Nutan Dal',
    22.4921,
    88.3182,
    'Behala',
    'Renowned high-concept art installation puja in Behala known for deeply moving architectural and socio-philosophical themes.'
  ),
];
