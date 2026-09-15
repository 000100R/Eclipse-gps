import { CrowdLevel, CrowdReport, Location, ReportSource } from '../../types';

export class CrowdService {
  private reportsKey = 'eclipse_gps_crowd_reports';
  private rateLimitKey = 'eclipse_gps_last_report_time';

  constructor() {
    this.purgeDemoReports();
  }

  /**
   * Purges any historical mock or demo reports from storage.
   * Only real user-submitted community reports are preserved.
   */
  private purgeDemoReports() {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(this.reportsKey);
      if (data) {
        try {
          const reports: CrowdReport[] = JSON.parse(data);
          const realReports = reports.filter(
            (r) => !['rep-1', 'rep-2', 'rep-3', 'rep-4'].includes(r.id) && r.source !== 'DEMO'
          );
          localStorage.setItem(this.reportsKey, JSON.stringify(realReports));
        } catch {
          localStorage.removeItem(this.reportsKey);
        }
      }
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

  getLatestCrowdStatus(itemId: string): { level: CrowdLevel; source: ReportSource; timestamp: number; description?: string } {
    const itemReports = this.getReportsForItem(itemId);
    if (itemReports.length > 0) {
      // Sort descending by timestamp
      const sorted = [...itemReports].sort((a, b) => b.timestamp - a.timestamp);
      // Only treat as valid if within the last 45 minutes
      if (Date.now() - sorted[0].timestamp < 45 * 60 * 1000) {
        return {
          level: sorted[0].level,
          source: sorted[0].source,
          timestamp: sorted[0].timestamp,
          description: sorted[0].description,
        };
      }
    }
    
    // Strict requirement: Never fabricate crowd levels. Return UNAVAILABLE when no real report exists.
    return {
      level: 'UNAVAILABLE',
      source: 'UNAVAILABLE',
      timestamp: Date.now(),
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
