/**
 * Eclipse GPS — Normalized Geographic Data Model for Google Earth Import
 * 
 * Supports KML & KMZ files exported from Google Earth Pro.
 * Preserves original coordinates, supports Point placemarks and LineString paths,
 * categorizes features, validates geographic accuracy, and flags duplicates.
 */

export type EclipseGeoCategory =
  | 'PANDAL'
  | 'BONEDI_BARI'
  | 'METRO_STATION'
  | 'METRO_EXIT'
  | 'EVENT'
  | 'PARKING'
  | 'ROAD'
  | 'WALKING_ROUTE'
  | 'LANDMARK'
  | 'OTHER';

export type GeometryType = 'Point' | 'LineString' | 'Polygon';

export type ImportVerificationStatus = 'imported' | 'verified' | 'rejected' | 'conflict';

export interface EclipseGeoCoordinate {
  lat: number;
  lng: number;
  altitude?: number;
}

/**
 * Normalized record created from Google Earth (KML/KMZ) placemarks
 */
export interface EclipseImportedRecord {
  /** Deterministic or unique identifier */
  id: string;

  /** Display name of the placemark */
  name: string;

  /** Normalized Eclipse category */
  category: EclipseGeoCategory;

  /** Raw / detected category before normalization */
  rawCategory?: string;

  /**
   * EXACT Latitude from Google Earth (Point coordinate or primary vertex)
   * Original coordinates are strictly preserved without re-geocoding.
   */
  latitude: number;

  /**
   * EXACT Longitude from Google Earth (Point coordinate or primary vertex)
   * Original coordinates are strictly preserved without re-geocoding.
   */
  longitude: number;

  /** Optional altitude in meters from Google Earth */
  altitude?: number;

  /** Description or HTML / CDATA markup included in Google Earth */
  description: string;

  /** Provenance tag — always 'google-earth' */
  source: 'google-earth';

  /** Originating file name (.kml or .kmz) */
  sourceFile: string;

  /**
   * Verification status — imported records start as 'imported'
   * and must NOT overwrite existing verified records.
   */
  verificationStatus: ImportVerificationStatus;

  /** Geometry type from KML */
  geometryType: GeometryType;

  /** Array of coordinates for Point (length 1) or LineString / Polygon (length >= 2) */
  coordinates: EclipseGeoCoordinate[];

  /** Folder path hierarchy in the KML document (e.g. ['South Kolkata', 'Pandals']) */
  folderHierarchy: string[];

  /** Optional KML Style URL reference */
  styleUrl?: string;

  /** Extended Data key-value pairs if present in KML */
  extendedData?: Record<string, string>;

  /** Whether a potential duplicate was detected */
  isDuplicate?: boolean;

  /** ID of existing Eclipse record matched as duplicate */
  matchedExistingId?: string;

  /** Name of existing Eclipse record matched as duplicate */
  matchedExistingName?: string;

  /** Explanation of duplicate detection match */
  duplicateReason?: string;

  /** Distance in meters to closest matching record */
  distanceToMatchMeters?: number;

  /** Any warnings during parsing/coordinate validation */
  validationWarnings: string[];

  /** Timestamp of creation */
  createdAt: number;

  /** Timestamp of import */
  importedAt: number;
}

/**
 * Summary breakdown for previewing imported KML/KMZ before committing
 */
export interface EclipseImportPreviewResult {
  fileName: string;
  fileType: 'KML' | 'KMZ';
  totalPlacemarks: number;
  validRecords: number;
  invalidRecords: number;
  duplicateRecords: number;
  categoryBreakdown: Record<EclipseGeoCategory, number>;
  geometryBreakdown: Record<GeometryType, number>;
  records: EclipseImportedRecord[];
  errors: string[];
  warnings: string[];
}

/**
 * Configuration options for import parsing and duplicate checking
 */
export interface EclipseImportOptions {
  /** Explicitly override category for all imported placemarks */
  targetCategoryOverride?: EclipseGeoCategory;

  /** Distance threshold in meters to flag duplicate (default: 50m) */
  duplicateDistanceThresholdMeters?: number;

  /** Allow locations outside the Kolkata metropolitan bounding box without error */
  allowOutsideKolkata?: boolean;

  /** Source file name tag */
  fileName?: string;
}

/**
 * Result of saving/committing imported records to Eclipse store
 */
export interface EclipseImportCommitResult {
  success: boolean;
  importedCount: number;
  skippedDuplicatesCount: number;
  records: EclipseImportedRecord[];
  timestamp: number;
}
