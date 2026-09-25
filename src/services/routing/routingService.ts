import { Location, Route, RouteInstruction, RouteWaypoint } from '../../types';

export interface IRoutingProvider {
  calculateRoute(
    origin: Location,
    destination: Location,
    waypoints: RouteWaypoint[],
    alternatives?: boolean | number,
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
export function getHaversineDistance(p1: Location, p2: Location): number {
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

/**
 * Robustly extract a valid Location object from any pandal, event, station, or coordinate object
 */
export function extractLocation(item: any): Location | null {
  if (!item) return null;
  if (typeof item.lat === 'number' && typeof item.lng === 'number' && !isNaN(item.lat) && !isNaN(item.lng)) {
    return { lat: item.lat, lng: item.lng };
  }
  if (typeof item.latitude === 'number' && typeof item.longitude === 'number' && !isNaN(item.latitude) && !isNaN(item.longitude)) {
    return { lat: item.latitude, lng: item.longitude };
  }
  if (item.location && typeof item.location.lat === 'number' && typeof item.location.lng === 'number' && !isNaN(item.location.lat) && !isNaN(item.location.lng)) {
    return { lat: item.location.lat, lng: item.location.lng };
  }
  return null;
}

export class OSRMRoutingProvider implements IRoutingProvider {
  isFallback: boolean = false;
  private routeCache = new Map<string, { route: Route; timestamp: number }>();
  private inFlightRequests = new Map<string, Promise<Route>>();

  private calculateGoogleRoute(
    origin: Location,
    destination: Location,
    waypoints: RouteWaypoint[],
    alternatives: boolean | number,
    profile: 'driving' | 'foot'
  ): Promise<Route | null> {
    return new Promise((resolve) => {
      let resolved = false;
      const safeResolve = (val: Route | null) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve(val);
        }
      };

      // Strict timeout: if Google Directions API does not answer within 3500ms, resolve null to let OSRM proceed
      const timeoutId = setTimeout(() => {
        safeResolve(null);
      }, 3500);

      try {
        const googleMaps = (window as any).google?.maps;
        if (!googleMaps || !googleMaps.DirectionsService) {
          safeResolve(null);
          return;
        }

        const directionsService = new googleMaps.DirectionsService();
        const travelMode = profile === 'driving' ? googleMaps.TravelMode.DRIVING : googleMaps.TravelMode.WALKING;

        directionsService.route(
          {
            origin: new googleMaps.LatLng(origin.lat, origin.lng),
            destination: new googleMaps.LatLng(destination.lat, destination.lng),
            waypoints: waypoints.map((wp) => ({
              location: new googleMaps.LatLng(wp.location.lat, wp.location.lng),
              stopover: true,
            })),
            travelMode,
            provideRouteAlternatives: Boolean(alternatives),
          },
          (result: any, status: any) => {
            if (status === 'OK' && result && result.routes && result.routes.length > 0) {
              const primaryGRoute = result.routes[0];
              const geometry: Location[] = primaryGRoute.overview_path.map((pt: any) => ({
                lat: pt.lat(),
                lng: pt.lng(),
              }));

              let totalDistance = 0;
              let totalDuration = 0;
              const instructions: RouteInstruction[] = [];

              for (const leg of primaryGRoute.legs || []) {
                totalDistance += leg.distance?.value || 0;
                totalDuration += leg.duration?.value || 0;

                for (const step of leg.steps || []) {
                  const rawText = step.instructions || 'Continue';
                  const cleanText = rawText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
                  instructions.push({
                    text: cleanText,
                    distance: step.distance?.value || 0,
                    duration: step.duration?.value || 0,
                  });
                }
              }

              const altRoutes: Route[] = [];
              if (result.routes.length > 1) {
                for (let i = 1; i < result.routes.length && i <= 3; i++) {
                  const alt = result.routes[i];
                  const altGeom: Location[] = alt.overview_path.map((latLng: any) => ({
                    lat: latLng.lat(),
                    lng: latLng.lng(),
                  }));
                  let altDist = 0;
                  let altDur = 0;
                  for (const leg of alt.legs || []) {
                    altDist += leg.distance?.value || 0;
                    altDur += leg.duration?.value || 0;
                  }
                  altRoutes.push({
                    id: `google-alt-${i}-${Date.now()}`,
                    name: `Alternative Route ${i}`,
                    origin,
                    destination,
                    waypoints,
                    geometry: altGeom,
                    distance: altDist,
                    duration: altDur,
                    instructions: [],
                  });
                }
              }

              safeResolve({
                id: `google-route-${Date.now()}`,
                name: waypoints.length > 0 ? `Google Route via ${waypoints.length} stops` : 'Google Primary Route',
                origin,
                destination,
                waypoints,
                geometry,
                distance: totalDistance,
                duration: totalDuration,
                instructions,
                alternatives: altRoutes,
              });
            } else {
              safeResolve(null);
            }
          }
        );
      } catch (e) {
        safeResolve(null);
      }
    });
  }

  private parseRouteFromOSRM(
    osrmRoute: any,
    origin: Location,
    destination: Location,
    waypoints: RouteWaypoint[],
    index: number = 0
  ): Route {
    const geometry: Location[] = osrmRoute.geometry.coordinates.map((coord: [number, number]) => ({
      lat: coord[1],
      lng: coord[0],
    }));

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
      id: `route-${index}-${Math.random().toString(36).substr(2, 9)}`,
      name: index === 0 ? (waypoints.length > 0 ? `Primary Route via ${waypoints.length} stops` : `Primary Route`) : `Alternative Route ${index}`,
      origin,
      destination,
      waypoints,
      geometry,
      distance: osrmRoute.distance,
      duration: osrmRoute.duration,
      instructions,
    };
  }

