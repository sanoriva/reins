import type { Help } from '../data-access/help.model';

/** Lo que funciona en cualquier pantalla. Se enseña debajo de la ayuda de cada una. */
export const COMMON_HELP: Help = {
  title: 'Cualquier pantalla',
  intro: 'Esto funciona estés donde estés.',
  file: 'transversal/agent/feature/agent-shell.component.ts',
  cases: [
    {
      title: 'Conectar tu asistente',
      say: 'El código es 4 8 2 9 1 3',
      action: 'pair_tab',
      what: 'Vitalia enseña un código de 6 dígitos; se lo dices a tu IA y la pestaña queda conectada.',
      how: 'provideAgent() conecta la app con el puente local. Cuando el puente pide emparejar, el store de agent lo dice y la shell abre el modal con el código.',
      code: `this.whileTrue(() => this.store.pairingCode() !== null, () => this.pairing(), '440px');`,
    },
    {
      title: 'Cortar la conexión',
      say: 'Corta',
      action: 'unpair_tab',
      what: 'La pestaña pierde su permiso y vuelve a enseñar un código nuevo.',
      how: 'No hay código en la app: lo hace el puente, y la librería vuelve a pedir emparejar.',
      code: `provideAgent(),`,
      file: 'app.config.ts',
    },
    {
      title: 'Saber dónde estás',
      say: '¿En qué pantalla estoy?',
      action: 'get_state',
      what: 'Te dice la pantalla, qué puede hacer ahí, si hay algo para leer y qué cajas puede mover.',
      how: 'Es una acción general de la librería: no hace falta nada más que provideAgent().',
      code: `provideAgent(),`,
      file: 'app.config.ts',
    },
    {
      title: 'Confirmar un envío',
      say: 'El código es … (el que ves en el modal)',
      action: 'confirm',
      what: 'Cuando tu IA quiere reservar, anular o pedir algo, aparece un código de 4 dígitos con lo que se va a enviar. Solo se envía si lo dices tú.',
      how: 'La librería genera y comprueba el código; la app solo lo enseña. Mientras está en pantalla, la IA no puede leer la página.',
      code: `this.whileTrue(() => this.store.pendingConfirmation() !== null, () => this.confirming(), '520px');`,
    },
    {
      title: 'Hablar por voz',
      say: 'Habla conmigo · Termina',
      action: 'listen · speak · stop',
      what: 'Tu IA te escucha y te contesta en voz alta, en tu idioma. Al decir «termina», cierra el micrófono.',
      how: 'Vitalia no tiene nada de voz: la voz es de la IA, un servidor MCP local que ella arranca (Whisper para oír, Piper para hablar).',
      code: `"sanoriva-voice": {
  "type": "stdio",
  "command": "node",
  "args": ["packages/agent-voice/dist/cli.js", "--language", "es", "--verbose"]
}`,
      file: '../../../../.mcp.json',
    },
  ],
};
