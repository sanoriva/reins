/** A report in the list. */
export interface Report {
  id: string;
  title: string;
  kind: string;
  kindLabel: string;
  date: Date;
  doctor: string;
  summary: string;
}

/** A full report, with its glossary and the related previous tests. */
export interface ReportDetail extends Report {
  html: string;
  glossary: { term: string; meaning: string }[];
  previous: { date: Date; name: string; result: string }[];
}
