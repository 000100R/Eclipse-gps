import { Location, Place, Event, Pandal } from '../../types';
import { demoPandals } from '../../data/demoPandals';
import { demoEvents } from '../../data/demoEvents';

export interface ISearchResult {
  id: string;
  name: string;
  type: 'place' | 'event' | 'pandal' | 'restaurant' | 'parking' | 'landmark';
  location: Location;
  address: string;
  description: string;
  crowdLevel?: 'LOW' | 'MODERATE' | 'HEAVY' | 'EXTREME';
  rawItem?: any;
}

export interface IPlacesProvider {
  search(query: string, near?: Location): Promise<ISearchResult[]>;
  getNearbyPlaces(location: Location, radius: number, type?: string): Promise<ISearchResult[]>;
  geocode(address: string): Promise<Location | null>;
  reverseGeocode(location: Location): Promise<string>;
}

export class NominatimPlacesProvider implements IPlacesProvider {
  async search(query: string, near?: Location): Promise<ISearchResult[]> {
    const results: ISearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // 1. Search local demo pandals and events first
    for (const p of demoPandals) {
      if (p.name.toLowerCase().includes(lowerQuery) || p.theme.toLowerCase().includes(lowerQuery) || p.address.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: p.id,
          name: p.name,
          type: 'pandal',
          location: p.location,
          address: p.address,
          description: `Theme: ${p.theme} - ${p.description}`,
          crowdLevel: p.crowdLevel,
          rawItem: p,
        });
      }
    }

    for (const e of demoEvents) {
      if (e.name.toLowerCase().includes(lowerQuery) || e.description.toLowerCase().includes(lowerQuery) || e.address.toLowerCase().includes(lowerQuery) || (e.category && e.category.toLowerCase().includes(lowerQuery))) {
        results.push({
          id: e.id,
          name: e.name,
          type: 'event',
          location: e.location,
          address: e.address,
          description: e.description,
          crowdLevel: e.crowdLevel,
          rawItem: e,
        });
      }
    }

    // 2. Perform live Nominatim search for global lookups (like "Victoria Memorial")
    // Limit to 5 results to keep things speedy
    let nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
    
    // If we have a 'near' location, let's bias or filter results near it
    if (near) {
      nominatimUrl += `&viewbox=${near.lng - 0.2},${near.lat + 0.2},${near.lng + 0.2},${near.lat - 0.2}&bounded=1`;
    }

    try {
      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'EclipseGPS/1.0',
        },
      });
      if (response.ok) {
        const data = await response.json();
        for (const item of data) {
          // Check if this item already exists in local results
          const itemLat = parseFloat(item.lat);
          const itemLng = parseFloat(item.lon);
          const isDup = results.some(r => Math.abs(r.location.lat - itemLat) < 0.0001 && Math.abs(r.location.lng - itemLng) < 0.0001);
          
          if (!isDup) {
            let itemType: 'place' | 'restaurant' | 'parking' | 'landmark' = 'place';
            if (item.type === 'restaurant' || item.class === 'amenity' && item.type === 'fast_food' || lowerQuery.includes('restaurant') || lowerQuery.includes('food')) {
              itemType = 'restaurant';
            } else if (item.type === 'parking' || lowerQuery.includes('parking')) {
              itemType = 'parking';
            } else if (item.class === 'historic' || item.class === 'tourism' || item.type === 'monument') {
              itemType = 'landmark';
            }

            results.push({
              id: `nom-${item.place_id || Math.random()}`,
              name: item.display_name.split(',')[0],
              type: itemType,
              location: { lat: itemLat, lng: itemLng },
              address: item.display_name,
              description: `Type: ${item.type || item.class || 'Location'} (OSM Real-time)`,
              crowdLevel: 'LOW', // default
              rawItem: item,
            });
          }
        }
      }
    } catch (e) {
      console.warn('Nominatim search failed, using local results only:', e);
    }

    // 3. Fallback: If results are empty and user is searching for something generic, generate mock points around the 'near' location
    if (results.length === 0 && near) {
      if (lowerQuery.includes('restaurant') || lowerQuery.includes('food')) {
        results.push(
          {
            id: 'mock-res-1',
            name: 'Mocambo Restaurant',
            type: 'restaurant',
            location: { lat: near.lat + 0.003, lng: near.lng + 0.002 },
            address: 'Park Street, Kolkata',
            description: 'Famous continental restaurant in Kolkata',
            crowdLevel: 'HEAVY',
          },
          {
            id: 'mock-res-2',
            name: 'Kusum Rolls',
            type: 'restaurant',
            location: { lat: near.lat - 0.002, lng: near.lng + 0.004 },
            address: 'Park Street, Kolkata',
            description: 'Iconic street food stall for Kathi rolls',
            crowdLevel: 'EXTREME',
          }
        );
      } else if (lowerQuery.includes('parking')) {
        results.push(
          {
            id: 'mock-pk-1',
            name: 'Maidan Underground Parking',
            type: 'parking',
            location: { lat: near.lat + 0.005, lng: near.lng - 0.003 },
            address: 'Jawaharlal Nehru Road, Kolkata',
            description: 'Spacious secure multi-level parking lot',
            crowdLevel: 'LOW',
          },
          {
            id: 'mock-pk-2',
            name: 'Forum Mall Parking',
            type: 'parking',
            location: { lat: near.lat - 0.004, lng: near.lng + 0.001 },
            address: 'Elgin Road, Kolkata',
            description: 'Shopping mall paid parking space',
            crowdLevel: 'HEAVY',
          }
        );
      }
    }

    return results;
  }

  async getNearbyPlaces(location: Location, radius: number, type?: string): Promise<ISearchResult[]> {
    // Return all places near the coordinate, utilizing local database + OSM Nominatim
    const results: ISearchResult[] = [];
    const query = type || 'amenities';
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&viewbox=${location.lng - 0.05},${location.lat + 0.05},${location.lng + 0.05},${location.lat - 0.05}&bounded=1`;

    try {
      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'EclipseGPS/1.0',
        },
      });
      if (response.ok) {
        const data = await response.json();
        for (const item of data) {
          results.push({
            id: `nom-${item.place_id || Math.random()}`,
            name: item.display_name.split(',')[0],
            type: type === 'parking' ? 'parking' : type === 'restaurant' ? 'restaurant' : 'place',
            location: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
            address: item.display_name,
            description: `Nearby ${type || 'Place'}`,
            crowdLevel: 'MODERATE',
            rawItem: item,
          });
        }
      }
    } catch (e) {
      console.warn('Nominatim nearby failed, using mock listings:', e);
    }

    // Always mix in matching local demo data
    for (const p of demoPandals) {
      const dist = this.getDistance(location, p.location);
      if (dist <= radius) {
        results.push({
          id: p.id,
          name: p.name,
          type: 'pandal',
          location: p.location,
          address: p.address,
          description: `Pandal Theme: ${p.theme}`,
          crowdLevel: p.crowdLevel,
          rawItem: p,
        });
      }
    }

    for (const e of demoEvents) {
      const dist = this.getDistance(location, e.location);
      if (dist <= radius) {
        results.push({
          id: e.id,
          name: e.name,
          type: 'event',
          location: e.location,
          address: e.address,
          description: e.description,
          crowdLevel: e.crowdLevel,
          rawItem: e,
        });
      }
    }

    return results;
  }

  async geocode(address: string): Promise<Location | null> {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'EclipseGPS/1.0',
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
      }
    } catch (e) {
      console.error('Nominatim geocoding error:', e);
    }
    return null;
  }

  async reverseGeocode(location: Location): Promise<string> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}`;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'EclipseGPS/1.0',
        },
      });
      if (response.ok) {
        const data = await response.json();
        return data.display_name || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
      }
    } catch (e) {
      console.error('Nominatim reverse geocoding error:', e);
    }
    return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
  }

  private getDistance(p1: Location, p2: Location): number {
    const R = 6371e3; // meters
    const phi1 = (p1.lat * Math.PI) / 180;
    const phi2 = (p2.lat * Math.PI) / 180;
    const deltaPhi = ((p2.lat - p1.lat) * Math.PI) / 180;
    const deltaLambda = ((p2.lng - p1.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

export const placesService = new NominatimPlacesProvider();
export const geocodingService = placesService;
