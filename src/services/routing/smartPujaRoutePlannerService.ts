/**
 * Eclipse GPS — Smart Puja Route Planner Service (Phase 13.8)
 * 
 * Generates practical, authentic Durga Puja and Bonedi Bari hopping itineraries.
 * 
 * STRICT INVARIANTS:
 * - Uses existing Eclipse PANDAL, BONEDI_BARI, METRO, PUJA_CALENDAR, CROWD, TRAFFIC, and OSRM routing systems.
 * - For MIXED/METRO mode: Identifies authentic Kolkata Metro stations, calculates walking segments, and NEVER invents Metro connections.
 * - Data Integrity: If crowd data is UNAVAILABLE, never assume low/high crowd. If traffic is unavailable, never fabricate traffic.
 * - Time & Budget Awareness: Accurately schedules arrival, darshan stay, and departure times against available time budget.
 * - Suggest Nearby: Recommends real pandals and Bonedi Baris that minimize detour from the current route.
 */

import { Location, Route, CrowdLevel } from '../../types';
import {
  TransportMode,
  RoutePriority,
  StartLocationOption,
  DestinationItem,
  SmartRouteStop,
  SmartRouteLeg,
  MetroHopInfo,
  SmartRoutePlan,
  NearbySuggestion,
} from '../../types/smartRoute';
import { routingService } from './routingService';
import { curatedEclipsePandals } from '../../data/curatedPandals';
import { curatedBonediBariList } from '../../data/curatedBonediBari';
import { curatedMetroStations } from '../../data/curatedMetroStations';
import { metroIntelligenceProvider } from '../intelligence/metroIntelligenceProvider';
import { trafficIntelligenceService } from '../intelligence/trafficIntelligenceService';
import { crowdIntelligenceService } from '../intelligence/crowdIntelligenceService';
import { pujaCalendarService } from '../intelligence/pujaCalendarService';
import { eventsService } from '../events/eventsService';

// Helpers
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

  return R * c;
}

