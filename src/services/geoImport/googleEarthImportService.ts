/**
 * Eclipse GPS — Google Earth Data Import Foundation Service
 * 
 * Reusable importer for Google Earth Pro KML and KMZ files.
 * Provides previewing, original coordinate preservation, category mapping,
 * geometry parsing (Point & LineString), coordinate validation, duplicate detection,
 * and staging of records without overwriting verified Eclipse records.
 */

import {
  EclipseImportedRecord,
  EclipseImportPreviewResult,
  EclipseImportOptions,
  EclipseImportCommitResult,
  EclipseGeoCategory,
  GeometryType,
  ImportVerificationStatus,
} from '../../types/geoImport';
import { kmlParser } from './kmlParser';
import { kmzParser } from './kmzParser';
import { DuplicateDetector, KnownGeoEntity } from './duplicateDetector';

const STORAGE_KEY = 'eclipse_imported_geo_records_v1';

export class GoogleEarthImportService {
  private inMemoryStore: EclipseImportedRecord[] = [];
  private duplicateDetector: DuplicateDetector;

  constructor() {
    this.loadFromStorage();
    this.duplicateDetector = new DuplicateDetector(this.getStoredEntitiesForDetector());
  }

  /**
   * Universal Preview: Analyzes a KML or KMZ file/content and returns a detailed
   * inspection preview with duplicate flags, coordinate validation, and category breakdown.
   * Does NOT commit records to the database.
   */
  public async previewImport(
    source: File | Blob | ArrayBuffer | string,
    fileName: string = 'google_earth_export',
    options?: EclipseImportOptions
  ): Promise<EclipseImportPreviewResult> {
    const isKmz = this.detectIsKmz(source, fileName);
    let parseResult: {
      records: EclipseImportedRecord[];
      errors: string[];
      warnings: string[];
    };

    const resolvedFileName = options?.fileName || fileName;

    if (isKmz) {
      let buffer: ArrayBuffer | Blob | Uint8Array;
      if (typeof source === 'string') {
        // Assume base64 or raw binary string if passed as string
        const binaryStr = atob(source.replace(/^data:.*?;base64,/, ''));
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        buffer = bytes.buffer;
      } else {
        buffer = source as Blob | ArrayBuffer;
      }

      parseResult = await kmzParser.parse(buffer, resolvedFileName, options);
    } else {
      let kmlText = '';
      if (typeof source === 'string') {
        kmlText = source;
      } else if (source instanceof Blob) {
        kmlText = await source.text();
      } else if (source instanceof ArrayBuffer) {
        kmlText = new TextDecoder('utf-8').decode(source);
      } else {
        kmlText = String(source);
      }

      parseResult = kmlParser.parse(kmlText, resolvedFileName, options);
    }

    // Refresh duplicate detector with latest known records
    this.duplicateDetector = new DuplicateDetector(this.getStoredEntitiesForDetector());

    // Run duplicate detection against existing verified records & batch items
    const threshold = options?.duplicateDistanceThresholdMeters ?? 50;
    const recordsWithDuplicates = this.duplicateDetector.detectDuplicates(
      parseResult.records,
      threshold
    );

    // Calculate metrics
    const categoryBreakdown: Record<EclipseGeoCategory, number> = {
      PANDAL: 0,
      BONEDI_BARI: 0,
      METRO_STATION: 0,
      METRO_EXIT: 0,
      EVENT: 0,
      PARKING: 0,
      ROAD: 0,
      WALKING_ROUTE: 0,
      LANDMARK: 0,
      OTHER: 0,
    };

    const geometryBreakdown: Record<GeometryType, number> = {
      Point: 0,
      LineString: 0,
      Polygon: 0,
    };

    let duplicateCount = 0;

    recordsWithDuplicates.forEach((r) => {
      categoryBreakdown[r.category] = (categoryBreakdown[r.category] || 0) + 1;
      geometryBreakdown[r.geometryType] = (geometryBreakdown[r.geometryType] || 0) + 1;
      if (r.isDuplicate) {
        duplicateCount++;
      }
    });

    return {
      fileName: resolvedFileName,
      fileType: isKmz ? 'KMZ' : 'KML',
      totalPlacemarks: recordsWithDuplicates.length,
      validRecords: recordsWithDuplicates.length,
      invalidRecords: parseResult.errors.length,
      duplicateRecords: duplicateCount,
      categoryBreakdown,
      geometryBreakdown,
      records: recordsWithDuplicates,
      errors: parseResult.errors,
      warnings: parseResult.warnings,
    };
  }

