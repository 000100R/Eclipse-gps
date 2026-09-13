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
  } = useAppState();

  return (
    <div id="gps-floating-dock" className="absolute bottom-24 right-4 z-10 flex flex-col space-y-2">
      {/* Accuracy Bubble (if active and reasonable) */}
      {gpsAccuracy && gpsStatus === 'tracking' && (
        <div className="bg-neutral-900/90 text-[10px] font-bold text-neutral-400 px-2.5 py-1 rounded-full border border-neutral-800 shadow-lg text-center backdrop-blur-xs whitespace-nowrap">
          Acc: {gpsAccuracy.toFixed(0)}m
        </div>
      )}

      {/* Toggle Watch GPS Active state */}
      <button
        id="btn-toggle-gps-watch"
        onClick={() => setWatchLocation(!watchLocation)}
        className={`p-3 rounded-xl border shadow-xl transition-all duration-300 ${
          watchLocation
            ? 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500'
            : 'bg-neutral-900/80 border-neutral-800 text-neutral-400 hover:text-neutral-100 backdrop-blur-md'
        }`}
        title="Toggle Continuous GPS Tracking"
      >
        <Compass size={18} className={watchLocation ? 'animate-spin' : ''} />
      </button>

      {/* Recenter Map Target */}
      <button
        id="btn-recenter-gps"
        onClick={recenterMap}
        className="p-3 bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-xl text-neutral-400 hover:text-neutral-100 shadow-xl transition-all duration-300"
        title="Recenter Map to Me"
      >
        <Locate size={18} />
      </button>
    </div>
  );
};
