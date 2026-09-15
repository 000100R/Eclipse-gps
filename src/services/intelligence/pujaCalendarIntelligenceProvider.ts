/**
 * Eclipse GPS — Puja Calendar Intelligence Layer Provider (Phase 13.6)
 * 
 * High-precision festival and ritual intelligence provider for the Eclipse Intelligence Grid.
 * Connects the Puja Calendar with maps, pandals, and real-time festival timeline filters.
 */

import {
  IntelligenceDataProvider,
  IntelligenceLayerId,
  DataProviderMetadata,
  MapViewportBounds,
} from '../../types/intelligence';
import { FestivalEvent, CalendarPeriodFilter, PujaDayType } from '../../types/festival';
import { Location } from '../../types';
import { pujaCalendarService } from './pujaCalendarService';
import { intelligenceLayerService } from './intelligenceLayerService';

export class PujaCalendarIntelligenceProvider
  implements IntelligenceDataProvider<FestivalEvent>
{
  public readonly layerId: IntelligenceLayerId = 'PUJA_CALENDAR';

  public readonly metadata: DataProviderMetadata = {
    id: 'PUJA_CALENDAR',
    name: 'Puja Calendar & Festival Intelligence',
    sourceType: 'curated',
    refreshIntervalMs: 60000,
    isAvailable: true,
  };

  private activePeriod: CalendarPeriodFilter = 'ALL';
  private selectedYear: number = 2026;
  private userLocation?: Location;

  constructor() {
    this.updateLayerStatus();
  }

  public setUserLocation(loc?: Location): void {
    this.userLocation = loc;
  }

  public setYear(year: number): void {
    this.selectedYear = year;
    pujaCalendarService.setYear(year);
    this.updateLayerStatus();
  }

  public setPeriod(period: CalendarPeriodFilter): void {
    this.activePeriod = period;
    this.updateLayerStatus();
  }

  public getActivePeriod(): CalendarPeriodFilter {
    return this.activePeriod;
  }

  public getSelectedYear(): number {
    return this.selectedYear;
  }

  private updateLayerStatus(): void {
    const events = this.getData();
    intelligenceLayerService.updateItemCount(this.layerId, events.length);
  }

  public getData(bounds?: MapViewportBounds): FestivalEvent[] {
    const allForYear = pujaCalendarService.getEventsForYear(this.selectedYear);
    if (this.activePeriod === 'ALL') {
      return allForYear;
    }
    return pujaCalendarService.getEventsByPeriod(this.activePeriod, new Date(), this.selectedYear);
  }

  public async refresh(bounds?: MapViewportBounds): Promise<FestivalEvent[]> {
    this.updateLayerStatus();
    return this.getData(bounds);
  }

  public async load(bounds: MapViewportBounds, zoom?: number): Promise<FestivalEvent[]> {
    return this.refresh(bounds);
  }

  public clear(): void {
    // in-memory curated data; no cache needed
  }

  public destroy(): void {
    // clean up if necessary
  }

  public isAvailable(): boolean {
    return true;
  }

  public async search(query: string, location?: Location): Promise<FestivalEvent[]> {
    if (!query || query.trim().length === 0) {
      return this.getData();
    }
    const q = query.toLowerCase().trim();
    const all = pujaCalendarService.getEventsForYear(this.selectedYear);

    return all.filter((e) => {
      return (
        e.name.toLowerCase().includes(q) ||
        (e.bengaliName && e.bengaliName.toLowerCase().includes(q)) ||
        e.pujaDay.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.location && e.location.toLowerCase().includes(q)) ||
        (e.tithi && e.tithi.toLowerCase().includes(q))
      );
    });
  }

  public getEventsForDay(day: PujaDayType): FestivalEvent[] {
    return pujaCalendarService.getEventsForDay(day, this.selectedYear);
  }

  public getEventsForPandal(pandalIdOrName: string): FestivalEvent[] {
    return pujaCalendarService.getEventsForPandal(pandalIdOrName, this.selectedYear);
  }
}

export const pujaCalendarIntelligenceProvider = new PujaCalendarIntelligenceProvider();
intelligenceLayerService.registerProvider(pujaCalendarIntelligenceProvider);
