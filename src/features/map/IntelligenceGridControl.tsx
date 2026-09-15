/**
 * Eclipse GPS — Intelligence Grid Control UI (Phase 13)
 * 
 * Floating, mobile-friendly map control to inspect and toggle Eclipse
 * Intelligence Layers:
 * - Pandals
 * - Bonedi Bari
 * - Metro
 * - Events
 * - Crowd
 * - Traffic
 * - Parking
 * - Walking Routes
 * - Alerts
 * 
 * Shows "Data layer coming soon" for unintegrated future layers.
 * Does not generate fake markers or data.
 */

import React, { useState } from 'react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { useIntelligenceGrid } from '../../hooks/useIntelligenceGrid';
import { IntelligenceLayerId } from '../../types/intelligence';
import {
  Layers,
  Check,
  X,
  Radio,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

const LAYER_ORDER: IntelligenceLayerId[] = [
  'PANDALS',
  'BONEDI_BARI',
  'METRO',
  'PUJA_CALENDAR',
  'EVENTS',
  'CROWD',
  'TRAFFIC',
  'PARKING',
  'WALKING_ROUTES',
  'ALERTS',
];

interface IntelligenceGridControlProps {
  className?: string;
}

export const IntelligenceGridControl: React.FC<IntelligenceGridControlProps> = ({
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    layers,
    activeLayers,
    toggleLayer,
    viewport,
  } = useIntelligenceGrid();

  const activeCount = activeLayers.length;

  return (
    <div
      id="eclipse-intelligence-grid-container"
      className={`flex flex-col items-start select-none ${className}`}
    >
      {/* Trigger Button — Floating HUD element with >44px touch target */}
      <button
        id="btn-intelligence-grid-hud"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 px-3.5 py-2 bg-neutral-950/90 hover:bg-neutral-900 border text-white font-bold text-xs rounded-2xl shadow-2xl transition-all duration-300 cursor-pointer h-11 ${
          isOpen || activeCount > 0
            ? 'border-indigo-500/70 shadow-indigo-950/40'
            : 'border-neutral-800/80'
        }`}
        style={{ minHeight: '44px' }}
        title="Eclipse Intelligence Grid Layer Controls"
      >
        <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 text-xs">
          ⚡
        </span>
        <span className="tracking-wider uppercase font-mono text-[11px] sm:text-xs">
          INTELLIGENCE
        </span>
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono border ${
            activeCount > 0
              ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
              : 'bg-neutral-800 border-neutral-700 text-neutral-400'
          }`}
        >
          {activeCount}
        </span>
        {isOpen ? (
          <ChevronUp size={14} className="text-neutral-400" />
        ) : (
          <ChevronDown size={14} className="text-neutral-400" />
        )}
      </button>

      {/* Expandable Intelligence Grid Popover Panel */}
      {isOpen && (
        <>
          {/* Backdrop click dismiss on mobile devices */}
          <div
            className="fixed inset-0 z-20 sm:hidden bg-black/40 backdrop-blur-[2px]"
            onClick={() => setIsOpen(false)}
          />

          <GlassPanel
            id="panel-intelligence-grid-menu"
            className="mt-2 p-3 w-72 sm:w-80 max-h-[75vh] flex flex-col space-y-2 border border-neutral-800/90 shadow-2xl rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200 z-30 overflow-hidden bg-neutral-950/95"
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800/80">
              <div className="flex items-center space-x-1.5">
                <Layers size={14} className="text-indigo-400" />
                <span className="text-xs font-black uppercase tracking-widest text-white">
                  INTELLIGENCE GRID
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>

            {/* Viewport Tracker Pill */}
            <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-neutral-900/60 border border-neutral-800/60 text-[10px] text-neutral-400 font-mono">
              <div className="flex items-center space-x-1">
                <Radio size={10} className="text-emerald-400 animate-pulse" />
                <span>VIEWPORT: Z{viewport.zoom.toFixed(1)}</span>
              </div>
              <span className="truncate max-w-[120px] text-[9px] text-neutral-500">
                {viewport.north.toFixed(2)}°N, {viewport.east.toFixed(2)}°E
              </span>
            </div>

            {/* List of 9 Standard Layers */}
            <div className="flex flex-col space-y-1 overflow-y-auto pr-0.5 max-h-[50vh] scrollbar-thin scrollbar-thumb-neutral-800">
              {LAYER_ORDER.map((layerId) => {
                const layer = layers[layerId];
                if (!layer) return null;

                const isChecked = layer.enabled && layer.visible;
                const hasRealData = layer.itemCount > 0;

                return (
                  <div
                    key={layer.id}
                    id={`layer-toggle-row-${layer.id.toLowerCase()}`}
                    onClick={() => toggleLayer(layer.id)}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-xl transition-all cursor-pointer select-none group border ${
                      isChecked
                        ? 'bg-neutral-900/90 border-neutral-700/80 hover:border-indigo-500/50'
                        : 'bg-neutral-950/40 border-transparent hover:bg-neutral-900/40 hover:border-neutral-800/60'
                    }`}
                    style={{ minHeight: '44px' }}
                  >
                    {/* Checkbox & Layer Name */}
                    <div className="flex items-center space-x-2.5 min-w-0">
                      {/* Checkbox Target */}
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
                          isChecked
                            ? 'bg-indigo-600 border border-indigo-500 text-white'
                            : 'bg-neutral-900 border border-neutral-700 group-hover:border-neutral-500'
                        }`}
                      >
                        {isChecked && <Check size={12} strokeWidth={3} />}
                      </div>

                      {/* Name & Details */}
                      <div className="flex flex-col min-w-0">
                        <span
                          className={`text-xs font-bold leading-tight truncate ${
                            isChecked
                              ? 'text-white'
                              : 'text-neutral-300 group-hover:text-white'
                          }`}
                        >
                          {layer.name}
                        </span>
                        <span className="text-[10px] text-neutral-500 truncate leading-tight hidden sm:inline">
                          {layer.description}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge / Notice */}
                    <div className="flex items-center ml-2 shrink-0">
                      {hasRealData ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/70 border border-emerald-700/60 text-emerald-300">
                          {layer.itemCount}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-neutral-900/80 border border-neutral-800 text-neutral-400">
                          Data layer coming soon
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Architecture Footer Notice */}
            <div className="pt-1.5 border-t border-neutral-800/80 flex items-center space-x-1 text-[10px] text-neutral-400 leading-tight">
              <Info size={11} className="shrink-0 text-indigo-400" />
              <span>
                Grid automatically tracks map viewport for future provider loading.
              </span>
            </div>
          </GlassPanel>
        </>
      )}
    </div>
  );
};
