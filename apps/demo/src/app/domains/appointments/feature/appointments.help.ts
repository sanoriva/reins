import type { Help } from '../../../transversal/help';

export const APPOINTMENTS_HELP: Help = {
  "title": "Mis citas",
  "intro": "Tus próximas citas y las anteriores. Aquí también puedes anular una.",
  "file": "domains/appointments/feature/appointments.component.ts",
  "cases": [
    {
      "title": "¿Qué citas tengo?",
      "say": "¿Qué citas tengo pendientes?",
      "action": "read_content",
      "what": "Tu asistente te dice tus citas como se dicen: «jueves, 14 de noviembre · 10:30 · Dr. Javier Ortega».",
      "how": "Contenido con datos propios: cada cita con su etiqueta hablada, que sale del mapper.",
      "code": "upcoming: this.store.upcoming().map(({ label, center, reason }) => ({ cita: label, center, reason })),"
    },
    {
      "title": "Ordenar",
      "say": "Ordénalas por especialidad",
      "action": "sort_appointments",
      "what": "Cambia el orden de las próximas citas. En otra pantalla, esta acción no existe.",
      "how": "Acción propia con provideAgentActions; llama a una acción del store.",
      "code": "name: 'sort_appointments',\ndescription: 'Ordena las próximas citas que se ven en pantalla.',"
    },
    {
      "title": "Anular una cita",
      "say": "Anula la cita del cardiólogo · El código es …",
      "action": "fill_cancellation · submit_cancellation · confirm",
      "what": "Tu asistente elige la cita; antes de anularla aparece un código en pantalla. Solo se anula si lo dices.",
      "how": "El formulario se ofrece con las citas de verdad (z.enum): no puede anular una que no exista.",
      "code": "fields: z.object({ appointment: z.enum(labels as [string, ...string[]]).describe('Cita que se anula') }),",
      "file": "domains/appointments/cancellation/feature/cancellation.component.ts"
    }
  ]
};
