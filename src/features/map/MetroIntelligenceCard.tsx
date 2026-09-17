/**
 * Eclipse GPS — Metro Intelligence Card (Phase 13.3)
 * 
 * Interactive intelligence card for Kolkata Metro stations.
 * Displays:
 * - Metro Station Name & Transit Line
 * - Distance from user & estimated travel time
 * - Station Entrances & Exits with landmarks
 * - "PUJA FROM METRO" action listing nearby Pandals & Bonedi Baris
 *   sorted strictly by walking distance, with walking minutes & crowd levels
 * - Direct NAVIGATE to Metro or to any nearby Pandal
 * - ADD TO ITINERARY action for stations and nearby pujas
 */

import React, { useState, useEffect } from 'react';
import {
  Train,
  Navigation,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  Compass,
  Plus,
  Footprints,
  Landmark,
  Sparkles,
  Layers,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  DoorOpen,
  CheckCircle2,
} from 'lucide-react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import {
  MetroStation,
  NearbyPandalRef,
  NearbyBonediBariRef,
  MetroGateIntelligenceResult,
  MetroGateRouteOption,
} from '../../types/metro';
import { Location } from '../../types';
import { CrowdBadge } from '../../components/ui/CrowdBadge';
import { useAppState } from '../../hooks/AppStateProvider';
import { metroIntelligenceProvider } from '../../services/intelligence/metroIntelligenceProvider';

interface MetroIntelligenceCardProps {
  metroStation: MetroStation;
  currentLocation?: Location;
  onClose: () => void;
  onNavigateToStation?: (station: MetroStation) => void;
  onNavigateToPuja?: (station: MetroStation, item: NearbyPandalRef | NearbyBonediBariRef) => void;
  onAddStop?: (item: any) => void;
  onShowOnMap?: (location: Location) => void;
  onSelectPandal?: (pandalId: string) => void;
  onSelectBonediBari?: (bonediBariId: string) => void;
}

