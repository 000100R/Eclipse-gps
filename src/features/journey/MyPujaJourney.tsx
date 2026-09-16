import React from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { visitedPandalsService } from '../../services/visited/visitedPandalsService';
import { GlassPanel } from '../../components/ui/GlassPanel';

export const MyPujaJourney: React.FC = () => {
  const { visitedRecords } = useAppState();

  // Use state records or fallback to persisted service records
  const records = visitedRecords && visitedRecords.length > 0
    ? visitedRecords
    : visitedPandalsService.getRecords();

  const totalPandalsVisited = records.length;
  const totalVisits = records.reduce((sum, r) => sum + (r.visitCount || 1), 0);

  const formatDateTime = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div id="my-puja-journey-view" className="space-y-4 max-w-lg mx-auto pb-24">
      {/* Section Header */}
      <div className="flex items-center space-x-2">
        <div className="w-1.5 h-6 rounded-full bg-emerald-500" />
        <h2 className="text-lg font-bold text-neutral-100 tracking-wide uppercase">
          My Puja Journey
        </h2>
      </div>

      <GlassPanel className="p-4 space-y-4">
        {/* Total Pandals Visited and Total Visits */}
        <div className="grid grid-cols-2 gap-3">
          <div
            id="stat-total-pandals-visited"
            className="p-3.5 bg-neutral-950/60 border border-neutral-900 rounded-xl"
          >
            <span className="text-xs font-medium text-neutral-400 block">
              Total Pandals Visited
            </span>
            <span className="text-2xl font-bold text-neutral-100 mt-1 block">
              {totalPandalsVisited}
            </span>
          </div>

          <div
            id="stat-total-visits"
            className="p-3.5 bg-neutral-950/60 border border-neutral-900 rounded-xl"
          >
            <span className="text-xs font-medium text-neutral-400 block">
              Total Visits
            </span>
            <span className="text-2xl font-bold text-neutral-100 mt-1 block">
              {totalVisits}
            </span>
          </div>
        </div>

        {/* Visited Pandals List */}
        {records.length === 0 ? (
          <div
            id="empty-journey-state"
            className="p-8 border border-dashed border-neutral-800 rounded-xl text-center text-xs text-neutral-400 flex flex-col items-center justify-center"
          >
            <p className="text-sm font-medium text-neutral-300">
              You haven't visited any pandals yet.
            </p>
          </div>
        ) : (
          <div id="visited-pandals-list" className="space-y-3">
            {records.map((record) => (
              <div
                key={record.pandalId}
                id={`journey-record-${record.pandalId}`}
                className="p-3.5 bg-neutral-950/60 border border-neutral-900 rounded-xl space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-neutral-100 truncate">
                    {record.pandalName}
                  </h3>
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                    Visit count: {record.visitCount}
                  </span>
                </div>

                <div className="text-xs text-neutral-400">
                  Latest visit: {formatDateTime(record.latestVisitedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
};