  async calculateRoute(
    origin: Location,
    destination: Location,
    waypoints: RouteWaypoint[] = [],
    alternatives: boolean | number = false,
    profile: 'driving' | 'foot' = 'foot'
  ): Promise<Route> {
    // Sanitize origin
    let safeOrigin = extractLocation(origin);
    if (!safeOrigin) {
      safeOrigin = { lat: 22.5726, lng: 88.3639 }; // Default Kolkata central reference
    }

    // Sanitize destination
    let safeDestination = extractLocation(destination);
    if (!safeDestination) {
      safeDestination = { lat: safeOrigin.lat + 0.005, lng: safeOrigin.lng + 0.005 };
    }

    // Filter valid waypoints
    const validWaypoints: RouteWaypoint[] = (waypoints || []).filter(wp => {
      const loc = extractLocation(wp?.location);
      return loc !== null;
    }).map(wp => ({
      ...wp,
      location: extractLocation(wp.location)!,
    }));

    const osrmProfile = profile === 'foot' ? 'foot' : 'driving';
    const altParam = typeof alternatives === 'number'
      ? alternatives
      : (alternatives ? 3 : 'false');

    // Check fast in-memory cache (valid for 5 minutes)
    const cacheKey = `${safeOrigin.lat.toFixed(4)},${safeOrigin.lng.toFixed(4)}->${safeDestination.lat.toFixed(4)},${safeDestination.lng.toFixed(4)}_${osrmProfile}_${validWaypoints.length}_${altParam}`;
    const cached = this.routeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300000) {
      return cached.route;
    }

