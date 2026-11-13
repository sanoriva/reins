import type { Help } from '../../../transversal/help';

export const ACCESS_HELP: Help = {
  "title": "Entrar",
  "intro": "Entrada de demostración: un botón por paciente, sin contraseña.",
  "file": "domains/access/feature/access.routes.ts",
  "cases": [
    {
      "title": "Abrir esta pantalla (no puede)",
      "say": "Llévame a entrar",
      "action": "navigate",
      "what": "No puede: no está definida para la IA (INVALID_PARAMS: no es una pantalla que conozca).",
      "how": "La ruta no tiene data.agent.",
      "code": "// No data.agent: for people only. The AI cannot sign you in."
    },
    {
      "title": "Entrar por ti (no puede)",
      "say": "Entra como Carmen",
      "action": "—",
      "what": "No hay ninguna acción para identificarse: solo tú, pulsando el botón.",
      "how": "La pantalla no ofrece nada a la IA; el botón llama al store de sesión.",
      "code": "await this.session.signIn(patientId);",
      "file": "domains/access/feature/login.component.ts"
    }
  ]
};
