import React, { useState } from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { Compass, Star, Check, Navigation, Calendar, MapPin, HelpCircle, Sparkles } from 'lucide-react';
import { PujaCalendarView } from '../calendar/PujaCalendarView';

export const ExploreEvents: React.FC = () => {
  const {
    events,
    calculateRouteToItem,
    isSaved,
    saveLocation,
    unsaveLocation,
    toggleVisited,
    visitedIds,
    refreshCatalogs,
  } = useAppState();

  const [activeSubTab, setActiveSubTab] = useState<'CALENDAR' | 'CULTURAL'>('CALENDAR');
  const [filterCategory, setFilterCategory] = useState('ALL');

  const filteredEvents = events.filter(e => {
    return filterCategory === 'ALL' || e.category.toUpperCase() === filterCategory;
  });

  const handleToggleFav = (event: any) => {
    if (isSaved(event.id)) {
      unsaveLocation(event.id);
    } else {
      saveLocation(event);
    }
    refreshCatalogs();
  };

  return (
    <div id="explore-events-view" className="space-y-4 max-w-lg mx-auto pb-24">
      {/* Sub-Navigation Switch */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-neutral-900/80 rounded-xl border border-neutral-800">
        <button
          id="btn-subtab-puja-calendar"
          onClick={() => setActiveSubTab('CALENDAR')}
          className={`py-2 px-3 rounded-lg text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all ${
            activeSubTab === 'CALENDAR'
              ? 'bg-amber-500 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
        >
          <Sparkles size={13} />
          Puja Calendar
        </button>
        <button
          id="btn-subtab-cultural-events"
          onClick={() => setActiveSubTab('CULTURAL')}
          className={`py-2 px-3 rounded-lg text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all ${
            activeSubTab === 'CULTURAL'
              ? 'bg-neutral-800 text-white shadow-sm border border-neutral-700'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
        >
          <Calendar size={13} />
          City Events ({filteredEvents.length})
        </button>
      </div>

      {activeSubTab === 'CALENDAR' ? (
        <PujaCalendarView />
      ) : (
        <>
          {/* View Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-6 rounded-full bg-indigo-500" />
              <h2 className="text-lg font-bold text-neutral-100 tracking-wide uppercase">Kolkata Cultural Events</h2>
            </div>
          </div>

          {/* Filter Toolbar */}
          <GlassPanel className="p-3 flex flex-wrap gap-2.5 bg-neutral-950/40">
            <div className="flex-1 min-w-[150px] space-y-1">
              <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Event Category</label>
              <select
                id="event-filter-category"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-900 rounded-lg px-2 py-1 text-xs text-neutral-300 focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                <option value="CONCERT">Music Concerts</option>
                <option value="SPORTS">Sports Tournaments</option>
                <option value="FAIR">Fairs & Festivals</option>
                <option value="EXHIBITION">Exhibitions & Museums</option>
                <option value="LANDMARK">Historical Landmarks</option>
              </select>
            </div>
          </GlassPanel>

          {/* List items */}
          <div className="space-y-3.5">
            {filteredEvents.length === 0 ? (
              <div className="p-8 border border-dashed border-neutral-800 rounded-xl text-center text-xs text-neutral-500">
                No cultural events matched the selected filter category.
              </div>
            ) : (
              filteredEvents.map((event) => {
                const isVisited = visitedIds.includes(event.id);
                const isFav = isSaved(event.id);

                return (
                  <GlassPanel key={event.id} className="p-4 flex flex-col space-y-3.5">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">{event.category}</span>
                          <span className="text-[10px] text-neutral-400 font-semibold">• {event.locationName}</span>
                        </div>
                        <h3 className="text-sm font-bold text-neutral-100 mt-1 truncate">{event.name}</h3>
                        <p className="text-xs text-neutral-400 mt-0.5 truncate">{event.address}</p>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          id={`btn-fav-toggle-event-${event.id}`}
                          onClick={() => handleToggleFav(event)}
                          className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-rose-500 transition-colors"
                        >
                          <Star size={14} fill={isFav ? '#ef4444' : 'none'} className={isFav ? 'text-rose-500' : ''} />
                        </button>
                        <button
                          id={`btn-visited-toggle-event-${event.id}`}
                          onClick={() => toggleVisited(event.id)}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isVisited
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                              : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white'
                          }`}
                        >
                          <Check size={14} className="stroke-[2.5]" />
                        </button>
                      </div>
                    </div>

                    {/* Event Schedule metadata */}
                    <div className="grid grid-cols-2 gap-3 p-2.5 bg-neutral-950/40 rounded-lg border border-neutral-900 text-[11px]">
                      <div className="flex items-center space-x-2">
                        <Calendar size={13} className="text-indigo-400" />
                        <div>
                          <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider block">Event Schedule</span>
                          <p className="text-neutral-300 font-semibold mt-0.5">{event.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin size={13} className="text-indigo-400" />
                        <div>
                          <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider block">Precise Location</span>
                          <p className="text-neutral-300 font-semibold mt-0.5 truncate">{event.locationName}</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-400 leading-relaxed">{event.description}</p>

                    {/* Actions row */}
                    <div className="flex items-center justify-between border-t border-neutral-900 pt-3.5 mt-1.5">
                      <button
                        id={`btn-nav-event-${event.id}`}
                        onClick={() => calculateRouteToItem(event)}
                        className="flex items-center space-x-1.5 text-xs font-bold tracking-wider text-indigo-400 hover:text-indigo-300 uppercase"
                      >
                        <Navigation size={12} className="fill-indigo-400" />
                        <span>Navigate</span>
                      </button>
                    </div>
                  </GlassPanel>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};
export default ExploreEvents;
