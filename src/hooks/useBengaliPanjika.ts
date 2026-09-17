/**
 * Eclipse GPS — useBengaliPanjika Hook
 * 
 * Provides reactive access to Bengal Panjika (বাংলা পঞ্জিকা) state,
 * astronomical calculations, automatic daily date synchronization,
 * manual date navigation, festival jumping, and language preferences.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { PanjikaDayData, ImportantPujaTithi } from '../types/panjika';
import {
  getPanjikaDataForDate,
  VERIFIED_FESTIVAL_TITHIS,
} from '../services/panjika/bengaliAstronomicalService';

export function useBengaliPanjika() {
  // Current active date in Panjika (defaults to system current date)
  const [activeDate, setActiveDate] = useState<Date>(() => new Date());
  // Language display mode: 'bn' (pure Bengali with subtle English aids) or 'bilingual' (equal dual text)
  const [displayLanguage, setDisplayLanguage] = useState<'bn' | 'en' | 'bilingual'>('bn');
  // Active festival filter (all vs Durga Puja vs Kali Puja etc)
  const [selectedFestivalFilter, setSelectedFestivalFilter] = useState<'ALL' | 'DURGA_PUJA' | 'POST_PUJA'>('ALL');

  // Automatically update daily information when date changes
  useEffect(() => {
    // Check at midnight or every minute for real-time synchronization
    const timer = setInterval(() => {
      const now = new Date();
      // If active date was set to today, keep it in sync with today
      setActiveDate((prev) => {
        const isSameDay =
          prev.getFullYear() === now.getFullYear() &&
          prev.getMonth() === now.getMonth() &&
          prev.getDate() === now.getDate();
        // If it was already today, ensure date object is fresh
        return isSameDay ? now : prev;
      });
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Compute full Panjika data for active date
  const panjikaData: PanjikaDayData = useMemo(() => {
    return getPanjikaDataForDate(activeDate);
  }, [activeDate]);

  // Is active date today?
  const isViewingToday = useMemo(() => {
    const today = new Date();
    return (
      activeDate.getFullYear() === today.getFullYear() &&
      activeDate.getMonth() === today.getMonth() &&
      activeDate.getDate() === today.getDate()
    );
  }, [activeDate]);

  // Navigation handlers
  const goToToday = useCallback(() => {
    setActiveDate(new Date());
  }, []);

  const goToPreviousDay = useCallback(() => {
    setActiveDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 1);
      return next;
    });
  }, []);

  const goToNextDay = useCallback(() => {
    setActiveDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 1);
      return next;
    });
  }, []);

  const setSpecificDate = useCallback((date: Date) => {
    setActiveDate(new Date(date));
  }, []);

  const jumpToFestival = useCallback((festival: ImportantPujaTithi) => {
    const [y, m, d] = festival.gregorianDate.split('-').map(Number);
    setActiveDate(new Date(y, m - 1, d));
  }, []);

  // Filtered upcoming festivals
  const filteredFestivals = useMemo(() => {
    if (selectedFestivalFilter === 'DURGA_PUJA') {
      return VERIFIED_FESTIVAL_TITHIS.filter(
        (f) =>
          f.id.includes('mahalaya') ||
          f.id.includes('shashthi') ||
          f.id.includes('saptami') ||
          f.id.includes('ashtami') ||
          f.id.includes('sandhi') ||
          f.id.includes('navami') ||
          f.id.includes('dashami')
      );
    }
    if (selectedFestivalFilter === 'POST_PUJA') {
      return VERIFIED_FESTIVAL_TITHIS.filter(
        (f) =>
          f.id.includes('lakshmi') ||
          f.id.includes('kali') ||
          f.id.includes('bhai') ||
          f.id.includes('jagaddhatri')
      );
    }
    return VERIFIED_FESTIVAL_TITHIS;
  }, [selectedFestivalFilter]);

  return {
    activeDate,
    panjikaData,
    isViewingToday,
    displayLanguage,
    setDisplayLanguage,
    selectedFestivalFilter,
    setSelectedFestivalFilter,
    filteredFestivals,
    allFestivals: VERIFIED_FESTIVAL_TITHIS,
    goToToday,
    goToPreviousDay,
    goToNextDay,
    setSpecificDate,
    jumpToFestival,
  };
}
