import React, { useState, useEffect } from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { LeafletMapView } from './LeafletMapView';
import { GoogleMapView } from './GoogleMapView';
import { IntelligenceGridControl } from './IntelligenceGridControl';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { Layers, Globe, Compass, Cpu, Check } from 'lucide-react';
import { getGoogleMapsApiKey, getGoogleMapsMapId, hasValidGoogleMapsKey } from '../../services/map/mapsConfig';

export const MapView: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { mapProvider, setMapProvider, mapStyle, setMapStyle, isNavigating } = useAppState();
  
  const apiKey = getGoogleMapsApiKey();
  const mapId = getGoogleMapsMapId();
  const isValidKey = hasValidGoogleMapsKey();
  const isGoogleActive = mapProvider === 'google' && isValidKey;
  const hasMapId = mapId.length > 5;
  const isTrue3DSupported = isValidKey && hasMapId;

  // If 3D mode was set but true 3D is not supported by current provider/configuration, revert to standard
  useEffect(() => {
    if (!isTrue3DSupported && mapStyle === '3d') {
      setMapStyle('standard');
    }
  }, [isTrue3DSupported, mapStyle, setMapStyle]);

  return (
    <div id="eclipse-map-viewport" className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-neutral-950">
      {/* Dynamic Map Component Rendering based on Provider State */}
      {isGoogleActive ? (
        <GoogleMapView />
      ) : (
        <LeafletMapView />
      )}

      {/* 🗺️ MAP HUD CONTROLS (Top-Left: Map Type Switcher + Intelligence Grid HUD - Active when NOT navigating) */}
      {!isNavigating && (
        <div id="map-left-hud-controls" className="absolute top-20 sm:top-24 left-3 sm:left-4 z-20 flex items-start space-x-2">
          {/* Clearly visible, easy-to-tap map control button */}
          <div id="map-style-selector-hud" className="flex flex-col items-start space-y-2">
            <button
              id="btn-toggle-map-style"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center space-x-2 px-4 py-2 bg-neutral-950/90 hover:bg-neutral-900 border border-neutral-800/80 text-white font-bold text-xs rounded-2xl shadow-2xl transition-all duration-300 select-none cursor-pointer h-11"
              style={{ minHeight: '44px' }}
              title={isTrue3DSupported ? "Change Map Style (Standard, Satellite, Hybrid, 3D)" : "Change Map Style (Standard, Satellite, Hybrid)"}
            >
              <span className="text-base">🗺️</span>
              <span className="tracking-wider uppercase">MAP: {mapStyle.toUpperCase()}</span>
              <Layers size={13} className="text-indigo-400 ml-1" />
            </button>

            {/* Floating Menu Popover (Opens above the map) */}
            {isMenuOpen && (
              <GlassPanel className="p-2 w-48 flex flex-col space-y-1 border border-neutral-800/90 shadow-2xl rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest px-2.5 pb-1 border-b border-neutral-900/60">
                  Select Map Type
                </div>

                {/* Standard Mode */}
                <button
                  type="button"
                  id="btn-map-style-standard"
                  onClick={() => {
                    setMapStyle('standard');
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center justify-between w-full px-2.5 py-2 text-xs font-bold rounded-xl transition-all hover:bg-neutral-900/60 text-left h-10 cursor-pointer"
                  style={{ minHeight: '40px' }}
                >
                  <span className={mapStyle === 'standard' ? 'text-indigo-400 font-extrabold' : 'text-neutral-300 hover:text-white'}>
                    {mapStyle === 'standard' ? '✓ ' : '  '}Standard
                  </span>
                  {mapStyle === 'standard' && <Check size={14} className="text-indigo-400" />}
                </button>

                {/* Satellite Mode */}
                <button
                  type="button"
                  id="btn-map-style-satellite"
                  onClick={() => {
                    setMapStyle('satellite');
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center justify-between w-full px-2.5 py-2 text-xs font-bold rounded-xl transition-all h-10 hover:bg-neutral-900/60 text-left cursor-pointer"
                  style={{ minHeight: '40px' }}
                >
                  <span className={mapStyle === 'satellite' ? 'text-indigo-400 font-extrabold' : 'text-neutral-300 hover:text-white'}>
                    {mapStyle === 'satellite' ? '✓ ' : '  '}Satellite
                  </span>
                  {mapStyle === 'satellite' && <Check size={14} className="text-indigo-400" />}
                </button>

                {/* Hybrid Mode */}
                <button
                  type="button"
                  id="btn-map-style-hybrid"
                  onClick={() => {
                    setMapStyle('hybrid');
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center justify-between w-full px-2.5 py-2 text-xs font-bold rounded-xl transition-all h-10 hover:bg-neutral-900/60 text-left cursor-pointer"
                  style={{ minHeight: '40px' }}
                >
                  <span className={mapStyle === 'hybrid' ? 'text-indigo-400 font-extrabold' : 'text-neutral-300 hover:text-white'}>
                    {mapStyle === 'hybrid' ? '✓ ' : '  '}Hybrid
                  </span>
                  {mapStyle === 'hybrid' && <Check size={14} className="text-indigo-400" />}
                </button>

                {/* 3D Mode */}
                <button
                  type="button"
                  id="btn-map-style-3d"
                  disabled={!isTrue3DSupported}
                  onClick={() => {
                    if (isTrue3DSupported) {
                      if (mapProvider !== 'google') {
                        setMapProvider('google');
                      }
                      setMapStyle('3d');
                      setIsMenuOpen(false);
                    }
                  }}
                  className={`flex items-center justify-between w-full px-2.5 py-2 text-xs font-bold rounded-xl transition-all h-10 text-left ${
                    !isTrue3DSupported
                      ? 'opacity-40 cursor-not-allowed text-neutral-500 hover:bg-transparent select-none'
                      : 'hover:bg-neutral-900/60 text-neutral-300 hover:text-white cursor-pointer'
                  }`}
                  style={{ minHeight: '40px' }}
                  title={
                    isTrue3DSupported
                      ? 'Switch to 3D perspective view'
                      : '3D map unavailable (Requires Google Maps Vector Map ID)'
                  }
                >
                  <div className="flex items-center space-x-1.5 truncate">
                    <span className={!isTrue3DSupported ? 'text-neutral-500' : mapStyle === '3d' ? 'text-indigo-400 font-extrabold' : 'text-neutral-300'}>
                      {mapStyle === '3d' && isTrue3DSupported ? '✓ ' : '  '}3D View
                    </span>
                    {!isTrue3DSupported && (
                      <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-neutral-900/90 text-amber-500/90 border border-neutral-800 tracking-tight">
                        Unavailable
                      </span>
                    )}
                  </div>
                  {mapStyle === '3d' && isTrue3DSupported && <Check size={14} className="text-indigo-400" />}
                </button>
              </GlassPanel>
            )}
          </div>

          {/* Intelligence Grid Control HUD */}
          <IntelligenceGridControl />
        </div>
      )}

      {/* Map Provider Selector HUD (Floating Top-Right Corner Overlay - Active when NOT navigating) */}
      {!isNavigating && (
        <div id="map-provider-dock" className="absolute top-20 sm:top-24 right-3 sm:right-4 z-20">
          <GlassPanel className="p-1.5 flex items-center space-x-1.5 border border-neutral-800/80 shadow-2xl rounded-2xl">
            <button
              id="btn-provider-leaflet"
              onClick={() => setMapProvider('leaflet')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                mapProvider === 'leaflet'
                  ? 'bg-neutral-800 text-white shadow-md'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40'
              }`}
              title="Switch to open-source CartoDB / OSM map layer"
            >
              <Globe size={12} />
              <span className="hidden sm:inline">Leaflet (OSM)</span>
            </button>
            
            <button
              id="btn-provider-google"
              onClick={() => {
                if (isValidKey) {
                  setMapProvider('google');
                }
              }}
              disabled={!isValidKey}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                !isValidKey
                  ? 'opacity-40 cursor-not-allowed text-neutral-600'
                  : mapProvider === 'google'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40'
              }`}
              title={isValidKey ? "Switch to WebGL 3D Google Maps Platform" : "Configure a valid Google Maps API Key to unlock Google Maps"}
            >
              <Cpu size={12} />
              <span className="hidden sm:inline">Google (3D)</span>
            </button>
          </GlassPanel>
        </div>
      )}
    </div>
  );
};

export default MapView;
