# ADR-0011: sonarcloud — JS bridge flakiness handled via `when: manual`, not `allow_failure: true`

- **Status**: Accepted
- **Date**: 2026-04-25
- **Deciders**: Mirador maintainers
- **Related**: `~/.claude/CLAUDE.md` -> "Surgical fixes, not allow_failure
  bypasses" + "Pipelines stay green"; the
  [SonarSource JS plugin issue tracker](https://community.sonarsource.com/c/bug-reports/javascript-typescript/) ;
  predecessor commit `5293974` (image tree-sitter fix) and
  `46acc46` (multi-arch build).

## Context

The `sonarcloud` CI job analyses the Mirador UI codebase against
SonarCloud. It runs the SonarSource JavaScript / TypeScript plugin
(`v12.3.0.39932` as of the 2026-04-25 trace) which spawns a Node
subprocess called the "JS bridge" and communicates with it over a
WebSocket. The bridge runs all JS / TS rule evaluations, then reports
results back to the Java scanner.

After the wave 1-10 chase to fix the tree-sitter directory permissions
(see [build/sonar-scanner.Dockerfile](file:///Users/benoitbesson/dev/js/mirador-ui/build/sonar-scanner.Dockerfile)),
the original symptom

    java.lang.RuntimeException: Failed to create directory:
      /home/scanner-cli/.tree-sitter/lib

is GONE. The custom image with chowned `/home/scanner-cli` works
correctly: the bridge subprocess starts, downloads tree-sitter,
runs JS analysis for ~9 minutes, then crashes:

    java.lang.IllegalStateException: WebSocket connection closed
      abnormally:

with no further detail. Pipeline
[#2479217597](https://gitlab.com/mirador1/mirador-ui/-/pipelines/2479217597)
sonarcloud job 14088151211 trace shows the bridge ran from 11:11:57
to 11:20:35 (~9 min into JS analysis) before the WebSocket dropped.
Total job runtime: 14 min 24 s.

This is a separate, deeper issue from the tree-sitter perms one. The
bridge is dying silently — possibly OOM-killed by the kernel, possibly
a known bug in the JS plugin v12.3.0 with codebases that mix multiple
quality profiles (CSS + TS + Web), possibly resource pressure on the
shared `macbook-local` runner when sonarcloud runs in parallel with
e2e:kind, build:production, and other macbook-local-tagged jobs.

## Decision

**Tag-gate the sonarcloud job behind `when: manual`** rather than
shielding it with `allow_failure: true`.

Specifically:

```yaml
sonarcloud:
  rules:
    - if: '$SONAR_TOKEN == null || $SONAR_TOKEN == ""'
      when: never
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
      when: manual
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
```

(NOT `allow_failure: true`, which is the explicitly-disallowed pattern
per `~/.claude/CLAUDE.md` -> "Surgical fixes, not allow_failure
bypasses".)

The job remains visible in every MR + main pipeline. Reviewers see it.
A reviewer who wants the SonarCloud feedback for a specific MR can
trigger it manually. But the pipeline does NOT depend on it for
automatic green status — the failure is real, not hidden.

This is option **(c) "scope-out, not shield"** from the global
`CLAUDE.md` — the difference matters: shielding pretends the job ran
successfully (silent debt that compounds); scoping out makes the
absence explicit so the next reviewer knows there's pending
investigation work.

## Consequences

### Positive

- Pipelines stay structurally green without false-positive shielding.
- The JS bridge crash is **explicit pending work** the next session
  picks up, not silent debt.
- The custom image (the actually-working part of waves 1-11) is in
  place + reusable: any future re-attempt at sonarcloud doesn't have
  to re-litigate the tree-sitter saga.
- Manual trigger preserves the workflow for reviewers who want
  SonarCloud feedback on a specific MR.

### Negative

- **No automatic SonarCloud quality gate.** PRs can merge without a
  fresh Sonar scan. Mitigation: the project has rich local lint
  (ESLint flat config, complexity limits via Phase C, circular-dep
  detection) + the joint Clean Code audit at `docs/audit/`. SonarCloud
  was always a secondary signal, not the primary quality gate.
- **Manual trigger is friction.** A reviewer wanting a sonar scan
  must click through GitLab's UI or run `glab ci trigger <job-id>`.
  Acceptable cost while the bridge crash is being investigated.

### Exit criterion (when to remove `when: manual`)

Flip the rule back to automatic (`if ... merge_request_event` /
`if ... main` without `when: manual`) ONCE the JS bridge crash root
cause is fixed AND there are 5+ consecutive green sonarcloud runs on
manual triggers. Candidates for the underlying fix:

1. **Resource isolation** — add `resource_group: heavy-build` so
   sonarcloud serialises with build:production / docker-build / e2e:kind.
   Cost: pipeline takes longer; may not help if the OOM is from the
   bridge alone, not from concurrent jobs.
2. **JS plugin downgrade** — pin to `v12.2.x` if v12.3.0 has the bug.
   Requires SonarCloud server to allow plugin override (it might not).
3. **Reduce analysis surface** — exclude more files from the JS
   analysis (e.g. `**/*.spec.ts`, generated types) to lower memory
   footprint. Already excluded; further reductions would compromise
   coverage.
4. **Bridge timeout / heap further tuning** — bridge crashes are not
   timeouts (we set `timeout=600`), but heap might be the issue.
   Currently `maxspace=8192`, `workerCount=2`. Could try
   `workerCount=1` to halve concurrent subprocess memory.
5. **Use SonarCloud's built-in CI integration** — instead of running
   the scanner ourselves, use SonarCloud's GitHub/GitLab integration
   that runs the scanner on their infrastructure. Trade-off: gives up
   control over the runner, but offloads the bridge OOM problem.

The next session inheriting this should start with option (1) or (4)
because they're zero-cost CI changes; (2) and (5) require SonarCloud
account-level changes.

## Alternatives considered

- **`allow_failure: true`** — explicitly forbidden per
  `~/.claude/CLAUDE.md`. Hides the failure in a green-looking pipeline,
  carries debt forever, and the bug never gets fixed. Anti-pattern.
- **Disable the job entirely (`rules: when: never`)** — would lose the
  manual-trigger affordance. The job stays "available but opt-in" with
  `when: manual`, which is preferable.
- **Delete the job + the custom image** — premature; the image is
  well-built infrastructure that just needs the JS bridge crash
  resolved to become useful again. Throwing it away would force
  re-litigation of the tree-sitter saga next time someone tries.

## References

- The custom image Dockerfile + waves 1-11 history:
  [`build/sonar-scanner.Dockerfile`](file:///Users/benoitbesson/dev/js/mirador-ui/build/sonar-scanner.Dockerfile)
- Pipeline showing the post-image-fix WebSocket close:
  [#2479217597](https://gitlab.com/mirador1/mirador-ui/-/pipelines/2479217597)
- CLAUDE.md rule on surgical fixes:
  `~/.claude/CLAUDE.md` -> "Surgical fixes, not allow_failure bypasses"
