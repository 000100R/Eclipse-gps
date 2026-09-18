import React, { useState } from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { CrowdBadge } from '../../components/ui/CrowdBadge';
import { crowdService } from '../../services/realtime/crowdService';
import { isFirebaseConfigured } from '../../services/firebase';
import { getPandalCrowdMetrics } from '../../utils/crowdUtils';
import { Star, Check, Navigation, AlertTriangle, MessageSquare, HelpCircle, Users } from 'lucide-react';
import { CrowdLevel } from '../../types';

export const ExplorePandals: React.FC = () => {
  const {
    pandals,
    calculateRouteToItem,
    isSaved,
    saveLocation,
    unsaveLocation,
    toggleVisited,
    visitedIds,
    refreshCatalogs,
    setActiveTab,
    pandalCrowdCounts,
    pandalCrowdTrends,
  } = useAppState();

  const [filterZone, setFilterZone] = useState('ALL');
  const [filterCrowd, setFilterCrowd] = useState('ALL');
  const [reportingItemId, setReportingItemId] = useState<string | null>(null);
  const [reportLevel, setReportLevel] = useState<CrowdLevel>('MODERATE');
  const [reportText, setReportText] = useState('');
  const [reportStatusMsg, setReportStatusMsg] = useState<{ success?: boolean; text?: string } | null>(null);

  // Filters calculation
  const filteredPandals = pandals.filter(p => {
    const matchesZone = filterZone === 'ALL' || p.zone.toUpperCase() === filterZone;
    const matchesCrowd = filterCrowd === 'ALL' || p.crowdLevel === filterCrowd;
    return matchesZone && matchesCrowd;
  });

  const handleToggleFav = (pandal: any) => {
    if (isSaved(pandal.id)) {
      unsaveLocation(pandal.id);
    } else {
      saveLocation(pandal);
    }
    refreshCatalogs();
  };

  const handleReportSubmit = async (e: React.FormEvent, itemId: string) => {
    e.preventDefault();
    setReportStatusMsg(null);
    const result = await crowdService.reportCrowd(itemId, reportLevel, reportText);
    
    if (result.success) {
      setReportStatusMsg({ success: true, text: result.message });
      setReportText('');
      // refresh catalogs so new crowd level gets updated instantly in the state!
      refreshCatalogs();
      setTimeout(() => {
        setReportingItemId(null);
        setReportStatusMsg(null);
      }, 2500);
    } else {
      setReportStatusMsg({ success: false, text: result.message });
    }
  };

  return (
    <div id="explore-pandals-view" className="space-y-4 max-w-lg mx-auto pb-24">
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-6 rounded-full bg-indigo-500" />
          <h2 className="text-lg font-bold text-neutral-100 tracking-wide uppercase">Durga Puja Pandals</h2>
        </div>
        {visitedIds.length > 0 && (
          <button
            id="btn-explore-view-visited"
            onClick={() => setActiveTab('visited')}
            className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 hover:bg-emerald-500/25 transition-colors"
            title="View Visited Pandals"
          >
            <Check size={11} className="stroke-[3]" />
            <span>{visitedIds.length} Visited</span>
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <GlassPanel className="p-3 flex flex-wrap gap-2.5 bg-neutral-950/40">
        <div className="flex-1 min-w-[120px] space-y-1">
          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Zone Location</label>
          <select
            id="pandal-filter-zone"
            value={filterZone}
            onChange={(e) => setFilterZone(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-900 rounded-lg px-2 py-1 text-xs text-neutral-300 focus:outline-none"
          >
            <option value="ALL">All Zones</option>
            <option value="NORTH">North Kolkata</option>
            <option value="SOUTH">South Kolkata</option>
            <option value="CENTRAL">Central Kolkata</option>
          </select>
        </div>

        <div className="flex-1 min-w-[120px] space-y-1">
          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Crowd Status</label>
          <select
            id="pandal-filter-crowd"
            value={filterCrowd}
            onChange={(e) => setFilterCrowd(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-900 rounded-lg px-2 py-1 text-xs text-neutral-300 focus:outline-none"
          >
            <option value="ALL">All Levels</option>
            <option value="LOW">Low Crowd</option>
            <option value="MODERATE">Moderate</option>
            <option value="HEAVY">Heavy</option>
            <option value="EXTREME">Extreme</option>
            <option value="UNAVAILABLE">Data Unavailable</option>
          </select>
        </div>
      </GlassPanel>

      {/* List items */}
      <div className="space-y-3.5">
        {filteredPandals.length === 0 ? (
          <div className="p-8 border border-dashed border-neutral-800 rounded-xl text-center text-xs text-neutral-500">
            No pandals matched the selected filter parameters.
          </div>
        ) : (
          filteredPandals.map((pandal) => {
            const isVisited = visitedIds.includes(pandal.id);
            const isFav = isSaved(pandal.id);

            return (
              <GlassPanel key={pandal.id} className="p-4 flex flex-col space-y-3.5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">{pandal.zone} Kolkata</span>
                      <CrowdBadge level={pandal.crowdLevel} />
                      {isVisited && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <Check size={10} className="stroke-[3]" />
                          VISITED
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-neutral-100 mt-1 truncate">{pandal.name}</h3>
                    <p className="text-xs text-neutral-400 mt-0.5 truncate">{pandal.address}</p>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      id={`btn-fav-toggle-pandal-${pandal.id}`}
                      onClick={() => handleToggleFav(pandal)}
                      className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-rose-500 transition-colors"
                    >
                      <Star size={14} fill={isFav ? '#ef4444' : 'none'} className={isFav ? 'text-rose-500' : ''} />
                    </button>
                    <button
                      id={`btn-visited-toggle-pandal-${pandal.id}`}
                      onClick={() => toggleVisited(pandal.id)}
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

                {/* Theme & Meta Details Row */}
                <div className="grid grid-cols-2 gap-3 p-2.5 bg-neutral-950/40 rounded-lg border border-neutral-900 text-[11px]">
                  <div>
                    <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">Artistic Theme</span>
                    <p className="text-neutral-300 font-semibold mt-0.5 truncate">{pandal.theme}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">Queue Time (Est.)</span>
                    {pandal.crowdLevel === 'UNAVAILABLE' ? (
                      <p className="text-neutral-500 font-medium mt-0.5">⏱ Unavailable</p>
                    ) : (
                      <p className="text-emerald-400 font-bold mt-0.5">⏱ {pandal.queueTimeMinutes} mins wait</p>
                    )}
                  </div>
                  <div>
                    <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">Darshan Hours</span>
                    <p className="text-neutral-300 font-semibold mt-0.5">{pandal.openingTime} - {pandal.closingTime}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">Rating & Safety</span>
                    <p className="text-amber-400 font-semibold mt-0.5">★ {pandal.rating} • {pandal.safetyStatus || 'SECURE'}</p>
                  </div>
                  {isFirebaseConfigured() && (
                    <div className="col-span-2 border-t border-neutral-900 pt-2 flex flex-col space-y-1 text-[11px]">
                      <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Users size={10} /> Live Crowd Intelligence
                      </span>
                      {(() => {
                        const metrics = getPandalCrowdMetrics(pandal.id, pandalCrowdCounts, pandalCrowdTrends);
                        if (!metrics.available) {
                          return <p className="text-neutral-500 italic mt-0.5">Live crowd data unavailable</p>;
                        }
                        return (
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-neutral-300 font-semibold">👥 {metrics.count} Eclipse users nearby</span>
                            <span className="flex items-center space-x-1.5">
                              <span className={`font-bold ${metrics.levelColorClass}`}>{metrics.levelLabel}</span>
                              <span className="text-neutral-400 font-semibold">• {metrics.trendLabel}</span>
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Additional Amenities Badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="bg-neutral-900/60 border border-neutral-800 text-neutral-400 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase">
                    Area: {pandal.area}
                  </span>
                  {pandal.parkingAvailability && (
                    pandal.parkingAvailability === 'none' || pandal.parkingStatus === 'full' ? (
                      <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-bold px-2 py-0.5 rounded-md">
                        🅿 NO PARKING
                      </span>
                    ) : pandal.parkingAvailability === 'limited' ? (
                      <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold px-2 py-0.5 rounded-md">
                        🅿 LIMITED PARKING
                      </span>
                    ) : (
                      <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-md">
                        🅿 PARKING AVAILABLE
                      </span>
                    )
                  )}
                  {pandal.accessibilityFriendly && (
                    <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-bold px-2 py-0.5 rounded-md">
                      ♿ WHEELCHAIR ACCESSIBLE
                    </span>
                  )}
                </div>

                <p className="text-xs text-neutral-400 leading-relaxed">{pandal.description}</p>

                {/* Actions row */}
                <div className="flex items-center justify-between border-t border-neutral-900 pt-3.5 mt-1.5">
                  <button
                    id={`btn-nav-pandal-p-${pandal.id}`}
                    onClick={() => calculateRouteToItem(pandal)}
                    className="flex items-center space-x-1.5 text-xs font-bold tracking-wider text-indigo-400 hover:text-indigo-300 uppercase"
                  >
                    <Navigation size={12} className="fill-indigo-400" />
                    <span>Navigate</span>
                  </button>

                  <button
                    id={`btn-toggle-pandal-report-${pandal.id}`}
                    onClick={() => setReportingItemId(reportingItemId === pandal.id ? null : pandal.id)}
                    className="flex items-center space-x-1.5 text-xs font-bold tracking-wider text-neutral-400 hover:text-neutral-300 uppercase"
                  >
                    <MessageSquare size={12} />
                    <span>Report Crowd</span>
                  </button>
                </div>

                {/* Live Report Form Drawer */}
                {reportingItemId === pandal.id && (
                  <form
                    id={`form-report-crowd-${pandal.id}`}
                    onSubmit={(e) => handleReportSubmit(e, pandal.id)}
                    className="p-3 border border-neutral-900 rounded-xl bg-neutral-950/80 space-y-3.5 transition-all duration-300 mt-2"
                  >
                    <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                      <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider">Report Live Crowd Level</span>
                      <AlertTriangle size={13} className="text-indigo-400" />
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {(['LOW', 'MODERATE', 'HEAVY', 'EXTREME'] as CrowdLevel[]).map((level) => (
                        <button
                          key={level}
                          type="button"
                          id={`btn-report-lvl-${level}`}
                          onClick={() => setReportLevel(level)}
                          className={`py-1 rounded-md text-[10px] font-bold tracking-wider border uppercase transition-colors ${
                            reportLevel === level
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Optional Comment</label>
                      <input
                        id="report-comment-field"
                        type="text"
                        value={reportText}
                        onChange={(e) => setReportText(e.target.value)}
                        placeholder="e.g. queue starts from main road, fast entry..."
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {reportStatusMsg && (
                      <p className={`text-center text-[10px] font-semibold ${reportStatusMsg.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {reportStatusMsg.text}
                      </p>
                    )}

                    <div className="flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        id="btn-report-cancel"
                        onClick={() => setReportingItemId(null)}
                        className="px-3 py-1 text-[10px] font-bold text-neutral-400 uppercase"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        id="btn-report-submit"
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-md uppercase"
                      >
                        Submit
                      </button>
                    </div>
                  </form>
                )}
              </GlassPanel>
            );
          })
        )}
      </div>
    </div>
  );
};
export default ExplorePandals;
