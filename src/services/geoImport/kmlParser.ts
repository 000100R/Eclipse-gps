/**
 * Eclipse GPS — KML Parser Engine for Google Earth Pro Exports
 * 
 * Supports standard KML 2.2 features:
 * - Nested Folder hierarchies for category context
 * - Point Placemarks and LineString paths
 * - ExtendedData / SchemaData extraction
 * - Original coordinate extraction without re-geocoding or coordinate swapping
 * - Coordinate validation against standard and Kolkata bounds
 * - Dual-mode XML parser (DOMParser in browser, native fallback for Node/SSR)
 */

import {
  EclipseGeoCategory,
  EclipseImportedRecord,
  EclipseGeoCoordinate,
  GeometryType,
  EclipseImportOptions,
} from '../../types/geoImport';
import { inferEclipseGeoCategory } from './categoryMapper';
import { KOLKATA_BOUNDS } from '../../utils/coordinateValidation';

interface ParsedPlacemarkRaw {
  name: string;
  description: string;
  styleUrl?: string;
  folderHierarchy: string[];
  extendedData: Record<string, string>;
  geometryType: GeometryType;
  coordinates: EclipseGeoCoordinate[];
}

export class KmlParser {
  /**
   * Parse a KML string into normalized EclipseImportedRecords
   */
  public parse(
    kmlContent: string,
    sourceFileName: string = 'google_earth.kml',
    options?: EclipseImportOptions
  ): {
    records: EclipseImportedRecord[];
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!kmlContent || typeof kmlContent !== 'string' || kmlContent.trim().length === 0) {
      errors.push('KML content is empty or invalid');
      return { records: [], errors, warnings };
    }

    try {
      const rawPlacemarks = this.extractPlacemarks(kmlContent);

      if (rawPlacemarks.length === 0) {
        warnings.push('No Placemark elements found in KML file');
      }

      const records: EclipseImportedRecord[] = [];
      const timestamp = Date.now();

      for (let idx = 0; idx < rawPlacemarks.length; idx++) {
        const raw = rawPlacemarks[idx];
        const validationWarnings: string[] = [];

        // Validate Coordinates
        if (raw.coordinates.length === 0) {
          warnings.push(`Skipping Placemark "${raw.name || `Record #${idx + 1}`}" - missing coordinates`);
          continue;
        }

        // Primary coordinate
        const primaryCoord = raw.coordinates[0];
        const lat = primaryCoord.lat;
        const lng = primaryCoord.lng;

        // Strict Numerical Validation
        if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
          errors.push(`Placemark "${raw.name}": Non-numeric coordinates (lat: ${lat}, lng: ${lng})`);
          continue;
        }

        // Standard Geographic Bounds Check
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          errors.push(`Placemark "${raw.name}": Coordinates out of range [-90..90, -180..180]: lat=${lat}, lng=${lng}`);
          continue;
        }

        // Null Island Check
        if (lat === 0 && lng === 0) {
          warnings.push(`Placemark "${raw.name}": Coordinates at (0, 0) Null Island`);
          validationWarnings.push('Coordinates positioned at Null Island (0, 0)');
        }

        // Kolkata Regional Boundary Check
        const inKolkata =
          lat >= KOLKATA_BOUNDS.minLat &&
          lat <= KOLKATA_BOUNDS.maxLat &&
          lng >= KOLKATA_BOUNDS.minLng &&
          lng <= KOLKATA_BOUNDS.maxLng;

        if (!inKolkata && !options?.allowOutsideKolkata) {
          validationWarnings.push(
            `Location (${lat.toFixed(5)}, ${lng.toFixed(5)}) is outside the standard Kolkata Metropolitan bounds`
          );
        }

        // Categorize
        const { category, reason } = inferEclipseGeoCategory({
          name: raw.name,
          description: raw.description,
          folderHierarchy: raw.folderHierarchy,
          geometryType: raw.geometryType,
          extendedData: raw.extendedData,
          categoryOverride: options?.targetCategoryOverride,
        });

        // Compute representative center for LineString
        let repLat = lat;
        let repLng = lng;
        if (raw.geometryType === 'LineString' && raw.coordinates.length > 1) {
          const mid = Math.floor(raw.coordinates.length / 2);
          repLat = raw.coordinates[mid].lat;
          repLng = raw.coordinates[mid].lng;
        }

        // Generate deterministic ID based on name and coordinates
        const safeName = (raw.name || 'unnamed')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 30);
        const coordHash = `${lat.toFixed(5)}_${lng.toFixed(5)}`.replace('.', 'p');
        const id = `ge-${safeName}-${coordHash}-${idx}`;

