/**
 * Eclipse GPS — Geospatial Marker Clustering Utility (Phase 13.1)
 * 
 * Provides zoom-aware clustering for high-density pandal markers.
 * At lower zooms (< 13), collapses dense groupings into interactive cluster badges.
 * When zooming in (or tapping a cluster), clusters expand into individual pandal markers.
 */

export interface MarkerClusterGroup<T> {
  id: string;
  isCluster: true;
  count: number;
  location: { lat: number; lng: number };
  items: T[];
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

export type ClusterOrItem<T> =
  | { isCluster: true; cluster: MarkerClusterGroup<T>; item?: never }
  | { isCluster: false; item: T; cluster?: never };

/**
 * Cluster radius threshold in meters based on zoom level
 */
function getClusterDistanceThresholdMeters(zoom: number): number {
  if (zoom <= 9) return 4000;
  if (zoom === 10) return 2500;
  if (zoom === 11) return 1400;
  if (zoom === 12) return 700;
  // Zoom 13 and above: no clustering (or very small 150m for identical colocations)
  return 120;
}

function calculateDistanceInMeters(
  loc1: { lat: number; lng: number },
  loc2: { lat: number; lng: number }
): number {
  const R = 6371e3;
  const phi1 = (loc1.lat * Math.PI) / 180;
  const phi2 = (loc2.lat * Math.PI) / 180;
  const deltaPhi = ((loc2.lat - loc1.lat) * Math.PI) / 180;
  const deltaLambda = ((loc2.lng - loc1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Clusters an array of geo-positioned items based on current map zoom
 */
export function clusterMarkers<T>(
  items: T[],
  zoom: number,
  getCoords: (item: T) => { lat: number; lng: number }
): ClusterOrItem<T>[] {
  if (items.length === 0) return [];

  // At zoom 14 and above, individual display is preferred unless exactly superimposed
  if (zoom >= 14) {
    return items.map((item) => ({ isCluster: false, item }));
  }

  const threshold = getClusterDistanceThresholdMeters(zoom);
  const clusters: MarkerClusterGroup<T>[] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    if (assigned.has(i)) continue;

    const item = items[i];
    const coords = getCoords(item);

    const clusterItems: T[] = [item];
    assigned.add(i);

    let sumLat = coords.lat;
    let sumLng = coords.lng;
    let minLat = coords.lat;
    let maxLat = coords.lat;
    let minLng = coords.lng;
    let maxLng = coords.lng;

    for (let j = i + 1; j < items.length; j++) {
      if (assigned.has(j)) continue;

      const otherItem = items[j];
      const otherCoords = getCoords(otherItem);
      const dist = calculateDistanceInMeters(coords, otherCoords);

      if (dist <= threshold) {
        clusterItems.push(otherItem);
        assigned.add(j);

        sumLat += otherCoords.lat;
        sumLng += otherCoords.lng;
        minLat = Math.min(minLat, otherCoords.lat);
        maxLat = Math.max(maxLat, otherCoords.lat);
        minLng = Math.min(minLng, otherCoords.lng);
        maxLng = Math.max(maxLng, otherCoords.lng);
      }
    }

    if (clusterItems.length > 1) {
      clusters.push({
        id: `cluster-${Math.round(coords.lat * 1000)}-${Math.round(coords.lng * 1000)}-${clusterItems.length}`,
        isCluster: true,
        count: clusterItems.length,
        location: {
          lat: Number((sumLat / clusterItems.length).toFixed(6)),
          lng: Number((sumLng / clusterItems.length).toFixed(6)),
        },
        items: clusterItems,
        bounds: { minLat, maxLat, minLng, maxLng },
      });
    } else {
      clusters.push({
        id: `single-${i}`,
        isCluster: true, // will be unwrapped below
        count: 1,
        location: coords,
        items: clusterItems,
        bounds: { minLat, maxLat, minLng, maxLng },
      });
    }
  }

  const result: ClusterOrItem<T>[] = [];
  for (const c of clusters) {
    if (c.count > 1) {
      result.push({ isCluster: true, cluster: c });
    } else {
      result.push({ isCluster: false, item: c.items[0] });
    }
  }

  return result;
}
