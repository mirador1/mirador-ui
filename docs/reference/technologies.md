# Technology glossary — mirador-ui

This is an exhaustive, browse-friendly reference listing every non-trivial piece of
technology this repo touches. Companion file: the backend glossary at
[mirador-service/docs/technologies.md](https://gitlab.com/mirador1/mirador-service/-/blob/main/docs/technologies.md).

Each entry follows the same three-line format:

- **What it is** — a one-sentence definition.
- **Usage here** — the concrete way this repo uses it, with file paths where applicable.
- **Why it's pertinent** — why we picked it (over alternatives, or the problem it solves for us).

Entries tagged `(rejected alternative)` document choices we considered and declined,
so the rationale survives across sessions.

For deeper rationale on the load-bearing decisions (zoneless, signals, raw SVG,
Vitest, standalone components), see [`docs/adr/`](../adr/).

---

## Table of contents

- [Languages, runtimes, and module systems](#languages-runtimes-and-module-systems)
- [Angular framework](#angular-framework)
- [Reactive state — Signals and RxJS](#reactive-state--signals-and-rxjs)
- [Build toolchain](#build-toolchain)
- [Testing](#testing)
- [Code quality, formatting, and static analysis](#code-quality-formatting-and-static-analysis)
- [Documentation generators](#documentation-generators)
- [HTTP, authentication, and API access](#http-authentication-and-api-access)
- [Visualisation and charts](#visualisation-and-charts)
- [Styling and theming](#styling-and-theming)
- [Browser platform APIs](#browser-platform-apis)
- [Progressive Web App features](#progressive-web-app-features)
- [Container image and runtime](#container-image-and-runtime)
- [Web server and serving](#web-server-and-serving)
- [Kubernetes and deployment targets](#kubernetes-and-deployment-targets)
- [CI/CD tooling](#cicd-tooling)
- [Supply-chain security](#supply-chain-security)
- [Dependency and release automation](#dependency-and-release-automation)
- [Observability and local-only helper scripts](#observability-and-local-only-helper-scripts)
- [Rejected alternatives](#rejected-alternatives)
- [Cross-reference](#cross-reference)

---

## Languages, runtimes, and module systems

### TypeScript 5.9
- **What it is** — a strictly typed superset of JavaScript that compiles to JS.
- **Usage here** — every source file under `src/` is `.ts`; `tsconfig.json`, `tsconfig.app.json`, and `tsconfig.spec.json` enable strict mode; `npm run typecheck` runs `tsc --noEmit` in CI (`.gitlab-ci.yml` `typecheck` job).
- **Why it's pertinent** — Angular 21 is authored in TS and assumes strictness; types catch template binding errors at build time rather than in production.

### ECMAScript (ES2022+)
- **What it is** — the evolving standardised JavaScript language.
- **Usage here** — compile target for Angular's builder (class fields, top-level `await`, `Object.hasOwn`, optional chaining are all used without transpilation fallbacks).
- **Why it's pertinent** — the browser matrix we target (evergreen Chrome/Firefox/Safari) supports ES2022 natively, so down-levelling would only bloat the bundle.

### ECMAScript modules (ESM)
- **What it is** — the standard `import`/`export` module format.
- **Usage here** — `"type": "module"` semantics via `.mjs` for scripts (`scripts/docker-api.mjs`, `commitlint.config.mjs`); the Angular bundle is tree-shaken ESM.
- **Why it's pertinent** — ESM is a prerequisite for esbuild's tree-shaking and for top-level `await` in Node scripts.

### Node.js 22 (LTS)
- **What it is** — a server-side JavaScript runtime built on V8.
- **Usage here** — `NODE_VERSION: "22"` in `.gitlab-ci.yml`; `FROM node:22-alpine` in `build/Dockerfile`; local dev uses the same major.
- **Why it's pertinent** — Angular CLI 21 requires Node 20.19+ or 22+; we standardise on 22 LTS so CI, local dev, and the Docker builder all match.

### Node.js 20 (compatibility floor)
- **What it is** — the previous Node LTS line.
- **Usage here** — `unit-tests:node20` CI job runs on `node:20-alpine` to guarantee the codebase still builds on the older LTS.
- **Why it's pertinent** — downstream consumers or contributors on Node 20 should not be blocked until Node 22 becomes the only supported version.

### Alpine Linux
- **What it is** — a small, musl-libc-based Linux distribution popular for container base images.
- **Usage here** — both build (`node:22-alpine`) and runtime (`nginx:1.27-alpine`) images are Alpine.
- **Why it's pertinent** — image size directly affects cold-pull latency on GKE Autopilot and Cloud Run; Alpine shaves ~150 MB off the Debian-based base.

### npm
- **What it is** — the default package manager for Node.js.
- **Usage here** — `"packageManager": "npm@11.11.0"` pinned in `package.json`; `npm ci --prefer-offline` in CI; lockfile `package-lock.json` is committed.
- **Why it's pertinent** — the Angular CLI is tested against npm first; switching to pnpm or yarn would add friction without clear upside for a single-app repo.

### package-lock.json
- **What it is** — npm's deterministic dependency graph lockfile.
- **Usage here** — committed at repo root; CI cache key uses its content hash so a lock change busts the `node_modules/` cache.
- **Why it's pertinent** — reproducible installs across CI runs, contributors' machines, and the Docker builder are only possible with a committed lockfile.

### tsc (TypeScript compiler)
- **What it is** — the reference TypeScript type-checker/compiler CLI.
- **Usage here** — `npm run typecheck` → `tsc --noEmit -p tsconfig.app.json`; also used by `@angular/compiler-cli` under the hood.
- **Why it's pertinent** — a separate typecheck pass catches errors the bundler (esbuild) would silently ignore because it skips type-checking for speed.

---

## Angular framework

### Angular 21
- **What it is** — Google's batteries-included web framework for SPAs.
- **Usage here** — core dependency set (`@angular/common`, `@angular/compiler`, `@angular/core`, `@angular/forms`, `@angular/platform-browser`, `@angular/router`); bootstrapped in `src/main.ts`.
- **Why it's pertinent** — we deliberately track the current major to benefit from signals, control-flow syntax, zoneless, and standalone APIs without long migration debt.

### `bootstrapApplication`
- **What it is** — the standalone-first application bootstrap function (replaces `platformBrowserDynamic().bootstrapModule`).
- **Usage here** — single call in `src/main.ts` with the root `App` component and `appConfig`.
- **Why it's pertinent** — eliminates `AppModule` boilerplate and enables tree-shaking of unused providers (see ADR-0005).

### Standalone components
- **What it is** — the Angular 14+ component model where each component declares its own imports without an `NgModule`.
- **Usage here** — all components, directives, and pipes in `src/app/**` are standalone; no `NgModule` exists in the repo (ADR-0005).
- **Why it's pertinent** — standalone reduces indirection, improves tree-shaking, and aligns with Angular's long-term direction.

### Zoneless change detection
- **What it is** — Angular 18+ mode where change detection is driven by signals and explicit APIs instead of monkey-patched browser APIs (Zone.js).
- **Usage here** — `provideZonelessChangeDetection()` in `src/app/app.config.ts`; no `zone.js` in `package.json`; ADR-0002 documents the decision.
- **Why it's pertinent** — smaller bundle, better debuggability (clean stack traces), and a natural fit for a signal-based codebase.

### Signals (`signal`, `computed`, `effect`)
- **What it is** — Angular's fine-grained reactive primitives for local and global state.
- **Usage here** — every service in `src/app/core/` uses `signal()` for writable state, `computed()` for derivations, and `effect()` for side effects (e.g., `ThemeService`, `EnvService`).
- **Why it's pertinent** — signals replace Zone.js-driven change detection and avoid the ceremony of RxJS `BehaviorSubject` for simple state.

### `provideBrowserGlobalErrorListeners`
- **What it is** — DI provider that registers Angular's built-in listeners for `unhandledrejection` and `error` window events.
- **Usage here** — first entry in the providers array of `src/app/app.config.ts`.
- **Why it's pertinent** — ensures uncaught promise rejections and errors surface through Angular's ErrorHandler rather than silently dying in the console.

### `@angular/router`
- **What it is** — Angular's client-side routing library.
- **Usage here** — `provideRouter(routes)` in `app.config.ts`; routes declared in `src/app/app.routes.ts` with lazy-loaded feature chunks.
- **Why it's pertinent** — lazy routes keep the initial bundle under our 1 MB budget; `pushState` routing means no full page reloads.

### Angular functional interceptors
- **What it is** — HTTP interceptors written as plain functions via `HttpInterceptorFn` instead of class-based services.
- **Usage here** — `authInterceptor` in `src/app/core/auth/auth.interceptor.ts`, registered with `provideHttpClient(withInterceptors([authInterceptor]))`.
- **Why it's pertinent** — functional interceptors compose naturally with `inject()`, need no provider boilerplate, and tree-shake cleanly.

### `HttpClient`
- **What it is** — Angular's Observable-returning HTTP client.
- **Usage here** — injected into `ApiService` (`src/app/core/api/api.service.ts`); used for every REST call to the Spring Boot backend.
- **Why it's pertinent** — tight integration with the interceptor chain and RxJS operators gives us retry-on-refresh logic with a few lines of code.

### `@angular/forms`
- **What it is** — Angular's forms package (template-driven + reactive).
- **Usage here** — imported by feature components that need form inputs; we prefer signal-based `[value]`/`(input)` bindings over `ngModel` for new code.
- **Why it's pertinent** — still needed for the few remaining template-driven forms and for `FormGroup` in the request builder feature.

### `@angular/common`
- **What it is** — core Angular directives, pipes, and the `CommonModule` primitives.
- **Usage here** — `DatePipe`, `DecimalPipe`, `@if`/`@for` control-flow (now built into the language) rely on symbols from this package.
- **Why it's pertinent** — mandatory peer of every Angular app; listing it guarantees matching versions when Renovate bumps Angular.

### `@angular/compiler`
- **What it is** — the Ivy compiler that turns templates into renderable instructions.
- **Usage here** — a transitive build-time dependency consumed by `@angular/build`; not imported by app code.
- **Why it's pertinent** — version-locked with all other `@angular/*` packages to avoid cross-package skew (Renovate groups them together in `renovate.json`).

### `@angular/compiler-cli`
- **What it is** — the CLI wrapper around the Angular compiler, used for AOT builds and ngc-powered typechecking.
- **Usage here** — devDependency only; invoked transparently by `@angular/build:application`.
- **Why it's pertinent** — AOT compilation catches template errors before a bundle ships; needed both in CI and dev.

### `@angular/platform-browser`
- **What it is** — the browser-specific Angular renderer and bootstrap platform.
- **Usage here** — source of `bootstrapApplication` in `src/main.ts`.
- **Why it's pertinent** — we render to the DOM, not to the server or native; there is no `platform-server`/SSR in this repo.

### `@angular/core`
- **What it is** — the DI container, change-detection engine, and decorator set at Angular's heart.
- **Usage here** — every TS file imports at least one symbol from it (`@Injectable`, `@Component`, `signal`, `inject`).
- **Why it's pertinent** — the hub; grouping all `@angular/*` in Renovate prevents API drift between core and its satellites.

### Angular control-flow blocks (`@if`, `@for`, `@switch`)
- **What it is** — Angular 17+ built-in template control-flow syntax, replacing `*ngIf`, `*ngFor`, `*ngSwitch`.
- **Usage here** — all feature templates (`*.component.html`) use blocks; `track` is always provided to `@for`.
- **Why it's pertinent** — better ergonomics, better typing, smaller runtime footprint, and no need to import `NgIf`/`NgForOf` individually.

### `inject()`
- **What it is** — the function-form alternative to constructor-based DI.
- **Usage here** — the default in interceptors, guards, and services that use property initialisers (e.g., `readonly auth = inject(AuthService)`).
- **Why it's pertinent** — works outside constructors (in functional interceptors and guards) and plays well with strict property initialisation.

### Lazy feature routes
- **What it is** — Angular routes declared with `loadChildren` / `loadComponent` that trigger a dynamic `import()` at navigation time.
- **Usage here** — `src/app/app.routes.ts` lazy-loads every feature folder (`dashboard/`, `observability/`, `quality/`, …).
- **Why it's pertinent** — keeps the initial bundle under the 1 MB hard limit in `angular.json` budgets.

### Angular component budgets
- **What it is** — `angular.json` bundle-size thresholds that fail the build when exceeded.
- **Usage here** — `initial`: warn at 560 kB, error at 1 MB; `anyComponentStyle`: warn at 24 kB, error at 32 kB.
- **Why it's pertinent** — guards against accidental dependency bloat; a PR that pushes the bundle over the limit fails CI automatically.

---

## Reactive state — Signals and RxJS

### RxJS 7.8
- **What it is** — a reactive programming library based on Observables.
- **Usage here** — `HttpClient` returns `Observable<T>`; the interceptor uses `switchMap`, `catchError`, `BehaviorSubject`, `filter`, `take` (`auth.interceptor.ts`).
- **Why it's pertinent** — Angular's HTTP layer is RxJS-native; switching to fetch + promises would regress cancellation and stream semantics.

### `BehaviorSubject`
- **What it is** — an RxJS Subject that replays its latest value to new subscribers.
- **Usage here** — `refreshTokenSubject` in `auth.interceptor.ts` queues 401s while a token refresh is in flight.
- **Why it's pertinent** — prevents a thundering-herd of concurrent refresh calls; exactly one request refreshes, others wait on the subject.

### RxJS operators (`switchMap`, `catchError`, `filter`, `take`)
- **What it is** — pure functions that transform observable streams.
- **Usage here** — `auth.interceptor.ts` chains them to: catch 401s, swap in a refresh call, filter null tokens during refresh, take one, then replay the original request.
- **Why it's pertinent** — declarative error/retry flow; the equivalent imperative code with promises would be significantly longer and harder to cancel.

### Angular `signal()`
- **What it is** — a writable reactive primitive with a getter `()` and a `set()`/`update()` mutation API.
- **Usage here** — `_theme` in `ThemeService`, `_current` in `EnvService`, token/refresh-token signals in `AuthService`.
- **Why it's pertinent** — simpler than `BehaviorSubject` for local state, integrates directly with zoneless change detection.

### Angular `computed()`
- **What it is** — a memoised derived signal that re-runs only when its inputs change.
- **Usage here** — `EnvService.baseUrl`, `.mavenSiteUrl`, `.sonarUrl` are all `computed()` over the active environment.
- **Why it's pertinent** — cache-on-demand derivation keeps templates simple and avoids manual invalidation bugs.

### Angular `effect()`
- **What it is** — a side-effect reaction that runs whenever its tracked signals change.
- **Usage here** — `ThemeService` constructor uses `effect(() => { localStorage.setItem('theme', t); document.documentElement.setAttribute('data-theme', t); })`.
- **Why it's pertinent** — single source of truth for "theme changed → DOM + storage updated", no risk of forgetting one side.

### `asReadonly()`
- **What it is** — a signal method returning a non-writable projection.
- **Usage here** — services expose public read-only signals (`readonly theme = this._theme.asReadonly()`) while keeping mutation private.
- **Why it's pertinent** — enforces encapsulation at the type level — consumers can't accidentally `set()` service state from a component.

### `localStorage`-backed signal pattern
- **What it is** — our convention: hydrate signal from localStorage at construction, persist via `effect()` on change.
- **Usage here** — `ThemeService` and `EnvService` both implement it; any new user-preference service should follow the same shape.
- **Why it's pertinent** — predictable persistence model across services; one pattern to learn, test, and review.

---

## Build toolchain

### Angular CLI (`@angular/cli`)
- **What it is** — the `ng` command-line tool that scaffolds, builds, tests, and serves Angular apps.
- **Usage here** — `npm start` → `ng serve`; `npm run build` → `ng build`; `ng test` in CI.
- **Why it's pertinent** — the only supported, first-party build system for Angular; deviating would mean rebuilding the AOT + template compile pipeline by hand.

### `@angular/build`
- **What it is** — the modern esbuild-based Angular builder (replacing the legacy Webpack-based `@angular-devkit/build-angular`).
- **Usage here** — `angular.json` uses `@angular/build:application` for production builds, `@angular/build:dev-server` for `ng serve`, and `@angular/build:unit-test` for Vitest integration.
- **Why it's pertinent** — orders of magnitude faster than Webpack builds (seconds vs. minutes) and is the forward path for Angular.

### esbuild
- **What it is** — a Go-based bundler/minifier used by `@angular/build` internally.
- **Usage here** — transparent dependency; powers production bundling, dev-server HMR, and test compilation.
- **Why it's pertinent** — sub-second incremental builds during development are only feasible with esbuild-class performance.

### Vite dev-server primitives
- **What it is** — the dev-server substrate (HMR, plugin API) that Angular's new build integrates with.
- **Usage here** — invoked under the hood by `@angular/build:dev-server` when running `ng serve`.
- **Why it's pertinent** — we don't author Vite config ourselves; documenting it here helps anyone debugging dev-server behaviour understand the layering.

### Angular CLI proxy config
- **What it is** — a `ng serve` configuration that forwards specific request paths to a backend/target, avoiding CORS.
- **Usage here** — `config/proxy.conf.json` proxies `/proxy/kafka-ui`, `/proxy/ollama`, `/proxy/keycloak` to local services during dev.
- **Why it's pertinent** — lets the local SPA call tools that don't expose CORS headers (Kafka UI, Ollama) without browser blocks.

### `ng serve`
- **What it is** — the Angular dev-server that watches sources and serves a bundle at `http://localhost:4200`.
- **Usage here** — `npm start`; documented in `docs/quick-start.md` and `docs/ports.md`.
- **Why it's pertinent** — the only supported way to iterate on Angular with full AOT + HMR parity with production.

### `ng build --configuration production`
- **What it is** — the production build command: AOT compile, minify, hash filenames, strip dev diagnostics.
- **Usage here** — CI `build:production` job; Docker builder stage 1 (`build/Dockerfile`).
- **Why it's pertinent** — only the production configuration enforces budgets, output hashing, and license extraction.

### Output hashing
- **What it is** — appending a content hash (e.g., `main-a1b2c3.js`) to every emitted asset.
- **Usage here** — `outputHashing: "all"` in `angular.json`.
- **Why it's pertinent** — enables the aggressive 1-year `Cache-Control: immutable` on JS/CSS/font in `deploy/nginx.conf`.

### Source maps
- **What it is** — `.map` files linking minified output back to original TypeScript.
- **Usage here** — enabled only in `development` configuration (`sourceMap: true`); stripped in production.
- **Why it's pertinent** — debugging friendly in dev; keeps the production bundle small and avoids leaking readable source to users.

### `.dockerignore`
- **What it is** — a file listing paths excluded from the Docker build context.
- **Usage here** — at repo root; excludes `node_modules`, `dist`, `.angular`, `docs`, `.git`.
- **Why it's pertinent** — shrinks the context sent to the Docker daemon from hundreds of MB to a few; required to fit within runner disk quotas.

### `tsconfig.json` / `tsconfig.app.json` / `tsconfig.spec.json`
- **What it is** — TypeScript project configuration files.
- **Usage here** — `tsconfig.json` is the base; `tsconfig.app.json` scopes production; `tsconfig.spec.json` includes test-only files.
- **Why it's pertinent** — splitting configs means tests can import Vitest globals without polluting the prod build's type environment.

### `.editorconfig`
- **What it is** — a universal editor indentation/whitespace configuration.
- **Usage here** — committed at repo root; drives editors (VS Code, IntelliJ) to match Prettier's output.
- **Why it's pertinent** — stops "fixed whitespace" commits before they happen, regardless of the editor contributors use.

---

## Testing

### Vitest
- **What it is** — a Vite-powered test runner with a Jest-compatible API.
- **Usage here** — `vitest` as devDependency; invoked via `@angular/build:unit-test` from `ng test`; per-component `*.spec.ts` colocated with sources.
- **Why it's pertinent** — ~10x faster than Karma+Jasmine on this repo (ADR-0004); natively ESM and TypeScript, aligns with Angular's esbuild direction.

### jsdom
- **What it is** — a pure-JS implementation of many DOM APIs, used to fake a browser inside Node.
- **Usage here** — `jsdom` devDependency; set as Vitest's environment so component tests can query the rendered DOM.
- **Why it's pertinent** — lets tests run headlessly on CI without launching Chrome; faster startup and fewer flakes than a real browser.

### `@angular/build:unit-test`
- **What it is** — Angular's Vitest-aware builder that compiles tests with the same pipeline as production builds.
- **Usage here** — declared as the `test` architect in `angular.json`.
- **Why it's pertinent** — one compile pipeline for src and spec files, avoiding the Karma-era class of "works in dev, breaks in test" bugs.

### `*.spec.ts` colocation
- **What it is** — the convention of placing a test file next to the source file it covers.
- **Usage here** — `api.service.spec.ts` next to `api.service.ts`; every service in `core/` has a matching spec.
- **Why it's pertinent** — makes it obvious when a new service ships without tests; dead tests are easy to spot after a refactor.

### Vitest globals (`describe`, `it`, `expect`, `vi`)
- **What it is** — the Jest-style assertion and spy APIs.
- **Usage here** — used in all specs; `vi.fn()`, `vi.spyOn()`, `vi.useFakeTimers()` replace Jasmine equivalents.
- **Why it's pertinent** — familiar API keeps migration cost low for contributors coming from Jest or earlier Karma+Jasmine suites.

---

## Code quality, formatting, and static analysis

### Prettier
- **What it is** — an opinionated code formatter.
- **Usage here** — `npm run format` writes; `npm run format:check` and the `lint:format` CI job verify; also pre-commit via lefthook.
- **Why it's pertinent** — zero-bikeshed formatting; one canonical style removes a whole class of review comments.

### TypeScript strict mode
- **What it is** — the `strict: true` family of TS compiler flags (`strictNullChecks`, `noImplicitAny`, …).
- **Usage here** — enabled in `tsconfig.json`; enforced via `npm run typecheck` in the `typecheck` CI job.
- **Why it's pertinent** — nullable types catch real bugs in services that return `null` on restore (e.g., `EnvService.restore()`).

### Angular strict templates (`strictTemplates`)
- **What it is** — AOT template type-checking at full strictness.
- **Usage here** — enabled by default in Angular 21 with standalone; verified by the `typecheck` job.
- **Why it's pertinent** — template binding errors (wrong pipe arg, missing property) fail the build instead of appearing in production.

### SonarCloud
- **What it is** — a SaaS code-quality and security analysis platform.
- **Usage here** — `sonarcloud` CI job runs the `sonarsource/sonar-scanner-cli:11` image; config in `config/sonar-project.properties`; token in `SONAR_TOKEN` CI variable.
- **Why it's pertinent** — catches code smells, bugs, and security hotspots the compiler doesn't; `allow_failure: true` means a SonarCloud outage doesn't block deploys.

### `sonar-scanner`
- **What it is** — the CLI that uploads analysis to SonarCloud.
- **Usage here** — `npm run sonar` locally; `sonar-scanner` binary in the CI image.
- **Why it's pertinent** — the npm package is archived (flagged in `renovate.json` as `enabled: false`) so we prefer the CLI-image version in CI.

### `sonar-project.properties`
- **What it is** — SonarCloud/Sonar scanner project configuration.
- **Usage here** — `config/sonar-project.properties` sets organisation and project key.
- **Why it's pertinent** — keeping the file under `config/` matches the backend's convention and unclutters the repo root.

### `dist/build-warnings.txt`
- **What it is** — captured build output used for downstream checks.
- **Usage here** — written by the `build:production` CI job; consumed by `lint:circular-deps` which greps for "circular".
- **Why it's pertinent** — catches circular imports that Angular accepts but which risk runtime order-of-initialisation bugs.

### Bundle size check
- **What it is** — a heuristic CI check that warns when `main-*.js` exceeds a threshold (500 kB).
- **Usage here** — `bundle-size-check` job in `.gitlab-ci.yml`, non-blocking (`allow_failure: true`).
- **Why it's pertinent** — complements the hard budget in `angular.json`; gives a visible warning earlier than the 1 MB error.

### `npm audit`
- **What it is** — npm's built-in vulnerability scanner for the dependency tree.
- **Usage here** — `security:audit` job runs `npm audit --audit-level=high || true` on every MR/main.
- **Why it's pertinent** — cheap, zero-dependency signal; the `|| true` prevents transient registry flakes from red-ing CI.

### Sensitive-files find scan
- **What it is** — a `find` invocation that looks for `.env*`, `*.pem`, `*.key`, or `credentials*` under `src/`.
- **Usage here** — `security:audit` job; fails the pipeline if any match.
- **Why it's pertinent** — last-line defence against accidentally committing secrets inside the Angular source tree.

---

## Documentation generators

### Compodoc
- **What it is** — an Angular-aware static documentation generator.
- **Usage here** — `@compodoc/compodoc` devDependency; `npm run compodoc` builds into `docs/compodoc/`; config `config/.compodocrc.json`.
- **Why it's pertinent** — understands Angular component metadata (inputs, outputs, providers); generic TypeDoc can't render template wiring.

### TypeDoc
- **What it is** — a TypeScript-native API documentation generator.
- **Usage here** — `typedoc` devDependency; `npm run typedoc` builds into `docs/typedoc/`; config `config/typedoc.json` (entry point `../src/app`).
- **Why it's pertinent** — complements Compodoc by covering pure-TS utilities, types, and services without the component lens; published as a CI artifact.

### Markdown docs under `docs/`
- **What it is** — our hand-written documentation tree.
- **Usage here** — `docs/architecture.md`, `docs/ci-cd.md`, `docs/environment.md`, ADRs under `docs/adr/`, etc.; linked from `docs/README.md`.
- **Why it's pertinent** — persistent context for future Claude sessions and contributors; survives across context-window resets.

### Architecture Decision Records (ADRs)
- **What it is** — lightweight markdown files documenting architectural decisions with context and consequences.
- **Usage here** — `docs/adr/0001…0005-*.md`; template at `0000-template.md`.
- **Why it's pertinent** — zoneless, raw SVG, Vitest, standalone components all have explicit ADRs so the rationale doesn't drift into tribal knowledge.

---

## HTTP, authentication, and API access

### `@auth0/auth0-angular` 2.8
- **What it is** — Auth0's official Angular SDK (OIDC + PKCE + token caching).
- **Usage here** — `provideAuth0()` in `src/app/app.config.ts` with domain `dev-ksxj46zlkhk2gcvo.us.auth0.com` and audience `https://mirador-api`; bridge in `src/app/core/auth/auth0-bridge.service.ts`.
- **Why it's pertinent** — offloads OIDC, PKCE, and token refresh to a managed provider; avoids shipping auth libraries we'd have to maintain.

### Auth0
- **What it is** — a hosted identity-as-a-service platform (OIDC, OAuth2, social login).
- **Usage here** — production IdP; tokens are validated by the Spring Boot backend.
- **Why it's pertinent** — faster to ship than a self-hosted Keycloak in production; the same app still talks to local Keycloak in dev via the proxy.

### Auth0 Bridge service
- **What it is** — our adapter that copies the Auth0 access token into our signal-based `AuthService`.
- **Usage here** — `src/app/core/auth/auth0-bridge.service.ts`; keeps the interceptor and components unchanged whether auth comes from Auth0 or our custom login.
- **Why it's pertinent** — insulates the app from the provider choice; swapping back to Keycloak is a one-file change.

### JWT (JSON Web Tokens)
- **What it is** — a compact, URL-safe token format with a signed payload.
- **Usage here** — the `authInterceptor` attaches `Authorization: Bearer <jwt>` to every backend call; refresh-token flow on 401.
- **Why it's pertinent** — stateless auth — the backend validates locally without a DB roundtrip; works equally with Auth0 and Keycloak.

### Bearer token scheme
- **What it is** — the `Authorization: Bearer <token>` HTTP header convention.
- **Usage here** — set by `auth.interceptor.ts` for all API requests to the current base URL.
- **Why it's pertinent** — interoperable with every OAuth2/OIDC server; no cookie/CSRF complexity.

### Silent token refresh
- **What it is** — retrying a failed 401 request after acquiring a new access token from a refresh token.
- **Usage here** — `handleRefresh()` in `auth.interceptor.ts`; concurrent 401s wait on a shared `BehaviorSubject`.
- **Why it's pertinent** — users don't see a logout flicker when a token expires mid-session; exactly one refresh call fires.

### Multi-environment `EnvService`
- **What it is** — our signal-backed service holding the active backend target (Local, Docker, Staging, …).
- **Usage here** — `src/app/core/env/env.service.ts`; persisted to `localStorage`; consumed by `ApiService` and feature pages.
- **Why it's pertinent** — one toggle switches every API call, Maven-site link, Compodoc link, and SonarQube link at once.

### `ApiService`
- **What it is** — our thin wrapper around `HttpClient` exposing typed backend calls.
- **Usage here** — `src/app/core/api/api.service.ts`; all feature components call it rather than `HttpClient` directly.
- **Why it's pertinent** — central place to add headers, base URLs, error handling, or telemetry without touching every call site.

### CORS
- **What it is** — browser-enforced Cross-Origin Resource Sharing policy.
- **Usage here** — avoided in prod by serving the SPA from the same origin as the API (Nginx + backend behind one Ingress); in dev, the proxy config in `config/proxy.conf.json` bypasses it locally.
- **Why it's pertinent** — same-origin deploy means we never need `*` in CORS headers, which is explicitly called out as an antipattern in global CLAUDE.md.

---

## Visualisation and charts

### Raw SVG
- **What it is** — the W3C Scalable Vector Graphics format, authored directly as DOM.
- **Usage here** — every visualisation under `src/app/features/visualizations/` and the observability dashboard is hand-authored SVG inside Angular templates (ADR-0003).
- **Why it's pertinent** — zero chart-library weight in the bundle, full control over interactions, animations, and theming via CSS custom properties.

### `viewBox` coordinate system
- **What it is** — SVG's internal virtual coordinate space, independent of rendered pixel size.
- **Usage here** — every `<svg>` sets `[attr.viewBox]` with a computed aspect ratio; data points map onto the viewBox.
- **Why it's pertinent** — crisp rendering at any zoom/resolution; no pixel math at component level.

### SVG path generation (in-house)
- **What it is** — plain TS utilities that emit `d` attribute strings (line, area, arc).
- **Usage here** — pure functions colocated with the consuming component; replaces D3's path helpers.
- **Why it's pertinent** — the functions we need are ~20 lines each; importing D3 just for `d3-shape` would add ~40 kB.

### Linear / log scale helpers (in-house)
- **What it is** — small TS functions mapping a domain (data range) to a range (SVG coordinates).
- **Usage here** — each chart defines its own scales; no shared abstraction yet.
- **Why it's pertinent** — explicit scale code is easier to debug than D3's scale objects when a chart axis looks wrong.

---

## Styling and theming

### SCSS (Sass)
- **What it is** — a CSS preprocessor with variables, nesting, and mixins.
- **Usage here** — every component has a `*.component.scss`; global `src/styles.scss`; `"style": "scss"` default in `angular.json` schematics.
- **Why it's pertinent** — nesting + variables keep component styles readable without reaching for CSS-in-JS.

### CSS custom properties (variables)
- **What it is** — native CSS `--name: value` tokens accessible via `var(--name)`.
- **Usage here** — the foundation of our theming system; defined in `src/styles.scss` under `[data-theme="light"]` and `[data-theme="dark"]`.
- **Why it's pertinent** — theme switching is a single DOM attribute change — no recompile, no stylesheet reload.

### `data-theme` attribute theming
- **What it is** — our convention: setting `data-theme="dark"` on `<html>` swaps the custom-property palette.
- **Usage here** — `ThemeService` writes the attribute inside an `effect()`; all component styles reference the tokens (`var(--bg)`, `var(--fg)`).
- **Why it's pertinent** — works in zero JS if needed; no flash of unstyled content because the attribute is applied eagerly in the constructor.

### `prefers-color-scheme` media query
- **What it is** — CSS media query for the user's OS colour preference.
- **Usage here** — not currently auto-applied; `ThemeService` defaults to stored preference then `light`. Potential future enhancement.
- **Why it's pertinent** — documented so contributors don't reintroduce a conflicting auto-detect without discussion.

### `:root` and `html[data-theme]` selectors
- **What it is** — CSS selectors targeting the document root for global token scope.
- **Usage here** — `styles.scss` declares palette tokens on `html[data-theme="light"]` / `html[data-theme="dark"]`.
- **Why it's pertinent** — scoping to `html[data-theme]` allows a stylesheet-free swap on attribute change.

### Per-component style budget
- **What it is** — the `anyComponentStyle` budget (warn 24 kB, error 32 kB) in `angular.json`.
- **Usage here** — enforced by every production build.
- **Why it's pertinent** — prevents one heavy component (e.g., a big SVG chart with inline styles) from bloating shared chunks.

### SVG favicon / icons
- **What it is** — vector favicons served as `image/svg+xml`.
- **Usage here** — `public/favicon.svg`, `public/icon-white.svg`, `public/banner.svg`.
- **Why it's pertinent** — one file renders crisp at every size, including the retina Safari tab.

---

## Browser platform APIs

### Fetch API
- **What it is** — the standard browser HTTP API (Promise-based).
- **Usage here** — used indirectly via Angular's `HttpClient`; directly in a few isolated debug utilities.
- **Why it's pertinent** — baseline in every evergreen browser, polyfill-free, streaming-capable.

### `HttpClient` (wraps XHR/fetch)
- **What it is** — Angular's HTTP abstraction layered on the browser's networking APIs.
- **Usage here** — the only HTTP call path for features; see [HTTP, authentication, and API access](#http-authentication-and-api-access).
- **Why it's pertinent** — gives us interceptors, observable cancellation, and typed responses without reinventing them.

### Server-Sent Events (SSE / `EventSource`)
- **What it is** — a unidirectional server-to-client streaming protocol over HTTP.
- **Usage here** — used by the activity/diagnostic features for live event feeds (see `src/app/core/activity/` and `src/app/features/activity/`).
- **Why it's pertinent** — simpler than WebSockets for read-only live updates and passes through the Nginx + Ingress stack without special config.

### `localStorage`
- **What it is** — a synchronous key-value store scoped to origin.
- **Usage here** — theme preference, active environment, keyboard-shortcuts enable flag; always guarded by try/catch during restore (see `EnvService.restore`).
- **Why it's pertinent** — survives reloads without cookies; enough size for our small JSON blobs (no quota concern).

### `document.documentElement`
- **What it is** — the `<html>` element reference in the DOM.
- **Usage here** — target of `setAttribute('data-theme', …)` in `ThemeService`.
- **Why it's pertinent** — attaching themes here means descendants inherit the attribute selector match automatically.

### `EventListener` / keyboard handling
- **What it is** — the DOM event system.
- **Usage here** — `src/app/core/keyboard/` centralises global shortcuts; listeners attached in the app shell.
- **Why it's pertinent** — Angular's template event bindings don't cover global shortcuts that fire outside the focused component tree.

### Web App Manifest
- **What it is** — a JSON manifest describing a web app's install metadata.
- **Usage here** — `public/manifest.json`; linked from `src/index.html` via `<link rel="manifest">`.
- **Why it's pertinent** — lets the app appear in "Add to Home Screen" / PWA install prompts with the right name, icon, and theme colour.

### `<meta name="theme-color">`
- **What it is** — a meta tag that sets the browser/OS chrome colour for the page.
- **Usage here** — `src/index.html` sets it to `#1e3a5f` to match the PWA theme colour.
- **Why it's pertinent** — Safari iOS and Android Chrome use it for the address bar tint; consistent brand on mobile.

### `pushState` HTML5 history
- **What it is** — the History API primitive behind client-side routing.
- **Usage here** — Angular Router uses it by default; Nginx's `try_files … /index.html` fallback makes it work on reload.
- **Why it's pertinent** — deep links work correctly — refreshing `/dashboard/foo` returns the SPA shell instead of a 404.

### `try_files` SPA fallback
- **What it is** — the Nginx directive that serves `index.html` for unknown paths.
- **Usage here** — `deploy/nginx.conf` `location /` block: `try_files $uri $uri/ /index.html`.
- **Why it's pertinent** — mandatory for client-side routing in production; without it every deep-link reload 404s.

---

## Progressive Web App features

### PWA manifest
- **What it is** — the aggregate of `manifest.json`, meta theme-color, and installable icons.
- **Usage here** — `public/manifest.json` + the Apple-specific meta tags in `src/index.html`.
- **Why it's pertinent** — allows "install to home screen" on Chrome and iOS Safari without taking the full Service Worker + offline dependency.

### Apple mobile web app meta tags
- **What it is** — Apple-specific meta directives (`apple-mobile-web-app-capable`, `status-bar-style`).
- **Usage here** — set in `src/index.html`.
- **Why it's pertinent** — iOS ignores the manifest's `display: standalone`; these tags are the iOS equivalent.

---

## Container image and runtime

### Docker
- **What it is** — the container engine used to build and run images.
- **Usage here** — `build/Dockerfile` multi-stage build; CI `docker-build` job uses `docker:28` with Docker-in-Docker service.
- **Why it's pertinent** — universal packaging format that every deploy target (GKE, EKS, AKS, Cloud Run, Fly, k3s) accepts.

### Multi-stage build
- **What it is** — a Dockerfile pattern where a "builder" stage produces artefacts consumed by a smaller "runtime" stage.
- **Usage here** — Stage 1 `node:22-alpine` runs `ng build`; Stage 2 `nginx:1.27-alpine` ships only the compiled `dist/` plus Nginx.
- **Why it's pertinent** — the final image has no Node.js, no `node_modules`, no source; ~30 MB runtime vs. ~1 GB if we shipped the builder.

### `node:22-alpine` (builder image)
- **What it is** — the official Node.js 22 Alpine Docker image.
- **Usage here** — builder stage in `build/Dockerfile`.
- **Why it's pertinent** — matches our CI Node version exactly; Alpine keeps the builder cache layer small too.

### `nginx:1.27-alpine` (runtime image)
- **What it is** — the official Nginx 1.27 Alpine image.
- **Usage here** — runtime stage in `build/Dockerfile`; serves the SPA on port 80.
- **Why it's pertinent** — minimal, runs as non-root by default in the Alpine variant; long-term maintained.

### `docker:28` CI image
- **What it is** — the official Docker client image used in GitLab CI for building other images.
- **Usage here** — `docker-build` job's `image: docker:28` plus `docker:28-dind` service.
- **Why it's pertinent** — version-pinned so the build environment doesn't drift silently; matches Trivy-scan image version.

### Docker-in-Docker (DinD)
- **What it is** — running a Docker daemon inside a container, used to build images in CI.
- **Usage here** — `services: docker:28-dind`; tag `saas-linux-medium-amd64` because local runners can't provide privileged mode.
- **Why it's pertinent** — only way to build Docker images on GitLab SaaS; the job's `before_script` waits up to 60 s for the daemon to become ready.

### Layer caching (`--cache-from`)
- **What it is** — reusing layers from a previous image to skip re-running identical steps.
- **Usage here** — `docker pull "$CI_REGISTRY_IMAGE:main"` + `--cache-from` in the build job.
- **Why it's pertinent** — saves ~2 minutes per build by reusing the `npm ci` layer when only `src/` changed.

### OCI image labels
- **What it is** — standardised metadata attached to container images (title, source, revision, …).
- **Usage here** — `org.opencontainers.image.*` labels set in `build/Dockerfile` and extended at build time (revision=SHA, created=timestamp).
- **Why it's pertinent** — Trivy, cosign, and the GitLab registry UI all surface these; improves traceability from a running container back to its commit.

### `CMD ["nginx", "-g", "daemon off;"]`
- **What it is** — runs Nginx in foreground mode as PID 1.
- **Usage here** — last line of `build/Dockerfile`.
- **Why it's pertinent** — Docker and Kubernetes only track PID 1; a daemonised Nginx would exit immediately.

### `EXPOSE 80`
- **What it is** — a Dockerfile directive declaring the listening port.
- **Usage here** — declared in `build/Dockerfile`; mapped to Service port 80 in `deploy/kubernetes/frontend/service.yaml`.
- **Why it's pertinent** — documentation for humans and signalling for orchestrators; doesn't actually bind anything.

### GitLab Container Registry
- **What it is** — GitLab's built-in OCI image registry.
- **Usage here** — images pushed to `$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA` (immutable) + `:$CI_COMMIT_REF_SLUG` (moving).
- **Why it's pertinent** — single-sign-on with the GitLab repo, free for our usage, no extra vendor.

### Non-root container user
- **What it is** — running the container process as a UID other than 0.
- **Usage here** — `nginx:1.27-alpine` uses the `nginx` user by default; we don't override.
- **Why it's pertinent** — Dockle and CIS Docker policies flag root-running containers; the base image already does the right thing.

---

## Web server and serving

### Nginx 1.27
- **What it is** — a high-performance HTTP server.
- **Usage here** — the runtime stage of `build/Dockerfile`; config in `deploy/nginx.conf`.
- **Why it's pertinent** — we don't need a full Node server; Nginx serves a static SPA with sub-ms overhead.

### Gzip compression
- **What it is** — HTTP response compression via the gzip algorithm.
- **Usage here** — `gzip on` plus a list of MIME types in `deploy/nginx.conf`; min-length 1024 bytes.
- **Why it's pertinent** — cuts the main bundle transfer size ~4x, which directly improves first paint over slow mobile networks.

### `Cache-Control: immutable` for hashed assets
- **What it is** — an HTTP cache directive telling browsers never to revalidate during the max-age.
- **Usage here** — `deploy/nginx.conf` applies `public, immutable, max-age=31536000` to `.js|.css|.woff2?|.ttf|.eot|.otf`.
- **Why it's pertinent** — Angular's content-hashed filenames guarantee a new URL on change, making a 1-year immutable cache safe and fast.

### `Cache-Control: no-cache` for `index.html`
- **What it is** — a directive forcing revalidation on every request.
- **Usage here** — `location = /index.html` block in `deploy/nginx.conf` with `no-cache, must-revalidate` and `expires 1m`.
- **Why it's pertinent** — a new deploy is picked up within ~1 minute without stale-SPA-pinning-old-chunks bugs.

### `/healthz` endpoint
- **What it is** — a plain-text "OK" endpoint used for liveness/readiness probes.
- **Usage here** — `deploy/nginx.conf` serves it with `return 200`, `Content-Type: text/plain`, `access_log off`.
- **Why it's pertinent** — K8s probes noisy access logs would otherwise drown real traffic; `access_log off` keeps logs clean.

### MIME type handling
- **What it is** — the Content-Type header served for each file extension.
- **Usage here** — Nginx's default `mime.types`; we only override with `text/plain` for `/healthz`.
- **Why it's pertinent** — SVG, woff2, and .js all need correct types for browsers to accept them; the default config gets this right.

### Static file root (`/usr/share/nginx/html`)
- **What it is** — Nginx's conventional webroot.
- **Usage here** — `COPY --from=builder /app/dist/mirador-ui/browser /usr/share/nginx/html`.
- **Why it's pertinent** — aligns with the base image defaults, minimising config surface.

---

## Kubernetes and deployment targets

### Kubernetes
- **What it is** — a container orchestration platform.
- **Usage here** — manifests under `deploy/kubernetes/frontend/` (Deployment, Service); backend owns Ingress.
- **Why it's pertinent** — the common denominator across GKE Autopilot, EKS, AKS, and k3s; one manifest applies to five targets.

### Deployment (`apps/v1/Deployment`)
- **What it is** — a K8s controller that maintains N replicas of a Pod template.
- **Usage here** — `deploy/kubernetes/frontend/deployment.yaml`; 2 replicas; rolling update with `maxUnavailable: 0`.
- **Why it's pertinent** — zero-downtime deploys since at least one pod always stays up; `maxSurge: 1` keeps capacity bounded.

### Service (`v1/Service`)
- **What it is** — a stable network endpoint selecting Pods by labels.
- **Usage here** — `deploy/kubernetes/frontend/service.yaml` exposes container port 80.
- **Why it's pertinent** — the backend's Ingress routes `/` to this Service, so both SPA and API live on the same origin.

### Rolling update strategy
- **What it is** — K8s's default no-downtime Pod replacement strategy.
- **Usage here** — `strategy.rollingUpdate: { maxUnavailable: 0, maxSurge: 1 }`.
- **Why it's pertinent** — with only 2 replicas we still want zero-unavailable; `maxSurge: 1` adds a third briefly.

### Liveness/readiness probes
- **What it is** — K8s health checks on the container's network endpoints.
- **Usage here** — HTTP `GET /` on port 80 for both probes in the Deployment.
- **Why it's pertinent** — Nginx starts in <1 s so short `initialDelaySeconds` are safe; unhealthy pods are auto-restarted.

### `imagePullSecrets`
- **What it is** — K8s credentials for pulling from a private registry.
- **Usage here** — `gitlab-registry` secret created idempotently in each deploy job's `.kubectl-apply-ui` script.
- **Why it's pertinent** — we pull from the private GitLab Container Registry; without the secret, pods stay in `ImagePullBackOff`.

### `envsubst` manifest templating
- **What it is** — a tiny GNU tool that substitutes `${VAR}` tokens in text.
- **Usage here** — `.kubectl-apply-ui` pipes each manifest through `envsubst` before `kubectl apply`, expanding `${IMAGE_REGISTRY}` and `${UI_IMAGE_TAG}`.
- **Why it's pertinent** — simpler than Helm or Kustomize overlays for two variables; no extra tool to install.

### `kubectl apply`
- **What it is** — K8s's declarative apply command.
- **Usage here** — used by every deploy target (`deploy:gke`, `deploy:eks`, `deploy:aks`, `deploy:k3s`).
- **Why it's pertinent** — idempotent and reconciling — safe to rerun, matches live cluster state to the manifests.

### `kubectl rollout status`
- **What it is** — blocks until a Deployment's new revision is fully rolled out.
- **Usage here** — `kubectl rollout status deployment/customer-ui -n app --timeout=120s` at the end of `.kubectl-apply-ui`.
- **Why it's pertinent** — makes CI fail fast if a pod crash-loops, rather than reporting "deployed" while the cluster is still trying.

### GKE Autopilot
- **What it is** — Google's managed Kubernetes service with per-pod billing.
- **Usage here** — `deploy:gke` is the default auto-deploy on main; auth via GitLab OIDC + Workload Identity Federation.
- **Why it's pertinent** — zero node management; we pay only for what Pods request.

### AWS EKS
- **What it is** — Amazon's managed Kubernetes service.
- **Usage here** — `deploy:eks` manual job; uses `alpine/k8s:1.30.2` image.
- **Why it's pertinent** — kept behind `when: manual` so we don't deploy on every main commit; available when the user opts in.

### Azure AKS
- **What it is** — Microsoft's managed Kubernetes service.
- **Usage here** — `deploy:aks` manual job using `mcr.microsoft.com/azure-cli`.
- **Why it's pertinent** — triad coverage (GCP/AWS/Azure) without actually paying for three clusters all the time.

### Google Cloud Run
- **What it is** — a managed serverless container platform.
- **Usage here** — `deploy:cloud-run` manual job; `--allow-unauthenticated --port 80 --cpu 1 --memory 256Mi`.
- **Why it's pertinent** — cheapest possible prod hosting for a static SPA; scales to zero.

### Fly.io
- **What it is** — a developer-focused global container platform.
- **Usage here** — `deploy:fly` manual job invoking `flyctl deploy`.
- **Why it's pertinent** — edge-local deployment; useful for demos outside GCP/AWS regions.

### k3s / bare-metal
- **What it is** — a lightweight certified Kubernetes distribution.
- **Usage here** — `deploy:k3s` manual job builds a kubeconfig from CI variables (`K8S_SERVER`, `K8S_TOKEN`, `K8S_CA_CERT`).
- **Why it's pertinent** — deploy to a self-hosted Raspberry Pi / home-lab cluster without any cloud vendor.

### Workload Identity Federation (WIF)
- **What it is** — GCP's keyless auth pattern accepting external OIDC tokens.
- **Usage here** — `deploy:gke` uses GitLab-issued OIDC to impersonate a GCP service account via `GCP_WIF_PROVIDER`.
- **Why it's pertinent** — no service-account JSON keys stored in GitLab — shorter-lived, revocable, auditable auth.

### GitLab OIDC `id_tokens`
- **What it is** — GitLab CI-issued short-lived JWTs for federating to cloud providers.
- **Usage here** — `GCP_OIDC_TOKEN` for WIF; `SIGSTORE_ID_TOKEN` for cosign keyless signing.
- **Why it's pertinent** — removes entire categories of credential-leak incidents.

### `envsubst` from gettext
- **What it is** — Alpine's `gettext` package provides `envsubst`.
- **Usage here** — installed via `apk add --no-cache gettext` in the `deploy:gke` before_script.
- **Why it's pertinent** — `google/cloud-sdk:alpine` doesn't ship it by default; skipping the install causes `envsubst: command not found`.

### `gke-gcloud-auth-plugin`
- **What it is** — the GKE authentication plugin for kubectl (replaces built-in GKE auth).
- **Usage here** — installed via `gcloud components install gke-gcloud-auth-plugin --quiet`.
- **Why it's pertinent** — without it, `kubectl` can't authenticate to GKE 1.26+; skipping it causes opaque "No Auth Provider found" errors.

---

## CI/CD tooling

### GitLab CI
- **What it is** — GitLab's integrated CI/CD platform driven by `.gitlab-ci.yml`.
- **Usage here** — single pipeline file at repo root; stages: validate, test, build, quality, docker, deploy.
- **Why it's pertinent** — our repos live in GitLab; using the native CI avoids token/webhook plumbing for GitHub Actions.

### `.gitlab-ci.yml` workflow rules
- **What it is** — top-level `workflow.rules` that decide whether a pipeline is created at all.
- **Usage here** — pipelines only run when `src/`, manifest, Dockerfile, Nginx config, or CI config changes — pure-doc commits skip.
- **Why it's pertinent** — saves CI minutes and prevents the #1 source of pipeline noise — flakiness on unrelated doc tweaks.

### GitLab Runner
- **What it is** — the agent that executes CI jobs (shared SaaS or self-hosted).
- **Usage here** — most jobs run on any available runner; DinD jobs require `saas-linux-medium-amd64` for privileged mode.
- **Why it's pertinent** — the macbook-local runner (arm64) handles most of the load; we pay for SaaS only when DinD requires it.

### GitLab CI cache
- **What it is** — runner-local directory cached across job invocations keyed by a file hash.
- **Usage here** — `node_modules/` cached with key derived from `package-lock.json`.
- **Why it's pertinent** — reduces `npm ci` from ~45 s to ~5 s on warm runners.

### GitLab CI artifacts
- **What it is** — files uploaded from a job and downloadable for up to `expire_in`.
- **Usage here** — `build:production` uploads `dist/` for 7 days; `typedoc` uploads `docs/typedoc/` for 30 days; `sbom:syft` uploads CycloneDX + SPDX for 90 days.
- **Why it's pertinent** — downstream jobs (`lint:circular-deps`, `grype:scan`) consume them; humans can browse them from the MR.

### GitLab CI reports (`reports.cyclonedx`)
- **What it is** — specialised artifact types that GitLab parses and shows in the UI.
- **Usage here** — `sbom:syft` emits `bom.cdx.json` under `reports.cyclonedx`.
- **Why it's pertinent** — the MR view surfaces the SBOM contents and diff without downloading the raw file.

### `glab` CLI
- **What it is** — GitLab's official CLI, like `gh` for GitHub.
- **Usage here** — `glab ci lint` in lefthook pre-commit; `glab mr merge --auto-merge --remove-source-branch=false` in the dev workflow.
- **Why it's pertinent** — catches `.gitlab-ci.yml` typos locally (saves a 15-minute failed pipeline) and drives auto-merge from the terminal.

### lefthook
- **What it is** — a fast, Go-based git hooks manager.
- **Usage here** — `lefthook.yml` runs Prettier, `glab ci lint`, hadolint, kubectl dry-run, gitleaks on pre-commit; Conventional Commits on commit-msg; `scripts/pre-push-checks.sh --standard` on pre-push.
- **Why it's pertinent** — parallel hook execution and clean failure output; bypassable with `LEFTHOOK=0` in emergencies.

### Conventional Commits
- **What it is** — a commit-message convention (`<type>(<scope>)!?: <subject>`).
- **Usage here** — pure-bash regex enforcement in `lefthook.yml` (commit-msg hook); `commitlint.config.mjs` documents the intent.
- **Why it's pertinent** — machine-parseable history powers release-please's automatic semver bumps and CHANGELOG sections.

### commitlint (documentary)
- **What it is** — a Node-based commit-message linter.
- **Usage here** — `commitlint.config.mjs` documents the ruleset; actual enforcement is the bash regex in lefthook to avoid adding a dependency and Node install step to a frontend repo that already installs plenty.
- **Why it's pertinent** — having the `commitlint` file makes IDE integrations pick it up while keeping CI lightweight.

### hadolint
- **What it is** — a Dockerfile linter that enforces best practices.
- **Usage here** — `hadolint` CI job (`hadolint/hadolint:v2.12.0-debian`); also pre-commit via lefthook; `--failure-threshold error` so warnings don't block.
- **Why it's pertinent** — catches mutable tags, missing `--no-install-recommends`, and secret leaks at author time.

### gitleaks
- **What it is** — a secret-scanning tool based on regex + entropy.
- **Usage here** — `secret-scan` CI job; pre-commit hook; `.gitleaks.toml` allowlists demo creds/test fixtures.
- **Why it's pertinent** — last-line defence before a token lands in git history; catches AWS keys, JWTs, high-entropy tokens.

### `scripts/pre-push-checks.sh`
- **What it is** — our shell script orchestrating a tiered check suite (quick/standard/full).
- **Usage here** — invoked by `npm run check`, `check:quick`, `check:full`, and the lefthook pre-push hook.
- **Why it's pertinent** — reproduces the exact CI gauntlet locally so we fail fast in 2 min instead of 15.

### `npx`
- **What it is** — a tool for running npm-distributed binaries without global install.
- **Usage here** — `npx ng`, `npx prettier`, `npx tsc`, `npx renovate-config-validator`, `npx release-please`.
- **Why it's pertinent** — CI doesn't need global installs; lockfile-pinned local binaries always match the build.

### `npm ci --prefer-offline --no-audit --no-fund`
- **What it is** — npm's clean-install command optimised for CI.
- **Usage here** — `before_script` of the `.install` fragment in `.gitlab-ci.yml`; same flags in the Dockerfile.
- **Why it's pertinent** — faster than `npm install`, strictly respects the lockfile, and skips irrelevant network calls.

### `$CI_COMMIT_SHA` / `$CI_COMMIT_REF_SLUG`
- **What it is** — GitLab-provided CI variables identifying the commit and branch.
- **Usage here** — the immutable Docker tag is `$CI_COMMIT_SHA`; the moving pointer is `$CI_COMMIT_REF_SLUG` (e.g., `main`).
- **Why it's pertinent** — deployments pin to the immutable tag so a re-pull gets the exact image regardless of branch updates.

### `interruptible: false`
- **What it is** — a GitLab CI job attribute preventing automatic cancellation on new pushes.
- **Usage here** — `docker-build` and `deploy:gke` both set it; protects mid-build Docker pushes and mid-deploy K8s applies.
- **Why it's pertinent** — cancelling a half-deployed pipeline leaves the cluster in a weird state; we'd rather let it finish.

### `allow_failure: true`
- **What it is** — a GitLab CI attribute where a failed job doesn't block the pipeline.
- **Usage here** — `bundle-size-check`, `sonarcloud`, `typedoc`, `trivy:scan`, `grype:scan`, `dockle`, `cosign:sign`, `release-please`.
- **Why it's pertinent** — informational/security jobs must not gate delivery; failures are visible without being blocking.

### GitLab CI stages
- **What it is** — sequential grouping of jobs (`stages:` top-level key).
- **Usage here** — `validate → test → build → quality → docker → deploy`.
- **Why it's pertinent** — a failure early (validate) skips expensive later work; the pipeline DAG is at least partially linear.

---

## Supply-chain security

### Trivy
- **What it is** — Aqua's multi-purpose vulnerability and misconfiguration scanner.
- **Usage here** — `trivy:scan` CI job (`aquasec/trivy:0.69.3`) scans the freshly built image for HIGH/CRITICAL CVEs; exports JSON artifact.
- **Why it's pertinent** — catches vulnerabilities in OS and language packages before the image reaches production.

### Syft
- **What it is** — Anchore's SBOM (Software Bill of Materials) generator.
- **Usage here** — `sbom:syft` CI job (`anchore/syft:v1.18.1`) emits CycloneDX and SPDX SBOMs from the registry image.
- **Why it's pertinent** — regulators/customers increasingly require SBOMs; generating them automatically is cheap insurance.

### CycloneDX format
- **What it is** — an OWASP standard SBOM JSON format.
- **Usage here** — `bom.cdx.json` artifact; GitLab shows it in the MR under `reports.cyclonedx`.
- **Why it's pertinent** — consumed natively by GitLab and by Grype for vulnerability scanning.

### SPDX format
- **What it is** — the Linux Foundation's SBOM standard, widely used for licence compliance.
- **Usage here** — `bom.spdx.json` artifact from `sbom:syft`.
- **Why it's pertinent** — some government/enterprise consumers require SPDX specifically; emitting both costs us nothing extra.

### Grype
- **What it is** — Anchore's CVE scanner that reads SBOMs.
- **Usage here** — `grype:scan` CI job (`anchore/grype:v0.87.0`) consumes `bom.cdx.json` and fails on high-severity CVEs (but `allow_failure: true` to unblock deploys while tracked).
- **Why it's pertinent** — second-opinion scanner; catches CVEs even when Trivy's DB lags.

### Dockle
- **What it is** — a container image best-practices linter (CIS Docker Benchmark).
- **Usage here** — `dockle` CI job (`goodwithtech/dockle:v0.4.15`); flags non-root, secrets, health-check absence.
- **Why it's pertinent** — catches policy drift in image composition that Trivy's CVE-focused scanner misses.

### cosign (Sigstore)
- **What it is** — a container image signing tool from the Sigstore project.
- **Usage here** — `cosign:sign` CI job uses GitLab OIDC → Sigstore Fulcio for keyless signing.
- **Why it's pertinent** — downstream consumers can verify our images originated from our pipeline without us managing key material.

### Sigstore Fulcio
- **What it is** — a free CA that issues short-lived signing certificates tied to OIDC identities.
- **Usage here** — receives `SIGSTORE_ID_TOKEN` from GitLab; issues a cert that cosign uses to sign our image.
- **Why it's pertinent** — the whole point of keyless signing — no private key to store, rotate, or leak.

### Sigstore Rekor (transparency log)
- **What it is** — a public append-only log of Sigstore signing events.
- **Usage here** — cosign publishes signature metadata to Rekor as part of `cosign sign`.
- **Why it's pertinent** — anyone can audit the provenance of our images from our GitLab org back to a Rekor entry.

### `SONAR_TOKEN` / `RELEASE_PLEASE_TOKEN` / `GCP_SA_KEY` / registry creds
- **What it is** — GitLab CI variable secrets.
- **Usage here** — masked variables at the group level; never committed; `gitleaks` guards against accidents.
- **Why it's pertinent** — a leaked token can publish images, upload packages, or deploy clusters — the gitleaks + secret-scan layers exist for this reason.

### OCI labels for provenance
- **What it is** — `org.opencontainers.image.revision` and `org.opencontainers.image.created` labels.
- **Usage here** — set by `docker build --label` in the `docker-build` job.
- **Why it's pertinent** — tools (Trivy, cosign, GitLab registry UI) surface them; lets us trace `docker inspect` back to a commit SHA and build timestamp.

---

## Dependency and release automation

### Renovate
- **What it is** — a dependency-upgrade bot that opens MRs for new versions.
- **Usage here** — `renovate.json` config; `prHourlyLimit: 4`, `prConcurrentLimit: 10`; auto-merge on patch/pin/digest.
- **Why it's pertinent** — handles npm + Docker updates with risk-aware grouping; no manual CVE-sweeping ritual.

### Renovate `packageRules`
- **What it is** — conditional rules that modify upgrade behaviour for matching packages.
- **Usage here** — groups all `@angular/*` together, groups `@auth0/*`, groups `vitest`+`jsdom`; Node major bumps require manual review.
- **Why it's pertinent** — Angular is allergic to cross-package version skew; lockstep upgrades avoid half-migrated states.

### `renovate-lint` CI job
- **What it is** — runs `renovate-config-validator --strict` on config changes.
- **Usage here** — only triggered when `renovate.json` changes (`rules: - changes: [renovate.json]`).
- **Why it's pertinent** — typos in Renovate config silently disable rules; this catches them at MR time.

### `release-please`
- **What it is** — Google's release automation tool that creates "release PRs" and tags.
- **Usage here** — `release-please` CI job on main; config `release-please-config.json`; manifest `.release-please-manifest.json`.
- **Why it's pertinent** — reads Conventional Commits, auto-generates CHANGELOG and semver bumps; no manual tag/changelog rituals.

### `release-please` changelog sections
- **What it is** — config mapping commit types to CHANGELOG section headers.
- **Usage here** — `release-please-config.json` hides `test`, `ci`, `chore`, `style`; exposes `feat`, `fix`, `perf`, `revert`, `docs`, `refactor`, `build`.
- **Why it's pertinent** — keeps the CHANGELOG readable by users, not noisy with CI/test noise.

### `RELEASE_PLEASE_TOKEN`
- **What it is** — a GitLab token with permission to create branches/MRs for release PRs.
- **Usage here** — gated by rule: `$CI_COMMIT_BRANCH == "main" && $RELEASE_PLEASE_TOKEN`.
- **Why it's pertinent** — forks or contributors without the token skip the release job cleanly instead of failing mysteriously.

---

## Observability and local-only helper scripts

### `scripts/docker-api.mjs`
- **What it is** — our Node.js HTTP server that exposes Docker CLI operations + Zipkin/Loki proxies over HTTP.
- **Usage here** — runs on port 3333 (override with `DOCKER_API_PORT`); used by the diagnostic and observability pages during local dev.
- **Why it's pertinent** — lets the SPA inspect/stop/start local containers and query Zipkin/Loki without browser CORS on raw ports.

### Zipkin integration
- **What it is** — a distributed-tracing UI consuming spans from the backend.
- **Usage here** — proxied via `/zipkin/*` through `scripts/docker-api.mjs` to `localhost:9411`.
- **Why it's pertinent** — the UI surfaces traces in its own panel without opening Zipkin's separate host/port.

### Loki integration
- **What it is** — Grafana's log-aggregation backend.
- **Usage here** — proxied via `/loki/*` to `localhost:3100`.
- **Why it's pertinent** — UI queries structured backend logs with LogQL; keeps everything under one origin.

### Custom SVG dashboards
- **What it is** — our in-repo dashboards that visualise backend metrics (implemented with raw SVG).
- **Usage here** — `src/app/features/observability/`, `src/app/features/visualizations/`, `src/app/features/dashboard/`.
- **Why it's pertinent** — embeds ops context into the app without requiring the user to open Grafana. Migration criterion recorded in [ADR-0006](../adr/0006-grafana-duplication.md).

### Grafana (not bundled)
- **What it is** — the upstream dashboard platform.
- **Usage here** — the backend ships Grafana via `docker-compose.observability.yml` (LGTM stack). Our UI duplicates some panels in-app.
- **Why it's pertinent** — [ADR-0006](../adr/0006-grafana-duplication.md) captures the criterion for keeping a view in-app vs migrating it to Grafana.

### `keyboard` / keyboard shortcuts module
- **What it is** — our custom global-shortcuts service.
- **Usage here** — `src/app/core/keyboard/`; documented in `docs/keyboard-shortcuts.md`.
- **Why it's pertinent** — keyboard-first ops workflows (jump-to-feature, command palette) benefit from consistent bindings.

### `toast` service
- **What it is** — our in-app notification / toaster service.
- **Usage here** — `src/app/core/toast/`; used by feature components to surface success/errors.
- **Why it's pertinent** — one consistent notification pattern; no alert() or feature-specific banners.

### `activity` service
- **What it is** — our SSE-consuming activity feed for live backend events.
- **Usage here** — `src/app/core/activity/` plus feature in `src/app/features/activity/`.
- **Why it's pertinent** — live visibility of what the backend is doing — diagnostic, auditing, demo-friendly.

### `metrics` service
- **What it is** — our client that polls backend micrometer/Actuator endpoints.
- **Usage here** — `src/app/core/metrics/`; feeds dashboards under `src/app/features/dashboard/`.
- **Why it's pertinent** — surface in-app what's on Grafana without the Grafana dependency for casual users.

### `audit` feature
- **What it is** — UI for inspecting the backend audit log.
- **Usage here** — `src/app/features/audit/`.
- **Why it's pertinent** — surfaces security-relevant backend events to operators.

### `chaos` feature
- **What it is** — UI to trigger chaos-engineering experiments against the backend.
- **Usage here** — `src/app/features/chaos/`.
- **Why it's pertinent** — safe, authenticated way to inject faults without SSH or running scripts manually.

### `quality` / `security` / `database` / `maven-site` features
- **What they are** — operator features backed by the equivalent Spring Boot endpoints.
- **Usage here** — `src/app/features/quality/`, `security/`, `database/`, `maven-site/`.
- **Why it's pertinent** — folds the Spring Boot `/actuator/*` surface into branded, permission-aware UI panels.

### `request-builder` feature
- **What it is** — an in-app HTTP request builder for exploring the backend API.
- **Usage here** — `src/app/features/request-builder/`.
- **Why it's pertinent** — lightweight Postman-alike so ops folks can poke the API without leaving the UI.

### `diagnostic` feature
- **What it is** — a feature page that gathers environment and backend health in one view.
- **Usage here** — `src/app/features/diagnostic/`.
- **Why it's pertinent** — first page to open when something's wrong; aggregates signals across all features.

### `timeline` feature
- **What it is** — a chronological event timeline of backend activity.
- **Usage here** — `src/app/features/timeline/`.
- **Why it's pertinent** — complements `activity` with a wider historical window.

### `settings` feature
- **What it is** — user preferences page (theme, environment, keyboard shortcuts, etc.).
- **Usage here** — `src/app/features/settings/`.
- **Why it's pertinent** — one home for user-local state that all services already persist to localStorage.

---

## Rejected alternatives

### Zone.js (rejected alternative)
- **What it is** — the monkey-patching library that traditionally drove Angular's change detection.
- **Rejected because** — zoneless change detection + signals is faster, smaller, and easier to debug (stack traces aren't polluted by Zone frames). ADR-0002.

### NgModules (rejected alternative)
- **What it is** — Angular's original module/DI grouping mechanism.
- **Rejected because** — standalone components replace them with less boilerplate and better tree-shaking. ADR-0005.

### NgRx / Redux (rejected alternative)
- **What it is** — a reactive-extensions state-management library modelled on Redux.
- **Rejected because** — signals cover every state need we have at one-tenth the code; the app isn't complex enough to justify action/reducer/effect boilerplate.

### Karma + Jasmine (rejected alternative)
- **What they are** — the legacy Angular test runner (Karma) and BDD framework (Jasmine).
- **Rejected because** — ADR-0004: Vitest is ~10x faster, natively TypeScript/ESM, and aligns with `@angular/build`'s esbuild pipeline.

### Jest (rejected alternative)
- **What it is** — a popular all-in-one JavaScript test framework.
- **Rejected because** — `ts-jest`/Babel adds a second compile path that fights Angular's AOT pipeline; Vitest shares compilation with the builder.

### Webpack (rejected alternative)
- **What it is** — the bundler behind the legacy Angular builder.
- **Rejected because** — `@angular/build` with esbuild compiles the whole app in seconds; Webpack builds were the biggest dev-loop time sink.

### Chart.js (rejected alternative)
- **What it is** — a popular canvas-based charting library.
- **Rejected because** — ADR-0003: 60-80 kB gzipped per use, and canvas blocks our click-to-drill and CSS-theming needs.

### D3 (rejected alternative)
- **What it is** — a data-visualisation library for the web.
- **Rejected because** — ADR-0003: heavy, and its scale/axis DSL fights Angular templates; we only need ~20 lines of scale math each.

### Apache ECharts (rejected alternative)
- **What it is** — a feature-rich charting library from Apache.
- **Rejected because** — ADR-0003: similar weight issues as Chart.js/D3, plus a DSL that conflicts with our template-first approach.

### Plotly (rejected alternative)
- **What it is** — a full-featured chart library often used in data science.
- **Rejected because** — ADR-0003: even heavier than ECharts and overkill for our visualisation types.

### Tailwind CSS (rejected alternative)
- **What it is** — a utility-first CSS framework.
- **Rejected because** — SCSS + CSS custom properties already cover our theming needs without adding a build step and class-name soup in templates.

### Bootstrap / Material UI (rejected alternative)
- **What they are** — component libraries with opinionated design systems.
- **Rejected because** — we want full control over look and feel; the visuals are part of the product.

### Kaniko (rejected alternative)
- **What it is** — a Google-built Dockerfile executor for CI without privileged mode.
- **Rejected because** — Kaniko can't cross-compile architectures and we need amd64 images built for GKE; DinD + buildx is the only path today (see global CLAUDE.md note).

### GitHub Actions (rejected alternative)
- **What it is** — GitHub's CI/CD platform.
- **Rejected because** — our repos live in GitLab; duplicating CI pipelines across platforms is wasted effort.

### Lerna / Nx / monorepo tooling (rejected alternative)
- **What it is** — monorepo management tools for multi-package JavaScript repos.
- **Rejected because** — this repo hosts a single app; adding monorepo tooling would be complexity without benefit.

### `ngModel` everywhere (rejected alternative)
- **What it is** — Angular's two-way binding directive via `FormsModule`.
- **Rejected because** — signal-based `[value]` + `(input)` composes better with our zoneless model; new code avoids `ngModel`.

### Service Worker / Workbox offline (rejected alternative for now)
- **What it is** — a browser worker that caches assets for offline use.
- **Rejected because** — we're an ops-internal tool where "offline" isn't a requirement; the complexity of cache invalidation isn't worth the trade-off yet.

### Server-Side Rendering / `@angular/ssr` (rejected alternative)
- **What it is** — pre-rendering Angular pages on the server for faster first paint and SEO.
- **Rejected because** — we're behind auth and don't need SEO; SSR would add a Node runtime in production we'd have to operate.

---

## Cross-reference

- Backend glossary (Spring Boot, Postgres, Kafka, Redis, Ollama, Keycloak, Prometheus, Grafana, Tempo, Loki, Pyroscope, etc.): [mirador-service/docs/technologies.md](https://gitlab.com/mirador1/mirador-service/-/blob/main/docs/technologies.md)
- Architecture overview: [`docs/reference/architecture.md`](architecture.md)
- CI/CD details: [`docs/ops/ci-cd.md`](../ops/ci-cd.md)
- Environments: [`docs/getting-started/environment.md`](../getting-started/environment.md)
- Theming: [`docs/guides/theming.md`](../guides/theming.md)
- Ports used locally: [`docs/reference/ports.md`](ports.md)
- Architecture Decision Records: [`docs/adr/`](../adr/)
  - [ADR-0002 — Zoneless + Signals](../adr/0002-zoneless-and-signals.md)
  - [ADR-0003 — Raw SVG for charts](../adr/0003-raw-svg-charts.md)
  - [ADR-0004 — Vitest over Jest](../adr/0004-vitest-over-jest.md)
  - [ADR-0005 — Standalone components](../adr/0005-standalone-components.md)
