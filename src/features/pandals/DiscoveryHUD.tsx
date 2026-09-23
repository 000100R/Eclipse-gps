import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppState } from '../../hooks/AppStateProvider';
import { MapPin, Sliders, Navigation, Users, Eye, Sparkles, RefreshCw, Plus, Check, ChevronUp, ChevronDown, Search, ArrowRight, X } from 'lucide-react';
import { Pandal } from '../../types';

export const DiscoveryHUD: React.FC = () => {
  const {
    currentLocation,
    pandals,
    activeTab,
    setActiveTab,
    discoveryRadius,
    setDiscoveryRadius,
    discoverySort,
    setDiscoverySort,
    discoveryCenter,
    setDiscoveryCenter,
    mapCenter,
    isDiscovering,
    triggerDiscovery,
    calculateRouteToItem,
    submitUserPandal,
    setSelectedItem,
    gpsStatus,
    gpsErrorMsg,
    visitedIds,
    isNavigating,
    stopNavigation,
    selectedItem,
    activeRoute,
    routeStops,
  } = useAppState();

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    name: '',
    address: '',
    area: '',
    theme: '',
    description: '',
    crowdLevel: 'LOW' as 'LOW' | 'MODERATE' | 'HEAVY' | 'EXTREME',
  });

  // Mobile-responsive compact vs expanded state for Pandal Explorer 2.0
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('eclipse_pandal_explorer_expanded');
      if (saved !== null) return saved === 'true';
      // Default expanded on larger screens, compact bar on mobile devices to preserve map space
      return window.innerWidth >= 768;
    }
    return false;
  });

  // Navigation companion state for Pandal Explorer 2.0 during active navigation
  const [isNavCompanionOpen, setIsNavCompanionOpen] = useState(false);
  const [pandalToReplace, setPandalToReplace] = useState<Pandal | null>(null);
  const [navSearchQuery, setNavSearchQuery] = useState('');
  const [navSortMethod, setNavSortMethod] = useState<'nearest' | 'least_crowded'>('nearest');

  // Destination name during navigation for replacement prompt
  const currentNavDestinationName = useMemo(() => {
    if (routeStops && routeStops.length > 0) {
      return routeStops[routeStops.length - 1]?.name || 'Current Destination';
    }
    if (activeRoute?.name) {
      return activeRoute.name.replace(/^Route to\s+/i, '');
    }
    return 'Current Destination';
  }, [routeStops, activeRoute]);

  // Filtered pandals for the navigation companion
  const navFilteredPandals = useMemo(() => {
    let list = [...pandals].filter(p => p.zone !== 'EVENTS');
    if (navSearchQuery.trim()) {
      const q = navSearchQuery.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.area && p.area.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q))
      );
    }
    if (navSortMethod === 'nearest') {
      list.sort((a, b) => (a.distance ?? 999999) - (b.distance ?? 999999));
    } else if (navSortMethod === 'least_crowded') {
      const crowdScore: Record<string, number> = { LOW: 1, MODERATE: 2, HIGH: 3, HEAVY: 3, EXTREME: 4 };
      list.sort((a, b) => (crowdScore[a.crowdLevel || 'MODERATE'] ?? 2) - (crowdScore[b.crowdLevel || 'MODERATE'] ?? 2));
    }
    return list;
  }, [pandals, navSearchQuery, navSortMethod]);

  // Automatically open replacement prompt if user taps a pandal marker on the map during active navigation
  useEffect(() => {
    if (isNavigating && selectedItem) {
      setPandalToReplace(selectedItem as Pandal);
    }
  }, [isNavigating, selectedItem]);

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('eclipse_pandal_explorer_expanded', String(next));
      }
      return next;
    });
  };

  // Only visible on home tab when not actively navigating and not inspecting an individual item card
  const isVisible = activeTab === 'home' && !isNavigating && !selectedItem;

  // Calculate distance between discovery center and map center to see if "Search this area" button is needed
  const getDistance = (p1: any, p2: any) => {
    if (!p1 || !p2) return 0;
    const R = 6371e3; // meters
    const phi1 = (p1.lat * Math.PI) / 180;
    const phi2 = (p2.lat * Math.PI) / 180;
    const deltaPhi = ((p2.lat - p1.lat) * Math.PI) / 180;
    const deltaLambda = ((p2.lng - p1.lng) * Math.PI) / 180;
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const mapMovedDistance = (mapCenter && discoveryCenter) ? getDistance(discoveryCenter, mapCenter) : 0;
  const showSearchAreaBtn = mapMovedDistance > 150; // map panned more than 150m

  const handleSearchThisArea = () => {
    if (mapCenter) {
      setDiscoveryCenter(mapCenter);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitForm.name.trim()) return;

    const lat = mapCenter?.lat ?? currentLocation?.lat ?? 0;
    const lng = mapCenter?.lng ?? currentLocation?.lng ?? 0;

    submitUserPandal({
      name: submitForm.name,
      address: submitForm.address || 'User Discovered Location',
      area: submitForm.area || 'Kolkata',
      theme: submitForm.theme || 'Traditional Creative theme',
      description: submitForm.description || 'Community reported Durga Puja pandal.',
      crowdLevel: submitForm.crowdLevel,
      latitude: lat,
      longitude: lng,
    });

    setShowSubmitModal(false);
    setSubmitForm({
      name: '',
      address: '',
      area: '',
      theme: '',
      description: '',
      crowdLevel: 'LOW',
    });
  };

  // Discovered pandals sorted by live GPS distance
  const livePandals = useMemo(() => {
    const list = [...pandals].filter(p => p.zone !== 'EVENTS');
    if (discoverySort === 'nearest' && currentLocation) {
      return list
        .map(p => {
          const liveDist = Math.round(getDistance(currentLocation, p.location));
          return { ...p, distance: liveDist };
        })
        .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
    }
    if (discoverySort === 'nearest') {
      return list.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
    }
    return list;
  }, [pandals, currentLocation, discoverySort]);

  return (
    <div className="fixed inset-0 pointer-events-none z-30">
      {/* 1. Map-Based Search Overlay Button ("Search this area") */}
      <AnimatePresence>
        {isVisible && showSearchAreaBtn && (
          <motion.div
            key="discovery-search-this-area-btn"
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-auto"
          >
            <button
              id="btn-search-this-area"
              onClick={handleSearchThisArea}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-neutral-900/90 hover:bg-neutral-800 text-white border border-neutral-800 rounded-full shadow-2xl text-xs font-bold uppercase tracking-wider transition-all hover:scale-[1.03] active:scale-[0.98]"
            >
              <MapPin size={13} className="text-indigo-400" />
              <span>Search This Area</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Floating Dashboard Controls: Collapsible Pandal Explorer 2.0 */}
      <AnimatePresence mode="wait">
        {isVisible && (
          isExpanded ? (
            /* Expanded Pandal Explorer 2.0 Panel */
            <motion.div
              key="discovery-hud-expanded"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-20 left-3 right-3 sm:left-4 sm:right-4 pointer-events-auto md:w-96 md:bottom-24 z-30"
            >
              <div className="bg-neutral-950/95 border border-neutral-850 rounded-2xl shadow-2xl overflow-hidden p-3.5 sm:p-4 space-y-3.5 backdrop-blur-md max-h-[calc(100vh-140px)] sm:max-h-[75vh] flex flex-col">
                
                {/* Header & Status Indicator + Show/Hide Toggle */}
                <div className="flex items-center justify-between border-b border-neutral-900/90 pb-2.5 shrink-0">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isDiscovering ? 'bg-indigo-400' : 'bg-emerald-400'} opacity-75`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isDiscovering ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-neutral-100 uppercase tracking-wide truncate">
                        {isDiscovering ? 'Searching Pandals...' : `${pandals.length} Pandals Discovered`}
                      </p>
                      <span className="text-[9px] text-neutral-500 font-mono block truncate">Pandal Explorer 2.0</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      id="btn-submit-pandal"
                      onClick={() => setShowSubmitModal(true)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 transition-colors"
                      title="Report Custom Pandal"
                      aria-label="Report Custom Pandal"
                    >
                      <Plus size={15} />
                    </button>
                    <button
                      type="button"
                      id="btn-refresh-discovery"
                      onClick={triggerDiscovery}
                      disabled={isDiscovering}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-indigo-400 hover:bg-neutral-900 transition-all disabled:opacity-50"
                      title="Refresh nearby search"
                      aria-label="Refresh nearby search"
                    >
                      <RefreshCw size={14} className={isDiscovering ? 'animate-spin' : ''} />
                    </button>

                    {/* Clear Hide Toggle Button */}
                    <button
                      type="button"
                      id="btn-toggle-pandal-explorer-hide"
                      onClick={toggleExpanded}
                      className="flex items-center space-x-1 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-750 text-neutral-300 hover:text-white border border-neutral-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer touch-manipulation ml-0.5"
                      title="Hide Pandal Explorer (Expand Map)"
                      aria-label="Hide Pandal Explorer"
                    >
                      <span>Hide</span>
                      <ChevronDown size={14} className="stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {/* Scrollable Body for small screens */}
                <div className="space-y-3.5 overflow-y-auto custom-scrollbar pr-0.5 overscroll-contain">
                  {/* Discovery Settings Panel */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Radius Control */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Search Radius</label>
                      <select
                        id="select-discovery-radius"
                        value={discoveryRadius}
                        onChange={(e) => setDiscoveryRadius(Number(e.target.value))}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2 py-1.5 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value={1}>1 km (Within walking)</option>
                        <option value={2}>2 km (Close drive)</option>
                        <option value={5}>5 km (Standard area)</option>
                        <option value={10}>10 km (Wider city)</option>
                      </select>
                    </div>

                    {/* Sorting control */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Sort Method</label>
                      <select
                        id="select-discovery-sort"
                        value={discoverySort}
                        onChange={(e) => setDiscoverySort(e.target.value as any)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2 py-1.5 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="nearest">📍 Nearest First</option>
                        <option value="recommended">⭐ Recommended</option>
                        <option value="least_crowded">👥 Least Crowded</option>
                        <option value="fastest">🚗 Fastest Travel</option>
                      </select>
                    </div>
                  </div>

                  {/* GPS Status Notification */}
                  {(gpsStatus === 'denied' || gpsStatus === 'error') && (
                    <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl px-2.5 py-1.5 text-[11px] text-amber-200/90 flex items-start gap-1.5">
                      <span className="text-amber-400 font-bold shrink-0">⚠️</span>
                      <span>
                        {gpsErrorMsg || 'GPS location is unavailable. Results are relative to current map center.'}
                      </span>
                    </div>
                  )}

                  {/* Inline List / All Discovered Pandals */}
                  {livePandals.length > 0 && (
                    <div className="space-y-2 border-t border-neutral-900 pt-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Discovered Durga Puja Pandals</p>
                        <span className="text-[9px] text-indigo-400 font-mono font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">{livePandals.length} discovered</span>
                      </div>
                      <div className="space-y-1.5 max-h-48 sm:max-h-56 overflow-y-auto custom-scrollbar overscroll-contain">
                        {livePandals.map((pandal) => {
                          const distFormatted = pandal.distance !== undefined
                            ? pandal.distance < 1000
                              ? `${pandal.distance} m`
                              : `${(pandal.distance / 1000).toFixed(1)} km`
                            : 'Distance calculating...';

                          const durationMins = pandal.distance ? Math.ceil((pandal.distance / 8.33) / 60) : 0;
                          const travelInfo = pandal.estimatedTravelTime
                            ? `${distFormatted} • ${pandal.estimatedTravelTime}`
                            : `${distFormatted} • ${durationMins} mins travel`;
                          
                          return (
                            <div
                              key={pandal.id}
                              id={`nearby-pandal-hud-item-${pandal.id}`}
                              className="flex items-center justify-between p-2 rounded-xl bg-neutral-900/60 hover:bg-neutral-900 transition-colors border border-neutral-900/40"
                            >
                              <div
                                className="flex-1 cursor-pointer min-w-0"
                                onClick={() => setSelectedItem(pandal)}
                              >
                                <div className="flex items-center space-x-1.5 flex-wrap">
                                  <p className="text-xs font-semibold text-neutral-200 truncate">{pandal.name}</p>
                                  {visitedIds.includes(pandal.id) && (
                                    <span className="text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1 py-0.5 rounded uppercase font-bold flex items-center gap-0.5">
                                      VISITED
                                    </span>
                                  )}
                                  {!pandal.verified && (
                                    <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 py-0.5 rounded uppercase font-bold">Unverified</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-neutral-400 mt-0.5">
                                  {travelInfo}
                                </p>
                              </div>

                              <div className="flex items-center space-x-1.5 shrink-0">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                                  pandal.crowdLevel === 'LOW' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  pandal.crowdLevel === 'MODERATE' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                  pandal.crowdLevel === 'HIGH' || pandal.crowdLevel === 'HEAVY' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                  pandal.crowdLevel === 'EXTREME' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse' :
                                  'bg-neutral-800 text-neutral-400 border-neutral-700'
                                }`}>
                                  {pandal.crowdLevel && pandal.crowdLevel !== 'UNAVAILABLE' ? pandal.crowdLevel : 'Crowd unavailable'}
                                </span>

                                <button
                                  type="button"
                                  id={`btn-hud-route-${pandal.id}`}
                                  onClick={() => calculateRouteToItem(pandal)}
                                  className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white transition-colors cursor-pointer"
                                  title="Navigate"
                                  aria-label={`Navigate to ${pandal.name}`}
                                >
                                  <Navigation size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Explore Button */}
                  <button
                    type="button"
                    id="btn-hud-explore-mode"
                    onClick={() => setActiveTab('explore')}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs rounded-xl uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 shadow-lg shadow-indigo-600/20 cursor-pointer shrink-0"
                  >
                    <Sparkles size={13} />
                    <span>Open Pandal Explorer 2.0</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Collapsed Compact Bar (Max Map Space for Mobile) */
            <motion.div
              key="discovery-hud-collapsed"
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-20 left-3 right-3 sm:left-4 sm:right-4 pointer-events-auto md:w-96 md:bottom-24 z-20"
            >
              <div
                id="pandal-explorer-collapsed-bar"
                onClick={toggleExpanded}
                className="group bg-neutral-950/92 hover:bg-neutral-950 border border-neutral-850 hover:border-neutral-700/80 rounded-2xl shadow-2xl px-3.5 py-2.5 backdrop-blur-md flex items-center justify-between gap-2.5 transition-all cursor-pointer active:scale-[0.99] touch-manipulation"
                role="button"
                aria-expanded={false}
                aria-label="Expand Pandal Explorer 2.0"
              >
                {/* Status & Nearest info */}
                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isDiscovering ? 'bg-indigo-400' : 'bg-emerald-400'} opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isDiscovering ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-bold text-neutral-100 tracking-wide uppercase truncate">
                        Pandal Explorer 2.0
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 shrink-0">
                        {livePandals.length}
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                      {livePandals.length > 0 && livePandals[0].distance !== undefined
                        ? `Nearest: ${livePandals[0].name} (${livePandals[0].distance < 1000 ? `${livePandals[0].distance} m` : `${(livePandals[0].distance / 1000).toFixed(1)} km`})`
                        : isDiscovering
                        ? 'Scanning nearby pandals...'
                        : `${livePandals.length} pandals discovered`}
                    </p>
                  </div>
                </div>

                {/* Actions: Refresh + Show toggle button */}
                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    type="button"
                    id="btn-refresh-discovery-collapsed"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerDiscovery();
                    }}
                    disabled={isDiscovering}
                    className="p-2 rounded-xl text-neutral-400 hover:text-indigo-400 hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-all disabled:opacity-50 cursor-pointer"
                    title="Refresh nearby search"
                    aria-label="Refresh pandal search"
                  >
                    <RefreshCw size={13} className={isDiscovering ? 'animate-spin' : ''} />
                  </button>

                  <button
                    type="button"
                    id="btn-toggle-pandal-explorer-show"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded();
                    }}
                    className="flex items-center space-x-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer touch-manipulation"
                    title="Show Pandal Explorer 2.0"
                    aria-label="Show Pandal Explorer"
                  >
                    <span>Show</span>
                    <ChevronUp size={14} className="stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>

      {/* 3. Community Custom Pandal Submission Modal Overlay */}
      <AnimatePresence>
        {showSubmitModal && (
          <motion.div
            key="submit-pandal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 pointer-events-auto z-50"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-sm bg-neutral-950 border border-neutral-900 rounded-2xl p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                <h3 className="font-bold text-neutral-100 text-sm tracking-wide">Report Nearby Pandal</h3>
                <button
                  id="btn-close-pandal-submit"
                  onClick={() => setShowSubmitModal(false)}
                  className="text-xs text-neutral-500 hover:text-neutral-200"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Pandal Name *</label>
                  <input
                    type="text"
                    required
                    value={submitForm.name}
                    onChange={(e) => setSubmitForm({ ...submitForm, name: e.target.value })}
                    placeholder="e.g. Deshapriya Park"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Address / Area</label>
                  <input
                    type="text"
                    value={submitForm.address}
                    onChange={(e) => setSubmitForm({ ...submitForm, address: e.target.value })}
                    placeholder="e.g. Kalighat, Kolkata"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Creative Theme</label>
                  <input
                    type="text"
                    value={submitForm.theme}
                    onChange={(e) => setSubmitForm({ ...submitForm, theme: e.target.value })}
                    placeholder="e.g. Eco-friendly traditional clay art"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Crowd Status Estimate</label>
                  <select
                    value={submitForm.crowdLevel}
                    onChange={(e) => setSubmitForm({ ...submitForm, crowdLevel: e.target.value as any })}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-2 text-neutral-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="LOW">🟢 Low Queue (Under 10m)</option>
                    <option value="MODERATE">🟡 Moderate (10m - 25m)</option>
                    <option value="HEAVY">🟠 Heavy Crowd (25m - 50m)</option>
                    <option value="EXTREME">🔴 Extreme Crowd (50m+)</option>
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    id="btn-submit-pandal-confirm"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-1.5"
                  >
                    <Check size={14} />
                    <span>Report Location</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Pandal Explorer 2.0 During Active Navigation */}
      <AnimatePresence mode="wait">
        {activeTab === 'home' && isNavigating && (
          !isNavCompanionOpen ? (
            /* Compact Dock during navigation - Fixed safe area above bottom nav bar */
            <motion.div
              key="nav-pandal-explorer-dock-compact"
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              style={{
                bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.5rem)',
                left: '0.75rem',
              }}
              className="fixed z-30 pointer-events-auto max-w-[calc(100vw-6.5rem)] sm:max-w-xs md:w-84"
            >
              <div
                id="nav-pandal-explorer-compact-dock"
                onClick={() => setIsNavCompanionOpen(true)}
                className="bg-neutral-950/95 hover:bg-neutral-900 border border-neutral-800 hover:border-indigo-500/60 rounded-2xl shadow-2xl px-3.5 py-2.5 backdrop-blur-md flex items-center justify-between gap-2.5 transition-all cursor-pointer active:scale-98 touch-manipulation group min-h-[46px]"
                role="button"
                aria-expanded={false}
                aria-label="Open Pandal Explorer while navigating"
              >
                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-bold text-neutral-100 tracking-wide uppercase truncate">
                        Pandal Explorer 2.0
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                        {pandals.length}
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                      {livePandals.length > 0 && livePandals[0].distance !== undefined
                        ? `Nearby: ${livePandals[0].name} (${livePandals[0].distance < 1000 ? `${livePandals[0].distance} m` : `${(livePandals[0].distance / 1000).toFixed(1)} km`})`
                        : 'Tap to browse pandals & switch'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/90 border border-indigo-800/80 px-2.5 py-1.5 rounded-xl flex items-center space-x-1 shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <span>Browse</span>
                    <ChevronUp size={13} />
                  </span>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Expanded Navigation Companion Drawer - Fixed safe area */
            <motion.div
              key="nav-pandal-explorer-drawer-expanded"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{
                bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.5rem)',
                left: '0.75rem',
              }}
              className="fixed z-35 pointer-events-auto w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm"
            >
              <div className="bg-neutral-950/95 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden p-3.5 sm:p-4 space-y-3 backdrop-blur-md max-h-[calc(100vh-14rem)] sm:max-h-[60vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-neutral-900/90 pb-2.5 shrink-0">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="p-1 rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-400 shrink-0">
                      <Sparkles size={14} />
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-neutral-100 uppercase tracking-wide truncate">
                        Pandal Explorer 2.0
                      </h4>
                      <p className="text-[10px] text-neutral-400 truncate">
                        Browse nearby or switch active destination
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    id="btn-nav-companion-minimize"
                    onClick={() => setIsNavCompanionOpen(false)}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer touch-manipulation"
                    title="Minimize companion"
                  >
                    <span>Hide</span>
                    <ChevronDown size={13} />
                  </button>
                </div>

                {/* Quick Search & Filter Controls */}
                <div className="space-y-2 shrink-0">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      id="nav-companion-search"
                      value={navSearchQuery}
                      onChange={(e) => setNavSearchQuery(e.target.value)}
                      placeholder="Search pandals to switch to..."
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    {navSearchQuery && (
                      <button
                        onClick={() => setNavSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 text-[10px]">
                    <span className="text-neutral-500 font-bold uppercase tracking-wider">Sort:</span>
                    <button
                      type="button"
                      onClick={() => setNavSortMethod('nearest')}
                      className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        navSortMethod === 'nearest'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                      }`}
                    >
                      📍 Nearest
                    </button>
                    <button
                      type="button"
                      onClick={() => setNavSortMethod('least_crowded')}
                      className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        navSortMethod === 'least_crowded'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                      }`}
                    >
                      👥 Least Crowded
                    </button>
                  </div>
                </div>

                {/* Scrollable Pandals List */}
                <div className="space-y-1.5 overflow-y-auto custom-scrollbar pr-0.5 flex-1 overscroll-contain">
                  {navFilteredPandals.length === 0 ? (
                    <div className="py-6 text-center text-xs text-neutral-500">
                      No matching pandals found.
                    </div>
                  ) : (
                    navFilteredPandals.map((pandal) => {
                      const distKm = pandal.distance ? (pandal.distance / 1000).toFixed(2) : '0';
                      return (
                        <div
                          key={pandal.id}
                          id={`nav-companion-item-${pandal.id}`}
                          className="flex items-center justify-between p-2 rounded-xl bg-neutral-900/60 hover:bg-neutral-900 transition-colors border border-neutral-900/40 gap-2"
                        >
                          <div
                            className="flex-1 cursor-pointer min-w-0"
                            onClick={() => setPandalToReplace(pandal)}
                          >
                            <p className="text-xs font-semibold text-neutral-200 truncate">{pandal.name}</p>
                            <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                              {distKm} km away • {pandal.area || 'Kolkata'}
                            </p>
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                              pandal.crowdLevel === 'LOW' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              pandal.crowdLevel === 'MODERATE' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              pandal.crowdLevel === 'HIGH' || pandal.crowdLevel === 'HEAVY' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                              pandal.crowdLevel === 'EXTREME' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                              'bg-neutral-800 text-neutral-400 border-neutral-700'
                            }`}>
                              {pandal.crowdLevel || 'Normal'}
                            </span>

                            <button
                              type="button"
                              id={`btn-nav-switch-to-${pandal.id}`}
                              onClick={() => setPandalToReplace(pandal)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider transition-all shadow-sm cursor-pointer touch-manipulation flex items-center space-x-1"
                              title="Switch navigation to this pandal"
                            >
                              <span>Switch</span>
                              <ArrowRight size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>

      {/* Destination Replacement Confirmation Modal */}
      {pandalToReplace && (
        <div
          id="modal-replace-destination"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 pointer-events-auto"
          onClick={() => {
            setPandalToReplace(null);
            setSelectedItem(null);
          }}
        >
          <div
            className="w-full max-w-sm bg-neutral-950 border border-indigo-500/50 rounded-2xl p-4 shadow-2xl space-y-3.5 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="replace-dest-title"
          >
            <div className="flex items-center space-x-2 text-indigo-400">
              <div className="p-2 rounded-xl bg-indigo-950/80 border border-indigo-800/80 shrink-0">
                <Navigation size={20} className="text-indigo-400" />
              </div>
              <div className="min-w-0">
                <h4 id="replace-dest-title" className="text-sm font-bold text-white">Navigate to this pandal instead?</h4>
                <p className="text-[11px] text-neutral-400">Switch active navigation destination</p>
              </div>
            </div>

            <div className="space-y-2 p-3 bg-neutral-900/80 rounded-xl border border-neutral-800 text-xs">
              <div className="flex items-center justify-between text-neutral-400 text-[11px]">
                <span className="shrink-0">Current Destination:</span>
                <span className="font-semibold text-neutral-300 truncate max-w-[160px] text-right">
                  {currentNavDestinationName}
                </span>
              </div>
              <div className="h-px bg-neutral-800" />
              <div className="flex items-center justify-between text-indigo-300 font-bold">
                <span className="shrink-0">New Destination:</span>
                <span className="text-white truncate max-w-[160px] text-right">
                  {pandalToReplace.name}
                </span>
              </div>
              {pandalToReplace.distance !== undefined && (
                <div className="flex items-center justify-between text-neutral-400 text-[11px]">
                  <span>Distance:</span>
                  <span className="font-mono text-neutral-300">
                    {(pandalToReplace.distance / 1000).toFixed(2)} km away
                  </span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-neutral-300 leading-relaxed">
              Navigation will immediately end the current route and calculate a fresh turn-by-turn route to <strong className="text-white">{pandalToReplace.name}</strong> from your current GPS location.
            </p>

            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                id="btn-cancel-replace-dest"
                onClick={() => {
                  setPandalToReplace(null);
                  setSelectedItem(null);
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-colors cursor-pointer touch-manipulation"
              >
                Keep Current
              </button>
              <button
                type="button"
                id="btn-confirm-replace-dest"
                onClick={() => {
                  const target = pandalToReplace;
                  setPandalToReplace(null);
                  setSelectedItem(null);
                  setIsNavCompanionOpen(false);
                  stopNavigation();
                  calculateRouteToItem(target);
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer touch-manipulation flex items-center justify-center space-x-1"
              >
                <span>Switch & Navigate</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
