import React, { useState } from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { MapPin, ArrowUpDown, Trash2, Zap, Play, Calendar, Star, HelpCircle } from 'lucide-react';

export const RoutePlanner: React.FC = () => {
  const {
    routeStops,
    setRouteStops,
    removeStop,
    activeRoute,
    optimizeRoute,
    isAiLoading,
    setIsNavigating,
    setCurrentStepIndex,
    setActiveTab,
    pandals,
    events,
    routePreference,
    setRoutePreference,
  } = useAppState();

  const [selectedCatalogId, setSelectedCatalogId] = useState('');

  // Handle reordering via shift buttons (safe, clean alternative to drag-and-drop)
  const shiftStop = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === routeStops.length - 1) return;

    const newStops = [...routeStops];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    
    // Swap
    const temp = newStops[index];
    newStops[index] = newStops[targetIdx];
    newStops[targetIdx] = temp;

    setRouteStops(newStops);
  };

  const handleAddStopFromSelect = (id: string) => {
    if (!id) return;
    const allCatalog = [...pandals, ...events];
    const item = allCatalog.find(c => c.id === id);
    if (item && !routeStops.some(s => s.id === id)) {
      setRouteStops([...routeStops, item]);
    }
    setSelectedCatalogId('');
  };

  const allAvailableStops = [...pandals, ...events].filter(
    item => !routeStops.some(stop => stop.id === item.id)
  );

  return (
    <div id="route-planner-view" className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center space-x-2">
        <div className="w-1.5 h-6 rounded-full bg-indigo-500" />
        <h2 className="text-lg font-bold text-neutral-100 tracking-wide uppercase">Trip Planner</h2>
      </div>

      <GlassPanel className="p-4 space-y-4">
        <p className="text-xs text-neutral-400 leading-relaxed">
          Create custom multi-stop routes across festival pandals and events. Optimize the order of your visits using our real road distance TSP solver.
        </p>

        {/* Add Stop select interface */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Add stop to tour</label>
          <select
            id="select-add-stop-route"
            value={selectedCatalogId}
            onChange={(e) => handleAddStopFromSelect(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">-- Choose a Pandal or Event --</option>
            {allAvailableStops.map(item => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.theme ? 'Pandal' : 'Event'})
              </option>
            ))}
          </select>
        </div>

        {/* Navigation Preference */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Navigation Preference</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              id="pref-driving"
              type="button"
              onClick={() => setRoutePreference('DRIVING')}
              className={`py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                routePreference !== 'WALKING'
                  ? 'bg-indigo-650/40 border-indigo-500 text-indigo-400'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:text-neutral-300'
              }`}
            >
              🚗 Driving
            </button>
            <button
              id="pref-walking"
              type="button"
              onClick={() => setRoutePreference('WALKING')}
              className={`py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                routePreference === 'WALKING'
                  ? 'bg-indigo-650/40 border-indigo-500 text-indigo-400'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:text-neutral-300'
              }`}
            >
              🚶 Walking
            </button>
          </div>
        </div>

        {/* Current Stops List */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Planned stops ({routeStops.length})</span>
          {routeStops.length === 0 ? (
            <div className="p-4 border border-dashed border-neutral-800 rounded-xl text-center text-xs text-neutral-500">
              Your itinerary is currently empty. Add stops above to create a route.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
              {routeStops.map((stop, index) => (
                <div
                  key={stop.id}
                  className="flex items-center justify-between p-3 bg-neutral-950/60 border border-neutral-900 rounded-xl"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-200 truncate">{stop.name}</p>
                      <p className="text-[10px] text-neutral-500 truncate mt-0.5">{stop.address}</p>
                    </div>
                  </div>

                  {/* Ordering Controls & Removal */}
                  <div className="flex items-center space-x-1.5">
                    <button
                      id={`btn-shift-stop-up-${stop.id}`}
                      onClick={() => shiftStop(index, 'up')}
                      disabled={index === 0}
                      className="p-1.5 text-neutral-500 hover:text-neutral-300 disabled:opacity-30 transition-colors"
                      title="Move Up"
                    >
                      ▲
                    </button>
                    <button
                      id={`btn-shift-stop-down-${stop.id}`}
                      onClick={() => shiftStop(index, 'down')}
                      disabled={index === routeStops.length - 1}
                      className="p-1.5 text-neutral-500 hover:text-neutral-300 disabled:opacity-30 transition-colors"
                      title="Move Down"
                    >
                      ▼
                    </button>
                    <button
                      id={`btn-remove-stop-${stop.id}`}
                      onClick={() => removeStop(stop.id)}
                      className="p-1.5 text-neutral-500 hover:text-rose-500 transition-colors ml-1"
                      title="Remove Stop"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Optimizers and Navigation Launcher */}
        {routeStops.length > 0 && (
          <div className="space-y-3 pt-2">
            {routeStops.length > 1 && (
              <button
                id="btn-optimize-tsp-route"
                onClick={optimizeRoute}
                disabled={isAiLoading}
                className="w-full flex items-center justify-center space-x-2 py-2 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold tracking-wider text-xs rounded-xl hover:scale-[1.01] active:scale-99 transition-all uppercase"
              >
                <Zap size={13} className="fill-white" />
                <span>{isAiLoading ? 'Computing TSP...' : 'Optimize Stops (TSP Solver)'}</span>
              </button>
            )}

            {activeRoute && (
              <div className="p-3 bg-neutral-900/40 border border-neutral-900 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                  <span>Total Distance:</span>
                  <span className="text-indigo-400">{(activeRoute.distance / 1000).toFixed(1)} km</span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                  <span>Total Estimated Time:</span>
                  <span className="text-indigo-400">{Math.ceil(activeRoute.duration / 60)} mins</span>
                </div>

                <button
                  id="btn-route-planner-start-nav"
                  onClick={() => {
                    setIsNavigating(true);
                    setCurrentStepIndex(0);
                    setActiveTab('home');
                  }}
                  className="w-full flex items-center justify-center space-x-2 py-2 mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold tracking-wider text-xs rounded-xl transition-colors uppercase"
                >
                  <Play size={12} className="fill-white" />
                  <span>Start Tour Navigation</span>
                </button>
              </div>
            )}
          </div>
        )}
      </GlassPanel>
    </div>
  );
};
export default RoutePlanner;
