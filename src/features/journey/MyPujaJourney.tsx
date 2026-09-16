import React, { useMemo } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { useAppState } from '../../hooks/AppStateProvider';
import { visitedPandalsService } from '../../services/visited/visitedPandalsService';
import { travelDistanceService } from '../../services/gps/travelDistanceService';
import { GlassPanel } from '../../components/ui/GlassPanel';

export const MyPujaJourney: React.FC = () => {
  const { visitedRecords, totalDistanceTravelledMeters } = useAppState();

  // Use state records or fallback to persisted service records
  const records = visitedRecords && visitedRecords.length > 0
    ? visitedRecords
    : visitedPandalsService.getRecords();

  const distanceMeters = totalDistanceTravelledMeters ?? travelDistanceService.getDistanceMeters();
  const formattedDistance = travelDistanceService.formatDistanceKm(distanceMeters);

  const totalUniquePandalsVisited = useMemo(() => {
    return new Set(records.map((r) => r.pandalId)).size;
  }, [records]);

  const totalVisits = useMemo(() => {
    return records.reduce((sum, r) => sum + (r.visitCount || 1), 0);
  }, [records]);

  const differentDaysVisited = useMemo(() => {
    const uniqueDays = new Set<string>();
    records.forEach((r) => {
      if (r.firstVisitedAt) {
        const d1 = new Date(r.firstVisitedAt);
        if (!isNaN(d1.getTime())) {
          uniqueDays.add(
            `${d1.getFullYear()}-${String(d1.getMonth() + 1).padStart(2, '0')}-${String(d1.getDate()).padStart(2, '0')}`
          );
        }
      }
      if (r.latestVisitedAt) {
        const d2 = new Date(r.latestVisitedAt);
        if (!isNaN(d2.getTime())) {
          uniqueDays.add(
            `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}-${String(d2.getDate()).padStart(2, '0')}`
          );
        }
      }
    });
    return uniqueDays.size;
  }, [records]);

  // Sort visits chronologically from newest to oldest
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const timeA = a.latestVisitedAt || a.firstVisitedAt || 0;
      const timeB = b.latestVisitedAt || b.firstVisitedAt || 0;
      return timeB - timeA;
    });
  }, [records]);

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleTimeString('en-IN', {
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
        {/* Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <div
            id="stat-total-unique-pandals"
            className="p-2.5 sm:p-3.5 bg-neutral-950/60 border border-neutral-900 rounded-xl flex flex-col justify-between"
          >
            <span className="text-[11px] sm:text-xs font-medium text-neutral-400 block leading-tight">
              Total Unique Pandals Visited
            </span>
            <span className="text-xl sm:text-2xl font-bold text-neutral-100 mt-1.5 block">
              {totalUniquePandalsVisited}
            </span>
          </div>

          <div
            id="stat-total-visits"
            className="p-2.5 sm:p-3.5 bg-neutral-950/60 border border-neutral-900 rounded-xl flex flex-col justify-between"
          >
            <span className="text-[11px] sm:text-xs font-medium text-neutral-400 block leading-tight">
              Total Visits
            </span>
            <span className="text-xl sm:text-2xl font-bold text-neutral-100 mt-1.5 block">
              {totalVisits}
            </span>
          </div>

          <div
            id="stat-different-days-visited"
            className="p-2.5 sm:p-3.5 bg-neutral-950/60 border border-neutral-900 rounded-xl flex flex-col justify-between"
          >
            <span className="text-[11px] sm:text-xs font-medium text-neutral-400 block leading-tight">
              Number of Different Days Visited
            </span>
            <span className="text-xl sm:text-2xl font-bold text-neutral-100 mt-1.5 block">
              {differentDaysVisited}
            </span>
          </div>

          <div
            id="stat-total-distance-travelled"
            className="p-2.5 sm:p-3.5 bg-neutral-950/60 border border-neutral-900 rounded-xl flex flex-col justify-between"
          >
            <span className="text-[11px] sm:text-xs font-medium text-neutral-400 block leading-tight">
              Total Distance Travelled
            </span>
            <span className="text-xl sm:text-2xl font-bold text-neutral-100 mt-1.5 block">
              {formattedDistance}
            </span>
          </div>
        </div>

        {/* Chronological Visit Timeline */}
        <div id="visit-timeline-section" className="space-y-3 pt-1">
          <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
            <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
              Visit Timeline
            </h3>
            <span className="text-[11px] text-neutral-500 font-medium">
              Newest to oldest
            </span>
          </div>

          {sortedRecords.length === 0 ? (
            <div
              id="empty-journey-state"
              className="p-8 border border-dashed border-neutral-800 rounded-xl text-center text-xs text-neutral-400 flex flex-col items-center justify-center"
            >
              <p className="text-sm font-medium text-neutral-300">
                You haven't visited any pandals yet.
              </p>
            </div>
          ) : (
            <div id="visit-timeline" className="space-y-3">
              {sortedRecords.map((record) => {
                const visitTimestamp = record.latestVisitedAt || record.firstVisitedAt;
                return (
                  <div
                    key={record.pandalId}
                    id={`journey-record-${record.pandalId}`}
                    className="p-3.5 bg-neutral-950/60 border border-neutral-900 rounded-xl space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold text-neutral-100 truncate">
                        {record.pandalName}
                      </h4>
                      {record.visitCount > 1 && (
                        <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                          {record.visitCount} visits
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-neutral-400 pt-1.5 border-t border-neutral-900/80">
                      <div className="flex items-center space-x-1.5">
                        <Calendar size={12} className="text-neutral-500 shrink-0" />
                        <span className="text-neutral-300 font-medium">{formatDate(visitTimestamp)}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Clock size={12} className="text-neutral-500 shrink-0" />
                        <span className="text-neutral-300 font-medium">{formatTime(visitTimestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
};
