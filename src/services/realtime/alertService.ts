import { Alert, Location } from '../../types';

export class AlertService {
  private alerts: Alert[] = [
    {
      id: 'alert-1',
      title: 'Extreme Crowd Spike',
      description: 'Sreebhumi Sporting Club has reached EXTREME capacity. Entry queues exceed 2 hours. Consider visiting Ballygunge Cultural or Chetla Agrani instead.',
      type: 'crowd',
      itemId: 'pandal-1',
      timestamp: Date.now() - 5 * 60000,
      active: true,
    },
    {
      id: 'alert-2',
      title: 'Road Blocked near Bowbazar',
      description: 'Lebutala Lane is temporarily blocked due to excessive pedestrian ingress. Traffic is diverted to Central Avenue.',
      type: 'traffic',
      itemId: 'pandal-2',
      timestamp: Date.now() - 15 * 60000,
      active: true,
    },
    {
      id: 'alert-3',
      title: 'Heavy Rain Forecast',
      description: 'Subtle rain shower expected over South Kolkata from 7:00 PM to 8:30 PM. Keep umbrellas handy.',
      type: 'weather',
      timestamp: Date.now() - 30 * 60000,
      active: true,
    },
  ];

  async getActiveAlerts(): Promise<Alert[]> {
    return this.alerts.filter(a => a.active);
  }

  async getAlertsForItem(itemId: string): Promise<Alert[]> {
    return this.alerts.filter(a => a.itemId === itemId && a.active);
  }

  // Smart Rerouting check:
  // If a route has a pandal/event, check if there's any critical alert (e.g. EXTREME crowd level)
  // and suggest a nearby alternative.
  checkSmartReroute(itemId: string): { trigger: boolean; reason?: string; replacementId?: string; replacementName?: string } {
    if (itemId === 'pandal-1') {
      // Sreebhumi is EXTREME. Suggest replacement with Ballygunge Cultural (pandal-4) or Chetla Agrani (pandal-5).
      return {
        trigger: true,
        reason: 'Sreebhumi Sporting Club is now EXTREME crowd. Entrance queues exceed 2 hours.',
        replacementId: 'pandal-4',
        replacementName: 'Ballygunge Cultural Association',
      };
    }
    if (itemId === 'pandal-2') {
      // Santosh Mitra Square is HEAVY and road blocked. Suggest Chetla Agrani (pandal-5).
      return {
        trigger: true,
        reason: 'Lebutala Lane leading to Santosh Mitra Square is temporarily blocked due to pedestrian congestion.',
        replacementId: 'pandal-5',
        replacementName: 'Chetla Agrani Club',
      };
    }
    return { trigger: false };
  }
}

export const alertService = new AlertService();
export const AlertServiceProvider = alertService;
export const RealtimeServiceProvider = alertService; // combining RealtimeService duties
export const RealtimeService = alertService;
