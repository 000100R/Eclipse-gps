import React, { useState, useEffect, useMemo } from 'react';
import { useAppState } from '../../hooks/AppStateProvider';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { SmartRouteStopCard } from './SmartRouteStopCard';
import { NearbySuggestionsModal } from './NearbySuggestionsModal';
import { SavedSmartRoutesModal } from './SavedSmartRoutesModal';
import { 
  SmartRoutePlan, 
  StartLocationOption, 
  DestinationItem, 
  TransportMode, 
  RoutePriority 
} from '../../types/smartRoute';
import { smartPujaRoutePlannerService } from '../../services/routing/smartPujaRoutePlannerService';
import { metroIntelligenceProvider } from '../../services/intelligence/metroIntelligenceProvider';
import { curatedMetroStations } from '../../data/curatedMetroStations';
import { 
  MapPin, 
  Trash2, 
  Zap, 
  Play, 
  Calendar, 
  Sparkles, 
  Bookmark, 
  BookmarkCheck, 
  Share2, 
  RefreshCw, 
  Train, 
  Footprints, 
  Car, 
  Layers, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  ChevronDown,
  Building2,
  Users
} from 'lucide-react';

export const RoutePlanner: React.FC = () => {
  const {
    currentLocation,
    routeStops,
    setRouteStops,
    activeRoute,
    setActiveRoute,
    isNavigating,
    setIsNavigating,
    setCurrentStepIndex,
    setActiveTab,
    pandals,
    events,
    smartRoutePlan,
    setSmartRoutePlan,
    savedSmartRoutes,
    saveSmartRoute,
    deleteSmartRoute,
    applySmartRoute,
    friendsList,
    friendsLocations,
  } = useAppState();

  // Route Planning Inputs State
  const [availableTimeMinutes, setAvailableTimeMinutes] = useState<number>(240); // 4 hours default
  const [preferredTransport, setPreferredTransport] = useState<TransportMode>('MIXED');
  const [priority, setPriority] = useState<RoutePriority>('MORE_PLACES');
  const [startType, setStartType] = useState<'GPS' | 'METRO' | 'FRIEND'>('GPS');
  const [selectedMetroStationId, setSelectedMetroStationId] = useState<string>('shyambazar');
  const [selectedFriendId, setSelectedFriendId] = useState<string>('');

  // Selected Destinations in Tour
  const [selectedDestinations, setSelectedDestinations] = useState<DestinationItem[]>([]);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState<string>('');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('');

  // UI Modals State
  const [isComputing, setIsComputing] = useState<boolean>(false);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState<boolean>(false);
  const [isNearbyModalOpen, setIsNearbyModalOpen] = useState<boolean>(false);
  const [nearbySuggestions, setNearbySuggestions] = useState<any[]>([]);
  const [shareSuccess, setShareSuccess] = useState<boolean>(false);

  // All available catalog items
  const allDestinations = useMemo(() => {
    return smartPujaRoutePlannerService.getAllDestinations();
  }, [pandals, events]);

  // Available candidate destinations not yet selected
  const availableDestinations = useMemo(() => {
    const selectedIds = new Set(selectedDestinations.map(d => d.id));
    return allDestinations.filter(d => !selectedIds.has(d.id));
  }, [allDestinations, selectedDestinations]);

  // Filtered by catalog search query
  const filteredAvailableDestinations = useMemo(() => {
    if (!catalogSearchQuery.trim()) return availableDestinations.slice(0, 30);
    const q = catalogSearchQuery.toLowerCase().trim();
    return availableDestinations
      .filter(d => d.name.toLowerCase().includes(q) || (d.address && d.address.toLowerCase().includes(q)))
      .slice(0, 30);
  }, [availableDestinations, catalogSearchQuery]);

  // Sync selectedDestinations from existing routeStops or smartRoutePlan on mount
  useEffect(() => {
    if (selectedDestinations.length === 0) {
      if (smartRoutePlan && smartRoutePlan.stops.length > 0) {
        const fromPlan = smartRoutePlan.stops.map(s => smartPujaRoutePlannerService.toDestinationItem(s.rawItem || s));
        setSelectedDestinations(fromPlan);
      } else if (routeStops.length > 0) {
        const fromStops = routeStops.map(s => smartPujaRoutePlannerService.toDestinationItem(s));
        setSelectedDestinations(fromStops);
      } else {
        // Initial default: North Kolkata Heritage Cluster (Bagbazar, Kumartuli, Ahiritola, Sovabazar)
        const defaults = allDestinations.filter(d => 
          ['pandal-bagbazar', 'pandal-kumartuli-park', 'pandal-ahiritola', 'bonedi-sovabazar-rajbari'].includes(d.id)
        );
        if (defaults.length > 0) {
          setSelectedDestinations(defaults);
        }
      }
    }
  }, [allDestinations]);

  // Construct start location option
  const currentStartLocationOption = useMemo((): StartLocationOption => {
    if (startType === 'METRO') {
      const station = curatedMetroStations.find(s => s.id === selectedMetroStationId) || curatedMetroStations[0];
      const gateText = station.entrancesExits?.[0]?.gateNumber || 'Main Gate';
      return {
        id: `metro-${station.id}`,
        name: `${station.name} Metro`,
        location: station.location,
        type: 'METRO',
        subtitle: `${station.line} • ${gateText}`,
      };
    }

    if (startType === 'FRIEND' && selectedFriendId && friendsLocations[selectedFriendId]) {
      const friend = friendsList.find(f => f.friendId === selectedFriendId);
      const loc = friendsLocations[selectedFriendId];
      return {
        id: `friend-${selectedFriendId}`,
        name: friend ? `${friend.friendName}'s Location` : "Friend's Location",
        location: { lat: loc.lat, lng: loc.lng },
        type: 'FRIEND',
        subtitle: 'Friend Live Location',
      };
    }

    // Default: GPS Current Location
    return {
      id: 'gps-current',
      name: 'Current Location (GPS)',
      location: currentLocation,
      type: 'GPS',
      subtitle: 'Real-time GPS coordinates',
    };
  }, [startType, selectedMetroStationId, selectedFriendId, currentLocation, friendsList, friendsLocations]);

  // Handle Preset Selections
  const applyPreset = (presetName: string) => {
    let ids: string[] = [];
    if (presetName === 'north_heritage') {
      ids = ['pandal-bagbazar', 'pandal-kumartuli-park', 'pandal-ahiritola', 'bonedi-sovabazar-rajbari', 'bonedi-chhatu-babu-latu-babu'];
      setStartType('METRO');
      setSelectedMetroStationId('shyambazar');
      setPreferredTransport('MIXED');
    } else if (presetName === 'south_classics') {
      ids = ['pandal-maddox', 'pandal-ballygunge-cultural', 'pandal-ekdalia-evergreen', 'pandal-tridhara-sammilani', 'pandal-deshapriya'];
      setStartType('METRO');
      setSelectedMetroStationId('kalighat');
      setPreferredTransport('MIXED');
    } else if (presetName === 'bonedi_tour') {
      ids = ['bonedi-sovabazar-rajbari', 'bonedi-chhatu-babu-latu-babu', 'bonedi-pathuriaghata-khelat-ghosh', 'bonedi-jorasanko-shib-krishna-daw'];
      setStartType('METRO');
      setSelectedMetroStationId('shobhabazar-sutanuti');
      setPreferredTransport('WALK');
      setPriority('LESS_WALKING');
    }

    const items = ids
      .map(id => smartPujaRoutePlannerService.getDestinationById(id))
      .filter(Boolean) as DestinationItem[];

    if (items.length > 0) {
      setSelectedDestinations(items);
    }
  };

  // Add stop from selector
  const handleAddDestination = (destId: string) => {
    if (!destId) return;
    const item = allDestinations.find(d => d.id === destId);
    if (item && !selectedDestinations.some(d => d.id === item.id)) {
      setSelectedDestinations(prev => [...prev, item]);
    }
    setSelectedCatalogId('');
    setCatalogSearchQuery('');
  };

  // Remove stop
  const handleRemoveDestination = (destId: string) => {
    setSelectedDestinations(prev => prev.filter(d => d.id !== destId));
  };

  // Shift stop position
  const handleShiftDestination = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === selectedDestinations.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...selectedDestinations];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setSelectedDestinations(updated);
  };

  // Core Optimization Trigger
  const handleOptimizeRoute = async () => {
    if (selectedDestinations.length === 0) return;

    setIsComputing(true);
    try {
      const plan = await smartPujaRoutePlannerService.planSmartRoute({
        startLocation: currentStartLocationOption,
        destinations: selectedDestinations,
        availableTimeMinutes,
        preferredTransport,
        priority,
      });

      setSmartRoutePlan(plan);
      applySmartRoute(plan);
    } catch (err) {
      console.error('[RoutePlanner] Error optimizing route:', err);
    } finally {
      setIsComputing(false);
    }
  };

  // Open "Suggest Nearby" modal
  const handleOpenNearbySuggestions = () => {
    const suggestions = smartPujaRoutePlannerService.suggestNearbyStops(
      selectedDestinations,
      6
    );
    setNearbySuggestions(suggestions);
    setIsNearbyModalOpen(true);
  };

  // Add suggestion from modal and re-plan
  const handleAddSuggestionStop = async (suggestion: any) => {
    const destItem: DestinationItem = smartPujaRoutePlannerService.toDestinationItem(
      suggestion.rawItem || suggestion
    );
    const updated = [...selectedDestinations, destItem];
    setSelectedDestinations(updated);
    setIsNearbyModalOpen(false);

    // Auto re-optimize with new stop
    setIsComputing(true);
    try {
      const plan = await smartPujaRoutePlannerService.planSmartRoute({
        startLocation: currentStartLocationOption,
        destinations: updated,
        availableTimeMinutes,
        preferredTransport,
        priority,
      });

      setSmartRoutePlan(plan);
      applySmartRoute(plan);
    } catch (err) {
      console.error('[RoutePlanner] Error auto-optimizing after suggestion:', err);
    } finally {
      setIsComputing(false);
    }
  };

  // Save Route Action
  const handleSaveCurrentRoute = () => {
    if (!smartRoutePlan) return;
    saveSmartRoute(smartRoutePlan);
  };

  const isCurrentRouteSaved = useMemo(() => {
    if (!smartRoutePlan) return false;
    return savedSmartRoutes.some(s => s.id === smartRoutePlan.id);
  }, [smartRoutePlan, savedSmartRoutes]);

  // Share Route Action
  const handleShareRoute = async () => {
    if (!smartRoutePlan) return;

    const stopList = smartRoutePlan.stops
      .map((s, idx) => `${idx + 1}. ${s.name} (${s.type === 'bonedi_bari' ? 'Heritage Bonedi Bari' : 'Pandal'}) - Est. Arrival: ${s.estimatedArrival}`)
      .join('\n');

    const shareText = `🌟 Kolkata Durga Puja Tour via Eclipse Smart Route Planner:\n\n` +
      `🏁 Start: ${smartRoutePlan.startLocation.name}\n\n` +
      `📍 Route Stops (${smartRoutePlan.stops.length}):\n${stopList}\n\n` +
      `⏱️ Total Time: ${Math.round(smartRoutePlan.summary.totalDurationMinutes / 60)}h ${smartRoutePlan.summary.totalDurationMinutes % 60}m | 🚶 Distance: ${(smartRoutePlan.summary.totalDistanceMeters / 1000).toFixed(1)} km\n` +
      `🚇 Mode: ${smartRoutePlan.config.preferredTransport}\n\n` +
      `Planned with Eclipse Smart Puja Route Planner (Authentic Kolkata Live Data)`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: smartRoutePlan.title,
          text: shareText,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
    } catch (clipErr) {
      console.error('Failed to copy route:', clipErr);
    }
  };

  return (
    <div id="smart-puja-route-planner-view" className="space-y-4 max-w-lg mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-2 h-7 rounded-full bg-gradient-to-b from-indigo-500 to-purple-600" />
          <div>
            <h2 className="text-base font-extrabold text-white tracking-wide uppercase">
              Smart Puja Route Planner
            </h2>
            <p className="text-[11px] text-neutral-400">
              Native multi-stop Kolkata Puja tour generator
            </p>
          </div>
        </div>

        {/* Saved Routes button */}
        <button
          id="btn-view-saved-routes"
          onClick={() => setIsSavedModalOpen(true)}
          className="px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-300 hover:text-white flex items-center space-x-1.5 transition-colors"
        >
          <Bookmark size={13} className="text-amber-400" />
          <span>Saved ({savedSmartRoutes.length})</span>
        </button>
      </div>

      {/* Curated Tour Preset Chips */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Quick Tour Presets</span>
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 custom-scrollbar">
          <button
            onClick={() => applyPreset('north_heritage')}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 hover:border-indigo-500/50 text-neutral-300 transition-all flex items-center space-x-1.5"
          >
            <Sparkles size={11} className="text-indigo-400" />
            <span>North Heritage</span>
          </button>
          <button
            onClick={() => applyPreset('south_classics')}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 hover:border-indigo-500/50 text-neutral-300 transition-all flex items-center space-x-1.5"
          >
            <Sparkles size={11} className="text-purple-400" />
            <span>South Classics</span>
          </button>
          <button
            onClick={() => applyPreset('bonedi_tour')}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-500/50 text-amber-300/90 transition-all flex items-center space-x-1.5"
          >
            <Building2 size={11} className="text-amber-400" />
            <span>Bonedi Aristocrat</span>
          </button>
        </div>
      </div>

      {/* Planning Controls Panel */}
      <GlassPanel className="p-4 space-y-4">
        {/* 1. Starting Location */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              Starting Point
            </label>
            <span className="text-[10px] text-indigo-400 font-medium">
              {currentStartLocationOption.name}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setStartType('GPS')}
              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center space-x-1 ${
                startType === 'GPS'
                  ? 'bg-indigo-650/40 border-indigo-500 text-white'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <MapPin size={11} />
              <span>Current GPS</span>
            </button>

            <button
              onClick={() => setStartType('METRO')}
              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center space-x-1 ${
                startType === 'METRO'
                  ? 'bg-cyan-950/50 border-cyan-500 text-cyan-200'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Train size={11} />
              <span>Metro Station</span>
            </button>

            <button
              onClick={() => setStartType('FRIEND')}
              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center space-x-1 ${
                startType === 'FRIEND'
                  ? 'bg-purple-950/50 border-purple-500 text-purple-200'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Users size={11} />
              <span>Friend Point</span>
            </button>
          </div>

          {/* Conditional Metro Selector */}
          {startType === 'METRO' && (
            <select
              id="select-start-metro-station"
              value={selectedMetroStationId}
              onChange={(e) => setSelectedMetroStationId(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-cyan-500"
            >
              {curatedMetroStations.map(station => (
                <option key={station.id} value={station.id}>
                  {station.name} Metro ({station.line})
                </option>
              ))}
            </select>
          )}

          {/* Conditional Friend Selector */}
          {startType === 'FRIEND' && (
            <select
              id="select-start-friend"
              value={selectedFriendId}
              onChange={(e) => setSelectedFriendId(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
            >
              <option value="">-- Choose Friend with Live GPS --</option>
              {friendsList.map(f => (
                <option key={f.friendId} value={f.friendId}>
                  {f.friendName} {friendsLocations[f.friendId] ? '(Active)' : '(No location)'}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 2. Available Time Window */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              Available Time Window
            </label>
            <span className="text-xs font-bold text-indigo-400">
              {Math.round(availableTimeMinutes / 60)} hours ({availableTimeMinutes} mins)
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[120, 180, 240, 300].map(mins => (
              <button
                key={mins}
                onClick={() => setAvailableTimeMinutes(mins)}
                className={`py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  availableTimeMinutes === mins
                    ? 'bg-indigo-650/40 border-indigo-500 text-white'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {mins / 60}h
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              onClick={() => setAvailableTimeMinutes(360)}
              className={`py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                availableTimeMinutes === 360
                  ? 'bg-indigo-650/40 border-indigo-500 text-white'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              6 hours
            </button>
            <button
              onClick={() => setAvailableTimeMinutes(480)}
              className={`py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                availableTimeMinutes === 480
                  ? 'bg-indigo-650/40 border-indigo-500 text-white'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              All Night (8h)
            </button>
          </div>
        </div>

        {/* 3. Preferred Transport Mode */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            Preferred Transport
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={() => setPreferredTransport('MIXED')}
              className={`py-2 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center space-y-1 ${
                preferredTransport === 'MIXED'
                  ? 'bg-indigo-650/40 border-indigo-500 text-white'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Layers size={14} className="text-indigo-400" />
              <span>Mixed</span>
            </button>
            <button
              onClick={() => setPreferredTransport('METRO')}
              className={`py-2 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center space-y-1 ${
                preferredTransport === 'METRO'
                  ? 'bg-cyan-950/50 border-cyan-500 text-cyan-200'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Train size={14} className="text-cyan-400" />
              <span>Metro</span>
            </button>
            <button
              onClick={() => setPreferredTransport('WALK')}
              className={`py-2 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center space-y-1 ${
                preferredTransport === 'WALK'
                  ? 'bg-emerald-950/50 border-emerald-500 text-emerald-200'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Footprints size={14} className="text-emerald-400" />
              <span>Walk</span>
            </button>
            <button
              onClick={() => setPreferredTransport('DRIVE')}
              className={`py-2 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center space-y-1 ${
                preferredTransport === 'DRIVE'
                  ? 'bg-amber-950/50 border-amber-500 text-amber-200'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Car size={14} className="text-amber-400" />
              <span>Drive</span>
            </button>
          </div>
        </div>

        {/* 4. Priority Option */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            Tour Optimization Priority
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPriority('MORE_PLACES')}
              className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all text-left flex items-center space-x-2 ${
                priority === 'MORE_PLACES'
                  ? 'bg-indigo-650/40 border-indigo-500 text-white'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>🏆</span>
              <span className="truncate">More Places</span>
            </button>
            <button
              onClick={() => setPriority('LESS_WALKING')}
              className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all text-left flex items-center space-x-2 ${
                priority === 'LESS_WALKING'
                  ? 'bg-indigo-650/40 border-indigo-500 text-white'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>🚶‍♂️</span>
              <span className="truncate">Less Walking</span>
            </button>
            <button
              onClick={() => setPriority('LESS_TRAFFIC')}
              className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all text-left flex items-center space-x-2 ${
                priority === 'LESS_TRAFFIC'
                  ? 'bg-indigo-650/40 border-indigo-500 text-white'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>🚦</span>
              <span className="truncate">Less Traffic</span>
            </button>
            <button
              onClick={() => setPriority('LESS_CROWD')}
              className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all text-left flex items-center space-x-2 ${
                priority === 'LESS_CROWD'
                  ? 'bg-indigo-650/40 border-indigo-500 text-white'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>👥</span>
              <span className="truncate">Less Crowd</span>
            </button>
          </div>
        </div>

        {/* 5. Add Stop to Tour */}
        <div className="space-y-1.5 pt-1">
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            Add Pandal or Bonedi Bari
          </label>
          <select
            id="select-add-pandal-stop"
            value={selectedCatalogId}
            onChange={(e) => handleAddDestination(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="">-- Select a Pandal or Heritage House --</option>
            {filteredAvailableDestinations.map(item => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.type === 'bonedi_bari' ? 'Heritage Bonedi' : 'Pandal'})
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons: Optimize & Suggest Nearby */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            id="btn-optimize-smart-route"
            onClick={handleOptimizeRoute}
            disabled={isComputing || selectedDestinations.length === 0}
            className="py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center space-x-1.5 transition-all uppercase tracking-wider"
          >
            <Zap size={14} className="fill-white" />
            <span>{isComputing ? 'Optimizing...' : 'Optimize Route'}</span>
          </button>

          <button
            id="btn-suggest-nearby-stops"
            onClick={handleOpenNearbySuggestions}
            disabled={selectedDestinations.length === 0}
            className="py-2.5 px-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-indigo-500/50 disabled:opacity-50 text-neutral-200 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-all uppercase tracking-wider"
          >
            <Sparkles size={14} className="text-indigo-400" />
            <span>Suggest Nearby</span>
          </button>
        </div>
      </GlassPanel>

      {/* Route Schedule & Timeline Output */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
            Planned Itinerary ({smartRoutePlan ? smartRoutePlan.stops.length : selectedDestinations.length} Stops)
          </span>

          {smartRoutePlan && (
            <div className="flex items-center space-x-2">
              <button
                id="btn-save-route-plan"
                onClick={handleSaveCurrentRoute}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors ${
                  isCurrentRouteSaved
                    ? 'text-amber-400 bg-amber-950/30 border border-amber-800/40'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
                title={isCurrentRouteSaved ? 'Route Saved' : 'Save Route'}
              >
                {isCurrentRouteSaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                <span>{isCurrentRouteSaved ? 'Saved' : 'Save'}</span>
              </button>

              <button
                id="btn-share-route-plan"
                onClick={handleShareRoute}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors flex items-center space-x-1 text-xs"
                title="Share Route"
              >
                <Share2 size={13} />
                <span>{shareSuccess ? 'Copied!' : 'Share'}</span>
              </button>
            </div>
          )}
        </div>

        {/* START Point Card */}
        <div className="p-3 bg-neutral-900/60 border border-neutral-800/80 rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 rounded-xl bg-emerald-950/60 border border-emerald-600/40 flex items-center justify-center text-xs font-bold text-emerald-400">
              🚩
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Start Point</p>
              <h4 className="text-xs font-bold text-white">{currentStartLocationOption.name}</h4>
              <p className="text-[10px] text-neutral-400">{currentStartLocationOption.subtitle}</p>
            </div>
          </div>
          <div className="text-right text-[11px] text-neutral-400">
            <p className="text-[10px] text-neutral-500">Departure</p>
            <p className="font-semibold text-neutral-200">
              {smartRoutePlan?.startTimeFormatted || '06:00 PM'}
            </p>
          </div>
        </div>

        {/* Stops List */}
        {selectedDestinations.length === 0 ? (
          <div className="p-6 text-center text-neutral-500 text-xs border border-dashed border-neutral-800 rounded-2xl space-y-1">
            <p className="font-semibold text-neutral-400">Your route is currently empty</p>
            <p>Select pandals or pick a tour preset above to generate an itinerary.</p>
          </div>
        ) : smartRoutePlan ? (
          <div className="space-y-1">
            {smartRoutePlan.stops.map((stop, idx) => {
              const incomingLeg = smartRoutePlan.legs[idx];
              return (
                <SmartRouteStopCard
                  key={stop.id}
                  stop={stop}
                  index={idx}
                  totalStops={smartRoutePlan.stops.length}
                  incomingLeg={incomingLeg}
                  onShiftUp={(i) => handleShiftDestination(i, 'up')}
                  onShiftDown={(i) => handleShiftDestination(i, 'down')}
                  onRemove={handleRemoveDestination}
                />
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {selectedDestinations.map((dest, idx) => (
              <div
                key={dest.id}
                className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-xl flex items-center justify-between"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xs font-bold text-indigo-400 flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{dest.name}</p>
                    <p className="text-[10px] text-neutral-500 truncate">{dest.address}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-1 flex-shrink-0">
                  <button
                    onClick={() => handleRemoveDestination(dest.id)}
                    className="p-1.5 text-neutral-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={handleOptimizeRoute}
              className="w-full py-2 bg-indigo-600/30 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-300 font-bold text-xs rounded-xl flex items-center justify-center space-x-1 transition-all uppercase"
            >
              <Zap size={12} />
              <span>Optimize this order now</span>
            </button>
          </div>
        )}

        {/* Route Summary & Navigation Actions */}
        {smartRoutePlan && (
          <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-2xl space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] text-neutral-400">Total Distance:</span>
                <p className="font-bold text-white">
                  {(smartRoutePlan.summary.totalDistanceMeters / 1000).toFixed(1)} km
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-neutral-400">Estimated Duration:</span>
                <p className="font-bold text-indigo-400">
                  {Math.round(smartRoutePlan.summary.totalDurationMinutes / 60)}h {smartRoutePlan.summary.totalDurationMinutes % 60}m
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-neutral-400">Travel Transit:</span>
                <p className="font-semibold text-neutral-300">
                  {smartRoutePlan.summary.totalTravelMinutes} mins
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-neutral-400">Pandal Darshan:</span>
                <p className="font-semibold text-neutral-300">
                  {smartRoutePlan.summary.totalStayMinutes} mins
                </p>
              </div>
            </div>

            {/* Time Budget Feasibility Status */}
            <div className={`p-2.5 rounded-xl text-xs flex items-center space-x-2 border ${
              smartRoutePlan.summary.isWithinTimeLimit
                ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
                : 'bg-amber-950/30 border-amber-800/40 text-amber-300'
            }`}>
              {smartRoutePlan.summary.isWithinTimeLimit ? (
                <CheckCircle2 size={15} className="flex-shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle size={15} className="flex-shrink-0 text-amber-400" />
              )}
              <span className="text-[11px] leading-tight">
                {smartRoutePlan.summary.isWithinTimeLimit
                  ? `✓ Fits nicely inside your ${Math.round(availableTimeMinutes / 60)}h window (${availableTimeMinutes - smartRoutePlan.summary.totalDurationMinutes}m buffer remaining)`
                  : `⚠️ Exceeds your ${Math.round(availableTimeMinutes / 60)}h window by ${smartRoutePlan.summary.totalDurationMinutes - availableTimeMinutes}m. Consider removing a stop.`}
              </span>
            </div>

            {/* Launch Turn-by-Turn Navigation HUD */}
            <div className="space-y-2 pt-1">
              <button
                id="btn-start-smart-navigation"
                onClick={() => {
                  setIsNavigating(true);
                  setCurrentStepIndex(0);
                  setActiveTab('home');
                }}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center space-x-2 transition-all uppercase tracking-wider"
              >
                <Play size={13} className="fill-white" />
                <span>Start Tour Navigation</span>
              </button>

              <button
                id="btn-recalculate-route"
                onClick={handleOptimizeRoute}
                className="w-full py-2 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white font-semibold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition-colors"
              >
                <RefreshCw size={12} />
                <span>Recalculate with Live Telemetry</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <NearbySuggestionsModal
        isOpen={isNearbyModalOpen}
        onClose={() => setIsNearbyModalOpen(false)}
        suggestions={nearbySuggestions}
        onAddStop={handleAddSuggestionStop}
      />

      <SavedSmartRoutesModal
        isOpen={isSavedModalOpen}
        onClose={() => setIsSavedModalOpen(false)}
        savedRoutes={savedSmartRoutes}
        onLoadRoute={(plan) => {
          setSmartRoutePlan(plan);
          applySmartRoute(plan);
          const fromPlan = plan.stops.map(s => smartPujaRoutePlannerService.toDestinationItem(s.rawItem || s));
          setSelectedDestinations(fromPlan);
        }}
        onDeleteRoute={deleteSmartRoute}
      />
    </div>
  );
};

export default RoutePlanner;
