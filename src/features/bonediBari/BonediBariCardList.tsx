import React from 'react';
import { BonediBari } from '../../types/bonediBari';
import { useAppState } from '../../hooks/AppStateProvider';
import { Landmark, Navigation, MapPin, Train, ExternalLink, Plus, Clock, ShieldCheck } from 'lucide-react';

interface BonediBariCardListProps {
  bonediBaris: BonediBari[];
  onActionComplete?: () => void;
}

export const BonediBariCardList: React.FC<BonediBariCardListProps> = ({
  bonediBaris,
  onActionComplete,
}) => {
  const { setSelectedItem, setActiveTab, calculateRouteToItem, addStop, mapRef } = useAppState();

  if (!bonediBaris || bonediBaris.length === 0) return null;

  const handleShowOnMap = (item: BonediBari) => {
    setSelectedItem(item);
    setActiveTab('home');
    if (mapRef) {
      if (mapRef.setView) {
        mapRef.setView([item.location.lat, item.location.lng], 16);
      } else if (mapRef.setCenter) {
        mapRef.setCenter({ lat: item.location.lat, lng: item.location.lng });
        mapRef.setZoom(16);
      }
    }
    if (onActionComplete) onActionComplete();
  };

  const handleNavigate = (item: BonediBari) => {
    calculateRouteToItem(item);
    setActiveTab('home');
    if (onActionComplete) onActionComplete();
  };

  const handleAddToItinerary = (item: BonediBari) => {
    addStop(item);
    if (onActionComplete) onActionComplete();
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="mt-3 space-y-2.5 w-full">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
          <Landmark size={12} className="text-amber-400" />
          Verified Bonedi Bari Houses ({bonediBaris.length})
        </span>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
        {bonediBaris.map((item) => {
          const age = item.pujaSince ? Math.max(1, currentYear - item.pujaSince) : null;

          return (
            <div
              key={item.id}
              className="p-3 bg-neutral-900/90 hover:bg-neutral-800/90 border border-amber-500/30 rounded-xl transition-all shadow-md group text-neutral-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Heritage
                    </span>
                    {item.pujaSince && (
                      <span className="text-[10px] font-mono text-neutral-400">
                        Since {item.pujaSince} ({age}+ yrs)
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-neutral-100 group-hover:text-amber-300 transition-colors mt-1 leading-snug">
                    {item.name}
                  </h4>
                  <p className="text-[11px] text-amber-400/90 font-medium truncate">
                    {item.family}
                  </p>
                </div>

                <button
                  onClick={() => handleShowOnMap(item)}
                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors shrink-0"
                  title="Show on map"
                  aria-label="Show on map"
                >
                  <ExternalLink size={13} />
                </button>
              </div>

              {/* Metro & Distance row */}
              <div className="mt-2 pt-2 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400 gap-2 flex-wrap">
                <div className="flex items-center gap-1 min-w-0">
                  <Train size={12} className="text-sky-400 shrink-0" />
                  <span className="truncate">{item.nearestMetro}</span>
                </div>
                {item.distanceFormatted && (
                  <div className="flex items-center gap-1 font-mono text-emerald-400 shrink-0">
                    <Clock size={11} />
                    <span>{item.distanceFormatted}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-2.5 flex items-center gap-1.5">
                <button
                  onClick={() => handleNavigate(item)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[11px] rounded-lg transition-colors shadow-sm"
                >
                  <Navigation size={11} className="fill-neutral-950" />
                  <span>NAVIGATE</span>
                </button>

                <button
                  onClick={() => handleAddToItinerary(item)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 hover:text-white font-semibold text-[11px] rounded-lg transition-colors"
                >
                  <Plus size={11} className="text-amber-400" />
                  <span>ITINERARY</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
