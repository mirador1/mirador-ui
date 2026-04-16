# Theming & Multi-Environment

Two user-facing toggles in the topbar — both persisted in `localStorage`, both backed by Angular signals.

## Dark Mode

Click the moon/sun icon in the topbar, or press `D`. Persisted in localStorage. Uses CSS custom properties (`--bg-primary`, `--text-primary`, etc.) defined in `src/styles.scss`, switched via the `data-theme` attribute on `<html>`.

The switch is driven by `ThemeService` (`src/app/core/theme/theme.service.ts`): a signal for the active theme, an `effect()` that mirrors it onto the root element, and a localStorage write on change.

## Multi-Environment

Click the environment badge in the topbar to switch between **Local**, **Docker**, **Staging**, **Production**. All API calls immediately use the new base URL via the `EnvService.baseUrl()` computed signal. Persisted in localStorage.

Because every `ApiService` call reads the signal at request time, the switch takes effect on the very next HTTP call — there is no page reload required.

## See also

- [Environment configuration](environment.md) — `.env` variables that seed the default environment URLs.
- [ADR 0002 — Zoneless change detection + Signals](adr/0002-zoneless-and-signals.md) — why these toggles use signals rather than `ngModel`.
