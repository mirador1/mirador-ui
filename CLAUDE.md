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

## Mobile-responsive by default (hard constraint)

Every UI change MUST work on mobile viewports (≤ 768 px). This is
non-negotiable — a component that only works on desktop is broken
on ~50 % of real traffic. See `~/.claude/CLAUDE.md` → "UI must
work on mobile" for the full rule + verification steps. Project-specific
specifics:

- **Breakpoints live in `src/styles.scss`** — use the CSS custom
  properties (`--bp-mobile`, `--bp-tablet`, `--bp-desktop`) rather
  than hardcoding `768px` / `1024px` in each component's `.scss`.
  If they're not defined yet, add them in `styles.scss` in the same
  commit as the first consumer.
- **`AppShellComponent` sidebar** is the canonical mobile-collapse
  pattern: > 768 px = sidebar visible, ≤ 768 px = hamburger opens
  a drawer. Every new multi-pane layout (dashboard, observability,
  quality) follows the same pattern.
- **SVG charts** must use `viewBox="0 0 W H" preserveAspectRatio="xMidYMid meet"`
  + `width="100%"` — never fixed pixel widths. The chart inherits
  its container's width and scales cleanly.
- **Angular Material / CDK** — we don't use either (raw SVG + CSS
  Grid / Flex). That's an active constraint, NOT a mobile excuse
  — we're responsible for responsive behaviour ourselves.
- **Signal-based viewport queries** for conditional rendering:

  ```ts
  readonly isMobile = signal(window.matchMedia('(max-width: 768px)').matches);
  @HostListener('window:resize') onResize() {
    this.isMobile.set(window.matchMedia('(max-width: 768px)').matches);
  }
  ```

  Use `@if (isMobile()) { … } @else { … }` in the template — no
  `ngIf` / `BreakpointObserver` dependency added.
- **E2E coverage** — Playwright projects include a `mobile` variant
  (390 × 844) for the home + dashboard routes. When adding a new
  load-bearing route, add a mobile spec alongside the desktop one.
- **Code review checklist** below has a dedicated mobile item —
  don't approve a PR that wasn't checked at 375 px wide.

## File length hygiene (segmenter les fichiers trop longs)

When a hand-written source file crosses **~1 000 lines**, plan a split at
the next touch; at **1 500+**, split NOW before shipping any other change.
Current offenders to address over upcoming sessions:

- `src/app/features/obs/quality/quality.component.html` (1 742) — 10+
  panels (coverage, SpotBugs, Pitest, OWASP, PMD, Checkstyle, Sonar,
  test results…) → 1 child `QualityPanelXxx` component per panel.
- `src/app/features/core-ux/dashboard/dashboard.component.ts` (1 022)
  + `.scss` (1 258) — 1 widget per file (ArchitectureMap, HealthProbes,
  ErrorTimeline, BundleTreemap…).
- `src/app/features/customer/customers/customers.component.ts` (904)
  — split by tab (list, CRUD, import/export, bio, todos, enrich).
- `.gitlab-ci.yml` (1 067) — modularise into `ci/includes/*.yml`
  (validate, test, build, e2e, quality, security, docker).

