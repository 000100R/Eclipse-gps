import React, { useState } from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { eventsService } from '../../services/events/eventsService';
import { Trash2, Heart, ArrowRight, CheckCircle2 } from 'lucide-react';
import { VisitedPandalsView } from '../visited/VisitedPandalsView';

export const SavedItems: React.FC = () => {
  const {
    savedLocations,
    unsaveLocation,
    visitedRecords,
    setSelectedItem,
    setActiveTab,
  } = useAppState();

  const [activeSubTab, setActiveSubTab] = useState<'saved' | 'visited'>('saved');

  const handleSelectSaved = (saved: any) => {
    const item = eventsService.getItemById(saved.itemId);
    if (item) {
      setSelectedItem(item);
      setActiveTab('home');
    }
  };

  return (
    <div id="saved-items-view" className="space-y-4 max-w-lg mx-auto pb-24">
      {/* Sub-tab switcher: Saved Locations vs Visited Pandals */}
      <div className="flex rounded-xl bg-neutral-900/80 p-1 border border-neutral-800">
        <button
          id="tab-saved-locations"
          onClick={() => setActiveSubTab('saved')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors ${
            activeSubTab === 'saved'
              ? 'bg-neutral-800 text-neutral-100 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Heart size={13} className={activeSubTab === 'saved' ? 'text-rose-500 fill-rose-500' : ''} />
          <span>Saved ({savedLocations.length})</span>
        </button>

        <button
          id="tab-visited-pandals"
          onClick={() => setActiveSubTab('visited')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors ${
            activeSubTab === 'visited'
              ? 'bg-neutral-800 text-neutral-100 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <CheckCircle2 size={13} className={activeSubTab === 'visited' ? 'text-emerald-400' : ''} />
          <span>Visited ({visitedRecords.length})</span>
        </button>
      </div>

      {activeSubTab === 'visited' ? (
        <VisitedPandalsView onBackToSaved={() => setActiveSubTab('saved')} />
      ) : (
        <>
          {/* View Header */}
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-6 rounded-full bg-indigo-500" />
            <h2 className="text-lg font-bold text-neutral-100 tracking-wide uppercase">Your Saved Collection</h2>
          </div>

          <GlassPanel className="p-4 space-y-4">
            <p className="text-xs text-neutral-400 leading-relaxed">
              Access your favorited Durga Puja pandals, concert venues, and customized routes. Perfect for quickly centering your maps or managing your bucket list.
            </p>

            {savedLocations.length === 0 ? (
              <div className="p-8 border border-dashed border-neutral-800 rounded-xl text-center text-xs text-neutral-500 flex flex-col items-center space-y-2">
                <Heart size={24} className="text-neutral-700" />
                <span>You haven't saved any locations yet.</span>
                <span className="text-[10px] text-neutral-600">Mark stars on pandals and events to see them here.</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {savedLocations.map((loc) => {
                  const fullDetails = eventsService.getItemById(loc.itemId);
                  
                  return (
                    <div
                      key={loc.id}
                      className="p-3 bg-neutral-950/60 border border-neutral-900 rounded-xl flex items-center justify-between hover:border-neutral-800 transition-colors"
                    >
                      <button
                        id={`btn-select-saved-${loc.itemId}`}
                        onClick={() => handleSelectSaved(loc)}
                        className="flex-1 text-left min-w-0 pr-2"
                      >
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">
                            {loc.type === 'pandal' ? 'Durga Puja' : 'Cultural Event'}
                          </span>
                          {fullDetails && fullDetails.crowdLevel && (
                            <span className="w-1 h-1 bg-neutral-700 rounded-full" />
                          )}
                          {fullDetails && fullDetails.crowdLevel && (
                            <span className="text-[9px] text-indigo-400 font-bold uppercase">{fullDetails.crowdLevel} crowd</span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-neutral-200 truncate mt-0.5">{loc.name}</h4>
                        {fullDetails && (
                          <p className="text-[10px] text-neutral-500 truncate mt-0.5">{fullDetails.address}</p>
                        )}
                      </button>

                      <div className="flex items-center space-x-2">
                        <button
                          id={`btn-navigate-saved-${loc.itemId}`}
                          onClick={() => handleSelectSaved(loc)}
                          className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg text-indigo-400 hover:text-indigo-300 transition-colors"
                          title="Pan on Map"
                        >
                          <ArrowRight size={13} />
                        </button>
                        <button
                          id={`btn-unsave-${loc.itemId}`}
                          onClick={() => unsaveLocation(loc.itemId)}
                          className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-500 hover:text-rose-500 transition-colors"
                          title="Remove from Saved"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassPanel>
        </>
      )}
    </div>
  );
};
export default SavedItems;
