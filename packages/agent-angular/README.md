# @reins-ai/angular

[`@reins-ai/web`](../agent-web) for Angular: connects your app to the user's AI through the local bridge, reports every navigation and exposes the connection state as a signal. It renders nothing: you show the pairing code however you like.

Requires Angular 21 and `@angular/router`.

## Installation

```sh
npm install @reins-ai/angular
```

## Getting started

```ts
// app.config.ts
import { provideRouter } from '@angular/router';
import { provideAgent } from '@reins-ai/angular';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideAgent()],
};
```

`provideAgent()` creates the agent, connects it when the app starts and, on every navigation, passes it the route and the title (the route `title`). It accepts the same options as `createAgent` (`url`, `actions`).

## Navigation

Mark the screens the AI can open in your routes, with `data.agent`: a key, a description and, if any, its zod parameters. The AI sends the key and the parameters, never a route. Routes without `data.agent` are out of its reach.

```ts
import type { AgentRouteData } from '@reins-ai/angular';
import { z } from 'zod';

export const routes: Routes = [
  {
    path: '',
    component: Home,
    title: 'Home',
    data: { agent: { key: 'home', description: 'Home screen' } satisfies AgentRouteData },
  },
  {
    path: 'article/:id',
    component: Article,
    title: 'Article',
    data: {
      agent: {
        key: 'article',
        description: 'An article with its comments',
        params: z.object({ id: z.enum(['coffee', 'tea']).describe('coffee: All about coffee; tea: All about tea') }),
      } satisfies AgentRouteData,
    },
  },
  { path: 'admin', component: Admin }, // the AI cannot go here
];
```

```
navigate { to: "article", params: { id: "tea" } }   → { route: "/article/tea" }
```

Every parameter needs a description (`.describe('…')`): it is what the AI reads to know what to send. And every path `:param` must be in `params`. Otherwise the app throws at startup, saying what is missing.

