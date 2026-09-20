import React, { useState } from 'react';
import { Footprints, Clock, Navigation, AlertCircle, Sparkles, ChevronDown, ChevronUp, Train } from 'lucide-react';
import { MetroGateIntelligenceResult, MetroGateRouteOption } from '../../types/metro';
import { useAppState } from '../../hooks/AppStateProvider';

interface MetroGateCopilotCardProps {
  result: MetroGateIntelligenceResult;
  onNavigateStart?: () => void;
}

export const MetroGateCopilotCard: React.FC<MetroGateCopilotCardProps> = ({
  result,
  onNavigateStart,
}) => {
  const { startGateWalkingNavigation, setActiveMetroGateIntelligence } = useAppState();
  const [showOtherGates, setShowOtherGates] = useState(false);

  if (!result) return null;

  const { station, targetPandal, recommendedGate, otherGates, hasVerifiedGates } = result;

  if (!hasVerifiedGates || !recommendedGate) {
    return (
      <div className="mt-3 p-3 rounded-xl bg-neutral-900/90 border border-amber-500/30 space-y-1.5">
        <div className="flex items-center gap-2 text-amber-400">
          <AlertCircle size={15} className="shrink-0" />
          <h4 className="text-xs font-bold text-amber-300">
            Verified gate coordinates unavailable
          </h4>
        </div>
        <p className="text-[11px] text-neutral-400 leading-relaxed">
          Verified individual gate coordinates are not yet available for{' '}
          <span className="text-neutral-200 font-semibold">{station?.name || 'this metro station'}</span>.
          Station-level coordinates are mapped, but specific exit recommendations are unverified.
        </p>
      </div>
    );
  }

  const handleStartWalk = (gateOpt: MetroGateRouteOption) => {
    startGateWalkingNavigation(gateOpt, targetPandal, station.name);
    if (onNavigateStart) {
      onNavigateStart();
    }
  };

  const handleSelectGate = (gateOpt: MetroGateRouteOption) => {
    setActiveMetroGateIntelligence({
      ...result,
      activeGateRoute: gateOpt,
    });
  };

  return (
    <div className="mt-3 space-y-2.5 rounded-xl bg-neutral-950/90 border border-neutral-800/80 p-3 shadow-lg">
      {/* Station Header */}
      <div className="flex items-center justify-between border-b border-neutral-800/60 pb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Train size={12} />
          </div>
          <span className="text-[11px] font-bold text-white">{station.name}</span>
        </div>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-medium">
          → {targetPandal.name}
        </span>
      </div>

      {/* Recommended Gate Card */}
      <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-950/60 via-neutral-900 to-neutral-950 border border-emerald-500/50">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
            <Sparkles size={10} className="text-emerald-400" />
            Recommended Exit Gate
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-mono font-bold">
            Shortest Walk
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm font-black text-white">
              Gate {recommendedGate.gate.gateNumber}
            </span>
            {recommendedGate.gate.name && (
              <span className="text-xs text-neutral-300 font-medium">
                ({recommendedGate.gate.name})
              </span>
            )}
          </div>

          {recommendedGate.gate.landmark && (
            <p className="text-[10px] text-neutral-400">
              Towards {recommendedGate.gate.landmark}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-1.5 rounded bg-neutral-900/90 border border-emerald-900/40">
              <span className="block text-[8px] uppercase font-bold text-neutral-400">
                Walking Distance
              </span>
              <span className="text-xs font-extrabold text-emerald-300 flex items-center gap-1 mt-0.5">
                <Footprints size={11} className="text-emerald-400 shrink-0" />
                {recommendedGate.walkingDistanceFormatted}
              </span>
            </div>
            <div className="p-1.5 rounded bg-neutral-900/90 border border-emerald-900/40">
              <span className="block text-[8px] uppercase font-bold text-neutral-400">
                Walking Time
              </span>
              <span className="text-xs font-extrabold text-emerald-200 flex items-center gap-1 mt-0.5">
                <Clock size={11} className="text-emerald-400 shrink-0" />
                {recommendedGate.walkingTimeFormatted}
              </span>
            </div>
          </div>
        </div>

        {/* Start Navigation Action Button */}
        <button
          onClick={() => handleStartWalk(recommendedGate)}
          className="mt-2.5 w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Navigation size={13} className="fill-current" />
          <span>Start Walking Navigation</span>
        </button>
      </div>

      {/* Other Available Gates (if any) */}
      {otherGates && otherGates.length > 0 && (
        <div className="pt-1">
          <button
            onClick={() => setShowOtherGates(!showOtherGates)}
            className="w-full flex items-center justify-between text-[10px] font-bold text-neutral-400 hover:text-neutral-200 transition-colors py-1 cursor-pointer"
          >
            <span>Compare {otherGates.length} other available gate{otherGates.length > 1 ? 's' : ''}</span>
            {showOtherGates ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showOtherGates && (
            <div className="space-y-1.5 mt-1.5 max-h-40 overflow-y-auto pr-1">
              {otherGates.map((gateOpt, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectGate(gateOpt)}
                  className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 transition-all flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-200">
                      <span>Gate {gateOpt.gate.gateNumber}</span>
                      {gateOpt.gate.name && (
                        <span className="text-[10px] text-neutral-400 font-normal truncate">
                          ({gateOpt.gate.name})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-neutral-400 mt-0.5">
                      <span>{gateOpt.walkingDistanceFormatted}</span>
                      <span>•</span>
                      <span>{gateOpt.walkingTimeFormatted}</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartWalk(gateOpt);
                    }}
                    className="py-1 px-2 rounded bg-neutral-800 hover:bg-emerald-600 text-neutral-200 hover:text-white text-[10px] font-bold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Navigation size={10} className="fill-current" />
                    <span>Walk</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
