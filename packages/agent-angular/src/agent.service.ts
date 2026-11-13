import { type Signal, signal } from '@angular/core';
import { type Agent, type AgentOptions, type ChannelState, type ConfirmationState, createAgent } from '@reins-ai/web';

/**
 * The agent-web agent inside Angular, with its connection and confirmation states as signals. Created by
 * `provideAgent()`.
 *
 * @example
 * export class AgentStatus {
 *   readonly state = inject(AgentService).state;
 *   readonly pairingCode = computed(() => {
 *     const state = this.state();
 *     return state.status === 'pairing' ? state.code : null;
 *   });
 * }
 */
export class AgentService {
  readonly agent: Agent;
  private readonly stateSignal = signal<ChannelState>({ status: 'connecting' });
  private readonly confirmationSignal = signal<ConfirmationState>({ status: 'none' });

  /** Connection state. While `pairing`, it carries the code the app must show. */
  readonly state: Signal<ChannelState> = this.stateSignal.asReadonly();

  /**
   * The submission waiting for its confirmation code. While `pending`, it carries the code and the summary the
   * app must show. The code only exists here: the user reads it on screen and says it to their AI.
   */
  readonly confirmation: Signal<ConfirmationState> = this.confirmationSignal.asReadonly();

  constructor(options: AgentOptions) {
    this.agent = createAgent(options);
    this.agent.onState((state) => this.stateSignal.set(state));
    this.agent.onConfirmation((state) => this.confirmationSignal.set(state));
  }
}
