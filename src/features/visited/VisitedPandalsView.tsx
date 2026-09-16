import React from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { CheckCircle2, MapPin, Calendar, Clock, Navigation, Trash2, ArrowRight } from 'lucide-react';
import { pandalDiscoveryService } from '../../services/discovery/pandalDiscoveryService';

interface VisitedPandalsViewProps {
  onBackToSaved?: () => void;
}

export const VisitedPandalsView: React.FC<VisitedPandalsViewProps> = ({ onBackToSaved }) => {
  const {
    visitedRecords,
    removeVisitedRecord,
    setSelectedItem,
    setActiveTab,
    calculateRouteToItem,
  } = useAppState();

  const handleSelectPandal = (record: any) => {
    // Look up full pandal from discovery service or construct a minimal one
    const local = pandalDiscoveryService.getLocalCandidates();
    const match = local.find(p => p.id === record.pandalId || p.name.toLowerCase() === record.pandalName.toLowerCase());
    
    if (match) {
      setSelectedItem(match);
    } else {
      setSelectedItem({
        id: record.pandalId,
        name: record.pandalName,
        location: record.coordinates,
        address: `${record.coordinates.lat.toFixed(5)}, ${record.coordinates.lng.toFixed(5)}`,
        zone: 'SOUTH',
        crowdLevel: 'MODERATE',
        verified: true,
        visitedStatus: true,
        favouriteStatus: false,
        source: 'VISITED_RECORD',
        sourceType: 'VERIFIED',
        sourceId: record.pandalId,
        verificationStatus: 'VERIFIED',
        createdAt: record.firstVisitedAt,
        updatedAt: record.latestVisitedAt,
        accessibility: true,
        rating: 4.5,
        estimatedVisitDuration: 30,
        parkingStatus: 'moderate',
        description: `Visited ${record.visitCount} time(s)`,
      });
    }
    setActiveTab('home');
  };

  const handleNavigate = (record: any) => {
    const local = pandalDiscoveryService.getLocalCandidates();
    const match = local.find(p => p.id === record.pandalId);
    const item = match || {
      id: record.pandalId,
      name: record.pandalName,
      location: record.coordinates,
    };
    calculateRouteToItem(item);
    setActiveTab('home');
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return new Date(timestamp).toLocaleString();
    }
  };

  return (
    <div id="visited-pandals-view" className="space-y-4 max-w-lg mx-auto pb-24">
      {/* Header with count and back button if provided */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-6 rounded-full bg-emerald-500" />
          <div>
            <h2 className="text-lg font-bold text-neutral-100 tracking-wide uppercase">
              Visited Pandals
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>{visitedRecords.length} Visited</span>
          </span>
          {onBackToSaved && (
            <button
              onClick={onBackToSaved}
              className="text-xs text-neutral-400 hover:text-neutral-200 px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 transition-colors"
            >
              Back
            </button>
          )}
        </div>
      </div>

      <GlassPanel className="p-4 space-y-4">
        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 text-xs text-neutral-300 flex items-start space-x-2.5">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed text-[11px]">
            Pandals are <span className="text-emerald-400 font-semibold">automatically recorded as VISITED</span> whenever your real GPS position enters within 75 meters of the pandal location.
          </p>
        </div>

        {visitedRecords.length === 0 ? (
          <div className="p-8 border border-dashed border-neutral-800 rounded-xl text-center text-xs text-neutral-500 flex flex-col items-center space-y-2">
            <CheckCircle2 size={28} className="text-neutral-700" />
            <span className="font-semibold text-neutral-400">No pandals visited yet</span>
            <span className="text-[10px] text-neutral-600 max-w-xs leading-relaxed">
              When you physically visit any Durga Puja pandal with GPS enabled, Eclipse GPS will automatically log your visit here.
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {visitedRecords.map((record) => (
              <div
                key={record.pandalId}
                id={`visited-pandal-record-${record.pandalId}`}
                className="p-3.5 bg-neutral-950/60 border border-neutral-900 rounded-xl hover:border-neutral-800 transition-colors space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        VISITED
                      </span>
                      <span className="text-[9px] font-bold text-neutral-400 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                        {record.visitCount} {record.visitCount === 1 ? 'visit' : 'visits'}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-neutral-100 truncate mt-1">
                      {record.pandalName}
                    </h4>

                    <div className="flex items-center space-x-1 text-[10px] text-neutral-500 mt-0.5">
                      <MapPin size={10} className="shrink-0 text-neutral-600" />
                      <span className="truncate">
                        {record.coordinates.lat.toFixed(5)}° N, {record.coordinates.lng.toFixed(5)}° E
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      id={`btn-view-visited-${record.pandalId}`}
                      onClick={() => handleSelectPandal(record)}
                      className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/30 transition-colors"
                      title="View on Map"
                    >
                      <ArrowRight size={13} />
                    </button>
                    <button
                      id={`btn-route-visited-${record.pandalId}`}
                      onClick={() => handleNavigate(record)}
                      className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg text-indigo-400 hover:text-indigo-300 transition-colors"
                      title="Calculate Route"
                    >
                      <Navigation size={13} />
                    </button>
                    <button
                      id={`btn-delete-visited-${record.pandalId}`}
                      onClick={() => removeVisitedRecord(record.pandalId)}
                      className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-500 hover:text-rose-500 transition-colors"
                      title="Remove Record"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Date & Time Timestamps */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-900/80 text-[10px]">
                  <div className="flex items-center space-x-1.5 text-neutral-400">
                    <Calendar size={11} className="text-neutral-500 shrink-0" />
                    <div>
                      <span className="text-[9px] text-neutral-600 block">First Visited</span>
                      <span className="text-neutral-300">{formatDate(record.firstVisitedAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 text-neutral-400">
                    <Clock size={11} className="text-neutral-500 shrink-0" />
                    <div>
                      <span className="text-[9px] text-neutral-600 block">Latest Visited</span>
                      <span className="text-neutral-300">{formatDate(record.latestVisitedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
};
