import type { Help } from '../../../transversal/help';

export const HOME_HELP: Help = {
  "title": "Inicio",
  "intro": "Sin sesión, qué es Vitalia; con sesión, tu día: la próxima cita, los avisos y lo que te toca tomar.",
  "file": "domains/home/feature/home.component.ts",
  "cases": [
    {
      "title": "¿Tengo alguna cita?",
      "say": "¿Cuándo es mi próxima cita?",
      "action": "read_content",
      "what": "Tu asistente lee el resumen del día y te dice la próxima cita, los avisos y lo que te toca tomar.",
      "how": "Contenido con datos propios: la pantalla decide qué comparte. Sin sesión, solo dice que tienes que entrar tú.",
      "code": "const remove = inject(AgentService).agent.provideContent('summary', () => ({\n  data: this.session.signedIn()"
    },
    {
      "title": "Ir a otra pantalla",
      "say": "Llévame a mis informes",
      "action": "navigate",
      "what": "Tu asistente abre la pantalla por su nombre. Si necesita sesión y no has entrado, te dice que entres tú.",
      "how": "Cada ruta define su pantalla para la IA con data.agent; las que piden sesión tienen authGuard.",
      "code": "agent: { key: 'reports', description: 'La lista de informes médicos y análisis de la paciente' } satisfies AgentRouteData,",
      "file": "domains/reports/feature/reports.routes.ts"
    },
    {
      "title": "Entrar por ti (no puede)",
      "say": "Entra con mi usuario",
      "action": "—",
      "what": "Tu asistente no puede identificarte: entrar es solo cosa tuya, con el botón Entrar.",
      "how": "La pantalla de entrar no está definida para la IA y no ofrece ninguna acción.",
      "code": "{ path: 'entrar', loadComponent: () => import('./login.component').then((m) => m.LoginComponent), title: 'Entrar', data: { help: ACCESS_HELP } },",
      "file": "domains/access/feature/access.routes.ts"
    }
  ]
};
