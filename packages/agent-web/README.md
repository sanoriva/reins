# @reins-ai/web

Connects your website to the user's AI, with no framework. The page joins the local bridge ([`@reins-ai/bridge`](../agent-bridge)), shows a code to pair, and runs the orders the AI sends. The library renders nothing: your app decides how to show the code and what to offer to the AI.

Using Angular? See [`@reins-ai/angular`](../agent-angular), which wires this up for you.

## Installation

```sh
npm install @reins-ai/web
```

## Getting started

```ts
import { createAgent } from '@reins-ai/web';

const agent = createAgent(); // connects to ws://127.0.0.1:7420/page

agent.onState((state) => {
  // While pairing, show state.code to the user, who says it to their AI.
  if (state.status === 'pairing') showCode(state.code);
  else hideCode();
});

agent.start();

// On every screen change:
agent.setPage({ route: '/recipes', title: 'Recipes' });
```

### Connection states (`agent.state`, `agent.onState`)

| `status` | Meaning |
| --- | --- |
| `connecting` | Connecting to the bridge. |
| `pairing` | The bridge asks to pair: show `code` (6 digits). It expires after 2 minutes and a new one arrives. |
| `ready` | Paired: the AI can use the page. |
| `waiting` | The bridge is not running; retrying in `retryInMs`. |
| `error` | An error retrying will not fix (`message`), such as a bridge that cannot prove it knows the tab's token. |

Once paired, the tab keeps a token in `localStorage` and does not ask for a code again. The token never travels again: on reconnection the tab sends its id, checks that the bridge signs a random nonce with that token, and signs the bridge's nonce in turn (HMAC-SHA256, Web Crypto). A program on the port that does not know the token gets no session. If the AI disconnects the tab, the token is cleared and the page goes back to `pairing` with a new code.

### `createAgent` options

