/**
 * Eclipse GPS — Puja Calendar & Festival Intelligence UI (Phase 13.6)
 * 
 * Lightweight, high-contrast festival timeline view providing verified Bengal
 * Panjika timings, Pushpanjali schedules, Sandhi Puja astronomical junctures,
 * Kumari Puja, and Visarjan guidelines.
 */

import React, { useState } from 'react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { usePujaCalendar } from '../../hooks/usePujaCalendar';
import { useAppState } from '../../hooks/AppStateProvider';
import { CalendarPeriodFilter, FestivalEvent, PujaDayType } from '../../types/festival';
import {
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  Flame,
  CheckCircle2,
  ShieldCheck,
  Search,
  ChevronRight,
  ExternalLink,
  Info,
} from 'lucide-react';

interface PujaCalendarViewProps {
  onSelectPandal?: (pandalId: string) => void;
  className?: string;
}

export const PujaCalendarView: React.FC<PujaCalendarViewProps> = ({
  onSelectPandal,
  className = '',
}) => {
  const {
    selectedYear,
    setSelectedYear,
    supportedYears,
    period,
    setPeriod,
    searchQuery,
    setSearchQuery,
    activeDayFilter,
    setActiveDayFilter,
    events,
    todayEvent,
    isCalendarLayerVisible,
    toggleCalendarLayer,
  } = usePujaCalendar();

  const { setSelectedItem, pandals, bonediBaris, setActiveTab } = useAppState();

  const handlePandalClick = (targetIdOrName: string) => {
    // Look up in curated pandals or bonedi baris
    const foundPandal = pandals.find(
      (p) => p.id === targetIdOrName || p.name.toLowerCase().includes(targetIdOrName.toLowerCase())
    );
    if (foundPandal) {
      setSelectedItem(foundPandal as any);
      if (onSelectPandal) onSelectPandal(foundPandal.id);
      return;
    }

    const foundBonedi = bonediBaris?.find(
      (b) => b.id === targetIdOrName || b.name.toLowerCase().includes(targetIdOrName.toLowerCase())
    );
    if (foundBonedi) {
      setSelectedItem(foundBonedi as any);
      if (onSelectPandal) onSelectPandal(foundBonedi.id);
    }
  };

  const dayFilterButtons: { label: string; value: PujaDayType | 'ALL' }[] = [
    { label: 'All Events', value: 'ALL' },
    { label: 'Mahalaya', value: 'MAHALAYA' },
    { label: 'Shashthi', value: 'SHASHTHI' },
    { label: 'Saptami', value: 'SAPTAMI' },
    { label: 'Ashtami', value: 'ASHTAMI' },
    { label: 'Sandhi Puja', value: 'SANDHI_PUJA' },
    { label: 'Navami', value: 'NAVAMI' },
    { label: 'Dashami', value: 'DASHAMI' },
    { label: 'Sindoor Khela', value: 'SINDOOR_KHELA' },
    { label: 'Visarjan', value: 'VISARJAN' },
    { label: 'Carnival', value: 'CARNIVAL' },
  ];

  return (
    <div id="eclipse-puja-calendar-view" className={`space-y-4 ${className}`}>
      {/* Header Deck */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-6 rounded-full bg-amber-500 shadow-xs shadow-amber-500/50" />
          <div>
            <h2 className="text-base font-bold text-neutral-100 tracking-wide uppercase flex items-center gap-1.5">
              Puja Festival Calendar
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                {selectedYear}
              </span>
            </h2>
            <p className="text-[10px] text-neutral-400">
              Verified Bengal Panjika ritual windows & astronomical timings
            </p>
          </div>
        </div>

        {/* Year Selector */}
        <div className="flex items-center space-x-1 bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-[10px]">
          {supportedYears.map((yr) => (
            <button
              key={yr}
              id={`btn-calendar-year-${yr}`}
              onClick={() => setSelectedYear(yr)}
              className={`px-2 py-1 rounded font-mono transition-colors ${
                selectedYear === yr
                  ? 'bg-amber-500 text-neutral-950 font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>

      {/* Period Tabs: ALL, TODAY, UPCOMING, COMPLETED */}
      <div className="grid grid-cols-4 gap-1.5 bg-neutral-950/60 p-1 rounded-xl border border-neutral-800/80">
        {(['ALL', 'TODAY', 'UPCOMING', 'COMPLETED'] as CalendarPeriodFilter[]).map((tabKey) => {
          const isActive = period === tabKey;
          return (
            <button
              key={tabKey}
              id={`tab-calendar-period-${tabKey.toLowerCase()}`}
              onClick={() => setPeriod(tabKey)}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all text-center ${
                isActive
                  ? 'bg-neutral-800 text-amber-400 border border-amber-500/30 shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40'
              }`}
            >
              {tabKey}
            </button>
          );
        })}
      </div>

      {/* Today Status Pill / Live Highlight */}
      {todayEvent ? (
        <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-start space-x-2.5">
          <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="min-w-0 flex-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300 uppercase tracking-wide text-[11px]">
                TODAY IN KOLKATA
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">{todayEvent.startTime}</span>
            </div>
            <p className="font-semibold text-neutral-200 mt-0.5">{todayEvent.name}</p>
            {todayEvent.tithi && (
              <p className="text-[10px] text-amber-200/80 mt-0.5">{todayEvent.tithi}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="px-3 py-2 rounded-xl bg-neutral-900/40 border border-neutral-800/60 flex items-center justify-between text-[11px]">
          <span className="text-neutral-400 flex items-center gap-1.5">
            <Clock size={12} className="text-amber-400" />
            Active Season Schedule: {selectedYear}
          </span>
          <span className="text-amber-400 font-mono text-[10px]">
            Bengal Bisuddhasiddhanta Rules
          </span>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
        />
        <input
          id="input-search-puja-calendar"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter rituals (e.g., Sandhi Puja, Anjali, Sindoor Khela)..."
          className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* Day Filter Horizontal Scroll */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px]">
        {dayFilterButtons.map((btn) => (
          <button
            key={btn.value}
            id={`filter-day-${btn.value.toLowerCase()}`}
            onClick={() => setActiveDayFilter(btn.value)}
            className={`whitespace-nowrap px-2.5 py-1 rounded-full border transition-all ${
              activeDayFilter === btn.value
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-semibold'
                : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:border-neutral-700'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {events.length === 0 ? (
          <div className="p-8 border border-dashed border-neutral-800 rounded-xl text-center text-xs text-neutral-500">
            No ritual events match the selected timeline or search filter.
          </div>
        ) : (
          events.map((event) => {
            const isSandhi = event.pujaDay === 'SANDHI_PUJA';
            const isAshtami = event.pujaDay === 'ASHTAMI';

            return (
              <GlassPanel
                key={event.id}
                className={`p-3.5 flex flex-col space-y-2.5 border transition-all ${
                  isSandhi
                    ? 'border-amber-500/40 bg-amber-950/10'
                    : 'border-neutral-800 hover:border-neutral-700'
                }`}
              >
                {/* Top Row: Date, Time & Category */}
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 font-mono font-bold text-amber-400">
                      {event.date}
                    </span>
                    <span className="text-neutral-400 font-mono flex items-center gap-1">
                      <Clock size={11} className="text-neutral-500" />
                      {event.startTime} – {event.endTime}
                    </span>
                  </div>

                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      event.category === 'RITUAL'
                        ? 'bg-red-950/40 border-red-500/30 text-red-300'
                        : event.category === 'IMMERSION'
                        ? 'bg-blue-950/40 border-blue-500/30 text-blue-300'
                        : event.category === 'CARNIVAL'
                        ? 'bg-purple-950/40 border-purple-500/30 text-purple-300'
                        : 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                    }`}
                  >
                    {event.category}
                  </span>
                </div>

                {/* Event Name & Bengali script */}
                <div>
                  <h3 className="text-sm font-bold text-neutral-100 flex items-center justify-between">
                    <span>{event.name}</span>
                  </h3>
                  {event.bengaliName && (
                    <p className="text-xs text-amber-300/90 font-serif mt-0.5">
                      {event.bengaliName}
                    </p>
                  )}
                </div>

                {/* Tithi & Astronomical window if specified */}
                {event.tithi && (
                  <div className="text-[10px] text-neutral-300 bg-neutral-900/60 px-2 py-1 rounded border border-neutral-800/80 font-mono flex items-center gap-1.5">
                    <Sparkles size={11} className="text-amber-400 shrink-0" />
                    <span>{event.tithi}</span>
                  </div>
                )}

                {/* Description */}
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {event.description}
                </p>

                {/* Ritual Notes / Cultural Significance */}
                {event.ritualNotes && (
                  <div className="text-[10px] text-neutral-400 bg-neutral-950/80 p-2 rounded-lg border border-neutral-900 space-y-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400/90">
                      Ritual Instructions
                    </span>
                    <p className="text-neutral-300">{event.ritualNotes}</p>
                  </div>
                )}

                {/* Location context if applicable */}
                {event.location && (
                  <div className="flex items-center space-x-1.5 text-[11px] text-neutral-400">
                    <MapPin size={12} className="text-neutral-500 shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </div>
                )}

                {/* Recommended Pandals or Spots */}
                {event.recommendedPandals && event.recommendedPandals.length > 0 && (
                  <div className="pt-2 border-t border-neutral-900">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                      Prominent Mandaps for this Ritual
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {event.recommendedPandals.map((pId) => {
                        const displayName = pId
                          .replace(/^curated-/, '')
                          .replace(/^bonedi-/, '')
                          .split('-')
                          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(' ');

                        return (
                          <button
                            key={pId}
                            id={`btn-event-pandal-${pId}`}
                            onClick={() => handlePandalClick(pId)}
                            className="inline-flex items-center space-x-1 px-2 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-300 hover:text-amber-300 hover:border-amber-500/50 transition-colors"
                          >
                            <span>{displayName}</span>
                            <ChevronRight size={10} className="text-neutral-500" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Provenance / Source */}
                <div className="flex items-center justify-between text-[9px] text-neutral-500 pt-1.5 border-t border-neutral-900/60 font-mono">
                  <span className="flex items-center gap-1">
                    <ShieldCheck size={11} className="text-emerald-400" />
                    {event.verificationStatus}
                  </span>
                  <span className="truncate max-w-[200px]" title={event.source}>
                    Source: {event.source}
                  </span>
                </div>
              </GlassPanel>
            );
          })
        )}
      </div>
    </div>
  );
};
