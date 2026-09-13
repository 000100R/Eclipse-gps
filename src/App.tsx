import React from 'react';
import { AppStateProvider, useAppState } from './hooks/AppStateProvider';
import { MapView } from './features/map/MapView';
import { LocationButton } from './features/map/LocationButton';
import { TopBar } from './components/layout/TopBar';
import { BottomNav } from './components/layout/BottomNav';
import { EclipseAIButton } from './features/ai/EclipseAIButton';
import { EclipseAIChat } from './features/ai/EclipseAIChat';
import { ExplorePandals } from './features/pandals/ExplorePandals';
import { DiscoveryHUD } from './features/pandals/DiscoveryHUD';
import { ExploreEvents } from './features/events/ExploreEvents';
import { RoutePlanner } from './features/navigation/RoutePlanner';
import { SavedItems } from './features/saved/SavedItems';
import { GroupPanel } from './features/groups/GroupPanel';
import { GlassPanel } from './components/ui/GlassPanel';
import { AlertTriangle, ShieldCheck, HelpCircle } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    activeTab,
    rerouteSuggestion,
    setRerouteSuggestion,
    acceptSmartReroute,
  } = useAppState();

  return (
    <div id="eclipse-gps-workspace" className="relative w-screen h-screen bg-neutral-950 text-neutral-200 overflow-hidden select-none font-sans">
      
      {/* 1. Core Map View Deck (Absolute Background Layer) */}
      <MapView />

      {/* 2. Floating GPS Coordinates & Watch Controllers */}
      <LocationButton />

      {/* 3. Top Mounted Search Decks and Alert Notifications */}
      <TopBar />

      {/* Pandal Discovery 2.0 HUD Overlay */}
      <DiscoveryHUD />

      {/* 4. Sliding Interactive Control Panel overlays (Explore, Routes, etc.) */}
      {activeTab !== 'home' && (
        <div
          id="sliding-control-panel"
          className="absolute inset-x-0 bottom-16 top-20 z-30 bg-neutral-950/90 backdrop-blur-md border-t border-neutral-900 px-4 py-4 overflow-y-auto custom-scrollbar md:bottom-20 md:top-24 md:left-4 md:right-auto md:w-96 md:rounded-2xl md:border md:border-neutral-800"
        >
          {activeTab === 'explore' && <ExplorePandals />}
          {activeTab === 'routes' && <RoutePlanner />}
          {activeTab === 'events' && <ExploreEvents />}
          {activeTab === 'saved' && <SavedItems />}
          {activeTab === 'group' && <GroupPanel />}
        </div>
      )}

      {/* 5. Floating AI Map Co-pilot Trigger Launcher */}
      <EclipseAIButton />

      {/* 6. AI Co-pilot Messaging Drawer */}
      <EclipseAIChat />

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
