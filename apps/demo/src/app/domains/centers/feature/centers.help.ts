import type { Help } from '../../../transversal/help';

export const CENTERS_HELP: Help = {
  "title": "Centros de salud",
  "intro": "Buscar centros, hospitales y centros de especialidades, con sus horarios. No hace falta entrar.",
  "file": "domains/centers/feature/centers.component.ts",
  "cases": [
    {
      "title": "Buscar un centro",
      "say": "¿Qué centros hay en Getafe?",
      "action": "navigate",
      "what": "Tu asistente abre /centros?q=getafe. La búsqueda queda en la dirección: recargar o volver atrás funciona.",
      "how": "La ruta define su parámetro q; como no está en el path, va en la query.",
      "code": "params: z.object({ q: z.string().min(1).describe('Localidad, nombre del centro o servicio que hay que buscar').optional() }),",
      "file": "domains/centers/feature/centers.routes.ts"
    },
    {
      "title": "¿A qué hora abre?",
      "say": "¿Hasta qué hora abre el Río Tajo los sábados?",
      "action": "read_content",
      "what": "Tu asistente lee los centros encontrados con sus horarios y te contesta.",
      "how": "Contenido con datos propios: los centros que se ven, con sus horarios y servicios.",
      "code": "const remove = inject(AgentService).agent.provideContent('centers', () => ({\n  data: { query: this.query(), centers: this.store.centers() },\n}));"
    },
    {
      "title": "Enseñar un centro",
      "say": "Enséñame el hospital",
      "action": "show_center",
      "what": "Abre los horarios y servicios de ese centro. Si no está entre los encontrados, error propio CENTER_NOT_FOUND.",
      "how": "Acción propia de la pantalla, con su código de error.",
      "code": "name: 'show_center',\ndescription: 'Enseña los horarios y servicios de uno de los centros encontrados.',"
    },
    {
      "title": "Bajar en los horarios",
      "say": "Baja en los horarios",
      "action": "scroll { in: \"horarios\" }",
      "what": "Mueve la caja de horarios y servicios, que tiene su propio scroll.",
      "how": "La caja está marcada con data-agent-scroll y un nombre.",
      "code": "<div class=\"box\" data-agent-scroll=\"horarios\" aria-label=\"Horarios y servicios\">",
      "file": "domains/centers/ui/center-hours.component.html"
    }
  ]
};
