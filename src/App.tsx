import React, { useState, useEffect } from 'react';
import { AppStateProvider, useAppState } from './hooks/AppStateProvider';
import { MapView } from './features/map/MapView';
import { LocationButton } from './features/map/LocationButton';
import { TopBar } from './components/layout/TopBar';
import { BottomNav } from './components/layout/BottomNav';
import { EclipseAIButton } from './features/ai/EclipseAIButton';
import { EclipseAIChat } from './features/ai/EclipseAIChat';
import { EclipseCopilotUI } from './features/ai/EclipseCopilotUI';
import { ExplorePandals } from './features/pandals/ExplorePandals';
import { DiscoveryHUD } from './features/pandals/DiscoveryHUD';
import { ExploreEvents } from './features/events/ExploreEvents';
import { RoutePlanner } from './features/navigation/RoutePlanner';
import { LiveNavigationHUD } from './features/navigation/LiveNavigationHUD';
import { RouteAlternativesBar } from './features/navigation/RouteAlternativesBar';
import { SavedItems } from './features/saved/SavedItems';
import { VisitedPandalsView } from './features/visited/VisitedPandalsView';
import { MyPujaJourney } from './features/journey/MyPujaJourney';
import { GroupPanel } from './features/groups/GroupPanel';
import { LocationRequiredScreen } from './features/location/LocationRequiredScreen';
import { GlassPanel } from './components/ui/GlassPanel';
import { AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';

const AppContent: React.FC = () => {
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  const {
    hasValidGps,
    currentLocation,
    gpsStatus,
    activeTab,
    isCalculatingRoute,
    routingError,
    clearRoutingError,
    rerouteSuggestion,
    setRerouteSuggestion,
    acceptSmartReroute,
    isNavigating,
    activeRoute,
  } = useAppState();

  // If valid GPS position is not acquired or permission is not granted, enforce full-screen Location Required state
  if (!hasValidGps || !currentLocation || gpsStatus === 'prompt' || gpsStatus === 'requesting' || gpsStatus === 'denied') {
    return <LocationRequiredScreen />;
  }

  return (
    <div id="eclipse-gps-workspace" className="relative w-screen h-screen bg-neutral-950 text-neutral-200 overflow-hidden select-none font-sans">
      {/* Google Maps Platform Quota Exceeded Notification Banner */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm pointer-events-auto">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      
      {/* 1. Core Map View Deck (Absolute Background Layer) */}
      <MapView />

      {/* 2. Floating GPS Coordinates & Watch Controllers */}
      <LocationButton />

      {/* 3. Top Mounted Search Decks and Alert Notifications (Active when NOT navigating) */}
      {!isNavigating && <TopBar />}

      {/* 4. ACTIVE NAVIGATION SYSTEM: Fixed at top level, high z-index, safe-area inset aware */}
      {isNavigating && activeRoute && (
        <div
          id="active-navigation-deck"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.65rem)' }}
          className="fixed left-3 right-3 sm:left-4 sm:right-4 z-40 max-w-lg mx-auto pointer-events-auto space-y-2"
        >
          <LiveNavigationHUD />
          {activeRoute.alternatives && activeRoute.alternatives.length > 0 && (
            <RouteAlternativesBar />
          )}
        </div>
      )}

      {/* Route Preview Alternatives (when route is calculated but before active navigation is started) */}
      {!isNavigating && activeRoute && activeRoute.alternatives && activeRoute.alternatives.length > 0 && (
        <div
          id="preview-route-alternatives"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 4.5rem)' }}
          className="fixed left-3 right-3 sm:left-4 sm:right-4 z-40 max-w-lg mx-auto pointer-events-auto"
        >
          <RouteAlternativesBar />
        </div>
      )}

      {/* Route Calculation Progress Indicator */}
      {isCalculatingRoute && (
        <div
          id="route-calculating-banner"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 4.5rem)' }}
          className="fixed left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-indigo-950/95 border border-indigo-500/50 rounded-full shadow-2xl flex items-center space-x-2.5 text-indigo-200 text-xs font-semibold backdrop-blur-md whitespace-nowrap"
        >
          <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <span>Calculating route...</span>
        </div>
      )}

      {/* Routing Error Notice */}
      {routingError && (
        <div
          id="route-error-banner"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 4.5rem)' }}
          className="fixed left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-rose-950/95 border border-rose-500/50 rounded-2xl shadow-2xl flex items-center space-x-2.5 text-rose-200 text-xs font-semibold backdrop-blur-md max-w-[90vw]"
        >
          <AlertTriangle size={15} className="text-rose-400 shrink-0" />
          <span className="truncate">{routingError}</span>
          <button onClick={clearRoutingError} className="ml-2 text-rose-400 hover:text-white font-bold text-xs p-1">✕</button>
        </div>
      )}

      {/* Pandal Discovery 2.0 HUD Overlay */}
      <DiscoveryHUD />

      {/* 4. Sliding Interactive Control Panel overlays (Explore, Routes, etc.) */}
      {activeTab !== 'home' && (
        <div
          id="sliding-control-panel"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 4.25rem)',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 3.75rem)',
          }}
          className="fixed inset-x-0 z-30 bg-neutral-950/95 backdrop-blur-md border-t border-neutral-900 px-3.5 sm:px-4 py-3 sm:py-4 overflow-y-auto custom-scrollbar md:bottom-20 md:top-24 md:left-4 md:right-auto md:w-96 md:rounded-2xl md:border md:border-neutral-800 shadow-2xl"
        >
          {activeTab === 'explore' && <ExplorePandals />}
          {activeTab === 'routes' && <RoutePlanner />}
          {activeTab === 'events' && <ExploreEvents />}
          {activeTab === 'saved' && <SavedItems />}
          {activeTab === 'visited' && <VisitedPandalsView />}
          {activeTab === 'journey' && <MyPujaJourney />}
          {activeTab === 'group' && <GroupPanel />}
        </div>
      )}

      {/* 5. Floating AI Map Co-pilot Trigger Launcher */}
      <EclipseAIButton />

      {/* 6. AI Co-pilot Messaging Drawer */}
      <EclipseAIChat />

      {/* Eclipse Copilot Core UI Panel */}
      <EclipseCopilotUI />

      {/* 7. Bottom Navigation Tab Selectors */}
      <BottomNav />

      {/* 8. Smart Rerouting Interceptor Modal */}
      {rerouteSuggestion && rerouteSuggestion.show && (
        <div id="smart-reroute-overlay" className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <GlassPanel className="w-full max-w-sm p-5 border-t-4 border-t-indigo-500 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2.5 text-indigo-400">
              <AlertTriangle className="animate-bounce" size={20} />
              <span className="text-xs font-bold uppercase tracking-wider">Smart Rerouting Alert</span>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              {rerouteSuggestion.reason || 'We detected a major crowd buildup along your path. We suggest taking a diversion.'}
            </p>

            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-900 text-xs">
              <p className="text-neutral-500 font-bold uppercase text-[9px] tracking-wider">Diversion Proposal</p>
              <div className="flex items-center space-x-2 mt-1.5 font-semibold text-neutral-200">
                <span className="line-through text-neutral-600">Sreebhumi</span>
                <span className="text-indigo-400">➔</span>
                <span className="text-indigo-400">{rerouteSuggestion.replacementName}</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3.5 border-t border-neutral-900 pt-3.5">
              <button
                id="btn-smart-reroute-decline"
                onClick={() => setRerouteSuggestion(null)}
                className="text-xs font-bold text-neutral-500 hover:text-neutral-300 uppercase tracking-wider"
              >
                Ignore
              </button>
              <button
                id="btn-smart-reroute-accept"
                onClick={acceptSmartReroute}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition-transform hover:scale-[1.02]"
              >
                Reroute Path
              </button>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  );
}
