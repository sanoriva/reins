import type { ReportDto, ReportKindDto, ReportSummaryDto } from './report.dto';
import type { Report, ReportDetail } from './report.model';

const KIND: Record<ReportKindDto, string> = {
  consulta: 'Consulta',
  analisis: 'Análisis',
  urgencias: 'Urgencias',
  revision: 'Revisión',
};

export const toReport = (dto: ReportSummaryDto): Report => ({
  id: dto.id,
  title: dto.title,
  kind: dto.kind,
  kindLabel: KIND[dto.kind],
  date: new Date(`${dto.date}T12:00`),
  doctor: dto.doctor,
  summary: dto.summary,
});

export const toReportDetail = (dto: ReportDto): ReportDetail => ({
  ...toReport(dto),
  html: dto.html,
  glossary: dto.glossary,
  previous: dto.previous.map((p) => ({ ...p, date: new Date(`${p.date}T12:00`) })),
});
