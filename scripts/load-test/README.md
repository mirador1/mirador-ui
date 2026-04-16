# Load tests

Tiny k6 smoke test that runs after `deploy:gke` on `main`. The intent is
early warning, not performance engineering — we confirm the deployed
frontend + backend proxy actually respond to light read-only traffic
within the published latency budget.

## What it does

- 30 s of traffic at ~3 RPS (total ~90 requests).
- Targets a mix of SPA shell paths (`/`, `/favicon.ico`, `/manifest.json`)
  and `/api/*` paths that the nginx Ingress rewrites to the backend.
- Thresholds (job fails if any is violated):
  - p95 latency < 500 ms
  - HTTP error rate < 1 %
  - >99 % of per-request checks pass

## Run locally

```bash
# brew install k6   (if not yet installed)
K8S_HOST=mirador1.duckdns.org k6 run scripts/load-test/smoke.js
```

## Run in CI

The `smoke-test` job in `.gitlab-ci.yml` runs this automatically after
`deploy:gke` on `main`. It uses the `grafana/k6:1.4.0` image and the
protected `K8S_HOST` CI variable.

## Editing thresholds

Thresholds live in `smoke.js` under the `options.thresholds` block. Keep
the test intentionally light; a heavier perf suite belongs in a separate
schedule.