    // Deduplicate in-flight requests for identical route queries
    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey)!;
    }

    const requestPromise = (async () => {
      // 1. If Google Maps Directions API is available in project/window, query it directly
      if (typeof window !== 'undefined' && (window as any).google?.maps?.DirectionsService) {
        try {
          const googleRoute = await this.calculateGoogleRoute(
            safeOrigin,
            safeDestination,
            validWaypoints,
            alternatives,
            profile
          );
          if (googleRoute) {
            this.isFallback = false;
            this.routeCache.set(cacheKey, { route: googleRoute, timestamp: Date.now() });
            return googleRoute;
          }
        } catch (gErr) {
          console.warn('[RoutingService] Google DirectionsService unavailable or failed, falling back to OSRM:', gErr);
        }
      }

      // Semicolon-separated coordinates list: lng,lat;lng,lat...
      const coordsList: string[] = [];
      coordsList.push(`${safeOrigin.lng},${safeOrigin.lat}`);
      for (const wp of validWaypoints) {
        coordsList.push(`${wp.location.lng},${wp.location.lat}`);
      }
      coordsList.push(`${safeDestination.lng},${safeDestination.lat}`);

      const coordsString = coordsList.join(';');
      const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${coordsString}?overview=full&geometries=geojson&steps=true&alternatives=${altParam}`;

      // Use 4.5 second AbortController timeout to prevent UI freezes on slow/unreachable networks
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`OSRM network request returned ${response.status}`);
        }
        const data = await response.json();

        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
          throw new Error('OSRM routing error: ' + (data.message || 'no route found'));
        }

        this.isFallback = false;
        const primaryRoute = this.parseRouteFromOSRM(data.routes[0], safeOrigin, safeDestination, validWaypoints, 0);

        // Parse up to 3 reasonable alternative routes if returned by OSRM
        if (data.routes.length > 1) {
          const altRoutes = data.routes
            .slice(1, 4)
            .map((r: any, idx: number) => this.parseRouteFromOSRM(r, safeOrigin, safeDestination, validWaypoints, idx + 1));
          primaryRoute.alternatives = altRoutes;
        }

        // Save to cache
        this.routeCache.set(cacheKey, { route: primaryRoute, timestamp: Date.now() });

        return primaryRoute;
      } catch (err: any) {
        clearTimeout(timeoutId);
        const isTimeout = err?.name === 'AbortError';
        console.warn(`[RoutingService] OSRM routing ${isTimeout ? 'timed out' : 'failed'}, using guaranteed direct fallback:`, err?.message || err);
        this.isFallback = true;
        const fallback = this.generateFallbackRoute(safeOrigin, safeDestination, validWaypoints, osrmProfile);
        return fallback;
      }
    })();

    this.inFlightRequests.set(cacheKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      this.inFlightRequests.delete(cacheKey);
    }
  }

  private generateFallbackRoute(
    origin: Location,
    destination: Location,
    waypoints: RouteWaypoint[],
    profile: 'driving' | 'foot' = 'foot'
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

    // Walking speed ~1.3 m/s (~4.7 km/h), Driving speed ~8.33 m/s (~30 km/h)
    const speedMps = profile === 'foot' ? 1.3 : 8.33;
    const totalDuration = Math.round(totalDistance / speedMps);

    // Generate instructions
    const instructions: RouteInstruction[] = [];
    instructions.push({
      text: `Start ${profile === 'foot' ? 'walking' : 'driving'} navigation (Direct Line Mode)`,
      distance: 0,
      duration: 0,
    });

    for (let i = 0; i < waypoints.length; i++) {
      const legDist = getHaversineDistance(i === 0 ? origin : waypoints[i - 1].location, waypoints[i].location);
      instructions.push({
        text: `Proceed to Stop ${i + 1}: ${waypoints[i].name}`,
        distance: legDist,
        duration: Math.round(legDist / speedMps),
      });
    }

    const finalLegDist = getHaversineDistance(waypoints.length === 0 ? origin : waypoints[waypoints.length - 1].location, destination);
    instructions.push({
      text: 'Proceed to final destination',
      distance: finalLegDist,
      duration: Math.round(finalLegDist / speedMps),
    });

    return {
      id: `route-fallback-${Date.now()}`,
      name: `Direct Route (${profile === 'foot' ? 'Walking' : 'Driving'})`,
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
    profile: 'driving' | 'foot' = 'foot'
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
