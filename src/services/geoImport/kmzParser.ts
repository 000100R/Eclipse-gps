/**
 * Eclipse GPS — KMZ Archive Parser Engine
 * 
 * Supports zipped Google Earth (.kmz) archives using JSZip.
 * Extracts the primary KML file (doc.kml or *.kml) and embedded assets.
 */

import JSZip from 'jszip';
import { kmlParser } from './kmlParser';
import { EclipseImportedRecord, EclipseImportOptions } from '../../types/geoImport';

export class KmzParser {
  /**
   * Parse a KMZ binary payload (File, Blob, ArrayBuffer, or Uint8Array)
   */
  public async parse(
    kmzData: Blob | ArrayBuffer | Uint8Array,
    sourceFileName: string = 'google_earth.kmz',
    options?: EclipseImportOptions
  ): Promise<{
    records: EclipseImportedRecord[];
    errors: string[];
    warnings: string[];
    embeddedFiles: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const embeddedFiles: string[] = [];

    try {
      const zip = await JSZip.loadAsync(kmzData);

      // List all entries in the KMZ archive
      zip.forEach((relativePath) => {
        embeddedFiles.push(relativePath);
      });

      if (embeddedFiles.length === 0) {
        errors.push(`KMZ archive "${sourceFileName}" is empty`);
        return { records: [], errors, warnings, embeddedFiles };
      }

      // Find the main KML file (usually doc.kml or first *.kml file)
      const kmlFiles = zip.file(/.*\.kml$/i);

      if (!kmlFiles || kmlFiles.length === 0) {
        errors.push(`No .kml document found inside KMZ archive "${sourceFileName}"`);
        return { records: [], errors, warnings, embeddedFiles };
      }

      // Prefer doc.kml if present, otherwise first matching .kml
      const targetKmlFile =
        kmlFiles.find((f) => f.name.toLowerCase().endsWith('doc.kml')) || kmlFiles[0];

      const kmlContent = await targetKmlFile.async('text');

      if (!kmlContent || kmlContent.trim().length === 0) {
        errors.push(`KML document "${targetKmlFile.name}" inside KMZ is empty`);
        return { records: [], errors, warnings, embeddedFiles };
      }

      // Delegate to KML parser
      const parseResult = kmlParser.parse(kmlContent, sourceFileName, options);

      return {
        records: parseResult.records,
        errors: [...errors, ...parseResult.errors],
        warnings: [...warnings, ...parseResult.warnings],
        embeddedFiles,
      };
    } catch (err: any) {
      errors.push(`Failed to unpack KMZ archive "${sourceFileName}": ${err?.message || String(err)}`);
      return { records: [], errors, warnings, embeddedFiles };
    }
  }
}

export const kmzParser = new KmzParser();
