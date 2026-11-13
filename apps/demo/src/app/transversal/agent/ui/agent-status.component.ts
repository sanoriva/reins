import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { ChannelState } from '@reins-ai/angular';

/** «Asistente conectado»: the AI status, always visible. */
@Component({
  selector: 'vt-agent-status',
  imports: [MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-status.component.html',
  styleUrl: './agent-status.component.scss',
})
export class AgentStatusComponent {
  readonly state = input.required<ChannelState>();

  protected readonly view = computed(() => {
    const state = this.state();
    switch (state.status) {
      case 'ready':
        return { label: 'Asistente conectado', hint: 'Tu IA puede usar Vitalia mientras le hablas', tone: 'ok' };
      case 'pairing':
        return { label: 'Esperando el código', hint: 'Dile a tu IA el código que aparece en pantalla', tone: '' };
      case 'waiting':
        return { label: 'Asistente sin conectar', hint: 'No encuentro el puente en este ordenador', tone: '' };
      case 'error':
        return { label: 'Error del asistente', hint: state.message, tone: 'bad' };
      default:
        return { label: 'Conectando…', hint: 'Buscando el puente local', tone: '' };
    }
  });
}
