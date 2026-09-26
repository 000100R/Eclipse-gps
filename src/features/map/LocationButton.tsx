import React, { useState, useEffect } from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { Locate, Compass, Plus, Minus, Navigation } from 'lucide-react';

export const LocationButton: React.FC = () => {
  const {
    gpsStatus,
    gpsAccuracy,
    currentLocation,
    recenterMap,
    watchLocation,
    setWatchLocation,
    activeTab,
    isNavigating,
    selectedItem,
    mapRef,
    mapProvider,
  } = useAppState();

  const [isExplorerExpanded, setIsExplorerExpanded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('eclipse_pandal_explorer_expanded');
      if (saved !== null) return saved === 'true';
      return window.innerWidth >= 768;
    }
    return false;
  });

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ expanded: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.expanded === 'boolean') {
        setIsExplorerExpanded(customEvent.detail.expanded);
      }
    };
    window.addEventListener('eclipse-pandal-explorer-toggle', handleToggle);
    return () => window.removeEventListener('eclipse-pandal-explorer-toggle', handleToggle);
  }, []);

  // Hide in secondary full-page tabs or when Pandal Explorer is expanded on mobile
  if (activeTab !== 'home' || (isExplorerExpanded && typeof window !== 'undefined' && window.innerWidth < 768)) {
    return null;
  }

  // Dynamic positioning that prevents any overlap on Android APK and mobile browsers:
  // - When navigating: sits safely above the turn instructions and alternatives HUD
  // - When inspecting a card: sits above the pandal detail drawer
  // - Default: sits comfortably above the bottom navigation and explorer deck
  const bottomStyle = isNavigating
    ? 'calc(env(safe-area-inset-bottom, 0px) + 12rem)'
    : selectedItem
    ? 'calc(env(safe-area-inset-bottom, 0px) + 20rem)'
    : 'calc(env(safe-area-inset-bottom, 0px) + 8.5rem)';

  const handleZoomIn = () => {
    if (mapRef?.zoomIn) {
      mapRef.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRef?.zoomOut) {
      mapRef.zoomOut();
    }
  };

  const handleResetNorth = () => {
    if (mapRef?.resetHeading) {
      mapRef.resetHeading();
    }
  };

  return (
    <div
      id="gps-floating-dock"
      style={{ bottom: bottomStyle }}
      className="fixed right-3 sm:right-4 z-20 flex flex-col items-center space-y-1.5 pointer-events-auto transition-all duration-300 select-none md:bottom-24"
    >
      {/* Accuracy Bubble (when GPS tracking is active and accuracy estimate is valid) */}
      {gpsAccuracy && gpsStatus === 'tracking' && (
        <div
          id="gps-accuracy-chip"
          className="bg-neutral-950/90 text-[10px] font-mono font-bold text-neutral-400 px-2 py-0.5 rounded-full border border-neutral-800/90 shadow-xl text-center backdrop-blur-md whitespace-nowrap mb-0.5"
          title={`GPS Horizontal Accuracy: ~${Math.round(gpsAccuracy)}m`}
        >
          Acc: {Math.round(gpsAccuracy)}m
        </div>
      )}

      {/* Zoom Controls Container */}
      <div className="flex flex-col bg-neutral-900/90 backdrop-blur-md border border-neutral-800/90 rounded-2xl shadow-2xl overflow-hidden divide-y divide-neutral-800/80">
        {/* Zoom In */}
        <button
          type="button"
          id="btn-zoom-in"
          onClick={handleZoomIn}
          className="w-11 h-11 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800/60 active:bg-neutral-800 transition-colors touch-manipulation cursor-pointer"
          title="Zoom In (+)"
          aria-label="Zoom In"
        >
          <Plus size={18} />
        </button>

        {/* Zoom Out */}
        <button
          type="button"
          id="btn-zoom-out"
          onClick={handleZoomOut}
          className="w-11 h-11 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800/60 active:bg-neutral-800 transition-colors touch-manipulation cursor-pointer"
          title="Zoom Out (-)"
          aria-label="Zoom Out"
        >
          <Minus size={18} />
        </button>
      </div>

      {/* Current-Location / Recenter Button */}
      <button
        type="button"
        id="btn-recenter-gps"
        onClick={recenterMap}
        className="w-11 h-11 flex items-center justify-center bg-neutral-900/90 backdrop-blur-md border border-neutral-800/90 rounded-2xl text-neutral-300 hover:text-white active:scale-95 shadow-2xl transition-all touch-manipulation cursor-pointer group"
        title="Center Map on Real GPS Location"
        aria-label="Center Map on Real GPS Location"
      >
        <Locate
          size={18}
          className="text-neutral-400 group-hover:text-indigo-400 transition-colors"
        />
      </button>

      {/* Reset North / Rotation Heading (Available on Google Maps Vector view or orientation mode) */}
      <button
        type="button"
        id="btn-reset-north"
        onClick={handleResetNorth}
        className="w-11 h-11 flex items-center justify-center bg-neutral-900/90 backdrop-blur-md border border-neutral-800/90 rounded-2xl text-neutral-300 hover:text-white active:scale-95 shadow-2xl transition-all touch-manipulation cursor-pointer group font-mono text-xs font-black"
        title="Reset Camera to Face True North"
        aria-label="Reset Camera to Face True North"
      >
        <span className="text-red-400 group-hover:text-red-300 font-bold">N</span>
      </button>

      {/* Toggle Continuous GPS Tracking */}
      <button
        type="button"
        id="btn-toggle-gps-watch"
        onClick={() => setWatchLocation(!watchLocation)}
        className={`w-11 h-11 flex items-center justify-center rounded-2xl border shadow-2xl transition-all touch-manipulation cursor-pointer active:scale-95 ${
          watchLocation
            ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-600/30'
            : 'bg-neutral-900/90 border-neutral-800/90 text-neutral-400 hover:text-neutral-200 backdrop-blur-md'
        }`}
        title={watchLocation ? 'Continuous GPS Tracking: Active' : 'Continuous GPS Tracking: Paused'}
        aria-label="Toggle Continuous GPS Tracking"
      >
        <Compass size={18} className={watchLocation ? 'animate-spin' : ''} />
      </button>
    </div>
  );
};
