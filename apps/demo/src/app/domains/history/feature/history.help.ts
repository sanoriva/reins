import type { Help } from '../../../transversal/help';

export const HISTORY_HELP: Help = {
  "title": "Historial clínico",
  "intro": "Tu historial completo. Solo para ti.",
  "file": "domains/history/feature/history.routes.ts",
  "cases": [
    {
      "title": "Abrir el historial (no puede)",
      "say": "Llévame a mi historial clínico",
      "action": "navigate",
      "what": "No puede: la pantalla no está definida para la IA. Tú entras desde el menú.",
      "how": "La ruta no tiene data.agent. La app decide qué datos son sensibles.",
      "code": "// No data.agent: for people only. The AI cannot open the full history."
    },
    {
      "title": "Leer el historial (no puede)",
      "say": "Léeme mi historial",
      "action": "read_content",
      "what": "Aunque estés en la pantalla, no hay contenido para la IA: la pantalla no ofrece nada.",
      "how": "La pantalla no llama a provideContent ni a provideAgentActions.",
      "code": "/** The full medical history: for the person only. It offers nothing to the AI. */",
      "file": "domains/history/feature/history.component.ts"
    }
  ]
};
