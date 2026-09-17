/**
 * Eclipse GPS — Bengali Panjika View (বাংলা পঞ্জিকা)
 * 
 * Dedicated Panjika UI card and interactive dashboard for Kolkata.
 * Displays current and historical Bengali date, Bangabda (বঙ্গাব্দ),
 * Tithi, Nakshatra, Paksha, Sunrise, Sunset, Amrita Yoga, Rahu Kaal,
 * and verified Durga Puja / festive tithis with Bengali typography.
 */

import React, { useState } from 'react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { useBengaliPanjika } from '../../hooks/useBengaliPanjika';
import { ImportantPujaTithi } from '../../types/panjika';
import {
  Sun,
  Moon,
  Compass,
  Calendar,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Flame,
  AlertCircle,
  HelpCircle,
  Sunrise,
  Sunset,
  ArrowRight,
  RotateCcw,
  Languages,
} from 'lucide-react';

interface BengaliPanjikaViewProps {
  className?: string;
  onSelectPandalJump?: (query: string) => void;
}

export const BengaliPanjikaView: React.FC<BengaliPanjikaViewProps> = ({
  className = '',
  onSelectPandalJump,
}) => {
  const {
    activeDate,
    panjikaData,
    isViewingToday,
    displayLanguage,
    setDisplayLanguage,
    selectedFestivalFilter,
    setSelectedFestivalFilter,
    filteredFestivals,
    goToToday,
    goToPreviousDay,
    goToNextDay,
    setSpecificDate,
    jumpToFestival,
  } = useBengaliPanjika();

  const [showDatePicker, setShowDatePicker] = useState(false);

  const {
    gregorianFormattedBn,
    gregorianFormattedEn,
    bengaliDate,
    tithi,
    nakshatra,
    solarTimings,
    auspiciousTimings,
    activeFestivalsToday,
    panjikaSourceBn,
    panjikaSourceEn,
  } = panjikaData;

  const isBilingual = displayLanguage === 'bilingual';
  const isEnOnly = displayLanguage === 'en';

  // Handle native HTML5 date input change
  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const [y, m, d] = e.target.value.split('-').map(Number);
      setSpecificDate(new Date(y, m - 1, d));
      setShowDatePicker(false);
    }
  };

  const formattedDateForInput = `${activeDate.getFullYear()}-${(activeDate.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${activeDate.getDate().toString().padStart(2, '0')}`;

  return (
    <div id="eclipse-bengali-panjika-deck" className={`space-y-4 ${className}`}>
      {/* 1. Header Toolbar & Date Navigator */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-1.5 h-6 rounded-full bg-amber-500 shadow-xs shadow-amber-500/60" />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-neutral-100 tracking-wide flex items-center gap-2 truncate">
              <span>বাংলা পঞ্জিকা</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                {bengaliDate.yearBn} বঙ্গাব্দ
              </span>
            </h2>
            <p className="text-[10px] text-neutral-400 truncate">
              {isEnOnly
                ? 'Authentic Bengal Drik Panjika • Kolkata Coordinates'
                : 'বিশুদ্ধ সিদ্ধান্ত ও দ্রিক জ্যোতিষ গণনা • কলকাতা কেন্দ্রিক'}
            </p>
          </div>
        </div>

        {/* Language & Today Controls */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            id="btn-panjika-lang-toggle"
            onClick={() =>
              setDisplayLanguage((prev) =>
                prev === 'bn' ? 'bilingual' : prev === 'bilingual' ? 'en' : 'bn'
              )
            }
            className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-colors"
            title="Toggle Language Display"
          >
            <Languages size={11} className="text-amber-400" />
            <span>{displayLanguage === 'bn' ? 'বাংলা' : displayLanguage === 'bilingual' ? 'দ্বিভাষিক' : 'EN'}</span>
          </button>

          {!isViewingToday && (
            <button
              id="btn-panjika-goto-today"
              onClick={goToToday}
              className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg text-[10px] flex items-center gap-1 shadow-xs transition-transform active:scale-95"
            >
              <RotateCcw size={10} />
              <span>আজ</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Interactive Date Navigation Bar */}
      <GlassPanel className="p-2.5 flex items-center justify-between gap-2 border border-neutral-800/80 bg-neutral-950/80">
        <button
          id="btn-panjika-prev-day"
          onClick={goToPreviousDay}
          className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          title="পূর্ববর্তী দিন (Previous Day)"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex-1 text-center min-w-0">
          <div className="flex items-center justify-center gap-1.5">
            <Calendar size={12} className="text-amber-400" />
            <span className="text-xs font-bold text-neutral-200 truncate">
              {isEnOnly ? gregorianFormattedEn : gregorianFormattedBn}
            </span>
          </div>
          {(isBilingual || isEnOnly) && (
            <p className="text-[10px] text-neutral-400 truncate mt-0.5">
              {isEnOnly ? gregorianFormattedBn : gregorianFormattedEn}
            </p>
          )}
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          {/* Quick Date Picker Trigger */}
          <div className="relative">
            <button
              id="btn-panjika-datepicker-open"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`p-1.5 rounded-lg text-neutral-300 hover:text-white transition-colors ${
                showDatePicker ? 'bg-amber-500 text-neutral-950' : 'bg-neutral-900 hover:bg-neutral-800'
              }`}
              title="তারিখ নির্বাচন করুন (Select Date)"
            >
              <Calendar size={14} />
            </button>
            {showDatePicker && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-neutral-900 border border-neutral-700 rounded-xl p-2.5 shadow-2xl">
                <p className="text-[10px] font-semibold text-neutral-400 mb-1">তারিখ বাছুন</p>
                <input
                  type="date"
                  value={formattedDateForInput}
                  onChange={handleDateInputChange}
                  className="bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            )}
          </div>

          <button
            id="btn-panjika-next-day"
            onClick={goToNextDay}
            className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
            title="পরবর্তী দিন (Next Day)"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </GlassPanel>

      {/* 3. Hero Bengali Date Card */}
      <div
        id="card-bengali-hero-date"
        className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-neutral-950 to-neutral-950 p-4 shadow-xl shadow-amber-950/20"
      >
        {/* Subtle decorative background watermarks */}
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
              <Sparkles size={11} className="text-amber-400" />
              <span>{bengaliDate.seasonBn}</span>
              {(isBilingual || isEnOnly) && (
                <span className="text-amber-200/60 font-normal">({bengaliDate.seasonEn})</span>
              )}
            </span>

            <span className="text-[10px] text-neutral-400 flex items-center gap-1 font-mono">
              <Compass size={11} className="text-emerald-400" />
              <span>কলকাতা (Kolkata)</span>
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-black text-amber-300 tracking-tight flex items-baseline gap-2">
              <span>{bengaliDate.dayBengali} {bengaliDate.monthNameBn}</span>
              <span className="text-base font-normal text-amber-200/70 font-mono">
                {bengaliDate.yearBn}
              </span>
            </h1>

            <p className="text-xs font-medium text-neutral-300 mt-0.5">
              {bengaliDate.bangabdaFormatted}
              {(isBilingual || isEnOnly) && (
                <span className="text-neutral-500 ml-1.5 font-normal">
                  • {bengaliDate.day} {bengaliDate.monthNameEn} {bengaliDate.yearEn} Bangabda
                </span>
              )}
            </p>
          </div>

          {/* Active festival today banner if matching */}
          {activeFestivalsToday.length > 0 && (
            <div className="mt-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/50 flex items-start gap-2 animate-pulse">
              <Flame size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs min-w-0">
                <span className="font-bold text-amber-300 uppercase text-[10px] tracking-wider block">
                  আজকের বিশেষ উৎসব • Special Festival Today
                </span>
                {activeFestivalsToday.map((fest) => (
                  <div key={fest.id} className="mt-0.5">
                    <p className="font-bold text-white text-xs">{fest.pujaNameBn} ({fest.pujaNameEn})</p>
                    <p className="text-[11px] text-amber-200/90 leading-tight">{fest.timingDetailsBn}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Panchang Core Quad (Tithi, Nakshatra, Paksha, Sun Timings) */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Tithi Card */}
        <GlassPanel className="p-3 bg-neutral-950/70 border border-neutral-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-neutral-400 flex items-center gap-1.5">
              <Moon size={13} className="text-indigo-400" />
              <span>তিথি (Tithi)</span>
            </span>
            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 font-mono">
              {tithi.isVerified ? 'যাচাইকৃত' : 'অনুপলব্ধ'}
            </span>
          </div>

          <div>
            <p className="text-sm font-bold text-neutral-100 truncate">
              {tithi.nameBn}
            </p>
            {(isBilingual || isEnOnly) && (
              <p className="text-[10px] text-neutral-400 truncate">{tithi.nameEn}</p>
            )}
          </div>

          <div className="space-y-1 pt-1 border-t border-neutral-900 text-[10px]">
            <div className="flex justify-between text-neutral-400">
              <span>পক্ষ (Paksha):</span>
              <span className="font-semibold text-neutral-200">{tithi.pakshaBn}</span>
            </div>
            {tithi.endTimeFormatted && (
              <p className="text-[9.5px] text-neutral-500 truncate leading-tight">
                {tithi.endTimeFormatted}
              </p>
            )}
          </div>
        </GlassPanel>

        {/* Nakshatra Card */}
        <GlassPanel className="p-3 bg-neutral-950/70 border border-neutral-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-neutral-400 flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-400" />
              <span>নক্ষত্র (Nakshatra)</span>
            </span>
            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono">
              {nakshatra.isVerified ? 'লাহিড়ী' : 'অনুপলব্ধ'}
            </span>
          </div>

          <div>
            <p className="text-sm font-bold text-neutral-100 truncate">
              {nakshatra.nameBn}
            </p>
            {(isBilingual || isEnOnly) && (
              <p className="text-[10px] text-neutral-400 truncate">{nakshatra.nameEn}</p>
            )}
          </div>

          <div className="space-y-1 pt-1 border-t border-neutral-900 text-[10px]">
            <div className="flex justify-between text-neutral-400">
              <span>অধিপতি দেব:</span>
              <span className="font-semibold text-neutral-200">{nakshatra.deityBn || 'মিত্র'}</span>
            </div>
            <p className="text-[9.5px] text-neutral-500 truncate leading-tight">
              সূর্যসিদ্ধান্ত সাপেক্ষে নির্ধারিত
            </p>
          </div>
        </GlassPanel>

        {/* Sunrise Card */}
        <GlassPanel className="p-3 bg-neutral-950/70 border border-neutral-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-amber-400 flex items-center gap-1.5">
              <Sunrise size={13} className="text-amber-400" />
              <span>সূর্যোদয় (Sunrise)</span>
            </span>
            <span className="text-[9.5px] text-neutral-500 font-mono">IST</span>
          </div>

          <div>
            <p className="text-sm font-bold text-amber-200 font-mono">
              {solarTimings.sunrise}
            </p>
            {(isBilingual || isEnOnly) && (
              <p className="text-[10px] text-neutral-400 font-mono">{solarTimings.sunriseEn}</p>
            )}
          </div>

          <p className="text-[9.5px] text-neutral-500 border-t border-neutral-900 pt-1 truncate">
            মধ্যাহ্ন: {solarTimings.noon}
          </p>
        </GlassPanel>

        {/* Sunset Card */}
        <GlassPanel className="p-3 bg-neutral-950/70 border border-neutral-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-rose-400 flex items-center gap-1.5">
              <Sunset size={13} className="text-rose-400" />
              <span>সূর্যাস্ত (Sunset)</span>
            </span>
            <span className="text-[9.5px] text-neutral-500 font-mono">IST</span>
          </div>

          <div>
            <p className="text-sm font-bold text-rose-200 font-mono">
              {solarTimings.sunset}
            </p>
            {(isBilingual || isEnOnly) && (
              <p className="text-[10px] text-neutral-400 font-mono">{solarTimings.sunsetEn}</p>
            )}
          </div>

          <p className="text-[9.5px] text-neutral-500 border-t border-neutral-900 pt-1 truncate">
            দিবা পরিমাণ: {solarTimings.dayLengthFormatted}
          </p>
        </GlassPanel>
      </div>

      {/* 5. Auspicious & Inauspicious Times (শুভ ও অশুভ সময়) */}
      <GlassPanel className="p-3.5 bg-neutral-950/80 border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
          <h3 className="text-xs font-bold text-neutral-200 tracking-wide flex items-center gap-1.5 uppercase">
            <Clock size={13} className="text-amber-400" />
            <span>দৈনিক শুভ ও বর্জনীয় সময় (Daily Windows)</span>
          </h3>
          <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-400 font-mono">
            Kolkata IST
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {/* Amrita Yoga */}
          <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300 flex items-center gap-1">
                <Sparkles size={12} />
                <span>{auspiciousTimings.amritaYoga.nameBn}</span>
              </span>
              <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-semibold">
                পরম শুভ
              </span>
            </div>
            <div className="space-y-0.5 pt-1">
              {auspiciousTimings.amritaYoga.timeSlotsBn.map((slot, i) => (
                <p key={i} className="text-[11px] font-mono text-neutral-200">
                  {slot}
                </p>
              ))}
            </div>
            <p className="text-[9.5px] text-amber-200/60 leading-tight pt-1">
              {auspiciousTimings.amritaYoga.descriptionBn}
            </p>
          </div>

          {/* Rahu Kaal */}
          <div className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-400 flex items-center gap-1">
                <AlertCircle size={12} />
                <span>{auspiciousTimings.rahuKaal.nameBn}</span>
              </span>
              <span className="text-[9px] px-1 rounded bg-rose-500/20 text-rose-300 font-semibold">
                বর্জনীয় কাল
              </span>
            </div>
            <div className="space-y-0.5 pt-1">
              {auspiciousTimings.rahuKaal.timeSlotsBn.map((slot, i) => (
                <p key={i} className="text-[11px] font-mono text-rose-200 font-semibold">
                  {slot}
                </p>
              ))}
            </div>
            <p className="text-[9.5px] text-rose-200/60 leading-tight pt-1">
              {auspiciousTimings.rahuKaal.descriptionBn}
            </p>
          </div>

          {/* Mahendra Yoga */}
          <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800 space-y-0.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-emerald-300">
                {auspiciousTimings.mahendraYoga.nameBn}
              </span>
              <span className="text-[9px] text-emerald-400">শুভ সময়</span>
            </div>
            {auspiciousTimings.mahendraYoga.timeSlotsBn.map((slot, i) => (
              <p key={i} className="text-[10px] font-mono text-neutral-300">
                {slot}
              </p>
            ))}
          </div>

          {/* Abhijit Muhurta */}
          <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800 space-y-0.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-indigo-300">
                {auspiciousTimings.abhijitMuhurta?.nameBn}
              </span>
              <span className="text-[9px] text-indigo-400">বিজয় মুহূর্ত</span>
            </div>
            <p className="text-[10px] font-mono text-neutral-300">
              {auspiciousTimings.abhijitMuhurta?.timeSlotsBn[0]}
            </p>
          </div>
        </div>
      </GlassPanel>

      {/* 6. Important Durga Puja / Puja Tithis Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <Flame size={14} className="text-amber-500" />
            <h3 className="text-xs font-bold text-neutral-100 uppercase tracking-wide">
              গুরুত্বপূর্ণ পূজা ও তিথি সময়সূচি (Puja Tithis)
            </h3>
          </div>
          <span className="text-[10px] text-amber-400 font-mono">
            {bengaliDate.yearBn} বঙ্গাব্দ
          </span>
        </div>

        {/* Filter Chips */}
        <div className="flex space-x-1.5 bg-neutral-900/80 p-1 rounded-xl border border-neutral-800 text-[10px]">
          {[
            { key: 'ALL', labelBn: 'সমস্ত পূজা', labelEn: 'All Pujas' },
            { key: 'DURGA_PUJA', labelBn: 'দুর্গাপূজা', labelEn: 'Durga Puja' },
            { key: 'POST_PUJA', labelBn: 'লক্ষ্মী ও কালীপূজা', labelEn: 'Post-Puja' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedFestivalFilter(tab.key as any)}
              className={`flex-1 py-1 px-2 rounded-lg font-semibold transition-all text-center ${
                selectedFestivalFilter === tab.key
                  ? 'bg-amber-500 text-neutral-950 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {isEnOnly ? tab.labelEn : tab.labelBn}
            </button>
          ))}
        </div>

        {/* Festival Cards List */}
        <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-0.5">
          {filteredFestivals.map((fest) => {
            const isFestActive =
              activeDate.toISOString().slice(0, 10) === fest.gregorianDate;

            return (
              <GlassPanel
                key={fest.id}
                id={`card-festival-tithi-${fest.id}`}
                className={`p-3 transition-all ${
                  isFestActive
                    ? 'border-amber-500/80 bg-amber-950/20 shadow-lg shadow-amber-950/30'
                    : 'border-neutral-800/80 bg-neutral-950/60 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-bold text-neutral-100">
                        {fest.pujaNameBn}
                      </h4>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 font-medium">
                        {fest.tithiBn}
                      </span>
                    </div>

                    {(isBilingual || isEnOnly) && (
                      <p className="text-[10px] text-neutral-400">
                        {fest.pujaNameEn} • {fest.tithiEn}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-1 font-mono">
                      <span className="text-amber-300 font-semibold">
                        {fest.bengaliDateBn}
                      </span>
                      <span>•</span>
                      <span>{fest.gregorianDisplayBn}</span>
                    </div>

                    <p className="text-[11px] text-neutral-300 mt-1.5 leading-relaxed">
                      {fest.timingDetailsBn}
                    </p>
                  </div>

                  <button
                    id={`btn-jump-to-fest-${fest.id}`}
                    onClick={() => jumpToFestival(fest)}
                    className="shrink-0 p-2 rounded-xl bg-neutral-900 hover:bg-amber-500 hover:text-neutral-950 text-neutral-300 transition-all flex flex-col items-center gap-0.5 text-[9px] font-semibold"
                    title="এই তিথির পঞ্জিকা দেখুন (Inspect this day)"
                  >
                    <ArrowRight size={12} />
                    <span>পঞ্জিকা</span>
                  </button>
                </div>
              </GlassPanel>
            );
          })}
        </div>
      </div>

      {/* 7. Provenance & Astronomical Attribution */}
      <div className="p-3 rounded-xl bg-neutral-900/40 border border-neutral-800/60 text-[10px] text-neutral-400 flex items-start gap-2">
        <ShieldCheck size={14} className="text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-neutral-300">
            {isEnOnly ? panjikaSourceEn : panjikaSourceBn}
          </p>
          <p className="text-neutral-500 text-[9px] leading-tight">
            কলকাতার প্রকৃত দ্রাঘিমা (88.36° E) ও অক্ষাংশ (22.57° N) অনুযায়ী সূর্যোদয়, সূর্যাস্ত ও দ্রিক তিথির নিখুঁত জ্যোতির্বৈজ্ঞানিক স্থানাঙ্ক।
          </p>
        </div>
      </div>
    </div>
  );
};
