import React from 'react';
import { SmartRouteStop, SmartRouteLeg } from '../../types/smartRoute';
import { 
  MapPin, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Train, 
  Footprints, 
  Car, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  Building2, 
  Sparkles,
  Layers
} from 'lucide-react';

interface SmartRouteStopCardProps {
  stop: SmartRouteStop;
  index: number;
  totalStops: number;
  incomingLeg?: SmartRouteLeg;
  onShiftUp: (index: number) => void;
  onShiftDown: (index: number) => void;
  onRemove: (stopId: string) => void;
}

export const SmartRouteStopCard: React.FC<SmartRouteStopCardProps> = ({
  stop,
  index,
  totalStops,
  incomingLeg,
  onShiftUp,
  onShiftDown,
  onRemove,
}) => {
  const isBonedi = stop.type === 'bonedi_bari';

  return (
    <div className="relative group">
      {/* Travel Leg indicator from previous stop */}
      {incomingLeg && (
        <div className="flex flex-col items-center my-1.5 px-4">
          <div className="flex items-center space-x-2 text-[11px] text-neutral-400 bg-neutral-900/90 border border-neutral-800/80 px-2.5 py-1 rounded-full shadow-sm">
            {incomingLeg.mode === 'METRO' ? (
              <Train size={12} className="text-cyan-400" />
            ) : incomingLeg.mode === 'DRIVE' ? (
              <Car size={12} className="text-amber-400" />
            ) : (
              <Footprints size={12} className="text-emerald-400" />
            )}

            <span className="font-medium text-neutral-200">
              {incomingLeg.distanceMeters >= 1000 
                ? `${(incomingLeg.distanceMeters / 1000).toFixed(1)} km` 
                : `${incomingLeg.distanceMeters} m`}
            </span>
            <span className="text-neutral-500">•</span>
            <span>{incomingLeg.durationMinutes} mins</span>

            {/* Traffic note if trustworthy */}
            {incomingLeg.trafficStatus && incomingLeg.trafficStatus !== 'UNAVAILABLE' && (
              <>
                <span className="text-neutral-500">•</span>
                <span className={`text-[10px] font-semibold ${
                  incomingLeg.trafficStatus === 'CONGESTED' || incomingLeg.trafficStatus === 'HEAVY'
                    ? 'text-rose-400' 
                    : incomingLeg.trafficStatus === 'MODERATE' || incomingLeg.trafficStatus === 'SLOW'
                    ? 'text-amber-400' 
                    : 'text-emerald-400'
                }`}>
                  {incomingLeg.trafficStatus === 'CONGESTED' || incomingLeg.trafficStatus === 'HEAVY'
                    ? 'Heavy'
                    : incomingLeg.trafficStatus === 'MODERATE' || incomingLeg.trafficStatus === 'SLOW'
                    ? 'Moderate'
                    : 'Clear'}
                </span>
              </>
            )}
          </div>

          {/* Metro Transfer Detail banner */}
          {incomingLeg.metroHop && (
            <div className="w-full mt-1.5 p-2 bg-cyan-950/30 border border-cyan-800/40 rounded-xl text-[11px] space-y-1">
              <div className="flex items-center space-x-1.5 text-cyan-300 font-semibold">
                <Train size={12} />
                <span>Metro Hop ({incomingLeg.metroHop.line}):</span>
              </div>
              <div className="text-neutral-300 pl-4 space-y-0.5">
                <p>
                  Board at <span className="font-medium text-white">{incomingLeg.metroHop.originStation.name}</span>
                  {incomingLeg.metroHop.originStation.gateInfo ? ` (${incomingLeg.metroHop.originStation.gateInfo})` : ''}
                </p>
                <p>
                  Alight at <span className="font-medium text-white">{incomingLeg.metroHop.destStation.name}</span>
                  {incomingLeg.metroHop.destStation.gateInfo ? ` (${incomingLeg.metroHop.destStation.gateInfo})` : ''}
                </p>
                <p className="text-[10px] text-cyan-400">
                  {incomingLeg.metroHop.rideDurationMinutes} min metro ride • {incomingLeg.metroHop.walkToStationMeters + incomingLeg.metroHop.walkFromStationMeters}m total walking
                </p>
              </div>
            </div>
          )}

          {/* Connector line */}
          <div className="w-0.5 h-3 bg-neutral-800 my-0.5" />
        </div>
      )}

      {/* Main Stop Card */}
      <div 
        id={`smart-stop-card-${stop.id}`}
        className="p-3.5 bg-neutral-950/90 border border-neutral-800/90 hover:border-neutral-700 rounded-2xl transition-all shadow-md space-y-2.5"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start space-x-3 min-w-0">
            {/* Sequential Stop Pill */}
            <div className="flex-shrink-0 w-7 h-7 rounded-xl bg-indigo-650/30 border border-indigo-500/50 flex items-center justify-center text-xs font-bold text-indigo-300 shadow-inner">
              {index + 1}
            </div>

            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                <h4 className="text-sm font-bold text-white tracking-tight truncate">
                  {stop.name}
                </h4>
                {isBonedi ? (
                  <span className="text-[9px] px-2 py-0.5 font-bold uppercase tracking-wider bg-amber-950/60 border border-amber-600/40 text-amber-300 rounded-full flex items-center space-x-1">
                    <Building2 size={9} />
                    <span>Heritage Bonedi</span>
                  </span>
                ) : (
                  <span className="text-[9px] px-2 py-0.5 font-bold uppercase tracking-wider bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 rounded-full flex items-center space-x-1">
                    <Sparkles size={9} />
                    <span>Pandal</span>
                  </span>
                )}
              </div>

              {stop.address && (
                <p className="text-[11px] text-neutral-400 truncate mt-0.5 flex items-center space-x-1">
                  <MapPin size={10} className="text-neutral-500 flex-shrink-0" />
                  <span className="truncate">{stop.address}</span>
                </p>
              )}
            </div>
          </div>

          {/* Reorder and Delete actions */}
          <div className="flex items-center space-x-1 flex-shrink-0">
            <button
              id={`btn-stop-up-${stop.id}`}
              onClick={() => onShiftUp(index)}
              disabled={index === 0}
              className="p-1 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 disabled:opacity-20 transition-all"
              title="Move stop earlier"
            >
              <ArrowUp size={13} />
            </button>
            <button
              id={`btn-stop-down-${stop.id}`}
              onClick={() => onShiftDown(index)}
              disabled={index === totalStops - 1}
              className="p-1 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 disabled:opacity-20 transition-all"
              title="Move stop later"
            >
              <ArrowDown size={13} />
            </button>
            <button
              id={`btn-stop-remove-${stop.id}`}
              onClick={() => onRemove(stop.id)}
              className="p-1 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-950/40 transition-all"
              title="Remove stop from route"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Schedule window & Visit details */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-900 text-[11px]">
          <div className="flex items-center space-x-1.5 text-neutral-300">
            <Clock size={11} className="text-indigo-400 flex-shrink-0" />
            <span className="text-[10px] text-neutral-400">Arrival:</span>
            <span className="font-semibold text-white">{stop.estimatedArrival}</span>
          </div>

          <div className="flex items-center space-x-1.5 text-neutral-300">
            <span className="text-[10px] text-neutral-400">Darshan:</span>
            <span className="font-semibold text-neutral-200">{stop.recommendedStayMinutes} mins</span>
          </div>
        </div>

        {/* Real-time Status Badges (Strictly Verified, Never Fabricated) */}
        <div className="flex items-center space-x-2 pt-1 flex-wrap gap-y-1.5">
          {/* Crowd Badge */}
          {stop.crowdStatus === 'UNAVAILABLE' ? (
            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-neutral-400 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
              <span>Crowd: Unavailable</span>
            </span>
          ) : (
            <span className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium flex items-center space-x-1 ${
              stop.crowdStatus === 'LOW'
                ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300'
                : stop.crowdStatus === 'MODERATE'
                ? 'bg-amber-950/40 border-amber-600/40 text-amber-300'
                : 'bg-rose-950/40 border-rose-600/40 text-rose-300'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                stop.crowdStatus === 'LOW' ? 'bg-emerald-400' : stop.crowdStatus === 'MODERATE' ? 'bg-amber-400' : 'bg-rose-400'
              }`} />
              <span>{stop.crowdStatus} Crowd {stop.queueWaitMinutes ? `(~${stop.queueWaitMinutes}m queue)` : ''}</span>
            </span>
          )}

          {/* Traffic Corridor Status */}
          {stop.trafficCorridor && (
            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-neutral-300 flex items-center space-x-1 truncate max-w-[200px]">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <span className="truncate">{stop.trafficCorridor}</span>
            </span>
          )}

          {/* Nearest Metro Station if any */}
          {stop.nearestMetro && (
            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-cyan-300 flex items-center space-x-1">
              <Train size={9} />
              <span>{stop.nearestMetro.stationName} ({stop.nearestMetro.distanceMeters}m)</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
