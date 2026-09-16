import React, { useState } from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { MapPin, Sliders, Navigation, Users, Eye, Sparkles, RefreshCw, Plus, Check } from 'lucide-react';
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

  if (activeTab !== 'home') return null;

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

  const mapMovedDistance = mapCenter ? getDistance(discoveryCenter, mapCenter) : 0;
  const showSearchAreaBtn = mapMovedDistance > 150; // map panned more than 150m

  const handleSearchThisArea = () => {
    if (mapCenter) {
      setDiscoveryCenter(mapCenter);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitForm.name.trim()) return;

    submitUserPandal({
      name: submitForm.name,
      address: submitForm.address || 'User Discovered Location',
      area: submitForm.area || 'Kolkata',
      theme: submitForm.theme || 'Traditional Creative theme',
      description: submitForm.description || 'Community reported Durga Puja pandal.',
      crowdLevel: submitForm.crowdLevel,
      latitude: mapCenter?.lat || currentLocation.lat,
      longitude: mapCenter?.lng || currentLocation.lng,
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

  // Get Top 10 closest pandals
  const topPandals = [...pandals]
    .filter(p => p.zone !== 'EVENTS')
    .slice(0, 10);

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      
      {/* 1. Map-Based Search Overlay Button ("Search this area") */}
      {showSearchAreaBtn && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-auto transition-all duration-300">
          <button
            id="btn-search-this-area"
            onClick={handleSearchThisArea}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-neutral-900/90 hover:bg-neutral-800 text-white border border-neutral-800 rounded-full shadow-2xl text-xs font-bold uppercase tracking-wider transition-all hover:scale-[1.03] active:scale-[0.98]"
          >
            <MapPin size={13} className="text-indigo-400" />
            <span>Search This Area</span>
          </button>
        </div>
      )}

      {/* 2. Floating Dashboard Controls */}
      <div className="absolute bottom-20 left-4 right-4 pointer-events-auto md:w-96 md:bottom-24">
        <div className="bg-neutral-950/90 border border-neutral-900 rounded-2xl shadow-2xl overflow-hidden p-4 space-y-4">
          
          {/* Header & Status Indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isDiscovering ? 'bg-indigo-400' : 'bg-emerald-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isDiscovering ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
              </span>
              <p className="text-xs font-bold text-neutral-100 uppercase tracking-wide">
                {isDiscovering ? 'Searching Pandals...' : `${pandals.length} Pandals Discovered`}
              </p>
            </div>
            
            <div className="flex items-center space-x-1">
              <button
                id="btn-submit-pandal"
                onClick={() => setShowSubmitModal(true)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 transition-colors"
                title="Report Custom Pandal"
              >
                <Plus size={15} />
              </button>
              <button
                id="btn-refresh-discovery"
                onClick={triggerDiscovery}
                disabled={isDiscovering}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-indigo-400 hover:bg-neutral-900 transition-all disabled:opacity-50"
                title="Refresh nearby search"
              >
                <RefreshCw size={14} className={isDiscovering ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

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
                <option value="recommended">⭐ Recommended</option>
                <option value="nearest">📍 Nearest</option>
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

          {/* Inline Slider / Top 3 Discovered Highlights */}
          {topPandals.length > 0 && (
            <div className="space-y-2 border-t border-neutral-900 pt-3">
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Closest Discovered Pandals</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                {topPandals.map((pandal) => {
                  const distKm = pandal.distance ? (pandal.distance / 1000).toFixed(2) : '0';
                  // Driving duration approximation
                  const durationMins = pandal.distance ? Math.ceil((pandal.distance / 8.33) / 60) : 0;
                  
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
                          {pandal.estimatedTravelTime ? `${distKm} km • ${pandal.estimatedTravelTime}` : `${distKm} km • ${durationMins} mins travel`}
                        </p>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          pandal.crowdLevel === 'LOW' ? 'bg-emerald-500/10 text-emerald-400' :
                          pandal.crowdLevel === 'MODERATE' ? 'bg-blue-500/10 text-blue-400' :
                          pandal.crowdLevel === 'HEAVY' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {pandal.crowdLevel}
                        </span>

                        <button
                          id={`btn-hud-route-${pandal.id}`}
                          onClick={() => calculateRouteToItem(pandal)}
                          className="p-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                          title="Navigate"
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
            id="btn-hud-explore-mode"
            onClick={() => setActiveTab('explore')}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5"
          >
            <Sparkles size={13} />
            <span>Open Pandal Explorer 2.0</span>
          </button>
        </div>
      </div>

      {/* 3. Community Custom Pandal Submission Modal Overlay */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 pointer-events-auto z-50">
          <div className="w-full max-w-sm bg-neutral-950 border border-neutral-900 rounded-2xl p-5 shadow-2xl space-y-4">
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
          </div>
        </div>
      )}
    </div>
  );
};
