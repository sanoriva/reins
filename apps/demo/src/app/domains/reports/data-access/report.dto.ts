export type ReportKindDto = 'consulta' | 'analisis' | 'urgencias' | 'revision';

export interface ReportSummaryDto {
  id: string;
  title: string;
  kind: ReportKindDto;
  date: string;
  doctor: string;
  summary: string;
}

export interface ReportDto extends ReportSummaryDto {
  html: string;
  glossary: { term: string; meaning: string }[];
  previous: { date: string; name: string; result: string }[];
}
