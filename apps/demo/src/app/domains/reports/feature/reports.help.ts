import type { Help } from '../../../transversal/help';

export const REPORTS_HELP: Help = {
  "title": "Mis informes",
  "intro": "Tus informes médicos y análisis, con filtro por tipo.",
  "file": "domains/reports/feature/reports.component.ts",
  "cases": [
    {
      "title": "¿Qué informes tengo?",
      "say": "¿Qué informes tengo?",
      "action": "read_content",
      "what": "Tu asistente te dice tus informes, con su tipo y su fecha.",
      "how": "Contenido con datos propios, con el id de cada informe para poder abrirlo.",
      "code": "const remove = this.agent.provideContent('reports', () => ({"
    },
    {
      "title": "Filtrar",
      "say": "Enséñame solo los análisis",
      "action": "filter_reports",
      "what": "Filtra la lista. Los tipos salen de tus informes, no de una lista fija.",
      "how": "La acción se ofrece cuando llegan los datos, con los tipos que hay (z.enum).",
      "code": "name: 'filter_reports',\ndescription: 'Filtra los informes que se ven por su tipo.',"
    },
    {
      "title": "Abrir uno",
      "say": "Abre el informe del cardiólogo",
      "action": "navigate",
      "what": "Abre /informes/cardiologia-palpitaciones.",
      "how": "La pantalla del informe recibe su id en el path.",
      "code": "params: z.object({ id: z.string().min(1).describe('El id del informe, tal como lo ves con read_content en Mis informes') }),",
      "file": "domains/reports/feature/reports.routes.ts"
    }
  ]
};