`provideAgent()` reads these routes (children included; `loadChildren` routes not yet) and navigates with the router. If a guard refuses, the AI gets `NOT_AVAILABLE`. More details: [agent-web, Navigation](../agent-web#navigation).

## Panels

A page where the AI shows pieces as the user asks for them ("show me my appointments", "open the blood test"), several at once. Declare the panels with `provideAgentPanels`: the page that shows them and, for each panel, its key, description, zod parameters and component (loaded on demand). The library renders nothing: you decide how they look.

```ts
import { provideAgent, provideAgentPanels } from '@reins-ai/angular';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { z } from 'zod';

export const appConfig: ApplicationConfig = {
  providers: [
    // withComponentInputBinding: route parameters reach the component as inputs, the same as panel parameters.
    provideRouter(routes, withComponentInputBinding()),
    provideAgent(),
    provideAgentPanels({
      path: '/assistant', // the page that shows them (opening one from another screen navigates here)
      panels: [
        {
          key: 'appointments',
          title: 'My appointments',
          description: 'Upcoming and past appointments',
          load: () => import('./appointments'),
        },
        {
          key: 'report',
          title: 'Report',
          description: 'A full medical report',
          params: z.object({ id: z.string().describe('Report id') }),
          load: () => import('./report').then((m) => m.ReportComponent),
        },
      ],
    }),
  ],
};
```

On that page, `AgentPanels.current()` lists the open panels (oldest first), each with its component loaded and its parameters, which reach the component as inputs:

```ts
@Component({
  imports: [NgComponentOutlet],
  template: `
    @for (panel of panels.current(); track panel.key) {
      <section class="panel">
        <h2>{{ panel.title }}</h2>
        <button (click)="panels.close(panel.key)">Close</button>
        @if (panel.component; as component) {
          <ng-container *ngComponentOutlet="component; inputs: panel.params" />
        }
      </section>
    }
  `,
})
export class AssistantPage {
  protected readonly panels = inject(AgentPanels);
}

// The report component works both as a screen (route reports/:id) and as a panel:
export class ReportComponent {
  readonly id = input.required<string>();
}
```

```
open_panel { panel: "report", params: { id: "blood-test" } }   → { open: ["report"] }   (URL: /assistant?panels=report:id=blood-test)
close_panel { panel: "report" }                                → { open: [] }
```

- Panels live in the URL (`?panels=…`, configurable with `param`): reloading, sharing or the back button show the same ones.
- Each panel change is a navigation, so it bumps the screen counter. If a guard on the page refuses, the AI gets `NOT_AVAILABLE`.
- Each panel offers its own things while rendered, like a screen: `agentContent`, `provideAgentActions`, `provideAgentForm`. `read_content` reads the last opened panel.
- From the app (a button): `panels.open(key, params)` and `panels.close(key)`, the same as the AI.
- More details (errors, URL format): [agent-web, Panels](../agent-web#panels).

## Showing the pairing code

`AgentService.state` is a signal with the connection state. While `status` is `'pairing'`, it carries the 6-digit code the user will say to their AI:

```ts
import { Component, inject } from '@angular/core';
import { AgentService } from '@reins-ai/angular';

@Component({
  selector: 'app-pair-code',
  template: `
    @if (agent.state(); as state) {
      @if (state.status === 'pairing') {
        <p>Tell your AI this code: <strong>{{ state.code }}</strong></p>
      }
    }
  `,
})
export class PairCode {
  protected readonly agent = inject(AgentService);
}
```

The example app shows it in an Angular Material dialog that opens and closes by itself (`apps/demo/src/app/transversal/agent/feature/agent-shell.component.ts` and `ui/pair-dialog.component.ts`).

States: `connecting`, `pairing` (`code`), `ready`, `waiting` (`retryInMs`), `error` (`message`). Details in [agent-web](../agent-web#connection-states-agentstate-agentonstate).

## Reading content

Put `agentContent` on the element that renders the content. However it arrives (CMS HTML, rendered markdown, your template), the AI reads that element's visible text with `read_content`, in blocks and parts. The value is the content type, whatever you choose:

```ts
import { AgentContent } from '@reins-ai/angular';

@Component({
  imports: [AgentContent],
  template: `
    <article agentContent="article">
      <h1>{{ post.title }}</h1>
      <div [innerHTML]="post.html"></div>
    </article>
  `,
})
export class PostPage {}
```

It is offered when the element appears and withdrawn when it is destroyed. How it is read and what the AI receives: [agent-web, Reading content](../agent-web#reading-content).

**With your own data** (a recipe with its ingredients, for example), use the agent directly and withdraw it when the screen is destroyed:

```ts
const remove = inject(AgentService).agent.provideContent('recipe', () => ({
  data: { name: 'Tortilla', ingredients: ['eggs', 'potatoes'] },
}));
inject(DestroyRef).onDestroy(remove);
```

## Highlighting

The AI highlights what it is reading with the general `highlight` action. There is nothing to prepare; just give it a colour in `styles.scss`:

```scss
::highlight(sanoriva) {
  background-color: var(--mat-sys-tertiary-container);
  color: var(--mat-sys-on-tertiary-container);
}
```

How the text is found: [agent-web, Highlighting](../agent-web#highlighting).

## Scrollable boxes

The AI scrolls with the general `scroll` action. If a screen has an area with its own scroll, mark it in the template so the AI can scroll it; unmarked boxes are never touched:

```html
<aside data-agent-scroll="comments"> … </aside>
<mat-sidenav-content data-agent-scroll="content"> … </mat-sidenav-content>
```

Details: [agent-web, Scrolling](../agent-web#scrolling).

## Forms

Offer the screen's form to the AI with `provideAgentForm` in the constructor, passing your usual `FormGroup`. The AI fills in what the user dictates (`patchValue`), and it is only submitted when the user says the code the screen shows. It is withdrawn when the component is destroyed.

```ts
import { provideAgentForm } from '@reins-ai/angular';
import { z } from 'zod';

export class ContactPage {
  protected readonly form = inject(FormBuilder).nonNullable.group({ name: [''], email: [''], message: [''] });

  constructor() {
    provideAgentForm({
      name: 'contact',
      description: 'Write a message to the newsroom',
      fields: z.object({
        name: z.string().min(1).describe('Your name'),
        email: z.email().describe('Email address for the reply'),
        message: z.string().min(10).describe('Message, at least 10 characters'),
      }),
      form: this.form,
      submit: (values) => this.api.send(values),
    });
  }
}
```

**You show the code** with the `AgentService.confirmation` signal (`status: 'pending'` carries `code`, `summary`, `expiresAt` and `attemptsLeft`). The example app opens a dialog while it is pending (`apps/demo/src/app/transversal/agent/feature/agent-shell.component.ts` and `ui/confirm-dialog.component.ts`):

```ts
effect(() => {
  const pending = this.agent.confirmation().status === 'pending';
  if (pending && !this.dialogRef) {
    this.dialogRef = this.dialog.open(ConfirmDialog, { disableClose: true });
  } else if (!pending && this.dialogRef) {
    this.dialogRef.close();
    this.dialogRef = undefined;
  }
});
```

How it works inside (actions, expiry, attempts, why the AI cannot read the screen while waiting): [agent-web, Forms](../agent-web#forms).

## Screen actions

Call `provideAgentActions` in the screen constructor: the AI has those actions while the screen exists, and they are withdrawn when it is destroyed. `defineAction` and `ActionError` are also exported from this package.

```ts
import { Component, signal } from '@angular/core';
import { defineAction, provideAgentActions } from '@reins-ai/angular';
import { z } from 'zod';

@Component({
  /* … */
})
export class SearchPage {
  protected readonly sort = signal<'title' | 'date'>('title');

  constructor() {
    provideAgentActions([
      defineAction({
        name: 'sort_results',
        description: 'Sorts the search results on screen.',
        params: z.object({ by: z.enum(['title', 'date']).describe('title: by title; date: newest first') }),
        run: ({ by }) => {
          this.sort.set(by);
          return { sortedBy: by };
        },
      }),
    ]);
  }
}
```

App-wide actions (the ones that do not depend on a screen) go in `provideAgent({ actions: [...] })`. Rules (a description on every parameter, unique names): [agent-web, Your own actions](../agent-web#your-own-actions).
