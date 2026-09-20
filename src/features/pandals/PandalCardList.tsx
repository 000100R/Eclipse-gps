import React from 'react';
import { DiscoveredPandal } from '../../types/discovery';
import { useAppState } from '../../hooks/AppStateProvider';
import { getPandalCrowdMetrics } from '../../utils/crowdUtils';
import { crowdIntelligenceService } from '../../services/intelligence/crowdIntelligenceService';
import { MapPin, Navigation, Users, Sparkles, ExternalLink, CheckCircle2 } from 'lucide-react';

interface PandalCardListProps {
  pandals: DiscoveredPandal[];
  onActionComplete?: () => void;
}

export const PandalCardList: React.FC<PandalCardListProps> = ({ pandals, onActionComplete }) => {
  const { setSelectedItem, setActiveTab, calculateRouteToItem, mapRef, pandalCrowdCounts, pandalCrowdTrends } = useAppState();

  if (!pandals || pandals.length === 0) return null;

  const handleShowOnMap = (pandal: DiscoveredPandal) => {
    setSelectedItem(pandal);
    setActiveTab('home');
    if (mapRef) {
      mapRef.setView([pandal.location.lat, pandal.location.lng], 16);
    }
    if (onActionComplete) onActionComplete();
  };

  const handleNavigate = (pandal: DiscoveredPandal) => {
    calculateRouteToItem(pandal);
    setActiveTab('home');
    if (onActionComplete) onActionComplete();
  };

  const getCrowdBadge = (crowd?: string) => {
    switch (crowd) {
      case 'EXTREME':
        return { text: 'EXTREME CROWD', bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
      case 'HEAVY':
      case 'HIGH':
        return { text: 'HEAVY CROWD', bg: 'bg-orange-500/15 text-orange-400 border-orange-500/30' };
      case 'MODERATE':
        return { text: 'MODERATE CROWD', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      case 'LOW':
        return { text: 'LOW CROWD', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'UNAVAILABLE':
      default:
        return { text: 'CROWD DATA UNAVAILABLE', bg: 'bg-neutral-800 text-neutral-400 border-neutral-700' };
    }
  };

  return (
    <div className="mt-3 space-y-2.5 w-full">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
          <Sparkles size={11} className="text-emerald-400" />
          Discovered Durga Puja Pandals ({pandals.length})
        </span>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
        {pandals.map((pandal) => {
          const crowdItem = crowdIntelligenceService.getCrowdForPandal(
            pandal.id,
            pandal,
            pandalCrowdCounts,
            pandalCrowdTrends
          );
          const crowdInfo = getCrowdBadge(crowdItem.crowdLevel);
          const distKm = pandal.distance ? (pandal.distance / 1000).toFixed(1) : null;

          return (
            <div
              key={pandal.id}
              id={`copilot-pandal-card-${pandal.id}`}
              className="p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 shadow-lg hover:border-neutral-700 transition-all text-left"
            >
              {/* Header: Name + Verification */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-semibold text-xs text-neutral-100 truncate">
                      {pandal.name}
                    </h4>
                    {pandal.verified && (
                      <CheckCircle2 size={12} className="text-emerald-400 shrink-0" title="Verified Pandal" />
                    )}
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-0.5 truncate">
                    {pandal.address || pandal.area}
                  </p>
                </div>

                {/* Crowd Badge & Provenance */}
                <div className="flex items-center gap-1 shrink-0">
                  {crowdItem.crowdLevel !== 'UNAVAILABLE' && (
                    <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                      crowdItem.source === 'LIVE'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : crowdItem.source === 'ESTIMATED'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                        : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                    }`}>
                      {crowdItem.source}
                    </span>
                  )}
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${crowdInfo.bg}`}
                  >
                    {crowdInfo.text}
                  </span>
                </div>
              </div>

              {/* Theme / Description */}
              {pandal.theme && (
                <p className="text-[10px] text-neutral-300/90 mt-1.5 line-clamp-1 italic">
                  Theme: {pandal.theme}
                </p>
              )}

              {/* Metrics row: Distance, Travel Time & Nearest Metro */}
              <div className="flex items-center gap-3 mt-2 text-[10px] text-neutral-400 font-medium flex-wrap">
                {distKm && (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <MapPin size={11} />
                    {distKm} km
                  </span>
                )}
                {pandal.estimatedTravelTime && (
                  <span>
                    ⏱ {pandal.estimatedTravelTime}
                  </span>
                )}
                {pandal.nearestMetro && (
                  <span className="text-sky-400">
                    🚇 {pandal.nearestMetro}
                  </span>
                )}
                {crowdItem.crowdLevel !== 'UNAVAILABLE' && crowdItem.queueWaitMinutes !== undefined ? (
                  <span className="flex items-center gap-1 text-neutral-400">
                    <Users size={11} />
                    Queue: ~{crowdItem.queueWaitMinutes}m
                  </span>
                ) : null}
              </div>

              {/* Action Buttons: SHOW ON MAP & NAVIGATE */}
              <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-neutral-800/80">
                <button
                  id={`btn-show-map-${pandal.id}`}
                  onClick={() => handleShowOnMap(pandal)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-semibold transition-colors active:scale-95"
                >
                  <MapPin size={12} className="text-emerald-400" />
                  SHOW ON MAP
                </button>

                <button
                  id={`btn-navigate-${pandal.id}`}
                  onClick={() => handleNavigate(pandal)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold shadow transition-colors active:scale-95"
                >
                  <Navigation size={12} />
                  NAVIGATE
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
