// =============================================================================
// k6 smoke test — runs post-deploy to verify the GKE frontend responds OK.
//
// Front-end smoke test mirrors the backend one (see mirador-service's
// scripts/load-test/smoke.js). The Angular app and the backend share a
// single host behind the nginx Ingress; we hit both the SPA shell and a
// few `/api/*` paths that the ingress rewrites to the backend. Running
// this after the UI deploy catches two classes of regression:
//   - the shell doesn't load (Nginx wrong MIME type, bad CSP, 404 on
//     index.html, etc.)
//   - the API proxy rewrite stops working (the ingress lost its
//     `rewrite-target` annotation or the backend is down).
//
// 30 seconds of light traffic (~3 RPS). Pass criteria:
//   - p95 latency < 500 ms
//   - <1% 5xx responses
//   - >99% of checks pass
//
// Run locally:
//   K8S_HOST=mirador1.duckdns.org k6 run scripts/load-test/smoke.js
//
// In CI, K8S_HOST is a protected variable set by the deploy:gke
// environment.
// =============================================================================

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = `https://${__ENV.K8S_HOST || 'mirador1.duckdns.org'}`;

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-arrival-rate',
      rate: 3, // 3 requests per second → ~90 requests over 30 s
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 5,
      maxVUs: 10,
    },
  },
  thresholds: {
    // Pass criteria — the job fails if any of these are violated.
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'], // <1% errors
    checks: ['rate>0.99'], // >99% of checks pass
  },
};

// Mix of SPA-shell hits + /api/* proxy hits. Read-only; no POST/PUT.
const paths = [
  '/', // Nginx serves index.html
  '/favicon.ico', // static asset cache-worthiness
  '/manifest.json', // PWA manifest is tiny; ensures Nginx MIME mapping works
  '/api/actuator/health', // ingress strips /api, proxies to backend
  '/api/actuator/health/readiness',
  '/api/customers?page=0&size=10',
];

export default function () {
  const path = paths[Math.floor(Math.random() * paths.length)];
  const res = http.get(`${BASE}${path}`, {
    headers: { Accept: 'application/json, text/html' },
  });

  check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'latency < 1s': (r) => r.timings.duration < 1000,
    'body is non-empty': (r) => (r.body || '').length > 0,
  });

  sleep(0.1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data),
    'smoke-summary.json': JSON.stringify(data, null, 2),
  };
}

// Minimal text summary so we don't need to fetch an external module.
function textSummary(data) {
  const m = data.metrics;
  const p95 = m.http_req_duration?.values?.['p(95)']?.toFixed(1) ?? 'n/a';
  const avg = m.http_req_duration?.values?.avg?.toFixed(1) ?? 'n/a';
  const errRate = ((m.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2);
  const count = m.http_reqs?.values?.count ?? 0;
  return [
    '',
    '=== k6 UI smoke-test summary ===',
    `Requests        : ${count}`,
    `Error rate      : ${errRate} %`,
    `Latency avg     : ${avg} ms`,
    `Latency p95     : ${p95} ms`,
    '',
  ].join('\n');
}