function formatClockTime(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // '0' -> '12'
  const minStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minStr} ${ampm}`;
}

export class SmartPujaRoutePlannerService {
  /**
   * Convert any pandal or bonedi bari into standard DestinationItem
   */
  public toDestinationItem(item: any): DestinationItem {
    const isBonedi = item.id?.startsWith('bonedi-') || item.type === 'bonedi_bari' || !!item.pujaSince;
    return {
      id: item.id,
      name: item.name,
      type: isBonedi ? 'bonedi_bari' : 'pandal',
      location: item.location || { lat: item.latitude || 22.5726, lng: item.longitude || 88.3639 },
      address: item.address || item.area || 'Kolkata',
      theme: item.theme,
      family: item.family,
      zone: item.zone || item.area,
      nearestMetro: item.nearestMetro,
      rawItem: item,
    };
  }

  /**
   * Get all destination candidates from verified Eclipse catalogs
   */
  public getAllDestinations(): DestinationItem[] {
    const results: DestinationItem[] = [];
    const seen = new Set<string>();

    // 1. Curated Pandals
    for (const p of curatedEclipsePandals) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        results.push(this.toDestinationItem(p));
      }
    }

    // 2. Curated Bonedi Baris
    for (const b of curatedBonediBariList) {
      if (!seen.has(b.id)) {
        seen.add(b.id);
        results.push(this.toDestinationItem(b));
      }
    }

    // 3. Events Service catalog items (community/cached)
    for (const e of eventsService.getCombinedList()) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        results.push(this.toDestinationItem(e));
      }
    }

    return results;
  }

  /**
   * Lookup destination by ID
   */
  public getDestinationById(id: string): DestinationItem | undefined {
    const all = this.getAllDestinations();
    return all.find((d) => d.id === id);
  }

  /**
   * Calculate direct distance between two coordinates in meters
   */
  public calculateDistance(p1: Location, p2: Location): number {
    return Math.round(getHaversineDistance(p1, p2));
  }

  /**
   * Find verified Metro Station closest to a given location
   */
  public findNearestMetroStation(loc: Location): {
    station: (typeof curatedMetroStations)[0];
    distanceMeters: number;
    walkingMinutes: number;
  } {
    let nearest = curatedMetroStations[0];
    let minDistance = Infinity;

    for (const s of curatedMetroStations) {
      const d = getHaversineDistance(loc, s.location);
      if (d < minDistance) {
        minDistance = d;
        nearest = s;
      }
    }

    const walkingMinutes = Math.max(1, Math.round(minDistance / 75));
    return {
      station: nearest,
      distanceMeters: Math.round(minDistance),
      walkingMinutes,
    };
  }

  /**
   * Calculate authentic Metro transit between two stations on the SAME line
   * Never invents stations or connections.
   */
  public getMetroHopIfBeneficial(
    fromLoc: Location,
    toLoc: Location,
    directDistMeters: number,
    mode: TransportMode
  ): MetroHopInfo | undefined {
    // Only consider Metro if preferred mode is METRO or MIXED
    if (mode !== 'METRO' && mode !== 'MIXED') return undefined;

    // For very short trips (< 900m), direct walking is faster & practical
    if (directDistMeters < 900 && mode !== 'METRO') return undefined;

    const fromNearest = this.findNearestMetroStation(fromLoc);
    const toNearest = this.findNearestMetroStation(toLoc);

    // If both places are nearest to the same station, take walking instead
    if (fromNearest.station.id === toNearest.station.id) return undefined;

    // Check if both stations are on the same line
    if (fromNearest.station.line !== toNearest.station.line) {
      // Different lines (e.g. Blue Line and Green Line interchange at Esplanade)
      // For simplicity & reliability, return undefined rather than inventing speculative transfers
      return undefined;
    }

    // Both on same line! Let's get station indices in curatedMetroStations
    const sameLineStations = curatedMetroStations.filter(
      (s) => s.line === fromNearest.station.line
    );
    const idxFrom = sameLineStations.findIndex((s) => s.id === fromNearest.station.id);
    const idxTo = sameLineStations.findIndex((s) => s.id === toNearest.station.id);

    if (idxFrom === -1 || idxTo === -1) return undefined;

    const stopsCount = Math.abs(idxFrom - idxTo);
    if (stopsCount === 0) return undefined;

    // Intermediate stations list
    const step = idxTo > idxFrom ? 1 : -1;
    const intermediate: string[] = [];
    for (let i = idxFrom + step; i !== idxTo; i += step) {
      intermediate.push(sameLineStations[i].name);
    }

    // Metro ride time: ~2.5 mins per stop
    const metroRideMinutes = Math.max(2, Math.round(stopsCount * 2.5));

    // Walk to & from stations
    const walkToMeters = fromNearest.distanceMeters;
    const walkToMinutes = fromNearest.walkingMinutes;
    const walkFromMeters = toNearest.distanceMeters;
    const walkFromMinutes = toNearest.walkingMinutes;

    // If walk to station + walk from station is too large (e.g. both > 1800m), skip metro
    if (walkToMeters > 2000 || walkFromMeters > 2000) {
      return undefined;
    }

    const totalTransitMinutes = walkToMinutes + metroRideMinutes + 4 + walkFromMinutes;
    const directWalkMinutes = Math.round(directDistMeters / 75);

    // If direct walk is significantly shorter than entering metro, riding and exiting, stick to walk
    if (mode === 'MIXED' && directWalkMinutes <= totalTransitMinutes - 2 && directDistMeters < 1200) {
      return undefined;
    }

    let lineColor = '#3b82f6'; // Blue Line
    if (fromNearest.station.line.toLowerCase().includes('green')) lineColor = '#10b981';
    if (fromNearest.station.line.toLowerCase().includes('purple')) lineColor = '#a855f7';
    if (fromNearest.station.line.toLowerCase().includes('orange')) lineColor = '#f97316';

    return {
      boardStation: fromNearest.station.name,
      deboardStation: toNearest.station.name,
      lineName: fromNearest.station.line,
      lineColor,
      stopsCount,
      intermediateStations: intermediate,
      metroRideMinutes,
      walkToStationMeters: walkToMeters,
      walkToStationMinutes: walkToMinutes,
      walkFromStationMeters: walkFromMeters,
      walkFromStationMinutes: walkFromMinutes,
    };
  }

  /**
   * Plan and optimize a smart Durga Puja Route
   */
  public async planSmartRoute(params: {
    startLocation: StartLocationOption;
    destinations: DestinationItem[];
    availableTimeMinutes: number;
    preferredTransport: TransportMode;
    priority: RoutePriority;
    startTime?: Date;
  }): Promise<SmartRoutePlan> {
    const {
      startLocation,
      destinations,
      availableTimeMinutes,
      preferredTransport,
      priority,
    } = params;

    const startTime = params.startTime ? new Date(params.startTime) : new Date();

    if (destinations.length === 0) {
      return {
        id: `plan-${Date.now()}`,
        name: 'Empty Puja Route',
        createdAt: Date.now(),
        startLocation,
        stops: [],
        totalDistanceMeters: 0,
        totalTravelTimeMinutes: 0,
        totalStayTimeMinutes: 0,
        totalDurationMinutes: 0,
        availableTimeMinutes,
        transportMode: preferredTransport,
        priority,
        isWithinBudget: true,
        timeDifferenceMinutes: availableTimeMinutes,
        metroHopsCount: 0,
        totalWalkingMeters: 0,
        fullGeometry: [startLocation.location],
        summary: 'No destinations selected. Add pandals or Bonedi Baris to build your itinerary.',
      };
    }

    // 1. DESTINATION ORDER OPTIMIZATION (TSP Solver with Priority Weighting)
    const orderedDestinations = await this.optimizeDestinationOrder(
      startLocation.location,
      destinations,
      preferredTransport,
      priority
    );

    // 2. BUILD DETAILED LEGS & STOPS WITH GROUNDED REAL-TIME DATA
    let currentClock = new Date(startTime.getTime());
    let prevLoc = startLocation.location;
    let prevName = startLocation.name;
    let prevId = startLocation.id;

    const stops: SmartRouteStop[] = [];
    let totalDistanceMeters = 0;
    let totalTravelTimeMinutes = 0;
    let totalStayTimeMinutes = 0;
    let metroHopsCount = 0;
    let totalWalkingMeters = 0;
    const geometryPoints: Location[] = [startLocation.location];

    for (let i = 0; i < orderedDestinations.length; i++) {
      const dest = orderedDestinations[i];
      const directDist = getHaversineDistance(prevLoc, dest.location);

      // Check Metro hop if beneficial
      const metroHop = this.getMetroHopIfBeneficial(
        prevLoc,
        dest.location,
        directDist,
        preferredTransport
      );

      let legMode: TransportMode = preferredTransport;
      let legDistMeters = Math.round(directDist);
      let legDurationMinutes = 0;
      const legInstructions: string[] = [];

      if (metroHop) {
        legMode = 'METRO';
        metroHopsCount++;
        legDistMeters = metroHop.walkToStationMeters + metroHop.stopsCount * 1200 + metroHop.walkFromStationMeters;
        legDurationMinutes = metroHop.walkToStationMinutes + metroHop.metroRideMinutes + 4 + metroHop.walkFromStationMinutes;
        totalWalkingMeters += metroHop.walkToStationMeters + metroHop.walkFromStationMeters;

        legInstructions.push(
          `Walk ${metroHop.walkToStationMeters}m (${metroHop.walkToStationMinutes} min) to ${metroHop.boardStation}`
        );
        legInstructions.push(
          `Board ${metroHop.lineName} at ${metroHop.boardStation} (${metroHop.stopsCount} stop${metroHop.stopsCount > 1 ? 's' : ''} • ~${metroHop.metroRideMinutes} min)`
        );
        legInstructions.push(
          `Deboard at ${metroHop.deboardStation} and walk ${metroHop.walkFromStationMeters}m (${metroHop.walkFromStationMinutes} min) to ${dest.name}`
        );
      } else if (preferredTransport === 'WALK' || preferredTransport === 'MIXED') {
        legMode = 'WALK';
        legDurationMinutes = Math.max(2, Math.round(directDist / 75)); // 75m/min (4.5 km/h)
        totalWalkingMeters += legDistMeters;
        legInstructions.push(
          `Walk ${legDistMeters < 1000 ? `${legDistMeters}m` : `${(legDistMeters / 1000).toFixed(1)} km`} to ${dest.name}`
        );
      } else {
        // DRIVE
        legMode = 'DRIVE';
        legDurationMinutes = Math.max(3, Math.round(directDist / 300)); // ~18-20 km/h Kolkata city road traffic
        legInstructions.push(
          `Drive ${legDistMeters < 1000 ? `${legDistMeters}m` : `${(legDistMeters / 1000).toFixed(1)} km`} via connecting road to ${dest.name}`
        );
      }

      // Check Real Traffic Intelligence for this stop / corridor
      const trafficInfo = trafficIntelligenceService.getTrafficNearPandal(dest.id, dest.location);
      let trafficDelayMinutes = 0;
      let trafficData: SmartRouteStop['traffic'] = {
        status: 'UNAVAILABLE',
        source: 'UNAVAILABLE',
        isTrustworthy: false,
      };

      if (trafficInfo) {
        const isLiveOrEst = trafficInfo.source === 'LIVE' || trafficInfo.source === 'ESTIMATED';
        if (isLiveOrEst) {
          trafficData = {
            status: trafficInfo.status as any,
            corridorName: trafficInfo.corridorName,
            delayMinutes: trafficInfo.estimatedDelayMinutes,
            source: trafficInfo.source as any,
            isTrustworthy: true,
          };
          if (preferredTransport === 'DRIVE' && trafficInfo.status === 'CONGESTED') {
            trafficDelayMinutes = trafficInfo.estimatedDelayMinutes || 0;
            legDurationMinutes += trafficDelayMinutes;
            legInstructions.push(
              `⚠️ Traffic advisory: ${trafficInfo.corridorName} experiencing delays (+${trafficInfo.estimatedDelayMinutes}m)`
            );
          }
        }
      }

      // Leg computation
      const leg: SmartRouteLeg = {
        fromId: prevId,
        fromName: prevName,
        toId: dest.id,
        toName: dest.name,
        distanceMeters: legDistMeters,
        durationMinutes: legDurationMinutes,
        transportMode: legMode,
        metroDetails: metroHop,
        traffic: trafficData.isTrustworthy ? {
          status: trafficData.status,
          corridorName: trafficData.corridorName,
          delayMinutes: trafficData.delayMinutes,
          source: trafficData.source,
          sourceLabel: trafficInfo?.sourceLabel,
          isTrustworthy: true,
        } : undefined,
        instructions: legInstructions,
      };

      totalDistanceMeters += legDistMeters;
      totalTravelTimeMinutes += legDurationMinutes;

      // Clock advancement: Arrival Time
      currentClock = new Date(currentClock.getTime() + legDurationMinutes * 60 * 1000);
      const arrivalStr = formatClockTime(currentClock);

      // Estimated Darshan / Visit stay duration
      // Pandals typically 20-30 mins; Bonedi Baris 20-25 mins
      const stayMinutes = dest.type === 'bonedi_bari' ? 20 : 25;
      totalStayTimeMinutes += stayMinutes;

      // Clock advancement: Departure Time
      const departureDate = new Date(currentClock.getTime() + stayMinutes * 60 * 1000);
      const departureStr = formatClockTime(departureDate);
      currentClock = departureDate;

      // Check Real Crowd Intelligence for this pandal
      // STRICT RULE: If crowd data is UNAVAILABLE, never assume low/high crowd!
      const crowdItem = crowdIntelligenceService.getCrowdForPandal(dest.id, dest.rawItem || dest);
      const isTrustworthyCrowd =
        crowdItem &&
        crowdItem.crowdLevel !== 'UNAVAILABLE' &&
        (crowdItem.source === 'LIVE' || crowdItem.source === 'ESTIMATED');

      const crowdData: SmartRouteStop['crowd'] = {
        level: crowdItem?.crowdLevel || 'UNAVAILABLE',
        source: (crowdItem?.source as any) || 'UNAVAILABLE',
        sourceLabel: crowdItem?.sourceLabel,
        waitMinutes: crowdItem?.queueWaitMinutes,
        isTrustworthy: isTrustworthyCrowd,
      };

      // Puja Calendar & Darshan hours evaluation
      const darshanStatus = this.evaluateDarshanHours(dest, currentClock);

      stops.push({
        id: dest.id,
        stopIndex: i + 1,
        name: dest.name,
        type: dest.type,
        location: dest.location,
        address: dest.address,
        theme: dest.theme,
        family: dest.family,
        legFromPrevious: leg,
        estimatedArrival: arrivalStr,
        estimatedDeparture: departureStr,
        estimatedStayMinutes: stayMinutes,
        crowd: crowdData,
        traffic: trafficData,
        darshanStatus,
        rawItem: dest.rawItem,
      });

      geometryPoints.push(dest.location);
      prevLoc = dest.location;
      prevName = dest.name;
      prevId = dest.id;
    }

    const totalDurationMinutes = totalTravelTimeMinutes + totalStayTimeMinutes;
    const isWithinBudget = totalDurationMinutes <= availableTimeMinutes;
    const timeDifferenceMinutes = availableTimeMinutes - totalDurationMinutes;

    // Generate accurate road OSRM route for real map rendering and turn-by-turn navigation
    let osrmRoute: Route | undefined = undefined;
    try {
      const osrmProfile = preferredTransport === 'WALK' ? 'foot' : 'driving';
      const destStop = stops[stops.length - 1];
      const waypointsList = stops.slice(0, -1).map((s) => ({
        name: s.name,
        location: s.location,
        isPandalOrEvent: true,
        itemId: s.id,
      }));

      osrmRoute = await routingService.calculateRoute(
        startLocation.location,
        destStop.location,
        waypointsList,
        false,
        osrmProfile
      );
    } catch (e) {
      console.warn('[SmartPujaRoutePlanner] OSRM route calculation fallback:', e);
    }

    // Build human-friendly plan summary
    const totalDistKm = (totalDistanceMeters / 1000).toFixed(1);
    const totalHours = Math.floor(totalDurationMinutes / 60);
    const totalMins = totalDurationMinutes % 60;
    const durationStr = totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins} mins`;

    let budgetMessage = '';
    if (isWithinBudget) {
      budgetMessage = `Fits nicely within your ${Math.round(availableTimeMinutes / 60)}h window (${Math.abs(timeDifferenceMinutes)} mins buffer).`;
    } else {
      budgetMessage = `Exceeds your ${Math.round(availableTimeMinutes / 60)}h budget by ${Math.abs(timeDifferenceMinutes)} mins. Consider removing 1 stop or switching to Metro.`;
    }

    const metroNote = metroHopsCount > 0 ? ` Includes ${metroHopsCount} high-efficiency Metro transit leg${metroHopsCount > 1 ? 's' : ''}.` : '';

    const summary = `${orderedDestinations.length} stops (${totalDistKm} km • ${durationStr}).${metroNote} ${budgetMessage}`;

    return {
      id: `plan-${Date.now()}`,
      name: `${orderedDestinations.length}-Stop Puja Hop (${preferredTransport})`,
      createdAt: Date.now(),
      startLocation,
      stops,
      totalDistanceMeters,
      totalTravelTimeMinutes,
      totalStayTimeMinutes,
      totalDurationMinutes,
      availableTimeMinutes,
      transportMode: preferredTransport,
      priority,
      isWithinBudget,
      timeDifferenceMinutes,
      metroHopsCount,
      totalWalkingMeters,
      fullGeometry: osrmRoute?.geometry || geometryPoints,
      summary,
      osrmRoute,
    };
  }

  /**
   * Evaluates if a destination is open for darshan at the estimated arrival clock
   */
  private evaluateDarshanHours(dest: DestinationItem, refTime: Date): SmartRouteStop['darshanStatus'] {
    const hour = refTime.getHours();

    if (dest.type === 'bonedi_bari') {
      // Bonedi Baris: Family ancestral houses usually welcome visitors 09:00 AM - 09:30 PM
      const isOpen = hour >= 9 && hour < 22;
      return {
        isOpen,
        statusText: isOpen ? 'Open for Darshan (Family Courtyard)' : 'Visiting Hours Closed (Opens 09:00 AM)',
        hoursText: '09:00 AM – 09:30 PM',
        ritualNotice: 'Traditional rituals take place in inner Natmandir.',
      };
    }

    // Durga Puja Pandals: Generally open continuously during festival days
    const isLateNight = hour >= 2 && hour < 5;
    return {
      isOpen: !isLateNight,
      statusText: isLateNight ? 'Restricted Entry / Deep Night Sanitization' : 'Open for Darshan',
      hoursText: '06:00 AM – 02:00 AM (Extended on festival nights)',
      ritualNotice: pujaCalendarService.isFestivalPeriod(refTime)
        ? 'Active Festival Darshan'
        : 'Pre-Festival Preparations / Viewing',
    };
  }

  /**
   * Optimize destination order using existing TSP solver & priority weights
   */
  public async optimizeDestinationOrder(
    startLoc: Location,
    destinations: DestinationItem[],
    transport: TransportMode = 'WALK',
    priority: RoutePriority = 'MORE_PLACES'
  ): Promise<DestinationItem[]> {
    if (destinations.length <= 1) return destinations;

    // If small number of stops (<= 7), evaluate permutations with priority scoring
    if (destinations.length <= 7) {
      const perms = this.permutations(destinations);
      let bestPerm = destinations;
      let bestScore = Infinity;

      for (const perm of perms) {
        let score = 0;
        let prevLoc = startLoc;

        for (let i = 0; i < perm.length; i++) {
          const item = perm[i];
          const dist = getHaversineDistance(prevLoc, item.location);
          score += dist;

          // Priority Penalties / Incentives
          if (priority === 'LESS_WALKING') {
            // Penalize walking segments > 800m
            if (dist > 800) score += (dist - 800) * 1.5;
          }

          if (priority === 'LESS_TRAFFIC' && transport === 'DRIVE') {
            const traffic = trafficIntelligenceService.getTrafficNearPandal(item.id, item.location);
            if (traffic && traffic.status === 'CONGESTED') {
              score += 2000; // Penalize routing through heavy traffic corridor
            }
          }

          if (priority === 'LESS_CROWD') {
            // Check trustworthy crowd only
            const crowd = crowdIntelligenceService.getCrowdForPandal(item.id, item.rawItem);
            if (crowd && crowd.crowdLevel !== 'UNAVAILABLE' && (crowd.source === 'LIVE' || crowd.source === 'ESTIMATED')) {
              if (crowd.crowdLevel === 'HEAVY' || crowd.crowdLevel === 'HIGH') {
                score += 1500;
              }
            }
          }

          prevLoc = item.location;
        }

        if (score < bestScore) {
          bestScore = score;
          bestPerm = perm;
        }
      }

      return bestPerm;
    }

    // For larger number of stops (> 7), use greedy nearest-neighbor ordering
    const remaining = [...destinations];
    const ordered: DestinationItem[] = [];
    let currentLoc = startLoc;

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let minScore = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        let dist = getHaversineDistance(currentLoc, item.location);

        if (priority === 'LESS_WALKING' && dist > 800) dist += (dist - 800) * 1.5;
        if (priority === 'LESS_TRAFFIC' && transport === 'DRIVE') {
          const traffic = trafficIntelligenceService.getTrafficNearPandal(item.id, item.location);
          if (traffic?.status === 'CONGESTED') dist += 1200;
        }

        if (dist < minScore) {
          minScore = dist;
          nearestIdx = i;
        }
      }

      const [nextStop] = remaining.splice(nearestIdx, 1);
      ordered.push(nextStop);
      currentLoc = nextStop.location;
    }

    return ordered;
  }

  /**
   * Permutation generator helper
   */
  private permutations<T>(arr: T[]): T[][] {
    const result: T[][] = [];
    const permute = (m: T[], temp: T[] = []) => {
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
  }

  /**
   * Suggest real nearby pandals/Bonedi Baris fitting the current route
   * Uses existing Pandal & Bonedi providers to suggest places that fit the route geographically.
   */
  public suggestNearbyStops(
    currentStops: DestinationItem[] | SmartRouteStop[],
    maxSuggestions = 4
  ): NearbySuggestion[] {
    const all = this.getAllDestinations();
    const existingIds = new Set(currentStops.map((s) => s.id));
    const unvisited = all.filter((d) => !existingIds.has(d.id));

    if (currentStops.length === 0) {
      // If no stops yet, suggest top prominent pandals
      return unvisited.slice(0, maxSuggestions).map((item, idx) => ({
        id: item.id,
        name: item.name,
        type: item.type as any,
        location: item.location,
        address: item.address,
        theme: item.theme,
        family: item.family,
        detourDistanceMeters: 0,
        detourMinutes: 0,
        nearStopIndex: 0,
        nearStopName: 'Start of Tour',
        reason: item.type === 'bonedi_bari' ? 'Historic Heritage Bonedi Bari' : 'Renowned Durga Puja Pandal',
        crowdLevel: 'UNAVAILABLE',
        rawItem: item.rawItem,
      }));
    }

    const suggestions: NearbySuggestion[] = [];

    for (const candidate of unvisited) {
      let minDetourMeters = Infinity;
      let closestStopIdx = 0;
      let closestStopName = '';

      for (let i = 0; i < currentStops.length; i++) {
        const stop = currentStops[i];
        const dist = getHaversineDistance(stop.location, candidate.location);
        if (dist < minDetourMeters) {
          minDetourMeters = dist;
          closestStopIdx = i + 1;
          closestStopName = stop.name;
        }
      }

      // Detour threshold: within 1600 meters of an existing stop
      if (minDetourMeters <= 1600) {
        const detourMins = Math.max(2, Math.round(minDetourMeters / 75));
        const detourFormatted =
          minDetourMeters < 1000
            ? `${Math.round(minDetourMeters)}m`
            : `${(minDetourMeters / 1000).toFixed(1)} km`;

        let reason = `Only ${detourFormatted} detour from Stop ${closestStopIdx} (${closestStopName})`;
        if (candidate.type === 'bonedi_bari') {
          reason = `Heritage house ${detourFormatted} from ${closestStopName}`;
        } else if (candidate.nearestMetro) {
          reason = `Near ${candidate.nearestMetro} • ${detourFormatted} detour`;
        }

        const crowdItem = crowdIntelligenceService.getCrowdForPandal(candidate.id, candidate.rawItem);
        const crowdLevel: CrowdLevel = crowdItem?.crowdLevel || 'UNAVAILABLE';

        suggestions.push({
          id: candidate.id,
          name: candidate.name,
          type: candidate.type as any,
          location: candidate.location,
          address: candidate.address,
          theme: candidate.theme,
          family: candidate.family,
          detourDistanceMeters: Math.round(minDetourMeters),
          detourMinutes: detourMins,
          nearStopIndex: closestStopIdx,
          nearStopName: closestStopName,
          reason,
          crowdLevel,
          rawItem: candidate.rawItem,
        });
      }
    }

    // Sort by smallest detour distance
    suggestions.sort((a, b) => a.detourDistanceMeters - b.detourDistanceMeters);
    return suggestions.slice(0, maxSuggestions);
  }
}

export const smartPujaRoutePlannerService = new SmartPujaRoutePlannerService();
