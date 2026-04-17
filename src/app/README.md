# `src/app/` — Root Angular app

## Top-level files

| File               | Role                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.ts`           | Root component. Renders the `AppShell` layout which hosts the router outlet.                                                                |
| `app.html`         | Root template (`<app-shell />`).                                                                                                            |
| `app.scss`         | Root component styles.                                                                                                                      |
| `app.spec.ts`      | Root component smoke test.                                                                                                                  |
| `app.config.ts`    | `ApplicationConfig`: zoneless change detection, router, HTTP with JWT interceptor, Auth0, providers.                                        |
| `app.routes.ts`    | Lazy-loaded feature routes (~18 pages). Each uses `loadComponent` so only the active feature's JS is fetched.                               |

## Subdirectories

| Directory           | Purpose                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| [`core/`](core/)      | Singleton services provided in root — `ApiService`, `AuthService`, `EnvService`, `ThemeService`, `ToastService`, `KeyboardService`, `ActivityService`. |
| [`features/`](features/) | Routed pages. One directory per feature, lazy-loaded. See `features/README.md` for the full list.         |
| [`shared/`](shared/)    | Reusable UI components — `layout/app-shell` (topbar, nav, theme switcher), `info-tip`, etc. No routed pages. |

## Module boundaries

- **`core/` is a sink.** Everything depends on it; it depends on nothing else
  in the app. Services here are singletons (`providedIn: 'root'`).
- **`features/` are leaves.** They may import from `core/` and `shared/`, but
  NOT from each other. Cross-feature collaboration goes through `core`.
- **`shared/` has no business logic.** Pure presentational components
  (tooltips, layout shell). No HTTP, no state persistence.

## Not here

- Auto-generated docs — `../../docs/compodoc/` (npm run compodoc).
- Unit tests — each component ships its own `*.spec.ts` alongside its `.ts`.
