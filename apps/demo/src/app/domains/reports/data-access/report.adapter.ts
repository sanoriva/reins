import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE } from '../../../core/api.config';
import type { ReportDto, ReportSummaryDto } from './report.dto';
import { toReport, toReportDetail } from './report.mapper';
import type { Report, ReportDetail } from './report.model';
import { ReportPort } from './report.port';

@Injectable()
export class ReportHttpAdapter extends ReportPort {
  private readonly http = inject(HttpClient);

  async mine(): Promise<Report[]> {
    return (await firstValueFrom(this.http.get<ReportSummaryDto[]>(`${API_BASE}/reports`))).map(toReport);
  }

  async read(reportId: string): Promise<ReportDetail> {
    return toReportDetail(await firstValueFrom(this.http.get<ReportDto>(`${API_BASE}/reports/${encodeURIComponent(reportId)}`)));
  }
}
