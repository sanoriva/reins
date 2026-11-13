import type { Help } from '../../../../transversal/help';

export const BOOKING_HELP: Help = {
  "title": "Pedir cita",
  "intro": "Elige la especialidad y un hueco libre. Se reserva solo cuando dices el código de la pantalla.",
  "file": "domains/appointments/booking/feature/booking.component.ts",
  "cases": [
    {
      "title": "Elegir especialidad",
      "say": "Quiero cita con dermatología",
      "action": "navigate",
      "what": "Tu asistente abre /citas/nueva?especialidad=dermatologia y salen los huecos libres.",
      "how": "La especialidad es un parámetro de la pantalla en la query; las especialidades las lee de la propia pantalla.",
      "code": "especialidad: z.string().min(1).describe('La especialidad, tal como la ves con read_content en esta pantalla (p. ej. su slug)').optional(),",
      "file": "domains/appointments/feature/appointments.routes.ts"
    },
    {
      "title": "¿Qué huecos hay?",
      "say": "¿Qué huecos hay la semana que viene por la tarde?",
      "action": "read_content",
      "what": "Tu asistente lee los huecos libres y te propone los que encajan.",
      "how": "Contenido con datos propios: especialidades y huecos libres como se dicen en voz alta.",
      "code": "freeSlots: this.store.slots().map((s) => s.label),"
    },
    {
      "title": "Bajar en los huecos",
      "say": "Baja en los huecos",
      "action": "scroll { in: \"huecos\" }",
      "what": "Mueve la lista de huecos libres, que tiene su propio scroll.",
      "how": "La caja de huecos está marcada con data-agent-scroll.",
      "code": "<div class=\"slots\" data-agent-scroll=\"huecos\" aria-label=\"Huecos libres\">",
      "file": "domains/appointments/booking/ui/slot-picker.component.html"
    },
    {
      "title": "Reservar con código",
      "say": "Ponme el jueves a las diez, es por una mancha en la piel · El código es …",
      "action": "fill_appointment · submit_appointment · confirm",
      "what": "Tu asistente rellena el hueco y el motivo. Aparece un código con el resumen: solo se reserva si lo dices.",
      "how": "El formulario se ofrece con los huecos libres de verdad (z.enum) y se vuelve a ofrecer si cambian.",
      "code": "slot: z.enum(labels as [string, ...string[]]).describe('Hueco'),"
    },
    {
      "title": "Un hueco que no existe (no puede)",
      "say": "Ponme el domingo a las tres",
      "action": "fill_appointment",
      "what": "No lo pone: solo admite huecos libres reales. Tu asistente te propone otro.",
      "how": "La validación es el propio esquema del campo: lo que no está en la lista, no pasa.",
      "code": "name: 'appointment',\ndescription: 'Reservar una cita en un hueco libre',"
    }
  ]
};
