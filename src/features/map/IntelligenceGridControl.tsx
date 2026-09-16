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

import React, { useState, useEffect } from 'react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { useIntelligenceGrid } from '../../hooks/useIntelligenceGrid';
import { IntelligenceLayerId } from '../../types/intelligence';
import { MetroLineCategory } from '../../types/metro';
import { metroIntelligenceProvider } from '../../services/intelligence/metroIntelligenceProvider';
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

const METRO_LINE_OPTIONS: Array<{
  id: MetroLineCategory;
  label: string;
  dotClass: string;
  activeClass: string;
  badgeClass: string;
}> = [
  {
    id: 'ALL',
    label: 'All Metro',
    dotClass: 'bg-indigo-400 shadow-sm shadow-indigo-400/50',
    activeClass: 'bg-indigo-950/80 text-indigo-200 border-indigo-500/60',
    badgeClass: 'bg-indigo-900/60 text-indigo-300 border border-indigo-500/40',
  },
  {
    id: 'BLUE',
    label: 'Blue Line',
    dotClass: 'bg-blue-500 shadow-sm shadow-blue-500/50',
    activeClass: 'bg-blue-950/80 text-blue-200 border-blue-500/60',
    badgeClass: 'bg-blue-900/60 text-blue-300 border border-blue-500/40',
  },
  {
    id: 'GREEN',
    label: 'Green Line',
    dotClass: 'bg-emerald-500 shadow-sm shadow-emerald-500/50',
    activeClass: 'bg-emerald-950/80 text-emerald-200 border-emerald-500/60',
    badgeClass: 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/40',
  },
  {
    id: 'PURPLE',
    label: 'Purple Line',
    dotClass: 'bg-purple-500 shadow-sm shadow-purple-500/50',
    activeClass: 'bg-purple-950/80 text-purple-200 border-purple-500/60',
    badgeClass: 'bg-purple-900/60 text-purple-300 border border-purple-500/40',
  },
  {
    id: 'YELLOW',
    label: 'Yellow Line',
    dotClass: 'bg-amber-400 shadow-sm shadow-amber-400/50',
    activeClass: 'bg-amber-950/80 text-amber-200 border-amber-500/60',
    badgeClass: 'bg-amber-900/60 text-amber-300 border border-amber-500/40',
  },
];

interface IntelligenceGridControlProps {
  className?: string;
}

export const IntelligenceGridControl: React.FC<IntelligenceGridControlProps> = ({
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeLine, setActiveLine] = useState<MetroLineCategory>(() =>
    metroIntelligenceProvider.getLineFilter()
  );

  const {
    layers,
    activeLayers,
    toggleLayer,
    viewport,
  } = useIntelligenceGrid();

  useEffect(() => {
    return metroIntelligenceProvider.subscribeLineFilter((newFilter) => {
      setActiveLine(newFilter);
    });
  }, []);

  const handleSelectLine = (e: React.MouseEvent, line: MetroLineCategory) => {
    e.stopPropagation();
    metroIntelligenceProvider.setLineFilter(line);
  };

  const lineCounts = metroIntelligenceProvider.getLineCounts();
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
                  <React.Fragment key={layer.id}>
                    <div
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

                    {/* Metro Line Sub-Filters (When Metro Layer is enabled) */}
                    {layer.id === 'METRO' && isChecked && (
                      <div
                        id="metro-line-filters-container"
                        onClick={(e) => e.stopPropagation()}
                        className="ml-4 mr-1 my-1 p-2 rounded-xl bg-neutral-950/90 border border-neutral-800/90 flex flex-col space-y-1.5 shadow-inner"
                      >
                        <div className="flex items-center justify-between text-[10px] text-neutral-400 font-bold uppercase tracking-wider px-1">
                          <span>Filter by Line</span>
                          <span className="font-mono text-neutral-500">{lineCounts[activeLine]} stations</span>
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                          {METRO_LINE_OPTIONS.map((opt) => {
                            const isSelected = activeLine === opt.id;
                            return (
                              <button
                                key={opt.id}
                                id={`btn-metro-line-${opt.id.toLowerCase()}`}
                                onClick={(e) => handleSelectLine(e, opt.id)}
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                                  isSelected
                                    ? `${opt.activeClass} font-bold border`
                                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60 border border-transparent font-medium'
                                }`}
                                style={{ minHeight: '36px' }}
                              >
                                <div className="flex items-center space-x-2 min-w-0">
                                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.dotClass}`} />
                                  <span className="truncate">{opt.label}</span>
                                </div>
                                <span
                                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                                    isSelected
                                      ? opt.badgeClass
                                      : 'bg-neutral-900 text-neutral-500 border border-neutral-800'
                                  }`}
                                >
                                  {lineCounts[opt.id]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
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