  /**
   * Commit verified or imported records to the Eclipse import storage.
   * Strictly marks records as 'imported' (unless explicitly verified)
   * and NEVER overwrites existing verified records.
   */
  public async commitImport(
    records: EclipseImportedRecord[],
    skipDuplicates: boolean = false
  ): Promise<EclipseImportCommitResult> {
    const toSave: EclipseImportedRecord[] = [];
    let skipped = 0;

    for (const rec of records) {
      if (skipDuplicates && rec.isDuplicate) {
        skipped++;
        continue;
      }

      // Ensure verification status starts as 'imported'
      const sanitized: EclipseImportedRecord = {
        ...rec,
        verificationStatus: rec.verificationStatus || 'imported',
        importedAt: Date.now(),
      };

      // Add to store or update existing imported record with same id
      const existingIdx = this.inMemoryStore.findIndex((r) => r.id === sanitized.id);
      if (existingIdx >= 0) {
        this.inMemoryStore[existingIdx] = sanitized;
      } else {
        this.inMemoryStore.push(sanitized);
      }

      toSave.push(sanitized);
    }

    this.saveToStorage();

    return {
      success: true,
      importedCount: toSave.length,
      skippedDuplicatesCount: skipped,
      records: toSave,
      timestamp: Date.now(),
    };
  }

  /**
   * Get all currently stored imported records
   */
  public getImportedRecords(): EclipseImportedRecord[] {
    return [...this.inMemoryStore];
  }

  /**
   * Get an imported record by ID
   */
  public getImportedRecordById(id: string): EclipseImportedRecord | undefined {
    return this.inMemoryStore.find((r) => r.id === id);
  }

  /**
   * Update the verification status of an imported record (e.g. from admin screen)
   */
  public updateVerificationStatus(id: string, status: ImportVerificationStatus): boolean {
    const record = this.inMemoryStore.find((r) => r.id === id);
    if (!record) return false;

    record.verificationStatus = status;
    this.saveToStorage();
    return true;
  }

  /**
   * Delete an imported record by ID
   */
  public deleteImportedRecord(id: string): boolean {
    const initialLen = this.inMemoryStore.length;
    this.inMemoryStore = this.inMemoryStore.filter((r) => r.id !== id);
    if (this.inMemoryStore.length !== initialLen) {
      this.saveToStorage();
      return true;
    }
    return false;
  }

  /**
   * Clear all imported records
   */
  public clearImportedRecords(): void {
    this.inMemoryStore = [];
    this.saveToStorage();
  }

  /**
   * Detect whether the input is KMZ (ZIP archive) or KML (XML text)
   */
  private detectIsKmz(source: any, fileName: string): boolean {
    if (fileName.toLowerCase().endsWith('.kmz')) {
      return true;
    }
    if (fileName.toLowerCase().endsWith('.kml')) {
      return false;
    }

    // Check for ZIP magic header bytes (PK\x03\x04 = 0x50, 0x4B, 0x03, 0x04)
    if (source instanceof ArrayBuffer) {
      const bytes = new Uint8Array(source.slice(0, 4));
      return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
    }

    if (source instanceof Uint8Array) {
      return source[0] === 0x50 && source[1] === 0x4b && source[2] === 0x03 && source[3] === 0x04;
    }

    return false;
  }

  private loadFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          this.inMemoryStore = JSON.parse(raw);
        }
      } catch (err) {
        console.warn('[GoogleEarthImportService] Failed to load imported records from storage:', err);
      }
    }
  }

  private saveToStorage(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.inMemoryStore));
      } catch (err) {
        console.warn('[GoogleEarthImportService] Failed to persist imported records to storage:', err);
      }
    }
  }

  private getStoredEntitiesForDetector(): KnownGeoEntity[] {
    return this.inMemoryStore.map((r) => ({
      id: r.id,
      name: r.name,
      latitude: r.latitude,
      longitude: r.longitude,
      category: r.category,
      source: r.source,
      isVerified: r.verificationStatus === 'verified',
    }));
  }
}

export const googleEarthImportService = new GoogleEarthImportService();
