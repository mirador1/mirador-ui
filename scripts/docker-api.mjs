/**
 * Lightweight Docker control API for the Observability UI.
 * Exposes endpoints to list, stop, start, and restart Docker containers.
 *
 * Usage: node scripts/docker-api.mjs
 * Listens on port 3333 by default (DOCKER_API_PORT env var to override).
 *
 * Endpoints:
 *   GET  /containers          — list running containers
 *   POST /containers/:name/stop    — stop a container
 *   POST /containers/:name/start   — start a container
 *   POST /containers/:name/restart — restart a container
 */

import { createServer } from 'http';
import { execSync } from 'child_process';

const PORT = parseInt(process.env.DOCKER_API_PORT || '3333', 10);

const json = (res, status, data) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  });
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

const server = createServer((req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/containers') {
    return json(res, 200, listContainers());
  }

  const match = url.pathname.match(/^\/containers\/([^/]+)\/(stop|start|restart)$/);
  if (req.method === 'POST' && match) {
    const [, name, action] = match;
    console.log(`[docker-api] ${action} ${name}`);
    const output = exec(`docker ${action} ${name}`);
    // Wait a moment for the container to change state
    const containers = listContainers();
    const container = containers.find(c => c.name === name);
    return json(res, 200, { name, action, output, container });
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`[docker-api] Docker control API listening on http://localhost:${PORT}`);
  console.log(`[docker-api] Endpoints: GET /containers, POST /containers/:name/(stop|start|restart)`);
});
