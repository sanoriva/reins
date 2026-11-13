import type { Help } from '../../../transversal/help';

export const MEDICATION_HELP: Help = {
  "title": "Medicación",
  "intro": "Qué te toca tomar hoy, tus tratamientos y la renovación de recetas.",
  "file": "domains/medication/feature/medication.component.ts",
  "cases": [
    {
      "title": "¿Qué me toca tomar?",
      "say": "¿Cuándo me tomo la pastilla de la tensión?",
      "action": "read_content",
      "what": "Tu asistente te dice las tomas de hoy y para qué es cada medicamento.",
      "how": "Contenido con datos propios: las tomas de hoy y los tratamientos.",
      "code": "today: this.store.today(),"
    },
    {
      "title": "Renovar una receta",
      "say": "Pide que me renueven la atorvastatina · El código es …",
      "action": "fill_renewal · submit_renewal · confirm",
      "what": "Solo las recetas que terminan pronto. Aparece un código en pantalla: solo se pide si lo dices.",
      "how": "El formulario se ofrece con las recetas que de verdad necesitan renovación (z.enum).",
      "code": "medicine: z.enum(medicines as [string, ...string[]]).describe('Medicamento'),",
      "file": "domains/medication/renewal/feature/renewal.component.ts"
    },
    {
      "title": "Leer mientras espera el código (no puede)",
      "say": "(con el código en pantalla) Léeme la página",
      "action": "read_content",
      "what": "Mientras hay un código en pantalla, tu asistente no puede leer ni buscar nada: así no puede adivinarlo.",
      "how": "Lo hace la librería; la app no tiene que hacer nada.",
      "code": "this.whileTrue(() => this.store.pendingConfirmation() !== null, () => this.confirming(), '520px');",
      "file": "transversal/agent/feature/agent-shell.component.ts"
    }
  ]
};
