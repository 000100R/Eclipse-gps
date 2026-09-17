import React from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { GlassPanel } from '../../components/ui/GlassPanel';
import {
  Navigation,
  Compass,
  MapPin,
  AlertTriangle,
  Loader2,
  RotateCw,
  ShieldCheck,
  Users,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export const LocationRequiredScreen: React.FC = () => {
  const {
    gpsStatus,
    gpsErrorMsg,
    permissionState,
    requestLocation,
    retryLocation,
  } = useAppState();

  const isRequesting = gpsStatus === 'requesting';
  const isDenied = gpsStatus === 'denied' || permissionState === 'denied';
  const isError = gpsStatus === 'error';
  // Permission is granted or requesting, but no valid GPS position fix yet
  const isWaitingForPosition = (permissionState === 'granted' || isRequesting || isError) && !isDenied;

  return (
    <div
      id="location-required-screen"
      className="fixed inset-0 z-50 bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto select-none"
    >
      {/* Ambient background glow & radar effect */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl opacity-60" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full border border-primary/20 animate-ping opacity-25 duration-1000" />
      </div>

      {/* Main Container Card */}
      <GlassPanel
        id="location-required-card"
        className="w-full max-w-lg p-6 sm:p-8 bg-neutral-900/95 border border-neutral-800/90 rounded-3xl shadow-2xl relative z-10 space-y-6 text-center"
      >
        {/* Brand & Radar Icon Header */}
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="relative flex items-center justify-center">
            {/* Concentric pulse rings */}
            <div className={`w-20 h-20 rounded-full flex items-center justify-center border transition-all ${
              isDenied
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                : isWaitingForPosition
                ? 'bg-sky-500/15 border-sky-500/40 text-sky-400'
                : 'bg-primary/15 border-primary/40 text-primary'
            }`}>
              {isRequesting ? (
                <Loader2 className="w-9 h-9 animate-spin text-primary" />
              ) : isDenied ? (
                <Lock className="w-9 h-9 text-rose-400" />
              ) : isError ? (
                <RotateCw className="w-9 h-9 text-amber-400" />
              ) : (
                <Compass className="w-10 h-10 text-primary animate-pulse" />
              )}
            </div>

            {/* Orbiting GPS tag */}
            <span
              id="location-status-badge"
              className={`absolute -bottom-2 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shadow-md ${
                isDenied
                  ? 'bg-rose-950/90 text-rose-300 border-rose-800'
                  : isWaitingForPosition
                  ? 'bg-sky-950/90 text-sky-300 border-sky-800'
                  : 'bg-neutral-950/90 text-primary border-primary/40'
              }`}
            >
              {isRequesting
                ? 'Acquiring GPS...'
                : isDenied
                ? 'Access Denied'
                : isWaitingForPosition
                ? 'Waiting for Location'
                : 'Access Required'}
            </span>
          </div>

          <div className="pt-2">
            <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
              Eclipse GPS • Strict Access Gate
            </span>
            <h1
              id="location-required-title"
              className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1 uppercase"
            >
              LOCATION ACCESS REQUIRED
            </h1>
          </div>
        </div>

        {/* Required Primary Message */}
        <div className="space-y-2 text-center bg-neutral-950/80 p-5 rounded-2xl border border-neutral-800/80">
          <p
            id="location-required-primary-message"
            className="text-base sm:text-lg font-bold text-neutral-100 leading-snug"
          >
            Eclipse GPS cannot be used without location access.
          </p>
          <p
            id="location-required-secondary-message"
            className="text-sm text-neutral-300 leading-relaxed"
          >
            Please enable location access to continue.
          </p>

          {/* Condition 8: If permission is granted but device cannot obtain valid GPS position */}
          {isWaitingForPosition && (
            <div
              id="waiting-for-location-banner"
              className="mt-3 pt-3 border-t border-neutral-800/80 flex flex-col items-center justify-center gap-1.5"
            >
              <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-wide">
                <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                <span>Waiting for your location...</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                {gpsErrorMsg || 'Acquiring high-accuracy real-time GPS coordinate fix from your device sensors.'}
              </p>
            </div>
          )}
        </div>

        {/* State-Specific Guidance if Denied */}
        {isDenied && (
          <div
            id="location-denied-guidance"
            className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200 text-left space-y-2"
          >
            <div className="flex items-center gap-1.5 font-bold text-rose-300 text-sm">
              <Lock className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Location permission is blocked</span>
            </div>
            <ol className="list-decimal list-inside text-[11px] text-rose-200/90 space-y-1 pl-1 leading-relaxed">
              <li>Click the lock or site settings icon in your browser address bar.</li>
              <li>Toggle <strong className="text-white">Location</strong> permission to <strong className="text-white">Allow</strong>.</li>
              <li>Tap <strong className="text-white">ENABLE LOCATION</strong> below to resume.</li>
            </ol>
          </div>
        )}

        {/* Core Features Dependent on GPS */}
        <div className="space-y-2 text-left">
          <span className="text-[10px] font-mono tracking-wider uppercase text-neutral-500 font-bold block">
            Why location is strictly mandatory
          </span>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800/70 flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-neutral-200 block">Pandal Discovery</span>
                <span className="text-neutral-500 text-[10px] leading-tight">Live distance from you</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800/70 flex items-start gap-2">
              <Navigation className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-neutral-200 block">Turn Navigation</span>
                <span className="text-neutral-500 text-[10px] leading-tight">Dynamic route guidance</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800/70 flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-neutral-200 block">Visited Pandals</span>
                <span className="text-neutral-500 text-[10px] leading-tight">Geofence auto check-in</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800/70 flex items-start gap-2">
              <Users className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-neutral-200 block">Puja Journey</span>
                <span className="text-neutral-500 text-[10px] leading-tight">Real-time journey tracking</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 space-y-2.5">
          {/* If waiting for location (permission granted or errored/retrying), provide RETRY button */}
          {isWaitingForPosition && !isRequesting ? (
            <button
              type="button"
              id="btn-retry-location"
              onClick={retryLocation}
              className="w-full py-3.5 px-5 rounded-2xl bg-primary hover:bg-primary/90 text-neutral-950 font-black text-sm tracking-wider uppercase shadow-xl shadow-primary/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
            >
              <RotateCw className="w-4 h-4 text-neutral-950" />
              <span>RETRY</span>
            </button>
          ) : (
            <button
              type="button"
              id="btn-enable-location"
              onClick={requestLocation}
              disabled={isRequesting}
              className="w-full py-3.5 px-5 rounded-2xl bg-primary hover:bg-primary/90 disabled:opacity-60 text-neutral-950 font-black text-sm tracking-wider uppercase shadow-xl shadow-primary/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
            >
              {isRequesting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
                  <span>Waiting for your location...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 text-neutral-950 fill-current" />
                  <span>ENABLE LOCATION</span>
                </>
              )}
            </button>
          )}

          {/* Secondary RETRY option if waiting or denied or error */}
          {(isDenied || isError) && (
            <button
              type="button"
              id="btn-secondary-retry"
              onClick={retryLocation}
              className="w-full py-2.5 px-4 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-white font-bold text-xs uppercase tracking-wider border border-neutral-700/80 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>RETRY</span>
            </button>
          )}
        </div>

        {/* Privacy Note */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-neutral-500 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/80" />
          <span>On-device processing • Real-time location is required to unlock app</span>
        </div>
      </GlassPanel>
    </div>
  );
};