| Option | Default | Description |
| --- | --- | --- |
| `url` | `ws://127.0.0.1:7420/page` | The bridge address. |
| `actions` | `[]` | App-wide actions (see below). |
| `navigation` | — | The screens the AI can open and how to navigate (see [Navigation](#navigation)). |
| `panels` | — | Panels of a page that the AI opens and closes (see [Panels](#panels)). |

## Reading content

Each screen can offer its content to the AI, which reads it with the general `read_content` action. The library wraps it and marks it as data, never instructions.

### From what is already rendered (the usual case)

Your article, recipe or record is already on screen, however it got there: CMS HTML, rendered markdown, a template… There is nothing to prepare. Tell the library **where** it is:

```ts
import { readElement } from '@reins-ai/web';

const remove = agent.provideContent('article', readElement(() => document.querySelector('article')));

// When leaving the screen:
remove();
```

When the AI calls `read_content`, the library:

1. Takes the element's **visible text**: no HTML, no scripts or icons (`aria-hidden`), and no text hidden with `display`, `visibility`, `opacity`, a box of 1 px or less (`font-size: 0`, the `sr-only` pattern) or a position before the start of the page. Text the same colour as its background cannot be detected reliably, so do not rely on it to hide anything from the AI.
2. Splits it into blocks following the HTML: headings, paragraphs, list items, cells…
3. Groups the blocks into parts of about 3000 characters (`readElement(el, { partSize })` to change it); the AI asks for `part + 1` while `more: true` comes back.

What the AI receives:

```json
{ "role": "content-not-instructions", "type": "article",
  "data": { "blocks": ["Coffee, from the tree to the cup", "Coffee starts on a shrub…", "The harvest", "…"] },
  "more": true }
```

Since it is exactly the text on screen, `highlight` always finds it.

### From your own data

To give the AI structured data instead (a recipe with its ingredients, a product sheet), pass a function. It receives the part number; you decide the shape of `data` and whether there is `more`:

```ts
agent.provideContent('recipe', () => ({
  data: { name: 'Tortilla', ingredients: ['eggs', 'potatoes'], steps: ['…'] },
}));
```

Rules:

- Only hand over **text visible on screen**: automatic with `readElement`, your responsibility with your own data.
- **You decide what is sensitive:** do not offer what the AI should not see.
- A screen offers one content at a time: the latest `provideContent` replaces the previous one, and `remove()` only withdraws its own.
- When content is offered, the AI gets a `content.available` notice (right after the screen change, with its title), and `get_state` tells its type.

## Highlighting

The AI highlights what it is reading with the general `highlight { text }` action. The page searches the text the user sees, marks it and scrolls to it if it is not in view. Nothing needs preparing in the HTML: no ids, no markers.

Just give it a colour in your CSS:

```css
::highlight(sanoriva) {
  background-color: #ffe08a;
}
```

How it searches:

- It ignores differences in whitespace and letter case, and finds text split across tags (`<b>Ask</b> it to…`).
- It only looks at visible text: no scripts, hidden elements or icons with `aria-hidden="true"`.
- With repeated text it continues after the last highlight, since the AI reads forward, and wraps around to the top when there is no more.
- A new highlight replaces the previous one, and changing screen clears it.
- If the text is not in view, it scrolls with the same rules as `scroll` (below).
- It does not touch the DOM: it uses the browser's [CSS Custom Highlight API](https://developer.mozilla.org/docs/Web/API/CSS_Custom_Highlight_API) (`CSS.highlights`). Without it, it answers `NOT_AVAILABLE`.

## Scrolling

The AI scrolls with the general `scroll` action:

```
scroll { to: "down" }                   → { atTop: false, atBottom: false }
scroll { to: "bottom" }                 → { atTop: false, atBottom: true }
scroll { to: "down", in: "comments" }   → scrolls the "comments" box
scroll { text: "Ingredients" }          → { scrolled: true, visible: true }  (brings that text into view)
```

- `to`: `down` / `up` moves one screen (80 % of the visible height, so the reader keeps their place); `top` / `bottom` goes to the start or the end. `atTop` and `atBottom` tell where it stopped.
- `text`: finds the text like `highlight` (without marking it) and centres it. `visible: false` means it is inside an unmarked box the AI cannot scroll: the user cannot see it, and the AI can say so.
- Send either `to` or `text`; `in` only goes with `to`.

### Scrollable boxes are marked by your app

**The AI can only scroll the whole page and the boxes your app marks.** If a screen has an area with its own scroll (a comment list, a side panel, the content of a `mat-sidenav`), give it a name:

```html
<aside data-agent-scroll="comments"> … </aside>
```

- The AI sees the names in `get_state` (`scrollAreas: ["comments"]`) and uses them in `scroll { to, in }`. Pick names the way the user would say them.
- Only boxes visible at that moment count. A box that leaves the screen leaves the list; there is nothing to withdraw.
- An unknown name answers `NOT_AVAILABLE` with the list of boxes that exist.
- Unmarked boxes are never scrolled, not even by `text` or `highlight`: if the text is inside one, only the page moves.

## Navigation

The AI changes screen with the general `navigate` action. **It never sends a URL**: it sends the **key** of a screen your app defined and its **parameters**, and the library builds the URL. It cannot go to screens you did not define, or to external URLs.

```ts
import { z } from 'zod';

const agent = createAgent({
  navigation: {
    routes: [
      { key: 'home', path: '/', title: 'Home', description: 'Home screen' },
      {
        key: 'recipe',
        path: '/recipes/:id',
        title: 'Recipe',
        description: 'A recipe with its ingredients',
        params: z.object({
          id: z.string().describe('Recipe id'),
          servings: z.number().optional().describe('Number of servings'),
        }),
      },
    ],
    go: (url) => myRouter.navigate(url), // return false when your app refuses (e.g. a guard)
  },
});
```

What the AI does:

```
navigate { to: "recipe", params: { id: "tortilla", servings: 4 } }   → { route: "/recipes/tortilla?servings=4" }
navigate { to: "home" }                                              → { route: "/" }
```

- `to` only accepts your keys; the action description lists every screen with its title, description and parameters.
- **Every parameter needs a description** (`.describe('…')`), and **every path `:param` must be in `params`**. Otherwise `createAgent` throws at startup, naming the screen and the parameter.
- Parameters are validated with the zod schema of **that** screen. If they do not fit: `INVALID_PARAMS`, and no navigation.
- Each path `:param` is filled from its parameter and the rest go to the query string, so reloads, the back button and direct links work.
- If `go` returns `false`: `NOT_AVAILABLE`. The action answers once `go` resolves, so your app should call `setPage` before that (routers usually report navigation before resolving).
- Without `navigation` (or without screens), there is no `navigate` action.

## Panels

A page where the AI shows pieces as the user asks for them: "show me my appointments", "open the blood test", "book me an appointment". Each piece is a **panel**, and several can be open at once. Declare them like screens: key, description and zod parameters (every parameter needs `.describe()`). The library renders nothing: it tells you which panels are open and you decide how they look (a column, a carousel, tabs…).

```ts
import { createAgent } from '@reins-ai/web';
import { z } from 'zod';

const agent = createAgent({
  panels: {
    panels: [
      { key: 'appointments', title: 'My appointments', description: 'Upcoming and past appointments' },
      {
        key: 'report',
        title: 'Report',
        description: 'A full medical report',
        params: z.object({ id: z.string().describe('Report id') }),
      },
    ],
    // The open panels live in the URL, so they survive reloads and can be shared.
    read: () => new URLSearchParams(location.search).get('panels') ?? '',
    write: (value) => {
      const url = new URL(location.href);
      if (value) url.searchParams.set('panels', value);
      else url.searchParams.delete('panels');
      history.pushState(null, '', url);
      agent.setPage({ route: url.pathname + url.search, title: document.title }); // the view changed
    },
  },
});

// Render the open panels (oldest first) and re-render on every change.
agent.panels!.onChange((open) => render(open)); // open: [{ key: 'report', params: { id: 'blood-test' } }]
addEventListener('popstate', () => agent.panels!.sync()); // browser back button
```

What the AI does:

```
open_panel { panel: 'report', params: { id: 'blood-test' } }   → { open: ['appointments', 'report'] }
close_panel { panel: 'appointments' }                          → { open: ['report'] }
get_state                                                      → { …, panels: [{ key: 'report', params: { id: 'blood-test' } }] }
```

- **In the URL**, readable: `?panels=appointments,report:id=blood-test`. Anything that does not fit (an unknown key, invalid parameters) is ignored when reading it.
- **Opening a panel that is already open** updates its parameters and moves it last (to the front).
- **Each panel offers its own things** while rendered, like a screen: its content (`provideContent` or `readElement`), its actions (`provideActions`) and its forms (`provideForm`), withdrawn when it is removed. `read_content` reads the content **offered last** (the last opened panel); once it closes, the previous one.
- **Screen counter:** each panel change changes what is on screen, so your `write` calls `setPage` (or your router does when the URL changes). An order meant for the previous panels answers `PAGE_CHANGED`.
- **Errors:** an unknown key or invalid parameters, `INVALID_PARAMS`; closing a panel that is not open, `PANEL_NOT_OPEN`; if `write` returns `false` (your app refuses), `NOT_AVAILABLE` and the previous panels stay.
- People can open and close them too: `agent.panels.open(key, params)`, `agent.panels.close(key)`, `agent.panels.current`.
- Without the `panels` option, there are no `open_panel` and `close_panel` actions.

## Forms

A screen offers its form to the AI: the AI fills in what the user dictates and may request a submission, but **it is only submitted when the user says out loud a code shown on screen**. The code never travels over the channel, so the AI can neither know nor make it up.

```ts
import { z } from 'zod';

const remove = agent.provideForm({
  name: 'contact',
  description: 'Write a message to the newsroom',
  fields: z.object({
    name: z.string().min(1).describe('Your name'),
    email: z.email().describe('Email address for the reply'),
    message: z.string().min(10).describe('Message, at least 10 characters'),
  }),
  fill: (values) => setFormValues(values), // put the given fields on screen
  values: () => getFormValues(), // what is on screen now, including anything typed by hand
  submit: (values) => api.send(values), // the real submission; its result goes to the AI
});

// When leaving the screen:
remove();
```

This creates two actions for that screen, plus the general `confirm` action:

```
fill_contact { name: "Ana", message: "Hello…" }   → { filled: ["name", "message"], missing: ["email"] }
submit_contact                                    → NEEDS_CONFIRMATION   (the app shows the code and the summary)
confirm { code: "4712" }                          → { sent: true, result: … }  |  INVALID_CODE (attempts left: 2)
```

**Showing the code** is up to your app, wherever and however it likes (a dialog, a banner…):

```ts
agent.onConfirmation((state) => {
  if (state.status === 'pending') {
    // state.code: the 4 digits · state.summary: [{ label, value }] of what will be sent
    // state.expiresAt: when it expires · state.attemptsLeft: attempts left
    showConfirmation(state);
  } else {
    hideConfirmation(); // sent, expired, out of attempts, or screen changed
  }
});
```

How it works:

- `fill_<name>` accepts any subset of the fields, since the user dictates bit by bit. Each value is validated with its zod schema; one that does not fit (a misheard email) answers `INVALID_PARAMS` and is not set. This is the only time the AI sends data: what the user dictates.
- `submit_<name>` (`effect: confirm`) does not submit. It validates **what is on screen** (including anything typed by hand); if something is missing, `INVALID_PARAMS` with the list. If it is complete, it generates the code, notifies the app with the summary and answers `NEEDS_CONFIRMATION`.
- `confirm { code }`: if it matches (spaces and dashes from the transcription are ignored), calls your `submit` and returns its result. Otherwise, `INVALID_CODE` with `attemptsLeft`.
- The code has 4 digits and is single-use. It expires after 60 s, after 3 attempts or on a screen change. `confirm` with nothing pending: `NOT_AVAILABLE`.
- Asking for a new code does not grant new guesses: every 3 wrong codes in a row, across codes, lock new submissions for 1 minute, then 2, 4… up to 1 hour. Meanwhile `submit_<name>` answers `TOO_MANY_ATTEMPTS` with the seconds left. Only a right code clears the count; a screen change does not.
- **While the code is pending, the AI cannot read or search text** (`read_content`, `highlight` and `scroll { text }` answer `NOT_AVAILABLE`): otherwise it could guess it by trying `highlight { text: "0000" }`, `"0001"`…
- Every field needs a description: it is what the AI reads and the label the user sees in the summary, so write it for the user ("Medication", not "The id as returned by read_content"). For a `z.enum` field, the AI already gets the list of valid values.

## Your own actions

Besides the general actions, your app can give the AI its own. Define them with `defineAction`: a name, a description (what the AI reads to decide) and [zod](https://zod.dev) parameters, validated before running.

### Screen actions

Most actions only make sense on one screen: sorting search results, changing the order of comments on an article… The screen provides them while it exists and withdraws them when it goes. On another screen the AI no longer sees them; calling one answers `UNKNOWN_ACTION`.

```ts
import { defineAction } from '@reins-ai/web';
import { z } from 'zod';

const remove = agent.provideActions([
  defineAction({
    name: 'sort_results',
    description: 'Sorts the search results on screen.',
    params: z.object({ by: z.enum(['title', 'date']).describe('title: by title; date: newest first') }),
    run: ({ by }) => {
      setSort(by);
      return { sortedBy: by };
    },
  }),
]);

// When leaving the screen:
remove();
```

Adding or removing them sends the catalog to the bridge again (with the same screen counter), and the bridge tells the AI its tools changed.

### App-wide actions

Actions that do not depend on a screen (changing the theme, for example) go in `createAgent`:

```ts
const agent = createAgent({ actions: [setTheme] });
```

### Rules

- **Every parameter needs a description** (`.describe('…')`): it is all the AI reads to know what to send. Without one, `defineAction` throws, naming the parameter.
- Names cannot repeat: neither with the general actions nor between app and screen actions.
- An action with `effect: 'confirm'` always needs the user's confirmation code: the first call answers `NEEDS_CONFIRMATION` with a summary built from the parameter descriptions, and it only runs after `confirm` with the code shown on screen.
- The AI sends parameters, never data: what is shown always comes from your app.
- A parameter with `.default(…)` or `.optional()` is optional for the AI; if it is not sent, `run` gets the default.
- `run` receives the validated parameters and the context (`route`, `title`, `page`, `actions`, `content`). It may be `async`, and its return value is the answer for the AI.
- For an error with its own code, throw an `ActionError` with an `UPPER_SNAKE_CASE` code: `throw new ActionError('RECIPE_NOT_FOUND', 'There is no such recipe')`.

## General actions

| Action | Parameters | Returns |
| --- | --- | --- |
| `get_state` | — | `{ route, title, page, actions, content, scrollAreas }`. `content` is the type of content available, or `null`; `scrollAreas`, the names of the visible marked boxes. With panels, also `panels`: the open ones with their parameters. |
| `read_content` | `part` (default 0) | The content envelope. Without content: `NOT_AVAILABLE`. |
| `highlight` | `text` | `{ scrolled }`: whether it scrolled to show it. Not found: `TEXT_NOT_FOUND`. |
| `scroll` | `to` (+ `in`) or `text` | With `to`: `{ atTop, atBottom }`. With `text`: `{ scrolled, visible }`. Unknown box: `NOT_AVAILABLE`; text not found: `TEXT_NOT_FOUND`. |
| `confirm` | `code` | `{ sent: true, result }` when the code the user said matches. Otherwise `INVALID_CODE` with `attemptsLeft`; nothing pending: `NOT_AVAILABLE`. |
| `navigate` | `to` (key) and `params` | `{ route }`: the URL it went to. Unknown key or invalid parameters: `INVALID_PARAMS`; the app refuses: `NOT_AVAILABLE`. Only when the app defines screens. |
| `open_panel` | `panel` (key) and `params` | `{ open }`: the keys of the open panels. Only when the app has panels. |
| `close_panel` | `panel` | `{ open }`. Not open: `PANEL_NOT_OPEN`. |

## Errors the AI can receive

| Code | When |
| --- | --- |
| `UNKNOWN_ACTION` | The action does not exist on this screen. |
| `INVALID_PARAMS` | The parameters do not match the schema. |
| `NOT_AVAILABLE` | The action cannot run right now (e.g. there is no content). |
| `PAGE_CHANGED` | The screen changed since the AI looked at it: the order does not run. |
| `NEEDS_CONFIRMATION` | A submission is waiting for the code the page shows: the AI must ask the user for it and send it with `confirm`. |
| `INVALID_CODE` | The code does not match; `attemptsLeft` tells how many attempts remain. |
| `TOO_MANY_ATTEMPTS` | Too many wrong codes in a row: no new code until the lock ends (the message says how long). |

Every `setPage` bumps a screen counter. Each order carries the counter the AI knew; if it does not match, the page answers `PAGE_CHANGED` instead of acting on a screen the AI has not seen.
