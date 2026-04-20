// moved 2026-04-20 from repo root per root-hygiene rule (see ~/.claude/CLAUDE.md).
// Wired in via angular.json → projects.mirador-ui.architect.test.options.runnerConfig.
// Without that option, @angular/build:unit-test defaults `runnerConfig: false` and this
// file is NEVER loaded — the pool tuning below only takes effect when the builder is
// explicitly pointed here. Before this move the file sat at root and was de-facto
// dormant for the same reason; the move made the wiring deliberate.
import { defineConfig } from 'vitest/config';

// =============================================================================
// vitest.config.ts — pool tuning for the macbook-local CI runner.
//
// Why this file exists: vitest 4 defaults to `pool: 'forks'` which spawns
// one Node child process per test file. On the saturated macbook-local
// runner (concurrent CI jobs + Docker Desktop VM contention) those forks
// can hit a 60-second timeout before the worker even responds — the job
// dies with "Failed to start forks worker for test files …" and reports
// zero tests run. Pipeline #278 on main died this way after !50's merge
// while 6+ jobs were running simultaneously on the same runner.
//
// `pool: 'threads'` reuses Node worker_threads instead — ~10× lighter
// startup, no per-file process fork. Tradeoff: tests must not rely on
// process-isolated globals (we don't; everything is signal-based + DI).
//
// `maxThreads: 2` caps concurrency so we don't trigger the same
// contention class via thread oversubscription. The macbook-local
// runner is shared by Spring Boot integration tests, Playwright, and
// Maven builds — leaving headroom keeps the whole pipeline stable.
//
// `singleThread: false` allows vitest to fan out within those 2 threads
// (one per spec), which is fine because Angular zoneless components
// don't share state across spec files.
//
// Vitest 4 breaking change: `test.poolOptions` was removed — all pool
// options are now TOP-LEVEL (not under test.). Migration docs:
// https://vitest.dev/guide/migration.html#pool-rework
// Keeping the nested form silently ignores the config → vitest falls
// back to defaults (forks) → CI runner OOMs (pipeline #302 = exit 137).
// =============================================================================
export default defineConfig({
  test: {
    pool: 'threads',
    // testTimeout bumped from default 5s → 15s: the 15 smoke specs
    // instantiate feature components that wire up signals + effects +
    // HTTP init — on a contended CI runner (macbook-local with
    // parallel integration tests) 5s is sometimes not enough.
    // Pipeline #304 on main showed 10/15 smoke specs timing out at
    // exactly 5000ms. Local run on warm laptop: ~2s total, well under.
    testTimeout: 15000,
  },
  // Top-level in Vitest 4:
  poolOptions: {
    threads: {
      maxThreads: 2,
      singleThread: false,
    },
  },
});
