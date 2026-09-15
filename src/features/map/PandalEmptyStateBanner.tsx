/**
 * Eclipse GPS — Pandal Empty State Banner (Phase 13.1)
 * 
 * Requirement 10: If no pandals are found in current map viewport bounds,
 * show "No verified pandals found in this map area."
 */

import React from 'react';
import { Info, Compass } from 'lucide-react';
import { GlassPanel } from '../../components/ui/GlassPanel';

interface PandalEmptyStateBannerProps {
  onRecenterKolkata?: () => void;
}

export const PandalEmptyStateBanner: React.FC<PandalEmptyStateBannerProps> = ({
  onRecenterKolkata,
}) => {
  return (
    <div className="pointer-events-auto">
      <GlassPanel className="px-3.5 py-2.5 bg-slate-900/90 border-slate-700/80 backdrop-blur-md shadow-xl rounded-xl text-white flex items-center gap-2.5 max-w-sm">
        <Info className="w-4 h-4 text-amber-400 shrink-0" />
        <div className="flex-1 text-xs">
          <p className="font-medium text-slate-200">
            No verified pandals found in this map area.
          </p>
        </div>
        {onRecenterKolkata && (
          <button
            onClick={onRecenterKolkata}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/40 transition-colors shrink-0"
          >
            <Compass className="w-3 h-3" />
            Kolkata
          </button>
        )}
      </GlassPanel>
    </div>
  );
};
