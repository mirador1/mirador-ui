# Mirador UI — Claude Instructions

## Persistent task backlog

**`TASKS.md`** (at the repo root) is the source of truth for pending work across sessions.
- **Read it at the start of every session** — before doing anything else.
- **Update it immediately** when a task is added, started, or completed.
- This file survives context window resets; the conversation history does not.
- **When all tasks are done**: delete `TASKS.md` and commit the deletion. Do not keep an empty file.
- **When new tasks arrive**: recreate `TASKS.md` from scratch and commit. The file either exists with real pending work, or it does not exist at all.
- **When adding a general rule** (workflow, style, architecture): also add it to `~/.claude/CLAUDE.md` so it applies globally across all projects.

## Claude workflow rules (apply to every session)

- **Start every response with the current time** in `HH:MM` format, no timezone suffix. Run `date "+%H:%M"` if uncertain.
- **Do not stop** between tasks — chain all pending work without asking "shall I continue?".
- **Never go silent**: when no background work is in flight, say `⏸  Idle. No background work.` then re-list pending tasks and restart them. Same when polling — explicit "waiting for X, next check at Y", never silent. **Waiting on a pipeline counts as idle**: schedule a wakeup at most every 10 min so a green pipeline doesn't sit unmerged. See `~/.claude/CLAUDE.md` → "Never go silent" for the full rule.
- **Regularly display the pending task list** — after completing a task, show what remains so the user can track progress without opening TASKS.md.
- **Act directly** — read only what is strictly necessary, then make the change.
- **One commit per logical change** — do not batch unrelated fixes.
- **Run the build after every change** (`npm run build -- --configuration production`) and fix errors before committing. Build must have zero warnings.
- **Comments explain why**, not what. Write comments that a future Claude session with no conversation history can understand.
- After significant feature work, **do a code review pass**: unused imports (`NG8113`), `any` types, silent error handlers, missing types on HTTP calls.
- **Never modify files outside this project** unless explicitly asked.
- **Reference pipelines/MRs/files as clickable URLs.** When a status update or commit message mentions an MR, pipeline, tag, ADR or audit report, emit it as a markdown link (`[!62](https://gitlab.com/mirador1/mirador-ui/-/merge_requests/62)`, `[#308](https://gitlab.com/mirador1/mirador-ui/-/pipelines/<id>)`, `[stable-v1.0.5](https://gitlab.com/mirador1/mirador-ui/-/tags/stable-v1.0.5)`, `[ADR](file:///<repo>/docs/adr/…md)`) so the user can open it in one click. Bare IDs are fine in subsequent prose once the clickable form has appeared earlier in the same turn. See `~/.claude/CLAUDE.md` → "Reference pipelines, MRs and config files as clickable URLs" for the full pattern list.

## Project overview

Angular 21 frontend for the `mirador-service` Spring Boot backend.
Provides observability dashboard, customer management, diagnostics, chaos testing, and visualisations.

- **Entry point:** `src/main/ts` / `src/app/app.ts`
- **Config:** `angular.json` (root), `config/proxy.conf.json`, `config/typedoc.json`, `config/.compodocrc.json`, `.env` (optional)
- **Backend** must be cloned as a sibling: `../workspace-modern/mirador-service/`

## Angular rules — critical

This project uses **Angular 21 with zoneless change detection** (no Zone.js).

- **DO NOT** use `fakeAsync`, `tick()`, `detectChanges()`, or `TestBed` in tests.
- **DO NOT** use `*ngIf`, `*ngFor`, `*ngSwitch` — use `@if`, `@for`, `@switch` control flow blocks.
- **DO NOT** use `ngModel` for reactive state — use `signal()` and computed signals.
- All charts and visualisations use raw SVG (no charting library). Keep it that way.
- When editing templates with `${}` interpolation, avoid `replace_all` — use targeted edits to prevent corrupting string interpolation.

## Build and quality

```bash
npm run build -- --configuration production   # production build (must have 0 warnings)
npm test                                       # unit tests
```

Budget limits in `angular.json`:
- Initial JS: **800 kB** warning / 1 MB error
  _(raised from 560 kB in ADR-0009 Phase B — the OpenTelemetry Web SDK
  + `protobufjs/minimal` add ~80 kB raw, ~25 kB gzipped. Lower back to
  560 kB if OTel is ever swapped for a lighter exporter.)_
- Component SCSS: **24 kB** warning / 32 kB error
  _(dashboard.component.scss and observability.component.scss legitimately exceed 12 kB — budget was raised intentionally)_
- `allowedCommonJsDependencies`: `protobufjs/minimal` (transitive via
  `@opentelemetry/otlp-transformer`, not ESM yet).

## Git workflow

