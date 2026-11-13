import { type Order, type PageMessage, parseBridgeMessage, PROTOCOL_VERSION } from '@reins-ai/contract';

/** Connection state, for the app to show its own way. While `pairing`, it carries the code to show. */
export type ChannelState =
  | { status: 'connecting' }
  | { status: 'pairing'; code: string }
  | { status: 'ready' }
  | { status: 'waiting'; retryInMs: number }
  | { status: 'error'; message: string };

/** The subset of the browser WebSocket the channel uses. */
export interface WebSocketLike {
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  send(data: string): void;
  close(): void;
}

export interface ChannelOptions {
  url: string;
  tabId: string;
  token: { get(): string | null; set(token: string): void; clear(): void };
  createSocket: (url: string) => WebSocketLike;
  onState(state: ChannelState): void;
  onReady(): void;
  onOrder(order: Order): void;
}

export const MIN_RETRY_MS = 500;
export const MAX_RETRY_MS = 10_000;

const encode = (text: string) => new TextEncoder().encode(text);
const hex = (bytes: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');

export async function tokenIdOf(token: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encode(token))).slice(0, 16);
}

export async function proofOf(token: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encode(token), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encode(message)));
}

export function pairingCode(): string {
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  return String((n ?? 0) % 1_000_000).padStart(6, '0');
}

/**
 * Connection to the bridge: hello → (pairing: a code is generated, shown by the app and offered to the
 * bridge) → welcome, with increasing reconnection delays. A tab with a token never sends it: it sends its id and a
 * nonce, checks that the bridge signs that nonce with the same token (challenge) and signs the bridge's nonce in
 * turn (proof). A welcome is only accepted after that proof or while pairing, so a fake bridge cannot take the tab.
 * When the AI disconnects the tab (unpaired), the token is cleared and pairing starts again.
 */
export class Channel {
  state: ChannelState = { status: 'connecting' };
  private socket: WebSocketLike | undefined;
  private retryMs = MIN_RETRY_MS;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private stopped = true;
  private nonce = '';
  private proved = false;

  constructor(private readonly options: ChannelOptions) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.open();
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    const socket = this.socket;
    this.socket = undefined;
    socket?.close();
  }

  /** Responses and events are only sent once the session is ready. */
  send(message: PageMessage): void {
    if (this.state.status === 'ready') this.write(message);
  }

  private open(): void {
    this.setState({ status: 'connecting' });
    const socket = this.options.createSocket(this.options.url);
    this.socket = socket;
    socket.onopen = async () => {
      const token = this.options.token.get();
      this.nonce = hex(crypto.getRandomValues(new Uint8Array(16)));
      this.proved = false;
      const tokenId = token ? await tokenIdOf(token) : undefined;
      if (this.socket !== socket) return;
      this.write({ type: 'hello', protocolVersion: PROTOCOL_VERSION, tabId: this.options.tabId, nonce: this.nonce, ...(tokenId ? { tokenId } : {}) });
    };
    socket.onmessage = (event) => {
      if (this.socket === socket) void this.receive(String(event.data), socket);
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      if (!this.stopped && this.state.status !== 'error') this.retry();
    };
  }

  private async receive(raw: string, socket: WebSocketLike): Promise<void> {
    const parsed = parseBridgeMessage(raw);
    if (!parsed.ok) return;
    const message = parsed.value;
    if ('action' in message) {
      if (this.state.status === 'ready') this.options.onOrder(message);
      return;
    }
    switch (message.type) {
      case 'challenge': {
        const token = this.options.token.get();
        const expected = token ? await proofOf(token, `bridge:${this.nonce}`) : '';
        if (this.socket !== socket) return;
        if (!token || message.proof !== expected) return this.fail('The bridge could not prove it knows this tab');
        const proof = await proofOf(token, `page:${message.nonce}`);
        if (this.socket !== socket) return;
        this.proved = true;
        this.write({ type: 'proof', proof });
        break;
      }
      case 'welcome':
        if (!this.proved && this.state.status !== 'pairing') return;
        if (message.token) this.options.token.set(message.token);
        this.retryMs = MIN_RETRY_MS;
        this.setState({ status: 'ready' });
        this.options.onReady();
        break;
      case 'pair_required': {
        const code = pairingCode();
        this.setState({ status: 'pairing', code });
        this.write({ type: 'pair_offer', code });
        break;
      }
      case 'unpaired':
        this.options.token.clear();
        break;
      case 'session_error':
        this.fail(message.message);
        break;
    }
  }

  private fail(message: string): void {
    this.setState({ status: 'error', message });
    this.socket?.close();
  }

  private retry(): void {
    const wait = this.retryMs;
    this.retryMs = Math.min(wait * 2, MAX_RETRY_MS);
    this.setState({ status: 'waiting', retryInMs: wait });
    this.retryTimer = setTimeout(() => this.open(), wait);
  }

  private write(message: PageMessage): void {
    this.socket?.send(JSON.stringify(message));
  }

  private setState(state: ChannelState): void {
    this.state = state;
    this.options.onState(state);
  }
}
