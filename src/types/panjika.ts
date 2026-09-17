/**
 * Eclipse GPS — Bengali Panjika Types
 * 
 * Typed data structures for the authentic Bengal Panjika (বাংলা পঞ্জিকা),
 * astronomical calculations, Tithi, Nakshatra, Paksha, solar timings,
 * auspicious windows (অমৃতযোগ, মাহেন্দ্রযোগ), and Durga Puja tithis.
 */

export type PakshaType = 'SHUKLA' | 'KRISHNA';

export interface BengaliDate {
  day: number;              // e.g. 1
  dayBengali: string;       // e.g. "১"
  monthIndex: number;       // 0-11
  monthNameEn: string;      // e.g. "Ashwin"
  monthNameBn: string;      // e.g. "আশ্বিন"
  seasonBn: string;         // e.g. "শরৎকাল" (Autumn)
  seasonEn: string;         // e.g. "Sharat (Autumn)"
  yearBn: string;           // e.g. "১৪৩৩"
  yearEn: number;           // e.g. 1433
  bangabdaFormatted: string;// e.g. "১ আশ্বিন ১৪৩৩ বঙ্গাব্দ"
}

export interface TithiInfo {
  index: number;            // 1-30
  nameBn: string;           // e.g. "শুক্লা পঞ্চমী" or "মহা সপ্তমী"
  nameEn: string;           // e.g. "Shukla Panchami"
  paksha: PakshaType;
  pakshaBn: string;         // e.g. "শুক্লপক্ষ" or "কৃষ্ণপক্ষ"
  pakshaEn: string;         // e.g. "Shukla Paksha" or "Krishna Paksha"
  completionPercentage: number; // 0-100% of current tithi elapsed
  endTimeFormatted?: string;// e.g. "রাত ১১:৪২ পর্যন্ত" / "Until 11:42 PM"
  isVerified: boolean;
  notesBn?: string;
}

export interface NakshatraInfo {
  index: number;            // 1-27
  nameBn: string;           // e.g. "অনুরাধা"
  nameEn: string;           // e.g. "Anuradha"
  deityBn?: string;         // e.g. "মিত্র"
  isVerified: boolean;
  endTimeFormatted?: string;// e.g. "পরবর্তী দিন ভোর ০৫:১২ পর্যন্ত"
}

export interface SolarTimings {
  sunrise: string;          // e.g. "০৫:২৪ AM"
  sunset: string;           // e.g. "০৫:৪০ PM"
  sunriseEn: string;        // e.g. "05:24 AM"
  sunsetEn: string;         // e.g. "05:40 PM"
  noon: string;             // e.g. "১১:৩২ AM"
  dayLengthFormatted: string; // e.g. "১২ ঘণ্টা ১৬ মিনিট"
  city: string;             // "Kolkata, West Bengal (কলকাতা)"
  isVerified: boolean;
}

export interface AuspiciousPeriod {
  nameBn: string;           // e.g. "অমৃতযোগ" (Amrita Yoga)
  nameEn: string;
  type: 'AUSPICIOUS' | 'INAUSPICIOUS' | 'NEUTRAL';
  timeSlotsBn: string[];    // e.g. ["সকাল ০৬:৪৮ - ০৮:২২", "দুপুর ০১:০৮ - ০৩:৩৪"]
  timeSlotsEn: string[];
  descriptionBn: string;
  isVerified: boolean;
}

export interface AuspiciousTimings {
  amritaYoga: AuspiciousPeriod;
  mahendraYoga: AuspiciousPeriod;
  rahuKaal: AuspiciousPeriod;
  varjyaKaal?: AuspiciousPeriod;
  abhijitMuhurta?: AuspiciousPeriod;
  isVerified: boolean;
}

export interface ImportantPujaTithi {
  id: string;
  pujaNameBn: string;       // e.g. "মহালয়া"
  pujaNameEn: string;       // e.g. "Mahalaya"
  tithiBn: string;          // e.g. "অমাবস্যা"
  tithiEn: string;
  gregorianDate: string;    // "2026-10-10"
  gregorianDisplayBn: string; // "১০ অক্টোবর ২০২৬, শনিবার"
  gregorianDisplayEn: string; // "Saturday, 10 October 2026"
  bengaliDateBn: string;    // "২৪ আশ্বিন ১৪৩৩"
  bengaliDateEn: string;    // "24 Ashwin 1433"
  timingDetailsBn: string;  // e.g. "ভোর ০৪:০০ থেকে পিতৃ তর্পণ ও মহিষাসুরমর্দিনী"
  timingDetailsEn: string;
  significanceBn: string;
  significanceEn: string;
  isToday?: boolean;
  isUpcoming?: boolean;
  daysRemaining?: number;
}

export interface PanjikaDayData {
  gregorianDate: Date;
  gregorianFormattedBn: string; // e.g. "১৭ সেপ্টেম্বর ২০২৬, বৃহস্পতিবার"
  gregorianFormattedEn: string; // e.g. "Thursday, 17 September 2026"
  weekdayBn: string;            // e.g. "বৃহস্পতিবার"
  weekdayEn: string;            // e.g. "Thursday"
  bengaliDate: BengaliDate;
  tithi: TithiInfo;
  nakshatra: NakshatraInfo;
  solarTimings: SolarTimings;
  auspiciousTimings: AuspiciousTimings;
  activeFestivalsToday: ImportantPujaTithi[];
  upcomingImportantPujas: ImportantPujaTithi[];
  panjikaSourceBn: string;      // e.g. "বিশুদ্ধ সিদ্ধান্ত ও গুপ্তপ্রেস পঞ্জিকা ঐতিহ্য অনুযায়ী গণিত"
  panjikaSourceEn: string;      // e.g. "Calculated per Bisuddhasiddhanta & Gupta Press traditions"
}