Exceptions (length is inherent — don't split): `README.md`,
`docs/reference/*.md`, auto-generated files
(`src/app/core/api/generated.types.ts`, docs/compodoc/*). Large component
`.scss` files (>800 lines) stay single-file by design when the visual
layout is inherently one cohesive page — refactor only when asked.

How to split — one commit per responsibility move, keep the public
entrypoint small (<200 lines), grep-friendly child names
(`QualityPanelCoverageComponent` not `CoveragePanel`), ADR if the
dependency graph changes.

**1 widget / 1 panel = 1 file** (confirmed pattern 2026-04-22). When
a component is a *container of independent things* — a dashboard
holding 8 widgets, a quality page holding 10 panels, a settings
screen holding 12 tabs — the split rule is **one concern per file**:

- Parent keeps ~150 LOC of composition glue (imports + template
  assembling the children + routing).
- Each widget / panel lands in `./<parent>/widgets/<name>.component.ts`
  as a standalone component — its own template, its own signals,
  its own SCSS. Fully extractable / testable in isolation.
- Name rule: preserve the parent's concern in the child's name
  (`DashboardArchitectureMap` not `ArchitectureMap`).
- Grep path: `grep -rn "DashboardArchitectureMap"` lands directly on
  the one file that owns that widget — no hunting through a 1200-line
  parent.

Applies to: dashboard (~8 widgets), quality (~10 panels), customers
(~6 tabs), settings, security, observability. A file > 400 LOC in
any of these is a smell — look for a hidden "add this widget too"
coupling worth extracting.

See `~/.claude/CLAUDE.md` → "File length hygiene" item #6 for the
cross-language version (Java parsers, shell sections).

Subdirectory side of the same rule: when a flat folder crosses **10
entries**, group by purpose (features/core-ux/, features/customer/,
features/obs/, features/infra-ops/ already in place — keep applying
as new features land); **15** is the hard ceiling. See
`~/.claude/CLAUDE.md` → "Subdirectory hygiene".

## Clean Code + Clean Architecture — binding constraints

Hard constraints, not aspirations — same 7 non-negotiables as
`~/.claude/CLAUDE.md` → "Clean Code + Clean Architecture":

1. Function size ≤ 20-30 LOC body, ≤ 5 params, complexity ≤ 10
   (ESLint enforces — `max-lines`, `max-lines-per-function`,
   `complexity`, `max-params`. Phase C flips warn → error).
2. Single Responsibility per component / service / signal.
3. Naming tells intent — rename the moment a mismatch is noticed.
4. Comments explain WHY, not WHAT.
5. Dependency rule — core services (`AuthService`, `ApiService`,
   `EnvService`, …) provide contracts; features import services,
   never the reverse. No circular component deps.
6. Test-as-spec — coverage drop on a touched file = ship a
   Vitest spec in the same commit.
7. No dead code — unused imports (`NG8113`), `*ngIf`/`*ngFor`
   leftovers, `any` types, empty `error: () => {}` handlers all
   count as warnings to clear before tagging a green checkpoint.

**Current-state baseline**: joint audit at
[`../workspace-modern/mirador-service/docs/audit/clean-code-architecture-2026-04-22.md`](file:///Users/benoitbesson/dev/workspace-modern/mirador-service/docs/audit/clean-code-architecture-2026-04-22.md)
(80 % Clean Code / 70 % Clean Arch). Covers both repos; UI-side
findings are in §"Observations" (Signals over NgRx, OpenAPI →
types). Re-audit every 3-6 months; the Phase B-5/B-6 file splits
will reshape UI metrics — re-audit post-Phase-B to update.

## Code review checklist (run proactively after significant changes)

- [ ] Zero `NG8113` warnings in production build
- [ ] No `any` types introduced
- [ ] All imports in `imports: []` arrays actually used in templates
- [ ] No `*ngIf`/`*ngFor` directives (use `@if`/`@for`)
- [ ] Error handlers are not silently empty
- [ ] New services are added to the correct `imports` or `providers` array
- [ ] **Clean Code 7 non-negotiables**: function size, SRP, naming,
      why-not-what comments, dependency rule, test-as-spec, no dead
      code. See the section above; the joint svc audit is the
      current baseline.
- [ ] **Root hygiene**: no new file added to repo root that belongs under
      `config/`, `build/`, `docs/`, or `deploy/`. See
      ~/.claude/CLAUDE.md → "Root file hygiene" for the authoritative list.
- [ ] **File length hygiene**: no hand-written file > 1 000 lines
      without a split plan. Auto-generated files
      (`generated.types.ts`, compodoc) exempt. See
      ~/.claude/CLAUDE.md → "File length hygiene".
- [ ] **Pipelines green**: `glab ci list` on `main` shows `success`
      for the last run. Any failed job (even `allow_failure: true`)
      counts as a task. Warnings (bundle budget, deprecations,
      `allow_failure` shields) are fix-now unless carried by a dated
      follow-up. See ~/.claude/CLAUDE.md → "Pipelines stay green".
- [ ] **Mobile-responsive**: every visual change was checked at
      375 px (iPhone SE), 390 px (iPhone 12-14), AND 1280 px
      desktop. No horizontal scrollbar at mobile widths; tap
      targets ≥ 44 px; hover-only interactions paired with a
      tap affordance. See the "Mobile-responsive by default"
      section above + global rule in ~/.claude/CLAUDE.md.

## Docker Cleanup — TIGHTENED CADENCE (2026-04-21)

Run the prune trio at **each** of these moments, not just "start of session":

1. **Session start** — baseline.
2. **After any CI pipeline failure carrying a runner-pressure signal**
   (vitest worker exit 137 / "Worker exited unexpectedly", npm ECONNRESET,
   Playwright `Target closed` under load, `OOMKilled` in logs). Rerun
   WITHOUT cleanup → dies the same way.
3. **Every 30 min of active local CI work** — catches leaks silently.
4. **Before calling a session done** — clean slate.

### Leak classes specific to this repo

- **Orphaned Playwright Chromium processes** from cancelled E2E runs —
  `ps auxm | grep -i chrom | head -5` shows suspects. Kill any older
  than the current run.
- **Stale `ng serve` / `vite` dev servers** on ports 4200 / 5173 from
  earlier sessions — `lsof -i :4200` / `lsof -i :5173`, then
  `kill <pid>` if not currently in use.
- **Dev Docker containers** — see svc CLAUDE.md for the list
  (`postgres-demo` etc. started by the sibling repo's `./run.sh all`
  leak into this repo's context too since they share the Docker VM).

### Prune trio + escalation

```bash
docker system df                                     # check first
docker container prune -f                            # stopped containers
docker builder prune -f                              # build cache
docker image prune -f                                # dangling images
# If > 80 GB total OR images > 100 count:
docker image prune -a -f                             # ALL unused images (~20-30 GB typical)
```

**Never** prune named volumes (`docker volume prune`) without user
confirmation — they hold postgres / sonar / flyway state.

See `~/.claude/CLAUDE.md` → "Clean Docker regularly — don't wait for
OOM" for the canonical rule (svc-side CI stressors + kind cluster leaks
cross-pollute this repo's CI because macbook-local is shared).
