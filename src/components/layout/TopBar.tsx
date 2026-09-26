import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { Search, Bell, AlertTriangle, X, Compass, MapPin, Sparkles } from 'lucide-react';
import { GlassPanel } from '../ui/GlassPanel';
import { calculateBengaliDate } from '../../services/panjika/bengaliAstronomicalService';

export const TopBar: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    executeSearch,
    setSelectedItem,
    alerts,
    openPanjika,
  } = useAppState();

  const todayBengali = useMemo(() => calculateBengaliDate(new Date()), []);

  const [inputVal, setInputVal] = useState(searchQuery);
  const [showResults, setShowResults] = useState(false);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);

  // Sync state with searchQuery if changed externally (e.g. by AI action)
  useEffect(() => {
    setInputVal(searchQuery);
  }, [searchQuery]);

  // Debounced search trigger (250ms)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (inputVal.trim().length >= 2) {
        executeSearch(inputVal);
        setShowResults(true);
      } else if (inputVal.trim() === '') {
        executeSearch('');
        setShowResults(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [inputVal]);

  // Click outside listener to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        setShowAlertsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectResult = (result: any) => {
    setSelectedItem(result.rawItem || result);
    setShowResults(false);
    setInputVal(result.name);
  };

  const clearSearch = () => {
    setInputVal('');
    setSearchQuery('');
    executeSearch('');
    setShowResults(false);
    setSelectedItem(null);
  };

  return (
    <div
      id="top-bar-overlay"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.65rem)' }}
      className="fixed left-3 right-3 sm:left-4 sm:right-4 z-40 flex items-center space-x-2 sm:space-x-3 pointer-events-none max-w-lg md:mx-auto"
    >
      {/* Search Input Panel */}
      <GlassPanel className="flex-1 min-w-0 flex flex-col pointer-events-auto relative">
        <div className="flex items-center px-3 sm:px-4 py-2 bg-neutral-950/40">
          <Search size={16} className="text-neutral-400 mr-2 sm:mr-3 shrink-0" />
          <input
            id="search-input-field"
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onFocus={() => setShowResults(true)}
            placeholder='Search places, pandals...'
            className="flex-1 min-w-0 bg-transparent border-none text-neutral-100 text-xs sm:text-sm placeholder-neutral-500 focus:outline-none focus:ring-0 py-0.5 sm:py-1 truncate"
          />
          {inputVal && (
            <button
              id="btn-clear-search"
              onClick={clearSearch}
              className="p-1 rounded-full text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors ml-1 shrink-0"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Search Results Dropdown Overlay */}
        {showResults && (searchResults.length > 0 || isSearching) && (
          <div
            ref={dropdownRef}
            id="search-results-dropdown"
            className="absolute top-full left-0 right-0 mt-2 bg-neutral-950/95 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto z-50 divide-y divide-neutral-900 custom-scrollbar"
          >
            {isSearching ? (
              <div className="p-4 text-center text-xs text-neutral-500 flex items-center justify-center space-x-2">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
                <span>Searching local indexes and OSRM geocoders...</span>
              </div>
            ) : (
              searchResults.map((item) => (
                <button
                  key={item.id}
                  id={`search-result-item-${item.id}`}
                  onClick={() => handleSelectResult(item)}
                  className="w-full text-left px-4 py-3 hover:bg-neutral-900 flex items-start space-x-3 transition-colors"
                >
                  <div className="mt-0.5">
                    {item.type === 'pandal' ? (
                      <MapPin size={15} className="text-indigo-400" />
                    ) : item.type === 'event' ? (
                      <Compass size={15} className="text-purple-400" />
                    ) : (
                      <MapPin size={15} className="text-emerald-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-200 truncate">{item.name}</p>
                    <p className="text-xs text-neutral-500 truncate mt-0.5">{item.address}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </GlassPanel>

      {/* Quick Bengali Panjika Trigger Button */}
      <button
        id="btn-topbar-panjika-pill"
        onClick={openPanjika}
        className="pointer-events-auto px-2 sm:px-2.5 py-2 sm:py-2.5 bg-neutral-900/80 backdrop-blur-md border border-amber-500/30 hover:border-amber-500/60 rounded-xl text-amber-300 hover:text-amber-200 shadow-xl transition-all duration-300 flex items-center gap-1 sm:gap-1.5 text-xs font-semibold shrink-0 touch-manipulation cursor-pointer"
        title="বাংলা পঞ্জিকা খুলুন (Open Bengali Panjika)"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
        <span className="hidden sm:inline font-mono">{todayBengali.dayBengali} {todayBengali.monthNameBn}</span>
        <span className="sm:hidden font-mono text-[10.5px]">{todayBengali.dayBengali} {todayBengali.monthNameBn}</span>
      </button>

      {/* Warnings & Alerts Bell */}
      <div ref={alertsRef} className="pointer-events-auto relative shrink-0">
        <button
          id="btn-alerts-bell"
          onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
          className="p-2.5 sm:p-3 bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-xl text-neutral-400 hover:text-neutral-100 shadow-xl transition-all duration-300 relative flex items-center justify-center touch-manipulation cursor-pointer"
          title="Active Alerts"
          aria-label="Active Alerts"
        >
          <Bell size={17} />
          {alerts.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-600 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full flex items-center justify-center border border-neutral-900 min-w-[18px]">
              {alerts.length}
            </span>
          )}
        </button>

        {/* Alerts Dropdown Overlay */}
        {showAlertsDropdown && (
          <div
            id="alerts-dropdown-panel"
            className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden z-50 divide-y divide-neutral-900"
          >
            <div className="px-4 py-3 bg-neutral-900/40 flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-300 tracking-wider uppercase">Active Alerts</span>
              <AlertTriangle size={14} className="text-amber-500" />
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-neutral-900 custom-scrollbar">
              {alerts.length === 0 ? (
                <p className="p-4 text-center text-xs text-neutral-500">No active alerts reported near your route.</p>
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className="p-4 flex items-start space-x-3">
                    <div className="mt-0.5">
                      <AlertTriangle size={15} className={alert.type === 'emergency' ? 'text-rose-500' : 'text-amber-500'} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-neutral-200">{alert.title}</p>
                      <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">{alert.description}</p>
                      <p className="text-[9px] text-neutral-500 mt-1.5">
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
