import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  Sparkles,
  RefreshCw,
  ArrowRight,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
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
    stopNavigation,
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
    pujaRouteSession,
    advancePujaRouteToNextStop,
    endPujaRoute,
  } = useAppState();

  if (!isNavigating || !activeRoute) {
    return null;
  }

  const isPujaRoute = Boolean(pujaRouteSession?.isActive && (pujaRouteSession.stops?.length || 0) > 0);
  const currentPujaStopIndex = pujaRouteSession?.currentStopIndex ?? 0;
  const totalPujaStops = pujaRouteSession?.stops?.length ?? 0;
  const isFinalStop = !isPujaRoute || currentPujaStopIndex >= totalPujaStops - 1;
  const remainingStops = isPujaRoute && pujaRouteSession
    ? pujaRouteSession.stops.slice(currentPujaStopIndex + 1)
    : [];

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
    if (isPujaRoute && pujaRouteSession?.stops[currentPujaStopIndex]?.name) {
      return pujaRouteSession.stops[currentPujaStopIndex].name;
    }
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
  }, [isPujaRoute, pujaRouteSession, currentPujaStopIndex, routeStops, selectedItem, activeRoute]);

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

  // Auto-advance turn-by-turn steps as user moves along the route geometry
  useEffect(() => {
    if (!currentLocation || !activeRoute || !instructions || instructions.length <= 1) return;
    if (safeStepIndex >= instructions.length - 1) return;

    const geom = activeRoute.geometry;
    if (geom && geom.length > 0) {
      let minDistance = Infinity;
      let closestPointIndex = 0;
      for (let i = 0; i < geom.length; i++) {
        const d = getHaversineDistanceMeters(currentLocation, geom[i]);
        if (d < minDistance) {
          minDistance = d;
          closestPointIndex = i;
        }
      }

      // If user is reasonably close to route (< 50m), correlate progress
      if (minDistance < 50) {
        const fractionAlongRoute = closestPointIndex / Math.max(1, geom.length - 1);
        const targetStepIndex = Math.min(
          instructions.length - 1,
          Math.floor(fractionAlongRoute * instructions.length)
        );

        if (targetStepIndex > safeStepIndex) {
          setCurrentStepIndex(targetStepIndex);
        }
      }
    }
  }, [currentLocation, activeRoute, instructions, safeStepIndex, setCurrentStepIndex]);

  // Auto-advance when intermediate pandal stop is reached in a Puja Route
  useEffect(() => {
    if (!hasArrived) return;
    if (!isPujaRoute || isFinalStop) return;

    // Automatically start navigation to the next pandal after a brief confirmation interval
    const timer = setTimeout(() => {
      advancePujaRouteToNextStop();
    }, 2500);

    return () => clearTimeout(timer);
  }, [hasArrived, isPujaRoute, isFinalStop, currentPujaStopIndex]);

  // Formatted ETA clock in user's local time (e.g. "ETA 8:42 PM")
  const etaClockText = useMemo(() => {
    if (hasArrived || remainingDurationSeconds <= 0) return '';
    const formattedTime = formatEtaClock(currentTimeMs, remainingDurationSeconds);
    return formattedTime ? `ETA ${formattedTime}` : '';
  }, [currentTimeMs, remainingDurationSeconds, hasArrived]);

  // Voice Navigation State (Browser / Device Speech Synthesis)
  const [isMuted, setIsMuted] = useState(false);
  const lastSpokenInstructionRef = useRef<string>('');
  const hasArrivedAnnouncedRef = useRef<boolean>(false);

  // Helper to safely speak voice announcements
  const speakVoiceAnnouncement = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis utterance error:', err);
    }
  };

  // Immediate cancellation if user toggles Mute
  useEffect(() => {
    if (isMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [isMuted]);

  // Clean up any ongoing speech synthesis when component unmounts
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Speak navigation instruction when it changes & announce arrival on arrival state
  useEffect(() => {
    if (hasArrived) {
      if (!hasArrivedAnnouncedRef.current) {
        hasArrivedAnnouncedRef.current = true;
        const arrivalText =
          isPujaRoute && !isFinalStop
            ? `Arrived at ${destinationName}. Stop ${currentPujaStopIndex + 1} reached.`
            : `You have arrived at ${destinationName}.`;
        if (!isMuted) {
          speakVoiceAnnouncement(arrivalText);
        }
      }
      return;
    }

    // Reset arrival announcement tracker when navigating actively
    hasArrivedAnnouncedRef.current = false;

    const instructionText = currentInstruction?.text?.trim();
    if (!instructionText) return;

    // Speak only when instruction text actually changes to avoid repeating repeatedly
    if (lastSpokenInstructionRef.current !== instructionText) {
      lastSpokenInstructionRef.current = instructionText;
      if (!isMuted) {
        speakVoiceAnnouncement(instructionText);
      }
    }
  }, [
    hasArrived,
    currentInstruction?.text,
    isPujaRoute,
    isFinalStop,
    currentPujaStopIndex,
    destinationName,
    isMuted,
  ]);

  const CurrentIcon = getInstructionIcon(currentInstruction.text);
  const NextIcon = nextInstruction ? getInstructionIcon(nextInstruction.text) : null;

  // Collapsible HUD State & Touch Gestures
  const [isCollapsed, setIsCollapsed] = useState(false);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchEndY - touchStartYRef.current;
    touchStartYRef.current = null;

    if (!isCollapsed && deltaY > 35) {
      // Swiping down while expanded -> collapse HUD
      setIsCollapsed(true);
    } else if (isCollapsed && Math.abs(deltaY) > 20) {
      // Swiping on collapsed bar -> expand HUD
      setIsCollapsed(false);
    }
  };

  const handleStepForward = () => {
    if (onStepForward) {
      onStepForward();
      return;
    }
    if (currentStepIndex < instructions.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (isPujaRoute && !isFinalStop) {
        advancePujaRouteToNextStop();
        return;
      }
      if (isPujaRoute) {
        endPujaRoute();
      } else {
        stopNavigation();
      }
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
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (isPujaRoute) {
      endPujaRoute();
    }
    if (onStop) {
      onStop();
    } else {
      stopNavigation();
    }
  };

  // 1. Collapsed HUD View (Minimalist & Non-Intrusive, Map fully usable)
  if (isCollapsed) {
    return (
      <GlassPanel
        id="nav-hud-collapsed"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest('button')) {
            setIsCollapsed(false);
          }
        }}
        className={`px-3.5 py-2 border-l-4 shadow-xl animate-fade-in transition-all duration-200 cursor-pointer ${
          hasArrived
            ? 'border-l-emerald-500 bg-neutral-950/95'
            : 'border-l-indigo-500 bg-neutral-950/90'
        }`}
        role="region"
        aria-label="Navigation HUD Collapsed"
      >
        {/* Subtle top indicator for gesture expansion */}
        <div className="w-8 h-1 bg-neutral-700/70 rounded-full mx-auto mb-1.5" />

        <div className="flex items-center justify-between space-x-3">
          {/* Left: Maneuver Icon */}
          <div className="flex items-center space-x-2.5 min-w-0 flex-1">
            <div
              className={`p-1.5 rounded-lg shrink-0 ${
                hasArrived
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                  : 'bg-indigo-950/80 text-indigo-400 border border-indigo-800/60'
              }`}
            >
              {hasArrived ? (
                <CheckCircle2 size={16} className="stroke-[2.5]" />
              ) : (
                <CurrentIcon size={16} className="stroke-[2.5]" />
              )}
            </div>

            {/* Middle: Maneuver Details, Distance to Maneuver, and ETA */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black text-neutral-100 tracking-tight shrink-0">
                  {hasArrived
                    ? 'Arrived'
                    : currentInstruction.distance > 0
                    ? `In ${formatDistance(currentInstruction.distance)}`
                    : 'Now'}
                </span>
                <span className="text-[11px] font-medium text-neutral-300 truncate">
                  {hasArrived ? destinationName : currentInstruction.text}
                </span>
              </div>

              {/* ETA & Distance */}
              <div className="flex items-center space-x-2 text-[10px] text-neutral-400 mt-0.5">
                <div className="flex items-center space-x-1 text-indigo-300 font-semibold">
                  <Clock size={11} className="text-indigo-400 shrink-0" />
                  <span id="nav-hud-collapsed-eta">
                    {etaClockText || `ETA ${formatDuration(remainingDurationSeconds)}`}
                  </span>
                </div>
                <span className="w-1 h-1 bg-neutral-700 rounded-full" />
                <span className="text-neutral-400">
                  {formatDistance(remainingDistanceMeters)} left
                </span>
              </div>
            </div>
          </div>

          {/* Right: Quick Mute Toggle & Clear Expand Button */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              type="button"
              id="btn-nav-mute-toggle-collapsed"
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted((prev) => !prev);
              }}
              className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                isMuted
                  ? 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                  : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60 hover:bg-indigo-900/60'
              }`}
              title={isMuted ? 'Unmute voice' : 'Mute voice'}
              aria-label={isMuted ? 'Unmute voice' : 'Mute voice'}
            >
              {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>

            <button
              type="button"
              id="btn-nav-hud-expand"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(false);
              }}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] tracking-wide transition-all shadow-md cursor-pointer"
              title="Expand Navigation HUD"
              aria-label="Expand Navigation HUD"
            >
              <ChevronUp size={14} />
              <span>Expand</span>
            </button>
          </div>
        </div>
      </GlassPanel>
    );
  }

  // 2. Expanded HUD View (Preserving all existing controls and details)
  return (
    <GlassPanel
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`p-4 border-l-4 shadow-2xl animate-fade-in transition-all duration-300 ${
        hasArrived ? 'border-l-emerald-500 bg-neutral-950/95' : 'border-l-indigo-500'
      }`}
    >
      {/* Swipe Down Gesture Drag Handle */}
      <div
        className="w-10 h-1 bg-neutral-700/60 hover:bg-neutral-500 rounded-full mx-auto -mt-1 mb-2.5 cursor-pointer transition-colors"
        onClick={() => setIsCollapsed(true)}
        title="Swipe down or tap to collapse HUD"
      />

      {/* Top Header: Destination, Travel Mode, Voice Mute & Collapse Button */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-neutral-800/60">
        <div className="flex items-center space-x-1.5 min-w-0 flex-1 mr-2">
          <MapPin size={13} className={hasArrived ? 'text-emerald-400 shrink-0' : 'text-indigo-400 shrink-0'} />
          <span className="text-xs font-bold text-neutral-200 truncate">
            {destinationName}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
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
              className={`flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide transition-all touch-manipulation cursor-pointer ${
                travelMode === 'walking'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 border border-transparent'
              }`}
              title="Switch to Walking navigation"
            >
              <Footprints size={11} className={travelMode === 'walking' ? 'text-emerald-400' : 'text-neutral-400'} />
              <span className="hidden xs:inline">Walk</span>
            </button>
            <button
              type="button"
              id="btn-mode-driving"
              onClick={() => handleModeChange('driving')}
              className={`flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide transition-all touch-manipulation cursor-pointer ${
                travelMode === 'driving'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 border border-transparent'
              }`}
              title="Switch to Driving navigation"
            >
              <Car size={11} className={travelMode === 'driving' ? 'text-sky-400' : 'text-neutral-400'} />
              <span className="hidden xs:inline">Drive</span>
            </button>
          </div>

          {/* Voice Mute / Unmute Toggle */}
          <button
            type="button"
            id="btn-nav-mute-toggle"
            onClick={() => setIsMuted((prev) => !prev)}
            className={`flex items-center space-x-1 px-1.5 sm:px-2 py-1 rounded-lg text-[10px] font-bold tracking-wide border transition-all cursor-pointer touch-manipulation ${
              isMuted
                ? 'bg-neutral-900/90 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:bg-neutral-800/60'
                : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-sm hover:bg-indigo-500/30'
            }`}
            title={isMuted ? 'Unmute voice navigation' : 'Mute voice navigation'}
            aria-label={isMuted ? 'Unmute voice navigation' : 'Mute voice navigation'}
          >
            {isMuted ? (
              <>
                <VolumeX size={12} className="text-neutral-400" />
                <span className="hidden xs:inline">Muted</span>
              </>
            ) : (
              <>
                <Volume2 size={12} className="text-indigo-400" />
                <span className="hidden xs:inline">Voice</span>
              </>
            )}
          </button>

          {/* Collapse HUD Button */}
          <button
            type="button"
            id="btn-nav-hud-collapse"
            onClick={() => setIsCollapsed(true)}
            className="flex items-center space-x-1 px-1.5 sm:px-2 py-1 rounded-lg text-[10px] font-bold tracking-wide border border-neutral-800 bg-neutral-900/90 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 transition-all cursor-pointer touch-manipulation"
            title="Collapse Navigation HUD (or swipe down)"
            aria-label="Collapse Navigation HUD"
          >
            <ChevronDown size={12} />
            <span className="hidden sm:inline">Collapse</span>
          </button>
        </div>
      </div>

      {/* Puja Route Current Stop and Remaining Stops Indicator */}
      {isPujaRoute && pujaRouteSession && (
        <div id="puja-route-progress-indicator" className="pb-2.5 mb-2.5 border-b border-neutral-800/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 min-w-0">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[10px] uppercase tracking-wider flex items-center space-x-1 shrink-0">
                <Sparkles size={10} className="text-amber-400" />
                <span>Puja Stop {currentPujaStopIndex + 1} of {totalPujaStops}</span>
              </span>
              <span className="text-xs font-bold text-white truncate">
                {pujaRouteSession.stops[currentPujaStopIndex]?.name}
              </span>
            </div>
            <span className="text-[10px] text-amber-300/80 font-medium shrink-0 ml-2 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40">
              {remainingStops.length === 0 ? 'Final Stop' : `${remainingStops.length} stop${remainingStops.length > 1 ? 's' : ''} left`}
            </span>
          </div>

          {/* Remaining stops sequence chip list */}
          {remainingStops.length > 0 && (
            <div className="mt-2 flex items-center space-x-1.5 text-[10px] overflow-x-auto custom-scrollbar pb-0.5">
              <span className="text-neutral-500 font-medium shrink-0">Next stops:</span>
              {remainingStops.map((stop, idx) => (
                <span
                  key={stop.id || idx}
                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 shrink-0"
                >
                  <span className="text-amber-400 font-bold mr-1">
                    {currentPujaStopIndex + 2 + idx}.
                  </span>
                  <span className="truncate max-w-[100px]">{stop.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

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
                  {isPujaRoute && !isFinalStop ? `Stop ${currentPujaStopIndex + 1} Reached` : 'Arrived'}
                </span>
                <span className="text-xs text-neutral-400">
                  {isPujaRoute && !isFinalStop ? 'Marked Completed ✓' : travelMode === 'walking' ? 'Walk Complete' : 'Drive Complete'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-neutral-100 mt-1 leading-snug truncate">
                {destinationName}
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                {isPujaRoute && !isFinalStop ? (
                  <span className="text-amber-300/90 flex items-center space-x-1.5 mt-0.5">
                    <RefreshCw size={11} className="animate-spin text-amber-400 shrink-0" />
                    <span>Auto-starting navigation to next pandal in a moment...</span>
                  </span>
                ) : isPujaRoute && isFinalStop ? (
                  `All ${totalPujaStops} pandals completed on your Puja Route!`
                ) : (
                  'You have reached your destination.'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2 border-t border-neutral-800/60">
            {isPujaRoute && !isFinalStop ? (
              <>
                <button
                  id="btn-nav-next-stop-now"
                  onClick={() => advancePujaRouteToNextStop()}
                  className="flex-1 text-[11px] bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 font-black tracking-wider text-neutral-950 py-2 px-3 rounded-lg uppercase flex items-center justify-center space-x-1.5 transition-all shadow-lg cursor-pointer"
                >
                  <span>Start Next Pandal ➜</span>
                </button>
                <button
                  id="btn-nav-stop-intermediate"
                  onClick={handleStop}
                  className="text-[11px] hover:bg-neutral-800 text-neutral-400 font-bold tracking-wider px-3 py-2 rounded-lg uppercase border border-neutral-800 transition-colors cursor-pointer"
                >
                  Exit
                </button>
              </>
            ) : (
              <>
                <button
                  id="btn-nav-arrived-done"
                  onClick={handleStop}
                  className="flex-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 font-bold tracking-wider text-white py-2 px-3 rounded-lg uppercase flex items-center justify-center space-x-1.5 transition-colors shadow-lg cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  <span>{isPujaRoute ? 'Finish Puja Route' : 'Finish Navigation'}</span>
                </button>
                <button
                  id="btn-nav-stop"
                  onClick={handleStop}
                  className="text-[11px] hover:bg-neutral-800 text-neutral-400 font-bold tracking-wider px-3 py-2 rounded-lg uppercase border border-neutral-800 transition-colors cursor-pointer"
                >
                  Exit
                </button>
              </>
            )}
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
          <div className="flex items-center justify-between gap-1.5 border-t border-neutral-800/40 mt-3 sm:mt-4 pt-2.5 sm:pt-3 flex-wrap sm:flex-nowrap">
            <button
              id="btn-nav-step-forward"
              onClick={handleStepForward}
              className="text-[10px] sm:text-[11px] bg-indigo-600 hover:bg-indigo-500 font-bold tracking-wider text-white px-2.5 sm:px-3 py-1.5 rounded-lg uppercase flex items-center space-x-1 transition-colors cursor-pointer touch-manipulation shrink-0"
            >
              <span>Step Forward</span>
            </button>

            {isPujaRoute && !isFinalStop && (
              <button
                id="btn-nav-advance-stop"
                onClick={() => advancePujaRouteToNextStop()}
                className="text-[10px] sm:text-[11px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold tracking-wider px-2 sm:px-2.5 py-1.5 rounded-lg uppercase flex items-center space-x-1 transition-colors cursor-pointer touch-manipulation shrink-0"
                title="Complete this stop and proceed to next pandal"
              >
                <span>Next Stop ➜</span>
              </button>
            )}

            <button
              id="btn-nav-trigger-offroute"
              onClick={handleReroute}
              className="text-[10px] sm:text-[11px] hover:bg-neutral-800 text-neutral-400 font-bold tracking-wider px-2.5 sm:px-3 py-1.5 rounded-lg uppercase border border-neutral-800 transition-colors cursor-pointer touch-manipulation shrink-0"
            >
              Reroute
            </button>
            <button
              id="btn-nav-stop"
              onClick={handleStop}
              className="text-[10px] sm:text-[11px] bg-rose-950 hover:bg-rose-900 font-bold tracking-wider text-rose-200 px-2.5 sm:px-3 py-1.5 rounded-lg uppercase transition-colors cursor-pointer touch-manipulation shrink-0"
            >
              Stop
            </button>
          </div>
        </>
      )}
    </GlassPanel>
  );
};
