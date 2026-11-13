# Vitalia (example app)

A fictional patient portal, in Spanish, that shows every use case of [`@reins-ai/angular`](../../packages/agent-angular): reading content, highlighting, scrolling, navigation, screen actions, forms with a confirmation code and panels. It is not published.

Built with Angular 21 and Angular Material, hash routing and the Arbo architecture (`core/`, `shared/`, `transversal/`, `domains/<domain>/{data-access,ui,feature}`). Every screen has a «?» button with its use cases and the code behind each one (`domains/**/*.help.ts`).

## Running it

From the repository root:

```sh
npm run setup       # once: dependencies, libraries and voice models
npm run start:all   # bridge, backend (http://localhost:3000) and this app (http://localhost:4200)
```

The app uses the compiled `@reins-ai/angular` (`paths` in `tsconfig.json` point to `packages/agent-angular/dist`), so the libraries must be built first. In development, `/api` is proxied to the backend on port 3000 (`proxy.conf.json`).
