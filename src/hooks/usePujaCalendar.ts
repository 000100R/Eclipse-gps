/**
 * Eclipse GPS — usePujaCalendar Hook (Phase 13.6)
 * 
 * Provides reactive access to Bengal Durga Puja festival intelligence, ritual schedules,
 * period filtering, and layer state.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { FestivalEvent, CalendarPeriodFilter, PujaDayType } from '../types/festival';
import { pujaCalendarService } from '../services/intelligence/pujaCalendarService';
import { pujaCalendarIntelligenceProvider } from '../services/intelligence/pujaCalendarIntelligenceProvider';
import { useIntelligenceGrid } from './useIntelligenceGrid';

export function usePujaCalendar() {
  const [selectedYear, setSelectedYearState] = useState<number>(
    pujaCalendarIntelligenceProvider.getSelectedYear()
  );
  const [period, setPeriodState] = useState<CalendarPeriodFilter>(
    pujaCalendarIntelligenceProvider.getActivePeriod()
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeDayFilter, setActiveDayFilter] = useState<PujaDayType | 'ALL'>('ALL');

  const { isLayerVisible, toggleLayer, setLayerVisibility } = useIntelligenceGrid();
  const isCalendarLayerVisible = isLayerVisible('PUJA_CALENDAR');

  const supportedYears = useMemo(() => pujaCalendarService.getSupportedYears(), []);

  const setSelectedYear = useCallback((year: number) => {
    setSelectedYearState(year);
    pujaCalendarIntelligenceProvider.setYear(year);
  }, []);

  const setPeriod = useCallback((newPeriod: CalendarPeriodFilter) => {
    setPeriodState(newPeriod);
    pujaCalendarIntelligenceProvider.setPeriod(newPeriod);
  }, []);

  const toggleCalendarLayer = useCallback(() => {
    toggleLayer('PUJA_CALENDAR');
  }, [toggleLayer]);

  const showCalendarLayer = useCallback(() => {
    setLayerVisibility('PUJA_CALENDAR', true);
  }, [setLayerVisibility]);

  // Compute filtered events
  const events = useMemo(() => {
    let result = pujaCalendarIntelligenceProvider.getData();

    if (activeDayFilter !== 'ALL') {
      result = result.filter((e) => e.pujaDay === activeDayFilter);
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.bengaliName && e.bengaliName.toLowerCase().includes(q)) ||
          e.category.toLowerCase().includes(q) ||
          e.pujaDay.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          (e.location && e.location.toLowerCase().includes(q)) ||
          (e.tithi && e.tithi.toLowerCase().includes(q))
      );
    }

    return result;
  }, [selectedYear, period, activeDayFilter, searchQuery]);

  const todayEvent = useMemo(() => {
    return pujaCalendarService.getTodayEvent(new Date(), selectedYear);
  }, [selectedYear]);

  return {
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
    showCalendarLayer,
  };
}
