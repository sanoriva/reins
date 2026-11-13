import type { Report, ReportDetail } from './report.model';

export abstract class ReportPort {
  abstract mine(): Promise<Report[]>;
  abstract read(reportId: string): Promise<ReportDetail>;
}
