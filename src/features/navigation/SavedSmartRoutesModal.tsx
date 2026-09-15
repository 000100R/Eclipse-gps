import React from 'react';
import { SmartRoutePlan } from '../../types/smartRoute';
import { Bookmark, X, Trash2, ArrowRight, Clock, MapPin, Train, Footprints, Car } from 'lucide-react';

interface SavedSmartRoutesModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedRoutes: SmartRoutePlan[];
  onLoadRoute: (plan: SmartRoutePlan) => void;
  onDeleteRoute: (planId: string) => void;
}

export const SavedSmartRoutesModal: React.FC<SavedSmartRoutesModalProps> = ({
  isOpen,
  onClose,
  savedRoutes,
  onLoadRoute,
  onDeleteRoute,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div 
        id="saved-smart-routes-dialog"
        className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-neutral-900 bg-neutral-900/40">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <Bookmark size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Saved Puja Routes</h3>
              <p className="text-[11px] text-neutral-400">
                {savedRoutes.length} saved itineraries ready to explore
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* List of Saved Routes */}
        <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1">
          {savedRoutes.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 text-xs border border-dashed border-neutral-900 rounded-xl space-y-2">
              <Bookmark size={24} className="mx-auto text-neutral-600" />
              <p className="font-semibold text-neutral-400">No saved routes yet</p>
              <p>Plan a Puja tour and tap "Save Route" to keep it handy offline or during your pandal hop!</p>
            </div>
          ) : (
            savedRoutes.map((route) => (
              <div
                key={route.id}
                className="p-3.5 bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 rounded-xl space-y-2.5 transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">
                      {route.title || `Puja Tour (${route.stops.length} Stops)`}
                    </h4>
                    <p className="text-[10px] text-neutral-400 mt-0.5">
                      {new Date(route.createdAt).toLocaleDateString(undefined, { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>

                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                    <button
                      onClick={() => onDeleteRoute(route.id)}
                      className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Delete saved route"
                    >
                      <Trash2 size={13} />
                    </button>
                    <button
                      onClick={() => {
                        onLoadRoute(route);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center space-x-1 shadow-sm transition-all"
                    >
                      <span>Load</span>
                      <ArrowRight size={11} />
                    </button>
                  </div>
                </div>

                {/* Route statistics */}
                <div className="flex items-center space-x-3 text-[10px] text-neutral-300 pt-2 border-t border-neutral-800/60 flex-wrap gap-y-1">
                  <span className="flex items-center space-x-1 text-indigo-400">
                    <MapPin size={10} />
                    <span className="font-semibold">{route.stops.length} stops</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Clock size={10} />
                    <span>{Math.round(route.summary.totalDurationMinutes / 60)}h {route.summary.totalDurationMinutes % 60}m</span>
                  </span>
                  <span>
                    {(route.summary.totalDistanceMeters / 1000).toFixed(1)} km
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-neutral-400 text-[9px] uppercase">
                    {route.config.preferredTransport}
                  </span>
                </div>

                {/* Preview of first 3 stops */}
                <div className="text-[10px] text-neutral-400 truncate">
                  {route.stops.map(s => s.name).slice(0, 3).join(' → ')}
                  {route.stops.length > 3 ? ` + ${route.stops.length - 3} more` : ''}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-neutral-900 bg-neutral-900/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
