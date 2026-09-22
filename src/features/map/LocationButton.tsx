import React from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { Locate, Compass } from 'lucide-react';

export const LocationButton: React.FC = () => {
  const {
    gpsStatus,
    gpsAccuracy,
    recenterMap,
    watchLocation,
    setWatchLocation,
    activeTab,
    isNavigating,
    selectedItem,
  } = useAppState();

  // Hide when in secondary tabs or inspecting a card so controls do not overlap
  if (activeTab !== 'home' || selectedItem) {
    return null;
  }

  // Positioning:
  // When navigating: bottom-20 right-3 sm:right-4 z-20
  // When on home map: bottom-36 right-3 sm:right-4 md:bottom-24 md:right-4 z-20 (above Pandal Explorer 2.0 bar)
  const bottomPosClass = isNavigating ? 'bottom-20' : 'bottom-36 md:bottom-24';

  return (
    <div
      id="gps-floating-dock"
      className={`fixed ${bottomPosClass} right-3 sm:right-4 z-20 flex flex-col space-y-2 pointer-events-auto transition-all duration-300`}
    >
      {/* Accuracy Bubble (if active and reasonable) */}
      {gpsAccuracy && gpsStatus === 'tracking' && (
        <div className="bg-neutral-900/90 text-[10px] font-bold text-neutral-400 px-2.5 py-1 rounded-full border border-neutral-800 shadow-lg text-center backdrop-blur-xs whitespace-nowrap self-end">
          Acc: {gpsAccuracy.toFixed(0)}m
        </div>
      )}

      {/* Toggle Watch GPS Active state */}
      <button
        id="btn-toggle-gps-watch"
        onClick={() => setWatchLocation(!watchLocation)}
        className={`w-11 h-11 flex items-center justify-center rounded-xl border shadow-xl transition-all duration-300 touch-manipulation cursor-pointer ${
          watchLocation
            ? 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500'
            : 'bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:text-neutral-100 backdrop-blur-md'
        }`}
        title="Toggle Continuous GPS Tracking"
        aria-label="Toggle Continuous GPS Tracking"
      >
        <Compass size={18} className={watchLocation ? 'animate-spin' : ''} />
      </button>

      {/* Recenter Map Target */}
      <button
        id="btn-recenter-gps"
        onClick={recenterMap}
        className="w-11 h-11 flex items-center justify-center bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-xl text-neutral-400 hover:text-neutral-100 shadow-xl transition-all duration-300 touch-manipulation cursor-pointer"
        title="Recenter Map to Me"
        aria-label="Recenter Map to Me"
      >
        <Locate size={18} />
      </button>
    </div>
  );
};
