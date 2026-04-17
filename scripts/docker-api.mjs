/**
 * Lightweight Docker control + observability proxy API.
 *
 * Usage: node scripts/docker-api.mjs
 * Listens on port 3333 by default (DOCKER_API_PORT env var to override).
 *
 * Endpoints:
 *   GET  /containers                — list Docker containers
 *   POST /containers/:name/stop    — stop a container
 *   POST /containers/:name/start   — start a container
 *   POST /containers/:name/restart — restart a container
 *   GET  /zipkin/*                  — proxy to Zipkin (localhost:9411)
 *   GET  /loki/*                    — proxy to Loki (localhost:3100)
 *   GET  /gitlab/*                  — proxy to GitLab REST API with
 *                                     PRIVATE-TOKEN injected from env
 *                                     (GITLAB_API_TOKEN). Keeps the token
 *                                     out of the browser. Used by the
 *                                     Pipelines feature.
 */

import { createServer, request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { execSync } from 'child_process';

const PORT = parseInt(process.env.DOCKER_API_PORT || '3333', 10);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const json = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(data));
};

const exec = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 15000 }).trim();
  } catch (e) {
    return e.stderr || e.message;
  }
};

const listContainers = () => {
  const out = exec('docker ps -a --format "{{.Names}}\\t{{.Status}}\\t{{.Image}}"');
  if (!out) return [];
  return out.split('\n').filter(Boolean).map(line => {
    const [name, status, image] = line.split('\t');
    const running = status.toLowerCase().startsWith('up');
    return { name, status, image, running };
  });
};

/** Proxy a request to a target host */
const proxy = (targetHost, targetPort, pathPrefix, req, res) => {
  const targetPath = req.url.replace(pathPrefix, '') || '/';
  const proxyReq = httpRequest({
    hostname: targetHost,
    port: targetPort,
    path: targetPath,
    method: req.method,
    headers: { ...req.headers, host: `${targetHost}:${targetPort}` },
    timeout: 10000,
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, { ...proxyRes.headers, ...CORS });
    proxyRes.pipe(res);
  });
  proxyReq.on('error', () => {
    json(res, 502, { error: `Cannot reach ${targetHost}:${targetPort}` });
  });
  req.pipe(proxyReq);
};

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Docker container management
  if (req.method === 'GET' && url.pathname === '/containers') {
    return json(res, 200, listContainers());
  }

  const match = url.pathname.match(/^\/containers\/([^/]+)\/(stop|start|restart)$/);
  if (req.method === 'POST' && match) {
    const [, name, action] = match;
    console.log(`[docker-api] ${action} ${name}`);
    const output = exec(`docker ${action} ${name}`);
    const containers = listContainers();
    const container = containers.find(c => c.name === name);
    return json(res, 200, { name, action, output, container });
  }

  // Zipkin proxy (localhost:9411)
  if (url.pathname.startsWith('/zipkin/')) {
    return proxy('localhost', 9411, '/zipkin', req, res);
  }

  // Loki proxy (localhost:3100)
  if (url.pathname.startsWith('/loki/')) {
    return proxy('localhost', 3100, '/loki', req, res);
  }

  // GitLab REST API proxy — injects PRIVATE-TOKEN so the browser never
  // sees it. Any path after /gitlab/ is forwarded verbatim to
  // gitlab.com/api/v4/. Example: GET /gitlab/projects/mirador1%2Fmirador-ui/pipelines
  // hits https://gitlab.com/api/v4/projects/mirador1%2Fmirador-ui/pipelines.
  if (url.pathname.startsWith('/gitlab/')) {
    return gitlabProxy(req, res);
  }

  json(res, 404, { error: 'Not found' });
});

/**
 * Forwards /gitlab/<anything> to https://gitlab.com/api/v4/<anything>.
 *
 * Strips the local Host/Origin/Referer headers that GitLab would reject
 * as non-matching and injects the `PRIVATE-TOKEN` header from the
 * GITLAB_API_TOKEN env var (falls back to anonymous access — works for
 * public projects, rate-limited at 10 req/min/IP).
 */
function gitlabProxy(req, res) {
  const targetPath = '/api/v4' + req.url.replace(/^\/gitlab/, '');
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'mirador-ui-docker-api/1.0',
  };
  if (process.env.GITLAB_API_TOKEN) {
    headers['PRIVATE-TOKEN'] = process.env.GITLAB_API_TOKEN;
  }
  const proxyReq = httpsRequest(
    {
      hostname: 'gitlab.com',
      port: 443,
      path: targetPath,
      method: req.method,
      headers,
      timeout: 10000,
    },
    (proxyRes) => {
      // Strip gitlab.com's CORS headers and replace with our permissive ones
      // (the browser hits us, not gitlab.com, so this is our call to make).
      const { 'access-control-allow-origin': _1, 'access-control-allow-methods': _2,
              'access-control-allow-headers': _3, ...passThrough } = proxyRes.headers;
      res.writeHead(proxyRes.statusCode, { ...passThrough, ...CORS });
      proxyRes.pipe(res);
    }
  );
  proxyReq.on('error', (e) => {
    json(res, 502, { error: `GitLab proxy failed: ${e.message}` });
  });
  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    json(res, 504, { error: 'GitLab request timed out' });
  });
  proxyReq.end();
}

server.listen(PORT, () => {
  console.log(`[docker-api] API listening on http://localhost:${PORT}`);
  console.log(`[docker-api] Docker: GET /containers, POST /containers/:name/(stop|start|restart)`);
  console.log(`[docker-api] Proxy:  /zipkin/* -> localhost:9411, /loki/* -> localhost:3100`);
  console.log(`[docker-api] Proxy:  /gitlab/* -> gitlab.com/api/v4/* ` +
    (process.env.GITLAB_API_TOKEN ? '(authenticated)' : '(anonymous — public projects only)'));
});
