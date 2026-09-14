/**
 * Eclipse GPS — Duplicate Detection Engine for Google Earth Import
 * 
 * Compares imported records against existing verified Eclipse records
 * (Curated database, demo dataset, previously imported records, and intra-batch items).
 * 
 * Strictly preserves existing verified records without overwriting them.
 * Imported records remain marked as verificationStatus = 'imported'.
 */

import { EclipseImportedRecord } from '../../types/geoImport';
import { curatedEclipsePandals } from '../../data/curatedPandals';
import { demoPandals } from '../../data/demoPandals';

export interface KnownGeoEntity {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category?: string;
  source: string;
  isVerified: boolean;
}

export class DuplicateDetector {
  private knownEntities: KnownGeoEntity[] = [];

  constructor(customExistingRecords: KnownGeoEntity[] = []) {
    this.initializeKnownEntities(customExistingRecords);
  }

  private initializeKnownEntities(customExistingRecords: KnownGeoEntity[]) {
    const list: KnownGeoEntity[] = [];
    const seenIds = new Set<string>();

    // 1. Curated Eclipse Pandals (Strict Ground Truth)
    curatedEclipsePandals.forEach((p) => {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        list.push({
          id: p.id,
          name: p.name,
          latitude: p.latitude,
          longitude: p.longitude,
          category: 'PANDAL',
          source: p.source,
          isVerified: true,
        });
      }
    });

    // 2. Demo Pandals
    demoPandals.forEach((p) => {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        list.push({
          id: p.id,
          name: p.name,
          latitude: p.latitude,
          longitude: p.longitude,
          category: 'PANDAL',
          source: p.source,
          isVerified: p.verified ?? true,
        });
      }
    });

    // 3. Custom / Previously stored records
    customExistingRecords.forEach((r) => {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        list.push(r);
      }
    });

    this.knownEntities = list;
  }

  /**
   * Check a batch of imported records for duplicates against known database
   * and within the batch itself.
   */
  public detectDuplicates(
    records: EclipseImportedRecord[],
    distanceThresholdMeters: number = 50
  ): EclipseImportedRecord[] {
    const processed: EclipseImportedRecord[] = [];
    const batchSeenCoords: { id: string; name: string; lat: number; lng: number }[] = [];

    for (const record of records) {
      const updated = { ...record };
      let matchFound = false;

      // 1. Check against known Eclipse database (verified records)
      for (const existing of this.knownEntities) {
        const dist = this.calculateDistanceMeters(
          updated.latitude,
          updated.longitude,
          existing.latitude,
          existing.longitude
        );

        const nameSim = this.computeNameSimilarity(updated.name, existing.name);

        // Immediate duplicate criteria:
        // A) Extremely close (< 15 meters) regardless of name
        // B) Close (< distanceThresholdMeters) with moderate name match (> 0.45)
        // C) Moderate distance (< 250 meters) with very strong name match (> 0.8)
        if (dist <= 15) {
          matchFound = true;
          updated.isDuplicate = true;
          updated.matchedExistingId = existing.id;
          updated.matchedExistingName = existing.name;
          updated.distanceToMatchMeters = Number(dist.toFixed(1));
          updated.duplicateReason = `Exact location match (${dist.toFixed(1)}m) with existing record "${existing.name}" [${existing.id}]`;
          break;
        } else if (dist <= distanceThresholdMeters && nameSim > 0.45) {
          matchFound = true;
          updated.isDuplicate = true;
          updated.matchedExistingId = existing.id;
          updated.matchedExistingName = existing.name;
          updated.distanceToMatchMeters = Number(dist.toFixed(1));
          updated.duplicateReason = `Spatial proximity (${dist.toFixed(1)}m) and similar name with existing record "${existing.name}"`;
          break;
        } else if (dist <= 250 && nameSim >= 0.8) {
          matchFound = true;
          updated.isDuplicate = true;
          updated.matchedExistingId = existing.id;
          updated.matchedExistingName = existing.name;
          updated.distanceToMatchMeters = Number(dist.toFixed(1));
          updated.duplicateReason = `Strong name match (${Math.round(nameSim * 100)}%) near existing record "${existing.name}" (${dist.toFixed(1)}m)`;
          break;
        }
      }

      // 2. Check against already processed records within this same import batch
      if (!matchFound) {
        for (const batchItem of batchSeenCoords) {
          const dist = this.calculateDistanceMeters(
            updated.latitude,
            updated.longitude,
            batchItem.lat,
            batchItem.lng
          );
          const nameSim = this.computeNameSimilarity(updated.name, batchItem.name);

          if (dist <= 10 || (dist <= distanceThresholdMeters && nameSim > 0.5)) {
            matchFound = true;
            updated.isDuplicate = true;
            updated.matchedExistingId = batchItem.id;
            updated.matchedExistingName = batchItem.name;
            updated.distanceToMatchMeters = Number(dist.toFixed(1));
            updated.duplicateReason = `Duplicate within current import batch (${dist.toFixed(1)}m from "${batchItem.name}")`;
            break;
          }
        }
      }

      // Record this item into batch tracking
      batchSeenCoords.push({
        id: updated.id,
        name: updated.name,
        lat: updated.latitude,
        lng: updated.longitude,
      });

      // Verification status MUST remain 'imported'
      updated.verificationStatus = 'imported';

      processed.push(updated);
    }

    return processed;
  }

  /**
   * Great Circle Haversine formula
   */
  private calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Calculates similarity between two place names (0.0 to 1.0)
   */
  private computeNameSimilarity(nameA: string, nameB: string): number {
    const cleanA = this.normalizeName(nameA);
    const cleanB = this.normalizeName(nameB);

    if (!cleanA || !cleanB) return 0;
    if (cleanA === cleanB) return 1.0;

    // Substring containment check
    if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
      const minLen = Math.min(cleanA.length, cleanB.length);
      const maxLen = Math.max(cleanA.length, cleanB.length);
      return Math.max(0.75, minLen / maxLen);
    }

    // Jaccard token overlap
    const tokensA = new Set(cleanA.split(/\s+/));
    const tokensB = new Set(cleanB.split(/\s+/));

    let intersection = 0;
    tokensA.forEach((token) => {
      if (tokensB.has(token)) intersection++;
    });

    const union = new Set([...tokensA, ...tokensB]).size;
    return union > 0 ? intersection / union : 0;
  }

  private normalizeName(name: string): string {
    return (name || '')
      .toLowerCase()
      .replace(/['".,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
      .replace(/\b(sarbojanin|sarbajanin|durgotsav|durga|puja|club|sangha|samiti|association|committee|barowari|utsav|utsab)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
