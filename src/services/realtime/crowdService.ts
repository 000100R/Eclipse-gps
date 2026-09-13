import { CrowdLevel, CrowdReport, Location, ReportSource } from '../../types';

export class CrowdService {
  private reportsKey = 'eclipse_gps_crowd_reports';
  private rateLimitKey = 'eclipse_gps_last_report_time';

  constructor() {
    this.seedInitialReports();
  }

  private seedInitialReports() {
    if (typeof window !== 'undefined' && !localStorage.getItem(this.reportsKey)) {
      const initialReports: CrowdReport[] = [
        {
          id: 'rep-1',
          itemId: 'pandal-1', // Sreebhumi
          level: 'EXTREME',
          description: 'The queue starts from the main bypass. Police are managing traffic. Avoid taking cars!',
          timestamp: Date.now() - 5 * 60000, // 5 min ago
          source: 'COMMUNITY REPORT',
        },
        {
          id: 'rep-2',
          itemId: 'pandal-2', // Santosh Mitra
          level: 'HEAVY',
          description: 'Main gate entry is slow. Queue is moving but it is crowded.',
          timestamp: Date.now() - 12 * 60000, // 12 min ago
          source: 'ORGANIZER',
        },
        {
          id: 'rep-3',
          itemId: 'pandal-3', // Maddox Square
          level: 'MODERATE',
          description: 'Spacious grounds, perfect time for Adda. Entry is very easy.',
          timestamp: Date.now() - 25 * 60000,
          source: 'COMMUNITY REPORT',
        },
        {
          id: 'rep-4',
          itemId: 'pandal-4', // Ballygunge Cultural
          level: 'LOW',
          description: 'Almost no queue right now. Smooth entry.',
          timestamp: Date.now() - 1 * 60000,
          source: 'LIVE API',
        },
      ];
      localStorage.setItem(this.reportsKey, JSON.stringify(initialReports));
    }
  }

  getAllReports(): CrowdReport[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(this.reportsKey);
    return data ? JSON.parse(data) : [];
  }

  getReportsForItem(itemId: string): CrowdReport[] {
    return this.getAllReports().filter(r => r.itemId === itemId);
  }

  getLatestCrowdStatus(itemId: string, defaultLevel: CrowdLevel = 'MODERATE'): { level: CrowdLevel; source: ReportSource; timestamp: number; description?: string } {
    const itemReports = this.getReportsForItem(itemId);
    if (itemReports.length > 0) {
      // Sort descending by timestamp
      const sorted = [...itemReports].sort((a, b) => b.timestamp - a.timestamp);
      return {
        level: sorted[0].level,
        source: sorted[0].source,
        timestamp: sorted[0].timestamp,
        description: sorted[0].description,
      };
    }
    
    return {
      level: defaultLevel,
      source: 'DEMO',
      timestamp: Date.now() - 24 * 3600000, // older mock
    };
  }

  async reportCrowd(itemId: string, level: CrowdLevel, description: string): Promise<{ success: boolean; message: string; report?: CrowdReport }> {
    if (typeof window === 'undefined') return { success: false, message: 'Client execution required' };

    // Spam Rate Limit: Allow report only once every 30 seconds
    const lastReportTime = localStorage.getItem(this.rateLimitKey);
    const now = Date.now();
    if (lastReportTime && now - parseInt(lastReportTime) < 30000) {
      const remainingSeconds = Math.ceil((30000 - (now - parseInt(lastReportTime))) / 1000);
      return {
        success: false,
        message: `Please wait ${remainingSeconds} seconds before submitting another report.`,
      };
    }

    const newReport: CrowdReport = {
      id: `rep-user-${Math.random().toString(36).substr(2, 9)}`,
      itemId,
      level,
      description,
      timestamp: now,
      source: 'COMMUNITY REPORT',
    };

    const reports = this.getAllReports();
    reports.push(newReport);
    localStorage.setItem(this.reportsKey, JSON.stringify(reports));
    localStorage.setItem(this.rateLimitKey, now.toString());

    return {
      success: true,
      message: 'Thank you for your community report!',
      report: newReport,
    };
  }
}

export const crowdService = new CrowdService();
export const CrowdServiceProvider = crowdService;
