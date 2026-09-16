import React, { useState } from 'react';
import { ShieldCheck, FileSpreadsheet, Globe, Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { DiscoveredPandal } from '../../types/discovery';

interface PandalCoverageBadgeProps {
  pandals: DiscoveredPandal[];
  isLoading?: boolean;
}

export const PandalCoverageBadge: React.FC<PandalCoverageBadgeProps> = ({
  pandals,
  isLoading = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (pandals.length === 0 && !isLoading) {
    return null;
  }

  let eclipseCount = 0;
  let googleEarthCount = 0;
  let googlePlacesCount = 0;
  let agamoniCount = 0;

  for (const p of pandals) {
    if (p.source === 'ECLIPSE_CURATED') {
      eclipseCount++;
    } else if (p.source === 'GOOGLE_EARTH') {
      googleEarthCount++;
    } else if (p.source === 'GOOGLE_PLACES') {
      googlePlacesCount++;
    } else if (p.source === 'AGAMONI' || p.source === 'OFFICIAL_COMMITTEE') {
      agamoniCount++;
    }
  }

  const total = pandals.length;

  return (
    <div id="pandal-coverage-badge" className="pointer-events-auto select-none">
      <GlassPanel className="px-3 py-1.5 bg-neutral-950/90 border-neutral-800/90 text-white rounded-xl shadow-xl flex flex-col gap-1 backdrop-blur-md">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-xs font-semibold hover:text-indigo-300 transition-colors cursor-pointer text-left"
          title="Click to view discovery sources breakdown"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          )}

          <span className="font-mono text-neutral-200">
            <strong className="text-white font-bold">{total}</strong> pandals discovered
          </span>

          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-neutral-400 ml-auto shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 ml-auto shrink-0" />
          )}
        </button>

        {isExpanded && (
          <div className="pt-1.5 mt-1 border-t border-neutral-800/70 flex flex-col gap-1 text-[11px] text-neutral-300 animate-in fade-in duration-150">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-amber-300">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                Verified Eclipse
              </span>
              <span className="font-mono font-bold text-neutral-200">{eclipseCount}</span>
            </div>

            {agamoniCount > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-purple-300">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  Agamoni Directory
                </span>
                <span className="font-mono font-bold text-neutral-200">{agamoniCount}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-emerald-300">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Google Earth KML
              </span>
              <span className="font-mono font-bold text-neutral-200">{googleEarthCount}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-blue-300">
                <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                Google Places
              </span>
              <span className="font-mono font-bold text-neutral-200">{googlePlacesCount}</span>
            </div>
          </div>
        )}
      </GlassPanel>
    </div>
  );
};
