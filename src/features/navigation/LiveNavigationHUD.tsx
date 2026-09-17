import React, { useMemo, useState, useEffect } from 'react';
import {
  CornerUpLeft,
  CornerUpRight,
  ArrowUp,
  RotateCcw,
  MapPin,
  CheckCircle2,
  Footprints,
  Car,
  Navigation,
  Clock,
  Milestone,
} from 'lucide-react';
import { useAppState } from '../../hooks/AppStateProvider';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { Location } from '../../types';

function getHaversineDistanceMeters(p1: Location, p2: Location): number {
  if (!p1 || !p2) return 0;
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

function formatDistance(meters: number): string {
  if (isNaN(meters) || meters <= 0) return '0 m';
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '< 1 min';
  const mins = Math.round(seconds / 60);
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'}`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

function formatEtaClock(currentTimeMs: number, durationSeconds: number): string {
  if (isNaN(durationSeconds) || durationSeconds < 0) return '';
  const arrivalDate = new Date(currentTimeMs + durationSeconds * 1000);
  return arrivalDate.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getInstructionIcon(text: string) {
  const lower = (text || '').toLowerCase();
  if (lower.includes('arrive') || lower.includes('destination') || lower.includes('reached')) {
    return MapPin;
  }
  if (lower.includes('u-turn') || lower.includes('uturn')) {
    return RotateCcw;
  }
  if (lower.includes('sharp left') || lower.includes('slight left') || lower.includes('left')) {
    return CornerUpLeft;
  }
  if (lower.includes('sharp right') || lower.includes('slight right') || lower.includes('right')) {
    return CornerUpRight;
  }
  if (lower.includes('straight') || lower.includes('continue') || lower.includes('depart') || lower.includes('head')) {
    return ArrowUp;
  }
  return Navigation;
}

interface LiveNavigationHUDProps {
  onStepForward?: () => void;
  onReroute?: () => void;
  onStop?: () => void;
}

export const LiveNavigationHUD: React.FC<LiveNavigationHUDProps> = ({
  onStepForward,
  onReroute,
  onStop,
}) => {
  const {
    isNavigating,
    setIsNavigating,
    activeRoute,
    currentStepIndex,
    setCurrentStepIndex,
    currentLocation,
    routePreference,
    setRoutePreference,
    travelMode: contextTravelMode,
    setTravelMode,
    routeStops,
    selectedItem,
    setSelectedItem,
    triggerOffRouteReroute,
  } = useAppState();

  if (!isNavigating || !activeRoute) {
    return null;
  }

  const travelMode = contextTravelMode || (routePreference === 'DRIVING' ? 'driving' : 'walking');

  const handleModeChange = (mode: 'walking' | 'driving') => {
    if (mode === travelMode) return;
    if (setTravelMode) {
      setTravelMode(mode);
    } else {
      setRoutePreference(mode === 'walking' ? 'WALKING' : 'DRIVING');
    }
  };

  const instructions = activeRoute.instructions || [];
  const safeStepIndex = Math.min(Math.max(0, currentStepIndex), Math.max(0, instructions.length - 1));
  const currentInstruction = instructions[safeStepIndex] || {
    text: 'Proceed towards destination',
    distance: activeRoute.distance || 0,
    duration: activeRoute.duration || 0,
  };

  const nextInstruction =
    safeStepIndex + 1 < instructions.length ? instructions[safeStepIndex + 1] : null;

  // Real destination name from stops, selectedItem, or route
  const destinationName = useMemo(() => {
    if (routeStops && routeStops.length > 0) {
      return routeStops[routeStops.length - 1].name;
    }
    if (selectedItem?.name) {
      return selectedItem.name;
    }
    if (activeRoute.waypoints && activeRoute.waypoints.length > 0) {
      return activeRoute.waypoints[activeRoute.waypoints.length - 1].name;
    }
    return activeRoute.name || 'Selected Destination';
  }, [routeStops, selectedItem, activeRoute]);

  // Real GPS distance to destination
  const directDistanceToDestMeters = useMemo(() => {
    if (currentLocation && activeRoute.destination) {
      return getHaversineDistanceMeters(currentLocation, activeRoute.destination);
    }
    return 0;
  }, [currentLocation, activeRoute.destination]);

  // Determine if user has arrived at the destination
  const hasArrived = useMemo(() => {
    // 1. Direct GPS distance within arrival radius (<= 40 meters)
    if (directDistanceToDestMeters > 0 && directDistanceToDestMeters <= 40) {
      return true;
    }
    // 2. On the final instruction step
    if (instructions.length > 0 && safeStepIndex >= instructions.length - 1) {
      const lastText = currentInstruction.text.toLowerCase();
      if (lastText.includes('arrive') || directDistanceToDestMeters <= 100) {
        return true;
      }
    }
    return false;
  }, [directDistanceToDestMeters, instructions.length, safeStepIndex, currentInstruction.text]);

  // Remaining distance in meters along the route steps
  const remainingDistanceMeters = useMemo(() => {
    if (hasArrived) return 0;
    if (safeStepIndex >= instructions.length - 1) {
      return directDistanceToDestMeters > 0
        ? directDistanceToDestMeters
        : currentInstruction.distance;
    }
    const remainingSteps = instructions.slice(safeStepIndex);
    const sum = remainingSteps.reduce((acc, inst) => acc + (inst.distance || 0), 0);
    return sum > 0 ? sum : activeRoute.distance;
  }, [hasArrived, safeStepIndex, instructions, directDistanceToDestMeters, currentInstruction.distance, activeRoute.distance]);

  // Remaining time in seconds along the route
  const remainingDurationSeconds = useMemo(() => {
    if (hasArrived) return 0;
    if (safeStepIndex >= instructions.length - 1) {
      if (directDistanceToDestMeters > 0) {
        const speedMps = travelMode === 'walking' ? 1.3 : 6.9;
        return Math.round(directDistanceToDestMeters / speedMps);
      }
      return currentInstruction.duration || 30;
    }
    const remainingSteps = instructions.slice(safeStepIndex);
    const sum = remainingSteps.reduce((acc, inst) => acc + (inst.duration || 0), 0);
    return sum > 0 ? sum : activeRoute.duration;
  }, [hasArrived, safeStepIndex, instructions, directDistanceToDestMeters, travelMode, currentInstruction.duration, activeRoute.duration]);

  // Keep track of current system time, refreshing periodically
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Formatted ETA clock in user's local time (e.g. "ETA 8:42 PM")
  const etaClockText = useMemo(() => {
    if (hasArrived || remainingDurationSeconds <= 0) return '';
    const formattedTime = formatEtaClock(currentTimeMs, remainingDurationSeconds);
    return formattedTime ? `ETA ${formattedTime}` : '';
  }, [currentTimeMs, remainingDurationSeconds, hasArrived]);

  const CurrentIcon = getInstructionIcon(currentInstruction.text);
  const NextIcon = nextInstruction ? getInstructionIcon(nextInstruction.text) : null;

  const handleStepForward = () => {
    if (onStepForward) {
      onStepForward();
      return;
    }
    if (currentStepIndex < instructions.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      setIsNavigating(false);
      setSelectedItem(null);
    }
  };

  const handleReroute = () => {
    if (onReroute) {
      onReroute();
    } else {
      triggerOffRouteReroute();
    }
  };

  const handleStop = () => {
    if (onStop) {
      onStop();
    } else {
      setIsNavigating(false);
      setSelectedItem(null);
    }
  };

  return (
    <GlassPanel
      className={`p-4 border-l-4 shadow-2xl animate-fade-in transition-all duration-300 ${
        hasArrived ? 'border-l-emerald-500 bg-neutral-950/95' : 'border-l-indigo-500'
      }`}
    >
      {/* Top Header: Destination & Travel Mode */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-neutral-800/60">
        <div className="flex items-center space-x-1.5 min-w-0 flex-1 mr-2">
          <MapPin size={13} className={hasArrived ? 'text-emerald-400 shrink-0' : 'text-indigo-400 shrink-0'} />
          <span className="text-xs font-bold text-neutral-200 truncate">
            {destinationName}
          </span>
        </div>
        {/* Travel Mode Switch: Walking / Driving */}
        <div
          id="nav-travel-mode-switch"
          className="flex items-center p-0.5 rounded-lg bg-neutral-900/90 border border-neutral-800 shrink-0 space-x-0.5"
          role="group"
          aria-label="Travel mode selection"
        >
          <button
            type="button"
            id="btn-mode-walking"
            onClick={() => handleModeChange('walking')}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide transition-all ${
              travelMode === 'walking'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 border border-transparent'
            }`}
            title="Switch to Walking navigation"
          >
            <Footprints size={11} className={travelMode === 'walking' ? 'text-emerald-400' : 'text-neutral-400'} />
            <span>Walk</span>
          </button>
          <button
            type="button"
            id="btn-mode-driving"
            onClick={() => handleModeChange('driving')}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide transition-all ${
              travelMode === 'driving'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 border border-transparent'
            }`}
            title="Switch to Driving navigation"
          >
            <Car size={11} className={travelMode === 'driving' ? 'text-sky-400' : 'text-neutral-400'} />
            <span>Drive</span>
          </button>
        </div>
      </div>

      {/* Main Body: Arrived State vs Active Turn-by-Turn Instruction */}
      {hasArrived ? (
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <div className="relative w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg animate-pulse">
              <span className="absolute -inset-0.5 rounded-xl bg-emerald-500/20 animate-ping opacity-60 pointer-events-none" />
              <CheckCircle2 size={22} className="stroke-[2.5] relative z-10" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-900/60 px-2 py-0.5 rounded-full animate-pulse shadow-sm shadow-emerald-500/20">
                  Arrived
                </span>
                <span className="text-xs text-neutral-400">
                  {travelMode === 'walking' ? 'Walk Complete' : 'Drive Complete'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-neutral-100 mt-1 leading-snug truncate">
                {destinationName}
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                You have reached your destination.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2 border-t border-neutral-800/60">
            <button
              id="btn-nav-arrived-done"
              onClick={handleStop}
              className="flex-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 font-bold tracking-wider text-white py-2 px-3 rounded-lg uppercase flex items-center justify-center space-x-1.5 transition-colors shadow-lg"
            >
              <CheckCircle2 size={14} />
              <span>Finish Navigation</span>
            </button>
            <button
              id="btn-nav-stop"
              onClick={handleStop}
              className="text-[11px] hover:bg-neutral-800 text-neutral-400 font-bold tracking-wider px-3 py-2 rounded-lg uppercase border border-neutral-800 transition-colors"
            >
              Exit
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Active Maneuver Instruction */}
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-indigo-950/60 border border-indigo-800/60 text-indigo-400 shrink-0 mt-0.5">
              <CurrentIcon size={18} className="stroke-[2.5]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-bold">
                  {currentInstruction.distance > 0 ? `In ${formatDistance(currentInstruction.distance)}` : 'Current Instruction'}
                </span>
              </div>
              <p className="text-sm font-semibold text-neutral-100 mt-0.5 leading-snug">
                {currentInstruction.text}
              </p>

              {/* Next Maneuver When Available */}
              {nextInstruction && NextIcon && (
                <div className="flex items-center space-x-1.5 mt-2 pt-2 border-t border-neutral-800/60 text-xs">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-400 bg-neutral-850 border border-neutral-800 px-1.5 py-0.5 rounded flex items-center space-x-1 shrink-0">
                    <NextIcon size={9} className="text-neutral-400" />
                    <span>Then</span>
                  </span>
                  <span className="text-neutral-300 font-medium truncate flex-1 text-[11px]">
                    {nextInstruction.text}
                  </span>
                  {nextInstruction.distance > 0 && (
                    <span className="text-neutral-500 shrink-0 text-[10px]">
                      ({formatDistance(nextInstruction.distance)})
                    </span>
                  )}
                </div>
              )}

              {/* Remaining Distance & ETA Metrics */}
              <div className="flex items-center space-x-3 mt-3 text-xs text-neutral-400">
                <div className="flex items-center space-x-1 font-semibold text-neutral-200">
                  <Milestone size={12} className="text-indigo-400 shrink-0" />
                  <span>Remaining: {formatDistance(remainingDistanceMeters)}</span>
                </div>
                <span className="w-1 h-1 bg-neutral-700 rounded-full" />
                <div className="flex items-center space-x-1.5 text-neutral-300">
                  <Clock size={12} className="text-indigo-400 shrink-0" />
                  <span id="nav-hud-eta-clock" className="font-semibold text-neutral-100">
                    {etaClockText || `ETA ${formatDuration(remainingDurationSeconds)}`}
                  </span>
                  <span className="text-neutral-500 text-[11px]">
                    ({formatDuration(remainingDurationSeconds)})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between border-t border-neutral-800/40 mt-4 pt-3">
            <button
              id="btn-nav-step-forward"
              onClick={handleStepForward}
              className="text-[11px] bg-indigo-600 hover:bg-indigo-500 font-bold tracking-wider text-white px-3 py-1.5 rounded-lg uppercase flex items-center space-x-1 transition-colors"
            >
              <span>Step Forward</span>
            </button>
            <button
              id="btn-nav-trigger-offroute"
              onClick={handleReroute}
              className="text-[11px] hover:bg-neutral-800 text-neutral-400 font-bold tracking-wider px-3 py-1.5 rounded-lg uppercase border border-neutral-800 transition-colors"
            >
              Reroute
            </button>
            <button
              id="btn-nav-stop"
              onClick={handleStop}
              className="text-[11px] bg-rose-950 hover:bg-rose-900 font-bold tracking-wider text-rose-200 px-3 py-1.5 rounded-lg uppercase transition-colors"
            >
              Stop
            </button>
          </div>
        </>
      )}
    </GlassPanel>
  );
};