        const record: EclipseImportedRecord = {
          id,
          name: raw.name || `Placemark #${idx + 1}`,
          category,
          rawCategory: reason,
          // ORIGINAL Google Earth coordinates strictly preserved
          latitude: repLat,
          longitude: repLng,
          altitude: primaryCoord.altitude,
          description: raw.description || '',
          source: 'google-earth',
          sourceFile: sourceFileName,
          verificationStatus: 'imported', // Must remain 'imported' until verified
          geometryType: raw.geometryType,
          coordinates: raw.coordinates,
          folderHierarchy: raw.folderHierarchy,
          styleUrl: raw.styleUrl,
          extendedData: Object.keys(raw.extendedData).length > 0 ? raw.extendedData : undefined,
          validationWarnings,
          createdAt: timestamp,
          importedAt: timestamp,
        };

        records.push(record);
      }

      return { records, errors, warnings };
    } catch (err: any) {
      errors.push(`KML parse error: ${err?.message || String(err)}`);
      return { records: [], errors, warnings };
    }
  }

  /**
   * Universal Placemark extractor using DOMParser if available, or regex fallback
   */
  private extractPlacemarks(kmlText: string): ParsedPlacemarkRaw[] {
    if (typeof DOMParser !== 'undefined') {
      try {
        return this.extractUsingDOMParser(kmlText);
      } catch (e) {
        console.warn('[KmlParser] DOMParser failed, falling back to regex parser:', e);
      }
    }

    return this.extractUsingRegex(kmlText);
  }

  /**
   * DOMParser implementation (standard browser runtime)
   */
  private extractUsingDOMParser(kmlText: string): ParsedPlacemarkRaw[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');

    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      console.warn('[KmlParser] XML parser warning/error:', parserError.textContent);
    }

    const results: ParsedPlacemarkRaw[] = [];

    // Traverse DOM to retain folder hierarchy
    const traverse = (node: Element, folderHierarchy: string[]) => {
      const nodeName = node.localName || node.nodeName;

      if (nodeName.toLowerCase() === 'folder') {
        const folderNameElem = Array.from(node.children).find(
          (c) => (c.localName || c.nodeName).toLowerCase() === 'name'
        );
        const folderName = folderNameElem ? folderNameElem.textContent?.trim() || '' : 'Folder';
        const newHierarchy = folderName ? [...folderHierarchy, folderName] : folderHierarchy;

        for (let i = 0; i < node.children.length; i++) {
          traverse(node.children[i], newHierarchy);
        }
      } else if (nodeName.toLowerCase() === 'placemark') {
        const placemark = this.parsePlacemarkElement(node, folderHierarchy);
        if (placemark) {
          results.push(placemark);
        }
      } else {
        for (let i = 0; i < node.children.length; i++) {
          traverse(node.children[i], folderHierarchy);
        }
      }
    };

    const root = xmlDoc.documentElement;
    if (root) {
      traverse(root, []);
    }

    return results;
  }

  private parsePlacemarkElement(elem: Element, folderHierarchy: string[]): ParsedPlacemarkRaw | null {
    let name = '';
    let description = '';
    let styleUrl: string | undefined;
    const extendedData: Record<string, string> = {};
    let geometryType: GeometryType = 'Point';
    let coordinates: EclipseGeoCoordinate[] = [];

    for (let i = 0; i < elem.children.length; i++) {
      const child = elem.children[i];
      const tag = (child.localName || child.nodeName).toLowerCase();

      if (tag === 'name') {
        name = child.textContent?.trim() || '';
      } else if (tag === 'description') {
        description = child.textContent?.trim() || '';
      } else if (tag === 'styleurl') {
        styleUrl = child.textContent?.trim() || undefined;
      } else if (tag === 'extendeddata') {
        this.extractExtendedData(child, extendedData);
      } else if (tag === 'point') {
        geometryType = 'Point';
        const coordsElem = child.querySelector('coordinates');
        if (coordsElem && coordsElem.textContent) {
          coordinates = this.parseCoordinateString(coordsElem.textContent);
        }
      } else if (tag === 'linestring') {
        geometryType = 'LineString';
        const coordsElem = child.querySelector('coordinates');
        if (coordsElem && coordsElem.textContent) {
          coordinates = this.parseCoordinateString(coordsElem.textContent);
        }
      } else if (tag === 'polygon') {
        geometryType = 'Polygon';
        const coordsElem = child.querySelector('coordinates');
        if (coordsElem && coordsElem.textContent) {
          coordinates = this.parseCoordinateString(coordsElem.textContent);
        }
      }
    }

    if (coordinates.length === 0) {
      return null;
    }

    return {
      name,
      description,
      styleUrl,
      folderHierarchy,
      extendedData,
      geometryType,
      coordinates,
    };
  }

  private extractExtendedData(elem: Element, target: Record<string, string>) {
    // Standard <Data name="key"><value>val</value></Data>
    const dataNodes = elem.querySelectorAll('Data');
    dataNodes.forEach((dn) => {
      const key = dn.getAttribute('name');
      const valNode = dn.querySelector('value');
      if (key && valNode) {
        target[key] = valNode.textContent?.trim() || '';
      }
    });

    // SchemaData <SimpleData name="key">val</SimpleData>
    const simpleNodes = elem.querySelectorAll('SimpleData');
    simpleNodes.forEach((sn) => {
      const key = sn.getAttribute('name');
      if (key) {
        target[key] = sn.textContent?.trim() || '';
      }
    });
  }

  /**
   * Native regex fallback parser for environments without DOMParser
   */
  private extractUsingRegex(kmlText: string): ParsedPlacemarkRaw[] {
    const results: ParsedPlacemarkRaw[] = [];

    // Find placemark blocks
    const placemarkRegex = /<Placemark[\s>]([\s\S]*?)<\/Placemark>/gi;
    let match: RegExpExecArray | null;

    while ((match = placemarkRegex.exec(kmlText)) !== null) {
      const block = match[1];

      // Name
      const nameMatch = /<name>([\s\S]*?)<\/name>/i.exec(block);
      const name = nameMatch ? this.cleanXmlCData(nameMatch[1]).trim() : '';

      // Description
      const descMatch = /<description>([\s\S]*?)<\/description>/i.exec(block);
      const description = descMatch ? this.cleanXmlCData(descMatch[1]).trim() : '';

      // StyleUrl
      const styleMatch = /<styleUrl>([\s\S]*?)<\/styleUrl>/i.exec(block);
      const styleUrl = styleMatch ? styleMatch[1].trim() : undefined;

      // Geometry & Coordinates
      let geometryType: GeometryType = 'Point';
      let coordsText = '';

      const pointMatch = /<Point[\s>][\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Point>/i.exec(block);
      const lineMatch = /<LineString[\s>][\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/LineString>/i.exec(block);
      const polyMatch = /<Polygon[\s>][\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Polygon>/i.exec(block);

      if (lineMatch) {
        geometryType = 'LineString';
        coordsText = lineMatch[1];
      } else if (polyMatch) {
        geometryType = 'Polygon';
        coordsText = polyMatch[1];
      } else if (pointMatch) {
        geometryType = 'Point';
        coordsText = pointMatch[1];
      } else {
        // Fallback bare coordinates tag
        const bareMatch = /<coordinates>([\s\S]*?)<\/coordinates>/i.exec(block);
        if (bareMatch) {
          coordsText = bareMatch[1];
        }
      }

      if (!coordsText) continue;

      const coordinates = this.parseCoordinateString(coordsText);
      if (coordinates.length === 0) continue;

      // ExtendedData
      const extendedData: Record<string, string> = {};
      const dataRegex = /<Data\s+name=["']([^"']+)["']>[\s\S]*?<value>([\s\S]*?)<\/value>[\s\S]*?<\/Data>/gi;
      let dataMatch: RegExpExecArray | null;
      while ((dataMatch = dataRegex.exec(block)) !== null) {
        extendedData[dataMatch[1]] = this.cleanXmlCData(dataMatch[2]).trim();
      }

      // Check for surrounding folder in text prior to placemark
      const folderHierarchy = this.findPrecedingFolders(kmlText, match.index);

      results.push({
        name,
        description,
        styleUrl,
        folderHierarchy,
        extendedData,
        geometryType,
        coordinates,
      });
    }

    return results;
  }

  private findPrecedingFolders(fullText: string, placemarkIndex: number): string[] {
    const textBefore = fullText.slice(0, placemarkIndex);
    const folderMatches = Array.from(textBefore.matchAll(/<Folder[\s>][\s\S]*?<name>([\s\S]*?)<\/name>/gi));
    if (folderMatches.length > 0) {
      const lastFolder = folderMatches[folderMatches.length - 1][1];
      return [this.cleanXmlCData(lastFolder).trim()];
    }
    return [];
  }

  private cleanXmlCData(text: string): string {
    return text.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').trim();
  }

  /**
   * Parse KML coordinates string: "lng,lat,alt lng,lat,alt ..."
   * 
   * CRITICAL GOOGLE EARTH KML RULES:
   * 1. Google Earth KML specifies coordinates as: longitude, latitude [, altitude]
   * 2. Part 0 = longitude, Part 1 = latitude, Part 2 = altitude
   * 3. Do NOT swap latitude and longitude!
   * 4. Preserve the EXACT original numbers.
   */
  public parseCoordinateString(coordStr: string): EclipseGeoCoordinate[] {
    if (!coordStr || typeof coordStr !== 'string') return [];

    const result: EclipseGeoCoordinate[] = [];
    const tokens = coordStr.trim().split(/\s+/);

    for (const token of tokens) {
      if (!token || !token.includes(',')) continue;

      const parts = token.split(',');
      if (parts.length >= 2) {
        // KML Standard: part[0] is Longitude, part[1] is Latitude
        const rawLng = parseFloat(parts[0]);
        const rawLat = parseFloat(parts[1]);
        const rawAlt = parts[2] !== undefined ? parseFloat(parts[2]) : undefined;

        if (!isNaN(rawLat) && !isNaN(rawLng)) {
          result.push({
            lat: rawLat,
            lng: rawLng,
            altitude: !isNaN(rawAlt as number) ? rawAlt : undefined,
          });
        }
      }
    }

    return result;
  }
}

export const kmlParser = new KmlParser();