export const MetroIntelligenceCard: React.FC<MetroIntelligenceCardProps> = ({
  metroStation,
  currentLocation,
  onClose,
  onNavigateToStation,
  onNavigateToPuja,
  onAddStop,
  onShowOnMap,
  onSelectPandal,
  onSelectBonediBari,
}) => {
  const {
    setSelectedItem,
    calculateRouteToItem,
    setIsNavigating,
    setCurrentStepIndex,
    activeMetroGateIntelligence,
    setActiveMetroGateIntelligence,
    setActiveRoute,
  } = useAppState();

  const [activeTab, setActiveTab] = useState<'pujas' | 'entrances'>('pujas');
  const [filterType, setFilterType] = useState<'all' | 'pandals' | 'bonedi'>('all');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Dynamic nearby pandals with real walking routes for the closest 10
  const [routedPandals, setRoutedPandals] = useState<NearbyPandalRef[]>(() => metroStation.nearbyPandals || []);
  const [isCalculatingRoutes, setIsCalculatingRoutes] = useState<boolean>(false);

  // Metro Gate Intelligence states
  const [selectedGatePandal, setSelectedGatePandal] = useState<NearbyPandalRef | null>(null);
  const [gateIntelligenceResult, setGateIntelligenceResult] = useState<MetroGateIntelligenceResult | null>(null);
  const [isLoadingGateIntelligence, setIsLoadingGateIntelligence] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setIsCalculatingRoutes(true);

    // Seed immediately with existing station pandals if available
    if (metroStation.nearbyPandals && metroStation.nearbyPandals.length > 0) {
      setRoutedPandals(metroStation.nearbyPandals);
    }

    // Discover nearby pandals and calculate real walking routes for the top 10
    metroIntelligenceProvider
      .getNearbyPandalsForStationWithWalkingRoutes(metroStation)
      .then((results) => {
        if (isMounted) {
          setRoutedPandals(results);
          setIsCalculatingRoutes(false);
        }
      })
      .catch((err) => {
        console.warn('[MetroIntelligenceCard] Error calculating walking routes:', err);
        if (isMounted) {
          setIsCalculatingRoutes(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [metroStation.id, metroStation.location.lat, metroStation.location.lng]);

  const handleSelectPujaForGateIntelligence = async (item: NearbyPandalRef) => {
    setSelectedGatePandal(item);
    setIsLoadingGateIntelligence(true);
    try {
      const result = await metroIntelligenceProvider.calculateMetroGateIntelligence(metroStation, item);
      setGateIntelligenceResult(result);
      setActiveMetroGateIntelligence(result);
      if (onShowOnMap) {
        onShowOnMap(item.location);
      }
    } catch (err) {
      console.warn('[MetroIntelligenceCard] Error calculating gate intelligence:', err);
    } finally {
      setIsLoadingGateIntelligence(false);
    }
  };

  const handleBackFromGateIntelligence = () => {
    setSelectedGatePandal(null);
    setGateIntelligenceResult(null);
    setActiveMetroGateIntelligence(null);
  };

  const handleSelectGateOption = (gateOpt: MetroGateRouteOption) => {
    if (gateIntelligenceResult) {
      const updated: MetroGateIntelligenceResult = {
        ...gateIntelligenceResult,
        activeGateRoute: gateOpt,
      };
      setGateIntelligenceResult(updated);
      setActiveMetroGateIntelligence(updated);
    }
  };

  const handleStartGateWalkingNavigation = (gateOpt: MetroGateRouteOption, targetPandal: NearbyPandalRef) => {
    const gateLoc: Location = gateOpt.gate.location || {
      lat: gateOpt.gate.latitude!,
      lng: gateOpt.gate.longitude!,
    };
    const pandalLoc: Location = targetPandal.location;

    const route: any = {
      origin: gateLoc,
      destination: pandalLoc,
      distance: gateOpt.distanceMeters,
      duration: gateOpt.walkingMinutes * 60,
      geometry: gateOpt.geometry,
      instructions: [
        {
          text: `Depart from ${gateOpt.gate.gateNumber} at ${metroStation.name}${gateOpt.gate.landmark ? ` (towards ${gateOpt.gate.landmark})` : ''}`,
          distance: 0,
          time: 0,
          type: 'depart',
        },
        {
          text: `Walk ${gateOpt.walkingDistanceFormatted} directly towards ${targetPandal.name}`,
          distance: gateOpt.distanceMeters,
          time: gateOpt.walkingMinutes * 60,
          type: 'continue',
        },
        {
          text: `Arrive at ${targetPandal.name}`,
          distance: 0,
          time: 0,
          type: 'arrive',
        },
      ],
    };

    setActiveRoute(route);
    setIsNavigating(true);
    setCurrentStepIndex(0);
  };

  const handleCardClose = () => {
    setActiveMetroGateIntelligence(null);
    onClose();
  };

  if (!metroStation) return null;

  const nearbyPandals = routedPandals;
  const nearbyBonediBaris = metroStation.nearbyBonediBaris || [];

  // Combined list of nearby places sorted strictly by walking distance
  const allNearbyPujas = [
    ...nearbyPandals.map((p) => ({ ...p, itemType: 'pandal' as const })),
    ...nearbyBonediBaris.map((b) => ({ ...b, itemType: 'bonedi' as const })),
  ].sort((a, b) => a.distanceMeters - b.distanceMeters);

  const filteredPujas = allNearbyPujas.filter((item) => {
    if (filterType === 'pandals') return item.itemType === 'pandal';
    if (filterType === 'bonedi') return item.itemType === 'bonedi';
    return true;
  });

  const handleSelectPuja = (item: any) => {
    if (item.itemType === 'pandal' && onSelectPandal) {
      onSelectPandal(item.id);
    } else if (item.itemType === 'bonedi' && onSelectBonediBari) {
      onSelectBonediBari(item.id);
    }
    if (onShowOnMap) {
      onShowOnMap(item.location);
    }
    setSelectedItem(item as any);
  };

  const handleNavigateToPuja = async (item: any) => {
    if (onNavigateToPuja) {
      onNavigateToPuja(metroStation, item);
    } else {
      await calculateRouteToItem(item);
      setIsNavigating(true);
      setCurrentStepIndex(0);
    }
  };

  const entrances = metroStation.entrancesExits || metroStation.entrances || [];

  // Metro line color accent
  const getLineAccent = (lineStr: string) => {
    const l = lineStr.toLowerCase();
    if (l.includes('blue')) return { text: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/40', badge: 'bg-blue-600' };
    if (l.includes('green')) return { text: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', badge: 'bg-emerald-600' };
    if (l.includes('purple')) return { text: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/40', badge: 'bg-purple-600' };
    if (l.includes('yellow')) return { text: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/40', badge: 'bg-amber-600' };
    if (l.includes('orange')) return { text: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/40', badge: 'bg-orange-600' };
    return { text: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', badge: 'bg-cyan-600' };
  };

  const lineAccent = getLineAccent(metroStation.line);

  return (
    <GlassPanel
      id={`metro-card-${metroStation.id}`}
      className="p-4 bg-neutral-950/95 border border-blue-500/40 shadow-2xl rounded-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 text-neutral-100 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
    >
      {/* Top Header: Line pill & Close */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-neutral-800/80">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase ${lineAccent.bg} ${lineAccent.text} ${lineAccent.border} border shadow-sm`}
          >
            <Train className="w-3.5 h-3.5" />
            {metroStation.line}
          </span>
          {metroStation.status && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950/70 border border-emerald-700/60 text-emerald-300">
              {metroStation.status}
            </span>
          )}
          <span className="text-[10px] text-neutral-400 font-mono">
            {allNearbyPujas.length} Nearby Pujas
          </span>
        </div>

        <button
          id="btn-close-metro-card"
          onClick={handleCardClose}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer"
          title="Close Card"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Station Name & Metrics */}
      <div className="mt-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-snug flex items-center gap-1.5">
              <span>🚇</span>
              {metroStation.name}
            </h3>
            {metroStation.operationalHours && (
              <p className="text-[11px] text-neutral-400 flex items-center gap-1 mt-0.5">
                <Clock size={12} className="text-blue-400 shrink-0" />
                <span>{metroStation.operationalHours}</span>
              </p>
            )}
          </div>

          {/* User distance from GPS */}
          {metroStation.distanceFormatted && (
            <div className="text-right shrink-0 bg-neutral-900/90 border border-neutral-800 px-2.5 py-1 rounded-xl">
              <div className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
                From You
              </div>
              <div className="text-xs font-bold text-blue-400">
                {metroStation.distanceFormatted}
              </div>
            </div>
          )}
        </div>

        {metroStation.estimatedTravelTime && (
          <div className="mt-2 text-xs text-neutral-300 bg-neutral-900/60 rounded-lg px-2.5 py-1.5 border border-neutral-800 flex items-center gap-1.5">
            <Footprints size={13} className="text-emerald-400 shrink-0" />
            <span>{metroStation.estimatedTravelTime}</span>
          </div>
        )}
      </div>

      {/* Primary Action Buttons: Navigate to Station & Add Stop */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          id="btn-navigate-to-metro"
          onClick={() => onNavigateToStation && onNavigateToStation(metroStation)}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer h-11"
        >
          <Navigation size={14} className="fill-current" />
          <span>NAVIGATE TO METRO</span>
        </button>

        <button
          id="btn-add-metro-itinerary"
          onClick={() => onAddStop && onAddStop({
            id: metroStation.id,
            name: metroStation.name,
            location: metroStation.location,
            address: `${metroStation.name}, ${metroStation.line}`,
            type: 'metro',
          })}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-neutral-800 hover:bg-neutral-750 active:bg-neutral-700 border border-neutral-700 text-neutral-200 font-bold text-xs rounded-xl transition-all cursor-pointer h-11"
        >
          <Plus size={14} className="text-blue-400" />
          <span>ADD TO ITINERARY</span>
        </button>
      </div>

      {/* METRO GATE INTELLIGENCE VIEW (When a Pandal is selected) */}
      {selectedGatePandal ? (
        <div className="mt-4 pt-3 border-t border-neutral-800/80 space-y-3">
          {/* Header Bar */}
          <div className="flex items-center justify-between gap-2">
            <button
              id="btn-back-to-pujas"
              onClick={handleBackFromGateIntelligence}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer border border-neutral-800"
            >
              <ArrowLeft size={13} />
              <span>Back to Pujas</span>
            </button>

            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80">
              Exit Intelligence
            </span>
          </div>

          {/* Station -> Pandal Context Strip */}
          <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-xs">
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span className="flex items-center gap-1 font-bold text-white truncate max-w-[140px]">
                <Train size={12} className="text-blue-400 shrink-0" />
                <span className="truncate">{metroStation.name}</span>
              </span>
              <ArrowRight size={11} className="text-neutral-500 shrink-0 mx-1" />
              <span className="flex items-center gap-1 text-emerald-300 font-bold truncate max-w-[150px]">
                <span>🛕</span>
                <span className="truncate">{selectedGatePandal.name}</span>
              </span>
            </div>
          </div>

          {isLoadingGateIntelligence ? (
            <div className="text-center py-8 space-y-2">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-neutral-300 font-medium">
                Calculating walking routes from station gates via OSRM...
              </p>
              <p className="text-[10px] text-neutral-500">
                Evaluating optimal exit geometry
              </p>
            </div>
          ) : gateIntelligenceResult && !gateIntelligenceResult.hasVerifiedGates ? (
            /* Graceful Fallback: Verified gate data is unavailable */
            <div className="p-4 rounded-xl bg-neutral-900/90 border border-amber-500/30 text-center space-y-2.5">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                <AlertCircle size={20} />
              </div>
              <h4 className="text-sm font-bold text-amber-300 tracking-tight">
                Metro gate information unavailable
              </h4>
              <p className="text-xs text-neutral-400 leading-relaxed max-w-xs mx-auto">
                Verified individual gate coordinates are not yet available for {metroStation.name}. Standard walking route from the station concourse is shown.
              </p>
              <div className="pt-2 border-t border-neutral-800 text-xs text-neutral-300 flex items-center justify-center gap-2">
                <Footprints size={14} className="text-blue-400" />
                <span>{selectedGatePandal.distanceMeters}m walk • {selectedGatePandal.walkingMinutes} min</span>
              </div>
              <button
                onClick={() => handleNavigateToPuja(selectedGatePandal)}
                className="w-full py-2.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Navigation size={13} className="fill-current" />
                <span>WALK FROM STATION CONCOURSE</span>
              </button>
            </div>
          ) : gateIntelligenceResult && gateIntelligenceResult.recommendedGate ? (
            <div className="space-y-3">
              {/* RECOMMENDED GATE */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-extrabold tracking-wider uppercase text-emerald-400 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-emerald-400" />
                    RECOMMENDED GATE
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-mono font-bold tracking-tight">
                    OSRM Shortest Route
                  </span>
                </div>

                <div
                  onClick={() => handleSelectGateOption(gateIntelligenceResult.recommendedGate!)}
                  className={`p-3.5 rounded-2xl bg-gradient-to-br from-emerald-950/50 via-neutral-900 to-neutral-950 border-2 ${
                    gateIntelligenceResult.activeGateRoute?.gate.gateNumber === gateIntelligenceResult.recommendedGate.gate.gateNumber
                      ? 'border-emerald-400 ring-2 ring-emerald-500/25 shadow-xl shadow-emerald-950/60'
                      : 'border-emerald-600/70 hover:border-emerald-500'
                  } transition-all cursor-pointer`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-[11px] font-extrabold uppercase tracking-wide text-emerald-400 bg-emerald-950/90 px-2 py-0.5 rounded-md border border-emerald-700/60">
                          Recommended Gate
                        </span>
                        <span className="text-base font-black text-white tracking-tight">
                          {gateIntelligenceResult.recommendedGate.gate.gateNumber}
                        </span>
                        {gateIntelligenceResult.recommendedGate.gate.name && (
                          <span className="text-xs text-neutral-300 font-medium">
                            ({gateIntelligenceResult.recommendedGate.gate.name})
                          </span>
                        )}
                      </div>

                      {gateIntelligenceResult.recommendedGate.gate.landmark && (
                        <p className="text-[11px] text-neutral-400">
                          Towards {gateIntelligenceResult.recommendedGate.gate.landmark}
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                        <div className="p-2 rounded-xl bg-neutral-900/90 border border-emerald-900/40">
                          <span className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                            Walking distance
                          </span>
                          <span className="text-sm font-extrabold text-emerald-300 flex items-center gap-1 mt-0.5">
                            <Footprints size={14} className="text-emerald-400 shrink-0" />
                            {gateIntelligenceResult.recommendedGate.walkingDistanceFormatted}
                          </span>
                        </div>

                        <div className="p-2 rounded-xl bg-neutral-900/90 border border-emerald-900/40">
                          <span className="block text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                            Walking time
                          </span>
                          <span className="text-sm font-extrabold text-emerald-200 flex items-center gap-1 mt-0.5">
                            <Clock size={13} className="text-emerald-400 shrink-0" />
                            {gateIntelligenceResult.recommendedGate.walkingTimeFormatted}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      id="btn-navigate-recommended-exit"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartGateWalkingNavigation(gateIntelligenceResult.recommendedGate!, selectedGatePandal);
                      }}
                      className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/30 flex items-center gap-1.5 shrink-0 cursor-pointer self-start"
                    >
                      <Navigation size={12} className="fill-current" />
                      <span>WALK</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Other available gates */}
              {gateIntelligenceResult.otherGates && gateIntelligenceResult.otherGates.length > 0 && (
                <div className="pt-2 border-t border-neutral-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                      Other available gates
                    </h5>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {gateIntelligenceResult.otherGates.length} other gate{gateIntelligenceResult.otherGates.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {gateIntelligenceResult.otherGates.map((otherGate, i) => {
                      const isActive = gateIntelligenceResult.activeGateRoute?.gate.gateNumber === otherGate.gate.gateNumber;
                      return (
                        <div
                          key={i}
                          onClick={() => handleSelectGateOption(otherGate)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isActive
                              ? 'bg-neutral-850 border-emerald-500/80 ring-1 ring-emerald-500/30'
                              : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850/60'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-neutral-200">
                                {otherGate.gate.gateNumber}
                              </span>
                              {otherGate.gate.name && (
                                <span className="text-[11px] text-neutral-400 truncate">
                                  {otherGate.gate.name}
                                </span>
                              )}
                            </div>
                            {otherGate.gate.landmark && (
                              <p className="text-[10px] text-neutral-500 truncate">
                                Towards {otherGate.gate.landmark}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <div className="text-right">
                              <div className="text-xs font-bold text-neutral-200">
                                {otherGate.walkingDistanceFormatted}
                              </div>
                              <div className="text-[10px] text-neutral-400 font-mono">
                                {otherGate.walkingTimeFormatted}
                              </div>
                            </div>

                            <button
                              title="Walk from this gate"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartGateWalkingNavigation(otherGate, selectedGatePandal);
                              }}
                              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                            >
                              <Navigation size={11} className="fill-current" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {/* Navigation Tabs: "PUJA FROM METRO" vs "ENTRANCES / EXITS" */}
          <div className="mt-4 pt-3 border-t border-neutral-800/80">
            <div className="flex items-center justify-between gap-1 bg-neutral-900/90 p-1 rounded-xl border border-neutral-800">
              <button
                id="tab-puja-from-metro"
                onClick={() => setActiveTab('pujas')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'pujas'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Sparkles size={13} className={activeTab === 'pujas' ? 'text-amber-300' : 'text-neutral-400'} />
                <span>PUJA FROM METRO</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono">
                  {allNearbyPujas.length}
                </span>
              </button>

              <button
                id="tab-metro-entrances"
                onClick={() => setActiveTab('entrances')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'entrances'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Compass size={13} />
                <span>GATES & EXITS</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 font-mono">
                  {entrances.length}
                </span>
              </button>
            </div>
          </div>

          {/* TAB 1: PUJA FROM METRO */}
          {activeTab === 'pujas' && (
            <div className="mt-3 space-y-2.5">
              {/* Subfilter chips: All / Pandals / Bonedi Bari */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-neutral-800 text-white border border-neutral-600'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  All ({allNearbyPujas.length})
                </button>
                <button
                  onClick={() => setFilterType('pandals')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    filterType === 'pandals'
                      ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Pandals ({nearbyPandals.length})
                </button>
                <button
                  onClick={() => setFilterType('bonedi')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    filterType === 'bonedi'
                      ? 'bg-amber-950/90 text-amber-300 border border-amber-700'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Bonedi Bari ({nearbyBonediBaris.length})
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-neutral-400 italic">
                  Select a puja to see recommended Metro exit gate:
                </p>
                {isCalculatingRoutes && (
                  <span className="text-[10px] text-blue-400 font-mono flex items-center gap-1 animate-pulse shrink-0">
                    <Clock size={10} />
                    Routing top 10...
                  </span>
                )}
              </div>

              {/* List of nearby Pujas */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {filteredPujas.length === 0 ? (
                  <div className="text-center py-6 text-neutral-500 text-xs">
                    No matching pandals or heritage houses found in walking radius.
                  </div>
                ) : (
                  filteredPujas.map((item, idx) => {
                    const isPandal = item.itemType === 'pandal';
                    return (
                      <div
                        key={`${item.id}-${idx}`}
                        onClick={() => {
                          if (isPandal) {
                            handleSelectPujaForGateIntelligence(item as NearbyPandalRef);
                          } else {
                            handleSelectPuja(item);
                          }
                        }}
                        className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800/90 hover:border-emerald-500/50 hover:bg-neutral-850/80 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isPandal ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                                  Pandal
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                                  Heritage Bonedi
                                </span>
                              )}

                              {isPandal && (item as NearbyPandalRef).crowdLevel && (
                                <CrowdBadge level={(item as NearbyPandalRef).crowdLevel!} />
                              )}

                              {!isPandal && (item as NearbyBonediBariRef).pujaSince && (
                                <span className="text-[9px] text-amber-400/90 font-mono">
                                  Since {(item as NearbyBonediBariRef).pujaSince}
                                </span>
                              )}
                            </div>

                            <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 transition-colors truncate mt-1">
                              {item.name}
                            </h4>

                            <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-400 flex-wrap">
                              <span className="font-semibold text-blue-300 flex items-center gap-0.5">
                                <Footprints size={12} className="text-blue-400" />
                                {item.distanceMeters < 1000
                                  ? `${item.distanceMeters}m`
                                  : `${(item.distanceMeters / 1000).toFixed(2)} km`}
                              </span>
                              <span>•</span>
                              <span className="text-neutral-300 font-medium">
                                {item.walkingMinutes} min walk
                              </span>
                              {Boolean((item as any).isCalculatedRoute) && (
                                <span
                                  className="text-[9px] px-1.5 py-0.2 rounded bg-blue-950/80 text-blue-300 border border-blue-800/60 font-mono"
                                  title="Accurate walking route via OSRM"
                                >
                                  OSRM
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Item Quick Actions */}
                          <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {isPandal && (
                              <button
                                title="Determine recommended exit gate"
                                onClick={() => handleSelectPujaForGateIntelligence(item as NearbyPandalRef)}
                                className="flex items-center justify-center gap-1 px-2 py-1 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 rounded-lg text-[10px] font-bold transition-all border border-emerald-700/70 shadow-sm cursor-pointer"
                              >
                                <Compass size={10} className="text-emerald-400" />
                                <span>EXIT GATE</span>
                              </button>
                            )}

                            <button
                              title="Navigate to this pandal"
                              onClick={() => handleNavigateToPuja(item)}
                              className="flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-600/90 hover:bg-blue-600 text-white rounded-lg text-[10px] font-bold transition-all shadow-sm cursor-pointer"
                            >
                              <Navigation size={10} className="fill-current" />
                              <span>WALK</span>
                            </button>

                            <button
                              title="Add to itinerary stops"
                              onClick={() => {
                                if (onAddStop) {
                                  onAddStop({
                                    id: item.id,
                                    name: item.name,
                                    location: item.location,
                                    address: item.address || item.name,
                                    type: isPandal ? 'pandal' : 'bonedi_bari',
                                  });
                                }
                              }}
                              className="flex items-center justify-center gap-1 px-2 py-1 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-lg text-[10px] font-bold transition-all border border-neutral-700 cursor-pointer"
                            >
                              <Plus size={10} />
                              <span>STOP</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: GATES & ENTRANCES */}
          {activeTab === 'entrances' && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] text-neutral-400 italic">
                Official operational entrance gates with verified geographic coordinates:
              </p>

              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {entrances.length === 0 ? (
                  <div className="text-center py-6 text-neutral-500 text-xs">
                    Gates information will update with real-time transit status.
                  </div>
                ) : (
                  entrances.map((gate, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-start justify-between gap-2.5"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="shrink-0 px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-bold text-[10px] border border-blue-500/30">
                          {gate.gateNumber}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-neutral-200">
                            {gate.name}
                          </div>
                          {gate.landmark && (
                            <div className="text-[11px] text-neutral-400 mt-0.5">
                              Towards {gate.landmark}
                            </div>
                          )}
                          {gate.latitude && gate.longitude && (
                            <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                              GPS: {gate.latitude.toFixed(4)}, {gate.longitude.toFixed(4)}
                            </div>
                          )}
                        </div>
                      </div>

                      <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-semibold">
                        Verified GPS
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </GlassPanel>
  );
};