- Branch: `dev`. One commit per logical change.
- Push: `git push origin dev`.
- Pre-push hook runs prettier and pre-push checks — do not skip.
- When merging MR: `glab mr merge <id> --auto-merge --squash=false --remove-source-branch=false`.
  **Always pass `--remove-source-branch=false`** — GitLab deletes source branch by default, which would destroy `dev`.
- Never push to `main` directly.
- **Tag stable-vX.Y.Z ONLY after the post-merge `main` pipeline goes green.** Don't tag right after the merge while main is still running with a "I'll move the tag if it goes red" recovery plan — that pattern silently produces tags on red commits when the recovery is forgotten or interrupted. The MR pipeline succeeding is NOT enough; the post-merge main pipeline runs the full main-branch ruleset (deploys, scheduled-only jobs) which can fail even when the MR pipeline passed. See `~/.claude/CLAUDE.md` → "Tag every green stability checkpoint, never tag on red" for the operational pattern (Monitor on the post-merge main pipeline).
- **Surface pending decisions on your own initiative** — when a session accumulates real forks-in-the-road (choice changes WHAT gets built, not just WHEN), list them at the next natural checkpoint. Don't wait for the user to ask. Dense one-liner per decision with concrete trade-off. See `~/.claude/CLAUDE.md` → "Surface pending decisions proactively — don't wait to be asked".
- **Vulgariser le jargon avec une parenthèse** — every technical term (ReDoS, takeUntilDestroyed, flat config, SARIF, zoneless change detection, etc) gets a plain-language gloss in parens on first mention per turn. Format: `<term> (<what it means here>)`. Keep the term, ADD the gloss. See `~/.claude/CLAUDE.md` → "Write in plain language — jargon gets a parenthetical".

## Key architecture patterns

```
AppShellComponent (layout: topbar + sidebar + router-outlet)
  └── Feature components (lazy-loaded via app.routes.ts)
        └── Core services (singleton, provided in root):
              ApiService      — all HTTP calls to backend
              AuthService     — JWT token (signal-based)
              EnvService      — multi-environment URL switching
              ThemeService    — dark/light mode
              ToastService    — ephemeral notifications
              MetricsService  — Prometheus polling + percentile computation
              ActivityService — in-session event timeline
```

## Type safety rules

- **No `any` types** in component code. Use specific interfaces or `unknown` with type guards.
- `getHealth()` returns `Observable<unknown>` — cast to `{ status?: string }` at the call site, not `any`.
- When calling `http.post<T>()` or `http.get<T>()`, always provide the generic type parameter.
- Use `Customer`, `Page<T>`, `CustomerSummary`, etc. from `api.service.ts` — do not redeclare them locally.

## Import hygiene

- After every edit to a component, verify that all imports in the `imports: []` array are actually used in the template.
- Unused Angular imports trigger `NG8113` build warnings — fix them immediately.
- Merge multiple imports from the same package into one `import` statement.

## Error handling

- HTTP error handlers must never be empty `error: () => {}` unless the failure is expected and a comment explains why.
- `catch { /* ignore */ }` blocks must at minimum log to `ActivityService` or `ToastService` so the user knows something failed.
- Silent failures make the dashboard look correct when it isn't.

## Component SCSS

- Global tokens (colours, spacing, shadows) are defined in `src/styles.scss` as CSS custom properties — use them instead of hardcoding values.
- Dashboard and observability components have large SCSS files by design (complex layout, many states). Do not refactor unless explicitly asked.

## Code review checklist (run proactively after significant changes)

- [ ] Zero `NG8113` warnings in production build
- [ ] No `any` types introduced
- [ ] All imports in `imports: []` arrays actually used in templates
- [ ] No `*ngIf`/`*ngFor` directives (use `@if`/`@for`)
- [ ] Error handlers are not silently empty
- [ ] New services are added to the correct `imports` or `providers` array
- [ ] **Root hygiene**: no new file added to repo root that belongs under
      `config/`, `build/`, `docs/`, or `deploy/`. See
      ~/.claude/CLAUDE.md → "Root file hygiene" for the authoritative list.
- [ ] **Pipelines green**: `glab ci list` on `main` shows `success`
      for the last run. Any failed job (even `allow_failure: true`)
      counts as a task. Warnings (bundle budget, deprecations,
      `allow_failure` shields) are fix-now unless carried by a dated
      follow-up. See ~/.claude/CLAUDE.md → "Pipelines stay green".

## Docker Cleanup

At the start of each session (or after heavy build/test work), run:
```
docker container prune -f
docker volume prune -f
docker builder prune -f
```
Check disk usage first with `docker system df`. Never prune running containers or named volumes without confirming with the user.
