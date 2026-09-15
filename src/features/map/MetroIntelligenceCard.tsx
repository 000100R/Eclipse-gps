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

import React, { useState } from 'react';
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
} from 'lucide-react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { MetroStation, NearbyPandalRef, NearbyBonediBariRef } from '../../types/metro';
import { Location } from '../../types';
import { CrowdBadge } from '../../components/ui/CrowdBadge';

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
  const [activeTab, setActiveTab] = useState<'pujas' | 'entrances'>('pujas');
  const [filterType, setFilterType] = useState<'all' | 'pandals' | 'bonedi'>('all');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  if (!metroStation) return null;

  const nearbyPandals = metroStation.nearbyPandals || [];
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

  const entrances = metroStation.entrancesExits || metroStation.entrances || [];

  // Metro line color accent
  const getLineAccent = (lineStr: string) => {
    const l = lineStr.toLowerCase();
    if (l.includes('blue')) return { text: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/40', badge: 'bg-blue-600' };
    if (l.includes('green')) return { text: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', badge: 'bg-emerald-600' };
    if (l.includes('purple')) return { text: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/40', badge: 'bg-purple-600' };
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
          <span className="text-[10px] text-neutral-400 font-mono">
            {allNearbyPujas.length} Nearby Pujas
          </span>
        </div>

        <button
          id="btn-close-metro-card"
          onClick={onClose}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors"
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

      {/* Navigation Tabs: "PUJA FROM METRO" vs "ENTRANCES / EXITS" */}
      <div className="mt-4 pt-3 border-t border-neutral-800/80">
        <div className="flex items-center justify-between gap-1 bg-neutral-900/90 p-1 rounded-xl border border-neutral-800">
          <button
            id="tab-puja-from-metro"
            onClick={() => setActiveTab('pujas')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
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
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
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
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                filterType === 'all'
                  ? 'bg-neutral-800 text-white border border-neutral-600'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              All ({allNearbyPujas.length})
            </button>
            <button
              onClick={() => setFilterType('pandals')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                filterType === 'pandals'
                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Pandals ({nearbyPandals.length})
            </button>
            <button
              onClick={() => setFilterType('bonedi')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                filterType === 'bonedi'
                  ? 'bg-amber-950/90 text-amber-300 border border-amber-700'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Bonedi Bari ({nearbyBonediBaris.length})
            </button>
          </div>

          <p className="text-[11px] text-neutral-400 italic">
            Sorted by walking distance directly from {metroStation.name}:
          </p>

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
                    className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800/90 hover:border-blue-500/50 transition-all"
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

                        <h4 className="text-xs sm:text-sm font-bold text-white truncate mt-1">
                          {item.name}
                        </h4>

                        <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-400">
                          <span className="font-semibold text-blue-300 flex items-center gap-0.5">
                            <Footprints size={12} className="text-blue-400" />
                            {item.distanceMeters}m
                          </span>
                          <span>•</span>
                          <span className="text-neutral-300 font-medium">
                            {item.walkingMinutes} min walk
                          </span>
                        </div>
                      </div>

                      {/* Item Quick Actions */}
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          title="Navigate to this pandal"
                          onClick={() => {
                            if (onNavigateToPuja) {
                              onNavigateToPuja(metroStation, item);
                            }
                          }}
                          className="flex items-center gap-1 px-2 py-1.5 bg-blue-600/90 hover:bg-blue-600 text-white rounded-lg text-[10px] font-bold transition-all shadow-sm cursor-pointer"
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
                          className="flex items-center gap-1 px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-[10px] font-bold transition-all border border-neutral-700 cursor-pointer"
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
            Official operational entrance gates and street exits:
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
                  className="p-2 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-start gap-2.5"
                >
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
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </GlassPanel>
  );
};
