/**
 * Eclipse GPS — Pandal Intelligence Card (Phase 13.4 — Eclipse Pandal Intelligence)
 * 
 * High-precision, rich information card for discovered and curated pandals in
 * Eclipse's own visual language and design system.
 * 
 * Renders ONLY verified/available data:
 * - Eclipse Intelligence & Verification Badge (Verified / Community / External / Unverified)
 * - Name, Area, and Landmark
 * - Est. Year & Historical Age (e.g., Est. 1935 • 91 Years)
 * - Distance, Travel Time, and Live Crowd Level
 * - Nearest Metro Station & Calculated Walking Distance
 * - Theme & Artistic Theme Description
 * - Best Visiting Period / Timings
 * - Entry & Exit Navigation Guidelines
 * - Accessibility Indicators (Ramps, Paved paths, Volunteer assistance)
 * - Organizer & Helpline / Official Website
 * - Verified Photo Preview / Gallery
 * - Source Provenance & Last Verified Timestamp
 * - Interactive Controls: Visited, Favorite, Show On Map, Navigate, Add to Tour
 */

import React from 'react';
import {
  Navigation,
  MapPin,
  Clock,
  ShieldCheck,
  Globe,
  X,
  ExternalLink,
  Plus,
  Users,
  Train,
  Sparkles,
  Building2,
  Accessibility,
  DoorOpen,
  Phone,
  Heart,
  CheckCircle2,
  Layers,
  Calendar,
  Flame,
  Car,
  TrendingUp,
  TrendingDown,
  Minus,
  Compass,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { DiscoveredPandal } from '../../types/discovery';
import { pujaCalendarService } from '../../services/intelligence/pujaCalendarService';
import { crowdIntelligenceService } from '../../services/intelligence/crowdIntelligenceService';
import { trafficIntelligenceService } from '../../services/intelligence/trafficIntelligenceService';
import { smartVisitService } from '../../services/intelligence/smartVisitService';
import { useAppState } from '../../hooks/AppStateProvider';

interface PandalIntelligenceCardProps {
  pandal: DiscoveredPandal | any;
  currentLocation?: { lat: number; lng: number } | null;
  onClose: () => void;
  onShowOnMap?: (pandal: DiscoveredPandal) => void;
  onNavigate?: (pandal: DiscoveredPandal) => void;
  onAddStop?: (pandal: DiscoveredPandal) => void;
  isAddingStop?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isVisited?: boolean;
  onToggleVisited?: () => void;
}

export const PandalIntelligenceCard: React.FC<PandalIntelligenceCardProps> = ({
  pandal,
  currentLocation: propsLocation,
  onClose,
  onShowOnMap,
  onNavigate,
  onAddStop,
  isAddingStop = false,
  isFavorite = false,
  onToggleFavorite,
  isVisited = false,
  onToggleVisited,
}) => {
  if (!pandal) return null;

  const { pandals, pandalCrowdCounts, pandalCrowdTrends, currentLocation: appLocation, setSelectedItem } = useAppState();
  const activeLocation = propsLocation || appLocation;

  // Real-time Crowd & Traffic Intelligence evaluation
  const crowdItem = crowdIntelligenceService.getCrowdForPandal(
    pandal.id,
    pandal,
    pandalCrowdCounts,
    pandalCrowdTrends
  );

  const trafficItem = trafficIntelligenceService.getTrafficNearPandal(
    pandal.id,
    pandal.location
  );

  const smartVisit = smartVisitService.calculateRecommendation(
    pandal,
    pandals,
    pandalCrowdCounts,
    pandalCrowdTrends,
    activeLocation
  );

  const name = pandal.name || 'Durga Puja Pandal';
  const area = pandal.area || pandal.zone || 'Kolkata';
  const landmark = pandal.landmark;

  // Format distance
  const distance = pandal.distance !== undefined
    ? pandal.distance < 1000
      ? `${pandal.distance}m away`
      : `${(pandal.distance / 1000).toFixed(1)} km away`
    : undefined;
  const travelTime = pandal.estimatedTravelTime;

  // Age calculation if establishedYear exists
  const currentYear = new Date().getFullYear();
  const pujaAge = pandal.establishedYear
    ? Math.max(1, currentYear - pandal.establishedYear)
    : undefined;

  // Verification Status Badge logic (Verified / Community / External)
  const renderVerificationBadge = () => {
    const status = pandal.verificationStatus;
    const isVerified =
      status === 'VERIFIED' ||
      pandal.source === 'ECLIPSE_CURATED' ||
      pandal.verified === true;
    const isCommunity =
      status === 'COMMUNITY_VERIFIED' ||
      pandal.source === 'USER_CONTRIBUTION' ||
      pandal.source === 'OFFICIAL_COMMITTEE';
    const isExternal =
      status === 'EXTERNAL' ||
      pandal.source === 'GOOGLE_PLACES' ||
      pandal.source === 'OSM_NOMINATIM' ||
      pandal.source === 'GOOGLE_EARTH';

    if (isVerified) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          Verified Eclipse
        </span>
      );
    }
    if (isCommunity) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-sm">
          <Users className="w-3 h-3 text-violet-400" />
          Community Report
        </span>
      );
    }
    if (isExternal) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm">
          <Globe className="w-3 h-3 text-blue-400" />
          External Source
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-800/80 text-neutral-300 border border-neutral-700">
        <MapPin className="w-3 h-3 text-neutral-400" />
        Unverified Spot
      </span>
    );
  };

  // Crowd level formatting
  const crowdColor =
    pandal.crowdLevel === 'EXTREME'
      ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
      : pandal.crowdLevel === 'HEAVY'
      ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
      : pandal.crowdLevel === 'MODERATE'
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

  // Distinct provenance sources list
  const sourceRecords = pandal.dataSources || [];
  const sourceNames = sourceRecords
    .map((s: any) => (typeof s === 'string' ? s : s.source))
    .filter((val: string, idx: number, arr: string[]) => arr.indexOf(val) === idx && Boolean(val));

  // Formatted last verified date
  const lastVerifiedVal = pandal.lastVerifiedTime || pandal.lastVerifiedAt;
  const formattedLastVerified = lastVerifiedVal
    ? typeof lastVerifiedVal === 'number'
      ? new Date(lastVerifiedVal).toLocaleDateString('en-IN', {
          month: 'short',
          year: 'numeric',
        })
      : String(lastVerifiedVal)
    : null;

  // Best visiting period
  const bestPeriod = pandal.bestVisitingPeriod || pandal.bestVisitingTime;

  // Photos/Images array
  const rawPhotos: string[] = pandal.photos || pandal.images || [];
  const validPhotos = rawPhotos.filter((url) => typeof url === 'string' && url.startsWith('http'));

  return (
    <GlassPanel
      id={`pandal-intel-card-${pandal.id || 'active'}`}
      className="p-4 bg-neutral-950/95 border border-primary/40 shadow-2xl rounded-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 text-neutral-100 max-w-md mx-auto max-h-[82vh] overflow-y-auto"
    >
      {/* Top Header Row: Layer Tag, Badges & Quick Action Controls */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-neutral-800/80">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Eclipse Intelligence Pill */}
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-primary/20 text-primary border border-primary/40 shadow-sm">
            <Sparkles className="w-3 h-3 text-primary" />
            Eclipse Pandal Intel
          </span>

          {/* Verification Badge */}
          {renderVerificationBadge()}

          {/* Visited Indicator */}
          {isVisited && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              VISITED
            </span>
          )}
        </div>

        {/* Quick Actions (Visited, Favorite, Close) */}
        <div className="flex items-center gap-1 shrink-0">
          {onToggleVisited && (
            <button
              onClick={onToggleVisited}
              title={isVisited ? 'Marked as Visited' : 'Mark as Visited'}
              className={`p-1.5 rounded-lg transition-colors ${
                isVisited
                  ? 'text-emerald-400 bg-emerald-500/20 border border-emerald-500/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}

          {onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              title={isFavorite ? 'Saved to Favorites' : 'Add to Favorites'}
              className={`p-1.5 rounded-lg transition-colors ${
                isFavorite
                  ? 'text-rose-400 bg-rose-500/20 border border-rose-500/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-400' : ''}`} />
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors"
            aria-label="Close card"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Title & Establishment Information */}
      <div className="mt-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="text-lg font-extrabold text-neutral-100 tracking-tight leading-snug">
            {name}
          </h3>
          {pandal.establishedYear && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
              Est. {pandal.establishedYear} {pujaAge ? `• ${pujaAge} Yrs` : ''}
            </span>
          )}
        </div>

        {/* Location & Landmark Subtitle */}
        <p className="text-xs text-primary/90 font-medium flex items-center gap-1.5 mt-1 truncate">
          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>{area}</span>
          {landmark && (
            <>
              <span className="text-neutral-600">•</span>
              <span className="text-neutral-300 truncate">{landmark}</span>
            </>
          )}
        </p>
      </div>

      {/* Distance, Travel Time & Quick Links HUD */}
      <div className="mt-3 flex items-center justify-between text-xs py-2 px-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800/90 gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          {distance && (
            <span className="font-bold text-neutral-200 flex items-center gap-1">
              <Navigation className="w-3 h-3 text-primary" />
              {distance}
            </span>
          )}
          {travelTime && (
            <span className="flex items-center gap-1 text-neutral-400">
              <Clock className="w-3 h-3 text-neutral-500" />
              {travelTime}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {pandal.googleMapsUri && (
            <a
              href={pandal.googleMapsUri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
            >
              Google Maps
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Real-time Crowd & Traffic Intelligence HUD */}
      <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {/* Crowd Intelligence Status */}
        <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 flex flex-col justify-between gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider flex items-center gap-1">
              <Users className="w-3 h-3 text-neutral-300" />
              Crowd Status
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${
              crowdItem.source === 'LIVE'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : crowdItem.source === 'ESTIMATED'
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : crowdItem.source === 'HISTORICAL'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-neutral-800/90 text-neutral-400 border-neutral-700'
            }`}>
              {crowdItem.source}
            </span>
          </div>

          {crowdItem.crowdLevel !== 'UNAVAILABLE' ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  crowdItem.crowdLevel === 'HEAVY'
                    ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                    : crowdItem.crowdLevel === 'HIGH'
                    ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
                    : crowdItem.crowdLevel === 'MODERATE'
                    ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                    : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                }`}>
                  {crowdItem.crowdLevel}
                </span>
                {crowdItem.crowdTrend !== 'UNKNOWN' && (
                  <span className="text-[11px] text-neutral-300 flex items-center gap-0.5">
                    {crowdItem.crowdTrend === 'RISING' && <TrendingUp className="w-3 h-3 text-rose-400" />}
                    {crowdItem.crowdTrend === 'FALLING' && <TrendingDown className="w-3 h-3 text-emerald-400" />}
                    {crowdItem.crowdTrend === 'STABLE' && <Minus className="w-3 h-3 text-neutral-400" />}
                    <span className="capitalize">{crowdItem.crowdTrend.toLowerCase()}</span>
                  </span>
                )}
              </div>
              {crowdItem.queueWaitMinutes !== undefined && (
                <span className="text-[11px] text-neutral-400 font-mono">
                  ~{crowdItem.queueWaitMinutes}m queue
                </span>
              )}
            </div>
          ) : (
            <div className="py-0.5">
              <p className="text-[11px] text-neutral-300 font-medium">
                Crowd data unavailable
              </p>
              <p className="text-[9px] text-neutral-500 mt-0.5 leading-tight">
                {crowdItem.notes || 'Awaiting live user presence on-site.'}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60 text-[9px] text-neutral-500">
            <span className="truncate max-w-[130px]">{crowdItem.sourceLabel}</span>
            <span className="font-mono shrink-0">
              {new Date(crowdItem.lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

          {/* Traffic Intelligence Status */}
          {trafficItem && trafficItem.status !== 'UNAVAILABLE' && (
            <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 flex flex-col justify-between gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider flex items-center gap-1">
                  <Car className="w-3 h-3 text-neutral-300" />
                  Arterial Traffic
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                  trafficItem.source === 'LIVE'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : trafficItem.source === 'ESTIMATED'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                }`}>
                  {trafficItem.source}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                    trafficItem.status === 'CONGESTED'
                      ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                      : trafficItem.status === 'SLOW'
                      ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                      : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                  }`}>
                    {trafficItem.status}
                  </span>
                  <span className="text-[11px] text-neutral-400 truncate max-w-[100px]">
                    {trafficItem.affectedRoad}
                  </span>
                </div>
                {trafficItem.estimatedDelayMinutes !== undefined && (
                  <span className={`text-[11px] font-mono font-semibold ${
                    trafficItem.estimatedDelayMinutes > 15 ? 'text-rose-400' : 'text-neutral-400'
                  }`}>
                    {trafficItem.estimatedDelayMinutes > 0 ? `+${trafficItem.estimatedDelayMinutes}m delay` : 'Flowing'}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

      {/* Eclipse Smart Visit Recommendation (Phase 13.7) */}
      {smartVisit && smartVisit.isDataAvailable && (
        <div className="mt-2.5 p-3 rounded-xl bg-gradient-to-br from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] uppercase font-bold text-neutral-300 tracking-wider">
                Eclipse Smart Visit
              </span>
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              smartVisit.status === 'RECOMMENDED'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : smartVisit.status === 'CAUTION'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : smartVisit.status === 'AVOID'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-neutral-800 text-neutral-300 border-neutral-700'
            }`}>
              {smartVisit.status === 'RECOMMENDED' && <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />}
              {smartVisit.status === 'CAUTION' && <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />}
              {smartVisit.status === 'AVOID' && <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />}
              {smartVisit.headline}
            </span>
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed">
            {smartVisit.description}
          </p>

          {/* Contextual Intelligence Factors */}
          <div className="grid grid-cols-1 gap-1.5 text-[11px] pt-1 border-t border-neutral-800/80">
            <div className="flex items-start gap-1.5 text-neutral-400">
              <span className="text-neutral-500 shrink-0 font-medium">👥 Crowd:</span>
              <span className="text-neutral-300 leading-tight">{smartVisit.crowdFactor}</span>
            </div>
            <div className="flex items-start gap-1.5 text-neutral-400">
              <span className="text-neutral-500 shrink-0 font-medium">🚗 Traffic:</span>
              <span className="text-neutral-300 leading-tight">{smartVisit.trafficFactor}</span>
            </div>
            <div className="flex items-start gap-1.5 text-neutral-400">
              <span className="text-neutral-500 shrink-0 font-medium">⏱️ Timing:</span>
              <span className="text-neutral-300 leading-tight">{smartVisit.timingFactor}</span>
            </div>
            {smartVisit.calendarFactor && (
              <div className="flex items-start gap-1.5 text-neutral-400">
                <span className="text-neutral-500 shrink-0 font-medium">🕉️ Festival:</span>
                <span className="text-amber-300/90 leading-tight">{smartVisit.calendarFactor}</span>
              </div>
            )}
          </div>

          {/* Actionable Alternative Recommendation */}
          {smartVisit.alternativePandal && (
            <div className="mt-1 p-2 rounded-lg bg-neutral-950/80 border border-neutral-800 flex items-center justify-between gap-2">
              <div className="text-xs truncate">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                  Recommended Alternative
                </span>
                <span className="text-white font-medium truncate block">
                  {smartVisit.alternativePandal.name}
                </span>
                <span className="text-[10px] text-neutral-400">
                  {smartVisit.alternativePandal.crowdLevel} footfall
                  {smartVisit.alternativePandal.distanceMeters && ` • ${(smartVisit.alternativePandal.distanceMeters / 1000).toFixed(1)} km away`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const alt = pandals.find(p => p.id === smartVisit.alternativePandal?.id);
                  if (alt) {
                    setSelectedItem(alt);
                    if (onShowOnMap) onShowOnMap(alt);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors shrink-0"
              >
                Switch
              </button>
            </div>
          )}
        </div>
      )}

      {/* Nearest Metro Station Link (if available) */}
      {pandal.nearestMetro && (
        <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-sky-300 bg-sky-950/40 px-3 py-2 rounded-xl border border-sky-800/40">
          <div className="flex items-center gap-2 truncate">
            <Train className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-neutral-400 text-[11px]">Nearest Metro:</span>
            <span className="font-bold text-white truncate">{pandal.nearestMetro}</span>
          </div>
          {pandal.metroDistance && (
            <span className="text-sky-300/90 font-mono text-[11px] shrink-0 font-medium">
              {pandal.metroDistance}
            </span>
          )}
        </div>
      )}

      {/* Theme & Concept Presentation (if available) */}
      {(pandal.theme || pandal.themeDescription || pandal.description) && (
        <div className="mt-2.5 p-3 rounded-xl bg-gradient-to-br from-neutral-900/90 to-neutral-900/50 border border-amber-500/30">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Theme: {pandal.theme || 'Durga Puja Art Installation'}</span>
          </div>
          {pandal.themeDescription ? (
            <p className="text-xs text-neutral-300 leading-relaxed pl-5">
              {pandal.themeDescription}
            </p>
          ) : pandal.description ? (
            <p className="text-xs text-neutral-400 italic line-clamp-3 pl-5">
              "{pandal.description}"
            </p>
          ) : null}
        </div>
      )}

      {/* Best Visiting Period (if available) */}
      {bestPeriod && (
        <div className="mt-2.5 flex items-start gap-2 text-xs text-amber-200/90 bg-amber-950/30 p-2.5 rounded-xl border border-amber-800/40">
          <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <span className="font-bold text-amber-300 block mb-0.5 text-[11px] uppercase tracking-wider">
              Best Visiting Period
            </span>
            <span className="text-neutral-200">{bestPeriod}</span>
          </div>
        </div>
      )}

      {/* Entry & Exit Guidelines (if available) */}
      {(pandal.entryGuide || pandal.exitGuide) && (
        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {pandal.entryGuide && (
            <div className="p-2.5 rounded-xl bg-neutral-900/70 border border-neutral-800 text-neutral-300 flex items-start gap-2">
              <DoorOpen className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                  Entry Route
                </span>
                <span className="text-neutral-200 leading-snug">{pandal.entryGuide}</span>
              </div>
            </div>
          )}
          {pandal.exitGuide && (
            <div className="p-2.5 rounded-xl bg-neutral-900/70 border border-neutral-800 text-neutral-300 flex items-start gap-2">
              <DoorOpen className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-400 block tracking-wider">
                  Exit Route
                </span>
                <span className="text-neutral-200 leading-snug">{pandal.exitGuide}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Accessibility Status (if available) */}
      {Boolean(pandal.accessibility) && (
        <div className="mt-2.5 flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/30 px-3 py-2 rounded-xl border border-emerald-800/40">
          <Accessibility className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold text-emerald-200">Accessibility:</span>
          <span className="text-neutral-200 truncate">
            {typeof pandal.accessibility === 'string'
              ? pandal.accessibility
              : 'Wheelchair & elder-accessible premises'}
          </span>
        </div>
      )}

      {/* Festival Rituals & Timings Intelligence (if available for this pandal) */}
      {(() => {
        const festivalEvents = pujaCalendarService.getEventsForPandal(pandal.id || pandal.name);
        if (!festivalEvents || festivalEvents.length === 0) return null;

        return (
          <div className="mt-2.5 p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-amber-300">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Special Puja Rituals & Timings
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">Panjika Verified</span>
            </div>

            <div className="space-y-2">
              {festivalEvents.map((fest) => (
                <div key={fest.id} className="p-2 rounded-lg bg-neutral-950/70 border border-neutral-900 text-xs">
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="font-bold text-neutral-200">{fest.name}</span>
                    <span className="text-amber-400 font-mono text-[10px]">{fest.startTime} – {fest.endTime}</span>
                  </div>
                  {fest.bengaliName && (
                    <p className="text-[11px] text-amber-200/90 font-serif mb-1">{fest.bengaliName}</p>
                  )}
                  {fest.ritualNotes && (
                    <p className="text-[11px] text-neutral-300 leading-snug">{fest.ritualNotes}</p>
                  )}
                  <div className="mt-1 flex items-center justify-between text-[9px] text-neutral-500 font-mono">
                    <span>{fest.date}</span>
                    <span>{fest.source}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Organizer / Helpline / Official Website (if available) */}
      {(pandal.organizer || pandal.helpline || pandal.officialWebsite) && (
        <div className="mt-2.5 p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 text-xs flex flex-col gap-1.5">
          {pandal.organizer && (
            <div className="flex items-center gap-1.5 text-neutral-300 truncate">
              <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span className="text-neutral-400">Organizer:</span>
              <span className="font-medium text-neutral-200 truncate">{pandal.organizer}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {pandal.helpline && (
              <span className="flex items-center gap-1 text-neutral-400 truncate">
                <Phone className="w-3 h-3 text-neutral-500 shrink-0" />
                <span className="truncate">{pandal.helpline}</span>
              </span>
            )}
            {pandal.officialWebsite && (
              <a
                href={pandal.officialWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 flex items-center gap-1 shrink-0 ml-auto font-medium"
              >
                <Globe className="w-3 h-3" />
                Official Website
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Photo Gallery (if photos exist) */}
      {validPhotos.length > 0 && (
        <div className="mt-2.5">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {validPhotos.slice(0, 3).map((photoUrl, idx) => (
              <img
                key={idx}
                src={photoUrl}
                alt={`${name} pandal photo ${idx + 1}`}
                referrerPolicy="no-referrer"
                className="w-24 h-16 object-cover rounded-lg border border-neutral-800 shrink-0 shadow-sm"
              />
            ))}
          </div>
        </div>
      )}

      {/* Source Provenance & Last Verified Audit */}
      {(sourceNames.length > 0 || formattedLastVerified) && (
        <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-500 font-mono gap-2 flex-wrap">
          {sourceNames.length > 0 && (
            <div className="flex items-center gap-1 truncate">
              <Layers className="w-3 h-3 text-neutral-600 shrink-0" />
              <span className="text-neutral-600">Source:</span>
              <span className="truncate text-neutral-400">{sourceNames.join(' • ')}</span>
            </div>
          )}
          {formattedLastVerified && (
            <span className="text-neutral-500 shrink-0 ml-auto">
              Verified: {formattedLastVerified}
            </span>
          )}
        </div>
      )}

      {/* Primary Navigation & Map Actions */}
      <div className="mt-3.5 pt-2.5 border-t border-neutral-800/90 grid grid-cols-2 gap-2">
        {onShowOnMap && (
          <button
            onClick={() => onShowOnMap(pandal)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-semibold text-xs border border-neutral-700 transition-colors shadow-sm"
          >
            <MapPin className="w-3.5 h-3.5 text-primary" />
            SHOW ON MAP
          </button>
        )}

        {onNavigate && (
          <button
            onClick={() => onNavigate(pandal)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-primary hover:bg-primary/90 text-neutral-950 font-extrabold text-xs shadow-lg shadow-primary/20 transition-colors"
          >
            <Navigation className="w-3.5 h-3.5 text-neutral-950 fill-current" />
            NAVIGATE
          </button>
        )}
      </div>

      {/* Add to Tour Itinerary Action */}
      {onAddStop && (
        <button
          onClick={() => onAddStop(pandal)}
          disabled={isAddingStop}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 text-xs font-medium border border-neutral-800 transition-colors disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5 text-primary" />
          Add to Tour Itinerary
        </button>
      )}
    </GlassPanel>
  );
};
