import type { Help } from '../../../../transversal/help';

export const READING_HELP: Help = {
  "title": "Informe",
  "intro": "Un informe entero, tal como lo escribió tu médico. Tu asistente te lo lee y te explica las palabras difíciles.",
  "file": "domains/reports/reading/feature/reading.component.ts",
  "cases": [
    {
      "title": "Leer el informe",
      "say": "Léeme el informe del cardiólogo",
      "action": "read_content (part 0, 1…)",
      "what": "Tu asistente lee el texto que ves: títulos, párrafos y listas, sin HTML ni nada oculto. Si es largo, por trozos seguidos.",
      "how": "agentContent marca dónde está el informe; la librería lee su texto visible ya pintado y lo trocea sola.",
      "code": "<article agentContent=\"report\">",
      "file": "domains/reports/reading/feature/reading.component.html"
    },
    {
      "title": "Resaltar por dónde va",
      "say": "Léemelo y resalta por dónde vas",
      "action": "highlight",
      "what": "Cada frase que lee se marca en pantalla, y la página baja hasta ella.",
      "how": "La librería busca el texto en lo que se ve, aunque esté partido entre negritas, y lo marca sin tocar el HTML.",
      "code": "::highlight(sanoriva) {",
      "file": "../styles.scss"
    },
    {
      "title": "¿Qué significa?",
      "say": "¿Qué es un Holter? · Baja en el glosario",
      "action": "scroll { in: \"glosario\" }",
      "what": "Tu asistente te lo explica con el glosario del informe y puede moverse por él.",
      "how": "El glosario es una caja con scroll propio, marcada con data-agent-scroll.",
      "code": "<div class=\"box\" data-agent-scroll=\"glosario\" aria-label=\"Glosario\">",
      "file": "domains/reports/reading/ui/glossary.component.html"
    },
    {
      "title": "Pruebas anteriores (no puede moverla)",
      "say": "Baja en las pruebas anteriores",
      "action": "scroll",
      "what": "No puede: esa caja no está marcada. Si pides algo de dentro, tu asistente sabe que no lo ves (visible: false).",
      "how": "Basta con no poner data-agent-scroll: para la IA esa caja no existe.",
      "code": "<!-- A scrollable box WITHOUT data-agent-scroll: the AI cannot scroll it. -->",
      "file": "domains/reports/reading/ui/previous-tests.component.html"
    }
  ]
};
