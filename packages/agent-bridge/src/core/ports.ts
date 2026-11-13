import type { BridgeMessage } from '@reins-ai/contract';

/** A connection to a tab, implemented by the WebSocket adapter. */
export interface Connection {
  readonly origin: string;
  send(message: BridgeMessage): void;
  close(): void;
}

/** Pairing tokens by origin. */
export type Tokens = Record<string, string[]>;

/** Where the pairing tokens are persisted. */
export interface TokenStore {
  load(): Tokens;
  save(tokens: Tokens): void;
}
