# ADR-0010: UI must work on mobile — responsive-first as a hard rule

- **Status**: Accepted
- **Date**: 2026-04-22
- **Deciders**: Mirador maintainers (user-added rule)
- **Related**: [ADR-0003](0003-raw-svg-charts.md) (raw SVG = trivially
  responsive), [ADR-0005](0005-standalone-components.md) (each
  component owns its responsiveness), `~/.claude/CLAUDE.md` →
  "UI must work on mobile (responsive-first)",
  `CLAUDE.md` → "Mobile-responsive by default (hard constraint)"

## Context

Mirador UI is an Angular 21 dashboard targeting both desktop observability
consoles and handheld checks by an on-call engineer. Roughly half of
"just give me a status" traffic on a real deployed Mirador would come
from someone pulling out their phone — an alert fired, they need to
see if the cluster is degraded, they don't want to open their laptop.

Historically this was implicit: components got built for desktop
because the maintainer works on a 16" laptop, and mobile was "tested"
by resizing the browser window once in a while. This produced:

- `dashboard.component.scss` (1258 LOC) with **zero** `@media` queries.
- `security.component.scss` (828 LOC) with a `grid-template-columns:
  240px 200px 200px 40px 1fr` = 680 px fixed-min → overflows at
  iPhone SE width (375 px).
- Hover-only affordances (tooltips, sort indicators) invisible on
  touch.
- Sidebar that never collapses on mobile — content squeezed to 45 %
  of the viewport.

Treating mobile as a "polish later" concern systematically ships
broken-on-phone UX. The project has been bitten by this pattern enough
times that the user escalated it from guidance to hard rule
2026-04-22.

## Decision

Every UI change — new component, refactored layout, added dashboard
panel, single-line CSS tweak — **MUST** work on mobile viewports
(≤ 768 px wide). Non-negotiable. The rule is enforced at four levels:

1. **Global CLAUDE instruction** (`~/.claude/CLAUDE.md` → "UI must
   work on mobile") — every Claude session reads this first. Applies
   to every UI repo in the workspace.
2. **Project CLAUDE instruction** (`CLAUDE.md` → "Mobile-responsive by
   default") — project-specific implementation notes (breakpoints,
   AppShell pattern, signal-based viewport queries, Playwright mobile
   project).
3. **Code-review checklist** (same file) — explicit line: "verified
   at 375 px (iPhone SE), 390 px (iPhone 12-14), AND 1280 px desktop".
   Missing this check = MR rejected.
4. **Playwright `mobile-chromium` project** — runs a subset of specs
   at iPhone 12 Pro viewport (390 × 844). A CI-level gate: layout that
   overflows mobile fails the pipeline before the MR merges.

### Canonical breakpoints

Defined in `src/styles.scss` as CSS custom properties (for JS /
`matchMedia` consumers) + documented literals (for `@media` conditions,
which cannot take CSS custom properties per spec):

- **`--bp-mobile: 768px`** — sidebar collapses below this width.
- **`--bp-tablet: 1024px`** — single-column layouts below this width.
- **`--bp-desktop: 1280px`** — spacious multi-column above.

### Concrete requirements

- **No horizontal scrollbar at 375 px.** Long tables get
  `overflow-x: auto` + `min-width` OR switch to a card list at
  mobile width.
- **Tap targets ≥ 44 × 44 px** (WCAG 2.5.5). Buttons, checkboxes,
  links have enough padding for a finger.
- **Readable text**: body ≥ 14 px, titles ≥ 18 px, line-height ≥ 1.4.
- **Sidebar collapses at ≤ 768 px** — AppShellComponent is the
  canonical pattern; new multi-pane layouts follow it.
- **No hover-only affordances**. Every `:hover` tooltip / dropdown
  pairs with a visible label or tap trigger.
- **SVG charts use `viewBox` + `preserveAspectRatio` + `width: 100%`**
  — never a fixed pixel width. Already the pattern per ADR-0003; this
  rule makes it explicit that width must scale.

## Consequences

### Positive

- Half the UX that used to be broken on mobile now actually works.
  Lower customer-support load, faster "status check" from a phone.
- Clear, testable bar — "no horizontal overflow at 375 px" is a
  binary pass/fail, not a subjective "feels ok".
- Playwright `mobile-chromium` project makes the rule enforceable
  in CI — no more "I'll test on my phone later".
- Forces responsive-first design upfront — cheaper than retrofitting
  (the classic "500 LOC SCSS with no @media queries" cleanup).

### Negative

- Every new component costs ~20-30% more time upfront because the
  author has to think about mobile from the start. Mitigated by: the
  AppShell pattern is reusable, SVG charts are mobile-friendly by
  default per ADR-0003, and signal-based `isMobile()` is a 4-line
  copy-paste.
- Existing components need a retrofit pass (dashboard, security,
  quality). Tracked as a dedicated "mobile audit" task, not blocking
  other work — but a new feature MUST ship responsive, even if
  adjacent legacy components aren't yet.
- Playwright `mobile-chromium` project doubles e2e runtime for covered
  specs. Scoped to home + dashboard + any `mobile.spec.ts` — full
  mobile e2e coverage would triple runtime, so we accept partial.

### Neutral

- No CSS framework adoption (Bootstrap, Tailwind, Angular Material).
  The project stays on raw CSS Grid / Flex + SCSS custom properties
  (ADR-0005 feature-slicing, ADR-0003 raw SVG). Responsiveness is a
  design discipline, not a framework purchase.

## References

- WCAG 2.5.5 — Target Size (AAA): https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- MDN — Using media queries: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Using_media_queries
- Playwright — Mobile emulation: https://playwright.dev/docs/emulation
- Angular CDK BreakpointObserver: considered, rejected — we use
  signal-based `matchMedia` in components (simpler, no extra dep,
  cheaper on bundle size).
