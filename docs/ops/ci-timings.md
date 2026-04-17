# CI / CD timings — mirador-ui

Measured job durations from the 5 most recent successful MR pipelines
(2026-04-16). All values are **wall-clock seconds per job**, median
across the sample. Refresh by re-running the analysis snippet at the
bottom of this file.

> Times are runner time on the **macbook-local** runner (Apple M-series,
> arm64). Main-branch pipelines have been failing at `secret-scan` or
> later stages in the sample window, so only the MR-event sample is
> load-bearing here; main-branch docker/deploy timings will backfill
> once those pipelines are green.

## Pipeline wall-clock (MR event, 5 pipelines)

| Sample | Duration |
| --- | --- |
| 1 | 9.1 min |
| 2 | 14.1 min |
| 3 | 13.2 min |
| 4 | 11.2 min |
| 5 | 15.9 min |
| **Median** | **13.2 min** |

End-to-end CI feedback on a typical MR is ~13 min. The critical path is
the `build` stage (Angular production build + typedoc generation) followed
by the quality/security suite.

## Per-job median duration

| Job                   | Stage    | Median  | Notes |
| --------------------- | -------- | ------- | ----- |
| `build:production`    | build    | **~49 s** | `ng build --configuration production` with esbuild. |
| `typedoc`             | build    | ~48 s   | Generates the full TypeScript API reference (HTML + index). |
| `lint:format`         | quality  | ~42 s   | Prettier `--check` across the tree. |
| `unit-tests`          | test     | ~40 s   | Vitest 29 entries, jsdom environment. |
| `typecheck`           | quality  | ~39 s   | `tsc --noEmit` full workspace. |
| `security:audit`      | quality  | ~36 s   | `npm audit --json` on the production dep tree. |
| `lint:circular-deps`  | quality  | ~25 s   | `madge --circular` over `src/`. |
| `bundle-size-check`   | quality  | ~25 s   | Verifies the initial bundle stays under the 1 MB budget. |
| `hadolint`            | validate | ~21 s   | Dockerfile linter (runs on every push). |
| `typecheck`           | validate | ~37 s   | Same `tsc --noEmit` but wired into the cheap early stage. |
| `lint:format`         | validate | ~38 s   | Prettier `--check` on early stage. |

## Per-stage median

| Stage       | Jobs included                                              | Notes |
| ----------- | ---------------------------------------------------------- | --- |
| validate    | lint:format, typecheck, hadolint                           | Runs first on every push; mostly parallel. |
| test        | unit-tests                                                 | Vitest is fast — sub-minute. |
| build       | build:production, typedoc                                  | Both CPU-bound; run in parallel. |
| quality     | security:audit, lint:circular-deps, bundle-size-check, lint:format, typecheck | Secondary quality gates. |

Jobs inside a stage run in parallel where `needs:` allows, which is why
the wall-clock is ~13 min despite summed job time being higher.

## Main-branch stages (not yet measured)

These run only on `main` after the MR pipeline stages above succeed:

- `docker-build` — buildx + QEMU cross-compile to `linux/amd64`.
- `trivy:scan`, `sbom:syft`, `grype:scan`, `dockle`, `cosign:sign` — supply chain.
- `deploy:gke` + 5 optional manual deploys.
- `smoke-test` — 30 s k6 load against the deployed UI (added in commit `ce84495`).

Measurements pending — the last 3 main pipelines in the sample were failing
at `secret-scan` (gitleaks config schema, fixed in MR 24) so docker/deploy
never ran. Re-measure after the next green main pipeline.

## Refreshing this file

```bash
# Fetch the last 5 successful MR pipelines as JSON.
for pid in $(glab api \
  "projects/mirador1%2Fmirador-ui/pipelines?status=success&per_page=5" \
  | python3 -c 'import json,sys;[print(p["id"]) for p in json.load(sys.stdin)]'); do
  glab api "projects/mirador1%2Fmirador-ui/pipelines/$pid/jobs?per_page=100" \
    > /tmp/mirador_ui_jobs_$pid.json
done

python3 <<'PY'
import json, glob
from collections import defaultdict
per_job = defaultdict(list)
for f in sorted(glob.glob('/tmp/mirador_ui_jobs_*.json')):
    for j in json.load(open(f)):
        if j.get('status') == 'success' and j.get('duration') is not None:
            per_job[j['name']].append(j['duration'])
for name, durs in sorted(per_job.items(), key=lambda kv: -sorted(kv[1])[len(kv[1])//2]):
    s = sorted(durs); med = s[len(s)//2]
    print(f"{name:<35} median {med:>7.1f}s  runs {len(durs)}")
PY
```
