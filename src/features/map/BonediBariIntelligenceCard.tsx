/**
 * Eclipse GPS — Bonedi Bari Intelligence Card (Phase 13.2)
 * 
 * Compact, high-contrast information card for Kolkata's heritage Bonedi Bari houses.
 * Displays:
 * - Name
 * - Heritage / Puja history (description)
 * - Puja year & verified age (e.g. Founded in 1757 • 269+ Years)
 * - Distance from user & estimated travel time
 * - Nearest Metro & approximate walking distance
 * - NAVIGATE button
 * - ADD TO ITINERARY button
 */

import React, { useState } from 'react';
import {
  Navigation,
  MapPin,
  Clock,
  ShieldCheck,
  Landmark,
  Train,
  Plus,
  X,
  ExternalLink,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { BonediBari } from '../../types/bonediBari';

interface BonediBariIntelligenceCardProps {
  bonediBari: BonediBari;
  onClose: () => void;
  onNavigate?: (item: BonediBari) => void;
  onAddStop?: (item: BonediBari) => void;
  onShowOnMap?: (item: BonediBari) => void;
  isAddingStop?: boolean;
}

export const BonediBariIntelligenceCard: React.FC<BonediBariIntelligenceCardProps> = ({
  bonediBari,
  onClose,
  onNavigate,
  onAddStop,
  onShowOnMap,
  isAddingStop = false,
}) => {
  const [showFullHistory, setShowFullHistory] = useState(false);
  if (!bonediBari) return null;

  const currentYear = new Date().getFullYear();
  const heritageAge = bonediBari.pujaSince
    ? Math.max(1, currentYear - bonediBari.pujaSince)
    : undefined;

  const isVerified = bonediBari.verificationStatus === 'VERIFIED';

  return (
    <GlassPanel
      id={`bonedi-bari-card-${bonediBari.id}`}
      className="p-4 bg-neutral-950/95 border border-amber-500/40 shadow-2xl rounded-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 text-neutral-100 max-w-md mx-auto"
    >
      {/* Top Header Row: Badge & Dismiss */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-neutral-800/80">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Heritage Pill */}
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
            <Landmark className="w-3 h-3 text-amber-400" />
            Bonedi Bari Heritage
          </span>

          {/* Verification Pill */}
          {isVerified ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Verified History
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700">
              External Record
            </span>
          )}
        </div>

        <button
          id="btn-close-bonedi-card"
          onClick={onClose}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors"
          title="Close Card"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Main Title & Family Lineage */}
      <div className="mt-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-snug">
              {bonediBari.name}
            </h3>
            <p className="text-xs text-amber-400/90 font-medium mt-0.5">
              {bonediBari.family}
            </p>
          </div>

          {/* Founded Year & Age Pill */}
          {bonediBari.pujaSince && (
            <div className="text-right shrink-0 bg-neutral-900/90 border border-neutral-800 px-2.5 py-1 rounded-xl">
              <div className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
                Since {bonediBari.pujaSince}
              </div>
              <div className="text-xs font-bold text-amber-300">
                {heritageAge}+ Years
              </div>
            </div>
          )}
        </div>

        {/* Address */}
        <div className="flex items-center gap-1.5 mt-2 text-neutral-400 text-xs">
          <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
          <span className="truncate">{bonediBari.address}</span>
        </div>
      </div>

      {/* Metro & Distance Metrics Row */}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-neutral-800/70 text-xs">
        {/* Nearest Metro Station */}
        <div className="flex items-start gap-2 p-2 rounded-xl bg-neutral-900/60 border border-neutral-800/70">
          <Train className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-[10px] text-neutral-400 font-medium">
              Nearest Metro
            </div>
            <div className="text-neutral-200 font-semibold truncate text-[11px] sm:text-xs" title={bonediBari.nearestMetro}>
              {bonediBari.nearestMetro.replace('Metro Station', '').trim()}
            </div>
            <div className="text-[10px] text-sky-300/80 font-mono mt-0.5">
              {bonediBari.approximateWalkingDistance}
            </div>
          </div>
        </div>

        {/* Distance from User & Travel Time */}
        <div className="flex items-start gap-2 p-2 rounded-xl bg-neutral-900/60 border border-neutral-800/70">
          <Clock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-[10px] text-neutral-400 font-medium">
              From Your Location
            </div>
            <div className="text-neutral-200 font-semibold text-[11px] sm:text-xs">
              {bonediBari.distanceFormatted || 'Calculating distance...'}
            </div>
            {bonediBari.estimatedTravelTime && (
              <div className="text-[10px] text-emerald-300/80 font-mono mt-0.5 truncate">
                {bonediBari.estimatedTravelTime}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Heritage History & Puja Tradition */}
      <div className="mt-3 p-2.5 rounded-xl bg-neutral-900/40 border border-neutral-800/50">
        <div className="flex items-center justify-between text-[11px] font-bold text-neutral-300 mb-1">
          <span className="flex items-center gap-1 text-amber-300">
            <Sparkles className="w-3 h-3" />
            Heritage & Puja Tradition
          </span>
          <button
            onClick={() => setShowFullHistory(!showFullHistory)}
            className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-0.5"
          >
            {showFullHistory ? (
              <>Less <ChevronUp size={12} /></>
            ) : (
              <>More <ChevronDown size={12} /></>
            )}
          </button>
        </div>
        <p
          className={`text-xs text-neutral-300 leading-relaxed font-normal ${
            showFullHistory ? '' : 'line-clamp-2'
          }`}
        >
          {bonediBari.heritageDescription}
        </p>
      </div>

      {/* Action Buttons: NAVIGATE & ADD TO ITINERARY */}
      <div className="flex items-center gap-2 mt-4 pt-1">
        {/* Navigate Button */}
        <button
          id={`btn-navigate-bonedi-${bonediBari.id}`}
          onClick={() => onNavigate && onNavigate(bonediBari)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all cursor-pointer h-11"
          style={{ minHeight: '44px' }}
        >
          <Navigation className="w-4 h-4 fill-slate-950" />
          <span>NAVIGATE</span>
        </button>

        {/* Add to Itinerary Button */}
        <button
          id={`btn-itinerary-bonedi-${bonediBari.id}`}
          onClick={() => onAddStop && onAddStop(bonediBari)}
          disabled={isAddingStop}
          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 border border-neutral-700/80 text-white font-semibold text-xs tracking-wide transition-all cursor-pointer h-11"
          style={{ minHeight: '44px' }}
          title="Add this Bonedi Bari to your active Puja Itinerary"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">ADD TO</span> ITINERARY
        </button>

        {/* Center / Show On Map */}
        {onShowOnMap && (
          <button
            id={`btn-map-bonedi-${bonediBari.id}`}
            onClick={() => onShowOnMap(bonediBari)}
            className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 text-neutral-300 hover:text-white transition-colors h-11 w-11 flex items-center justify-center"
            title="Focus On Map"
            aria-label="Focus on map"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>
    </GlassPanel>
  );
};
