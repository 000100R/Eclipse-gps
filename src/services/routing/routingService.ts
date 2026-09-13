import { Location, Route, RouteInstruction, RouteWaypoint } from '../../types';

export interface IRoutingProvider {
  calculateRoute(
    origin: Location,
    destination: Location,
    waypoints: RouteWaypoint[],
    alternatives?: boolean,
    profile?: 'driving' | 'foot'
  ): Promise<Route>;
  optimizeRoute(
    origin: Location,
    destination: Location,
    stops: RouteWaypoint[],
    profile?: 'driving' | 'foot'
  ): Promise<{ optimizedStops: RouteWaypoint[]; optimizedRoute: Route }>;
}

// Haversine distance helper (for local fallback calculation)
function getHaversineDistance(p1: Location, p2: Location): number {
  const R = 6371e3; // meters
  const phi1 = (p1.lat * Math.PI) / 180;
  const phi2 = (p2.lat * Math.PI) / 180;
  const deltaPhi = ((p2.lat - p1.lat) * Math.PI) / 180;
  const deltaLambda = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

export class OSRMRoutingProvider implements IRoutingProvider {
  isFallback: boolean = false;

  async calculateRoute(
    origin: Location,
    destination: Location,
    waypoints: RouteWaypoint[],
    alternatives: boolean = false,
    profile: 'driving' | 'foot' = 'driving'
  ): Promise<Route> {
    // Semicolon-separated coordinates list: lng,lat;lng,lat...
    const coordsList: string[] = [];
    coordsList.push(`${origin.lng},${origin.lat}`);
    
    for (const wp of waypoints) {
      coordsList.push(`${wp.location.lng},${wp.location.lat}`);
    }
    coordsList.push(`${destination.lng},${destination.lat}`);

    const coordsString = coordsList.join(';');
    const osrmProfile = profile === 'foot' ? 'foot' : 'driving';
    const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${coordsString}?overview=full&geometries=geojson&steps=true&alternatives=${alternatives}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('OSRM network request failed');
      }
      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('OSRM routing error: ' + (data.message || 'no route found'));
      }

      this.isFallback = false;
      const osrmRoute = data.routes[0];
      
      // Parse coordinates from GeoJSON
      const geometry: Location[] = osrmRoute.geometry.coordinates.map((coord: [number, number]) => ({
        lat: coord[1],
        lng: coord[0],
      }));

      // Parse turn-by-turn instructions
      const instructions: RouteInstruction[] = [];
      if (osrmRoute.legs) {
        for (const leg of osrmRoute.legs) {
          if (leg.steps) {
            for (const step of leg.steps) {
              const name = step.name || 'Road';
              const type = step.maneuver.type;
              const modifier = step.maneuver.modifier ? ` ${step.maneuver.modifier}` : '';
              let instructionText = `${type}${modifier} on ${name}`;
              
              if (type === 'depart') {
                instructionText = `Depart from starting location towards ${name}`;
              } else if (type === 'arrive') {
                instructionText = `Arrive at destination`;
              } else if (type === 'turn') {
                instructionText = `Turn ${step.maneuver.modifier} onto ${name}`;
              } else if (type === 'new name') {
                instructionText = `Continue onto ${name}`;
              }

              instructions.push({
                text: instructionText,
                distance: step.distance,
                duration: step.duration,
              });
            }
          }
        }
      }

      // If no steps returned, make simulated steps
      if (instructions.length === 0) {
        instructions.push({
          text: `Depart from starting point`,
          distance: osrmRoute.distance * 0.1,
          duration: osrmRoute.duration * 0.1,
        });
        instructions.push({
          text: `Drive on main road`,
          distance: osrmRoute.distance * 0.8,
          duration: osrmRoute.duration * 0.8,
        });
        instructions.push({
          text: `Arrive at destination`,
          distance: osrmRoute.distance * 0.1,
          duration: osrmRoute.duration * 0.1,
        });
      }

      return {
        id: `route-${Math.random().toString(36).substr(2, 9)}`,
        name: `Road Route via ${waypoints.length} stops`,
        origin,
        destination,
        waypoints,
        geometry,
        distance: osrmRoute.distance,
        duration: osrmRoute.duration,
        instructions,
      };
    } catch (err) {
      console.warn('OSRM routing failed, falling back to Haversine straight-line simulation:', err);
      this.isFallback = true;
      return this.generateFallbackRoute(origin, destination, waypoints);
    }
  }

  private generateFallbackRoute(
    origin: Location,
    destination: Location,
    waypoints: RouteWaypoint[]
  ): Route {
    // Generate straight lines connecting all coordinates
    const geometry: Location[] = [];
    geometry.push(origin);
    for (const wp of waypoints) {
      geometry.push(wp.location);
    }
    geometry.push(destination);

    // Calculate simulated distance/duration
    let totalDistance = 0;
    for (let i = 0; i < geometry.length - 1; i++) {
      totalDistance += getHaversineDistance(geometry[i], geometry[i + 1]);
    }

    // Assume average speed 30 km/h (8.3 m/s)
    const totalDuration = totalDistance / 8.33;

    // Generate instructions
    const instructions: RouteInstruction[] = [];
    instructions.push({
      text: 'Start navigation (Fallback/Straight-Line Mode)',
      distance: 0,
      duration: 0,
    });

    for (let i = 0; i < waypoints.length; i++) {
      instructions.push({
        text: `Proceed to Stop ${i + 1}: ${waypoints[i].name}`,
        distance: getHaversineDistance(i === 0 ? origin : waypoints[i - 1].location, waypoints[i].location),
        duration: getHaversineDistance(i === 0 ? origin : waypoints[i - 1].location, waypoints[i].location) / 8.33,
      });
    }

    instructions.push({
      text: 'Proceed to final destination',
      distance: getHaversineDistance(waypoints.length === 0 ? origin : waypoints[waypoints.length - 1].location, destination),
      duration: getHaversineDistance(waypoints.length === 0 ? origin : waypoints[waypoints.length - 1].location, destination) / 8.33,
    });

    return {
      id: `route-fallback-${Date.now()}`,
      name: `Simulated Route (Demo)`,
      origin,
      destination,
      waypoints,
      geometry,
      distance: totalDistance,
      duration: totalDuration,
      instructions,
    };
  }

  // Exact optimization (Brute-force solver since stops size <= 6)
  async optimizeRoute(
    origin: Location,
    destination: Location,
    stops: RouteWaypoint[],
    profile: 'driving' | 'foot' = 'driving'
  ): Promise<{ optimizedStops: RouteWaypoint[]; optimizedRoute: Route }> {
    if (stops.length <= 1) {
      const optimizedRoute = await this.calculateRoute(origin, destination, stops, false, profile);
      return { optimizedStops: stops, optimizedRoute };
    }

    // We want to find the permutation of stops that minimizes the total path distance:
    // path: origin -> perm[0] -> perm[1] -> ... -> perm[N-1] -> destination
    let bestPermutation: RouteWaypoint[] = [];
    let minDistance = Infinity;

    const permutations = (arr: RouteWaypoint[]): RouteWaypoint[][] => {
      const result: RouteWaypoint[][] = [];
      const permute = (m: RouteWaypoint[], temp: RouteWaypoint[] = []) => {
        if (m.length === 0) {
          result.push(temp);
        } else {
          for (let i = 0; i < m.length; i++) {
            const curr = m.slice();
            const next = curr.splice(i, 1);
            permute(curr.slice(), temp.concat(next));
          }
        }
      };
      permute(arr);
      return result;
    };

    const allPerms = permutations(stops);

    for (const perm of allPerms) {
      let currentDist = 0;
      let prevLoc = origin;
      
      for (const stop of perm) {
        currentDist += getHaversineDistance(prevLoc, stop.location);
        prevLoc = stop.location;
      }
      currentDist += getHaversineDistance(prevLoc, destination);

      if (currentDist < minDistance) {
        minDistance = currentDist;
        bestPermutation = perm;
      }
    }

    const optimizedRoute = await this.calculateRoute(origin, destination, bestPermutation, false, profile);
    return {
      optimizedStops: bestPermutation,
      optimizedRoute,
    };
  }
}

export const routingService = new OSRMRoutingProvider();
