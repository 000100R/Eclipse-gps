import React from 'react';
import { NearbySuggestion } from '../../types/smartRoute';
import { 
  Sparkles, 
  X, 
  Plus, 
  MapPin, 
  Train, 
  Building2, 
  CornerDownRight, 
  Clock 
} from 'lucide-react';

interface NearbySuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: NearbySuggestion[];
  onAddStop: (suggestion: NearbySuggestion) => void;
}

export const NearbySuggestionsModal: React.FC<NearbySuggestionsModalProps> = ({
  isOpen,
  onClose,
  suggestions,
  onAddStop,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div 
        id="nearby-suggestions-dialog"
        className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-neutral-900 bg-neutral-900/40">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Suggested Nearby Stops</h3>
              <p className="text-[11px] text-neutral-400">
                Pandals & Bonedi Baris fitting along your current tour corridor
              </p>
            </div>
          </div>
          <button
            id="btn-close-nearby-suggestions"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* List of Suggestions */}
        <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1">
          {suggestions.length === 0 ? (
            <div className="p-6 text-center text-neutral-500 text-xs border border-dashed border-neutral-900 rounded-xl space-y-1">
              <p className="font-semibold text-neutral-400">No close detours detected</p>
              <p>Your current stops already cover the immediate cluster efficiently!</p>
            </div>
          ) : (
            suggestions.map((suggestion) => {
              const isBonedi = suggestion.type === 'bonedi_bari';

              return (
                <div
                  key={suggestion.id}
                  className="p-3.5 bg-neutral-900/60 border border-neutral-800/80 hover:border-indigo-500/50 rounded-xl space-y-2.5 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <h4 className="text-xs font-bold text-white truncate">
                          {suggestion.name}
                        </h4>
                        {isBonedi ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-950/60 text-amber-400 border border-amber-800/50 flex items-center space-x-0.5">
                            <Building2 size={8} />
                            <span>Heritage</span>
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-indigo-950/60 text-indigo-400 border border-indigo-800/50 flex items-center space-x-0.5">
                            <Sparkles size={8} />
                            <span>Pandal</span>
                          </span>
                        )}
                      </div>

                      {suggestion.address && (
                        <p className="text-[10px] text-neutral-400 truncate mt-0.5 flex items-center space-x-1">
                          <MapPin size={9} className="text-neutral-500 flex-shrink-0" />
                          <span className="truncate">{suggestion.address}</span>
                        </p>
                      )}
                    </div>

                    <button
                      id={`btn-add-suggestion-${suggestion.id}`}
                      onClick={() => onAddStop(suggestion)}
                      className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center space-x-1 shadow-sm transition-all"
                    >
                      <Plus size={12} />
                      <span>Add</span>
                    </button>
                  </div>

                  {/* Why it fits & Detour details */}
                  <div className="flex items-center space-x-2 text-[10px] text-neutral-400 pt-1 border-t border-neutral-800/50 flex-wrap gap-y-1">
                    <span className="px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-emerald-400 font-semibold flex items-center space-x-1">
                      <CornerDownRight size={10} />
                      <span>
                        +{suggestion.detourDistanceMeters >= 1000 
                          ? `${(suggestion.detourDistanceMeters / 1000).toFixed(1)} km` 
                          : `${suggestion.detourDistanceMeters} m`} detour
                      </span>
                    </span>

                    <span className="text-neutral-400 truncate flex-1">
                      {suggestion.reason}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-neutral-900 bg-neutral-900/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
