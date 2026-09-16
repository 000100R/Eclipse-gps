import React from 'react';
import { GitFork, Clock, Navigation } from 'lucide-react';
import { useAppState } from '../../hooks/AppStateProvider';
import { Route } from '../../types';

function formatDist(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDur(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) {
    return `${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

export const RouteAlternativesBar: React.FC = () => {
  const { activeRoute, selectAlternativeRoute } = useAppState();

  if (!activeRoute || !activeRoute.alternatives || activeRoute.alternatives.length === 0) {
    return null;
  }

  const allRoutes: { route: Route; isActive: boolean; label: string }[] = [
    {
      route: activeRoute,
      isActive: true,
      label: 'Main Route',
    },
    ...activeRoute.alternatives.map((alt, idx) => ({
      route: alt,
      isActive: false,
      label: `Alt ${idx + 1}`,
    })),
  ];

  return (
    <div
      id="route-alternatives-container"
      className="bg-neutral-900/95 backdrop-blur-md border border-neutral-800/90 rounded-2xl shadow-2xl p-2 sm:p-2.5 pointer-events-auto"
    >
      <div className="flex items-center justify-between px-1 mb-1.5">
        <div className="flex items-center space-x-1.5 text-xs text-neutral-300 font-medium">
          <GitFork size={13} className="text-indigo-400" />
          <span className="text-[11px] font-semibold text-neutral-200">Route Options</span>
          <span className="text-[10px] text-neutral-400 bg-neutral-800 px-1.5 py-0.2 rounded-full font-mono">
            {allRoutes.length}
          </span>
        </div>
        <span className="text-[10px] text-neutral-400 hidden sm:inline">Tap an alternative to switch route</span>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {allRoutes.map((item, idx) => {
          const { route, isActive, label } = item;
          const isPrimary = idx === 0;

          return (
            <button
              key={route.id || `route-${idx}`}
              id={isActive ? 'btn-active-route' : `btn-alt-route-${idx}`}
              type="button"
              onClick={() => {
                if (!isActive) {
                  selectAlternativeRoute(route);
                }
              }}
              className={`flex-shrink-0 flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-left transition-all text-xs ${
                isActive
                  ? 'bg-indigo-600/30 border-indigo-500/80 text-white shadow-sm shadow-indigo-500/20 ring-1 ring-indigo-500/50'
                  : 'bg-neutral-800/80 border-neutral-700/60 text-neutral-300 hover:bg-neutral-750 hover:border-neutral-600 active:scale-95'
              }`}
            >
              <div className="flex flex-col">
                <div className="flex items-center space-x-1.5">
                  {isActive ? (
                    <Navigation size={11} className="text-indigo-400 fill-indigo-400 shrink-0" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 shrink-0" />
                  )}
                  <span className={`font-semibold tracking-tight ${isActive ? 'text-indigo-200 font-bold' : 'text-neutral-200'}`}>
                    {label}
                  </span>
                  {isActive && (
                    <span className="text-[9px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider">
                      Active
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-neutral-400">
                  <span className={isActive ? 'text-neutral-200 font-medium' : 'text-neutral-300'}>
                    {formatDist(route.distance)}
                  </span>
                  <span className="w-0.5 h-0.5 bg-neutral-600 rounded-full" />
                  <div className="flex items-center space-x-0.5">
                    <Clock size={10} className="shrink-0 text-neutral-400" />
                    <span className={isActive ? 'text-neutral-200 font-medium' : 'text-neutral-300'}>
                      {formatDur(route.duration)}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
