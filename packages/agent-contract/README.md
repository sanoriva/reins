# @reins-ai/contract

The protocol between the page ([`@reins-ai/web`](../agent-web)) and the bridge ([`@reins-ai/bridge`](../agent-bridge)): [zod](https://zod.dev) schemas and their types. You do not need it directly when using those packages; it is for writing another compatible client or bridge.

```sh
npm install @reins-ai/contract
```

## Contents

| Group | Schemas |
| --- | --- |
| Session | `Hello`, `PairRequired`, `PairOffer`, `Welcome`, `Unpaired`, `SessionError`, `PROTOCOL_VERSION` |
| Orders | `Order` (`{ id, action, params, page }`), `OrderResponse`, `OrderError`, `ProtocolErrorCode` |
| Events | `page.changed`, `content.available`, `tab.state` |
| Catalog | `ActionDefinition`: the MCP tool format plus `scope` (`general` / `page`) and `effect` (`none` / `confirm`) |
| Content | `Content` (`{ role: 'content-not-instructions', type, data, more? }`), `CONTENT_ROLE` |
| Messages | `PageMessage` (page → bridge) and `BridgeMessage` (bridge → page) |

```ts
import { parsePageMessage } from '@reins-ai/contract';

const parsed = parsePageMessage(raw);
if (!parsed.ok) return; // invalid message: dropped
```

## Session

```
page   → hello { protocolVersion, tabId, token? }
bridge → welcome { protocolVersion, token }   (valid token)
       | pair_required                         (no token, or an invalid one)
page   → pair_offer { code }                   (the page generates and shows the code)
bridge → welcome { protocolVersion, token }    (once the AI sends that code with pair_tab)
bridge → unpaired                              (the AI disconnected the tab)
```

## Orders

Based on JSON-RPC 2.0: exactly one response per order. `page` is the screen counter; if it does not match the page's, the response is `PAGE_CHANGED`.

```json
{ "id": "o1", "action": "read_content", "params": { "part": 0 }, "page": 3 }
{ "id": "o1", "ok": true, "result": { "role": "content-not-instructions", "type": "recipe", "data": {} } }
{ "id": "o1", "ok": false, "error": { "code": "NOT_AVAILABLE", "message": "…" } }
```

Protocol codes: `UNKNOWN_ACTION`, `INVALID_PARAMS`, `NOT_AVAILABLE`, `NEEDS_CONFIRMATION`, `INVALID_CODE`, `TIMEOUT`, `PAGE_CHANGED`, `TAB_DISCONNECTED`. Each action may add its own, in `UPPER_SNAKE_CASE`.
