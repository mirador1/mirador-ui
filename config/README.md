# `config/` — Tool configuration files

Configuration files that static analyzers, doc generators and the Angular
dev server need at build/analysis time. Grouped here (instead of the
project root) to keep the top level focused on the application itself.

## Files

| File                        | Consumed by                          | Role                                                                                                    |
| --------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `proxy.conf.json`           | Angular CLI dev server (`ng serve`)  | Proxies `/proxy/kafka-ui`, `/proxy/ollama`, `/proxy/keycloak` to their local ports (avoids CORS).       |
| `typedoc.json`              | TypeDoc (`npm run typedoc`)          | Entry points, output dir, navigation links. Paths use `../` because TypeDoc is run from the repo root.  |
| `.compodocrc.json`          | Compodoc (`npm run compodoc`)        | Angular-aware doc generator config. Same `../` convention for paths.                                    |
| `sonar-project.properties`  | SonarCloud scanner                   | Project key, organization, source paths, coverage file locations.                                       |

## Why paths are prefixed with `../`

Angular CLI / TypeDoc / Compodoc are all run from the repo root. When
their config file lives at `config/foo.json`, path options inside the
JSON (like `"out": "../docs/typedoc"`) are resolved **relative to the
config file itself** (TypeDoc rule) or **relative to the cwd** (Angular
rule). We use `../` to point back at the repo root for TypeDoc and
Compodoc to stay consistent, since both need to write into `docs/` at
the root level.

The Angular CLI's `proxyConfig` path in `angular.json` points at
`config/proxy.conf.json` relative to the Angular workspace root (repo
root) — no `../` needed there.

## How npm scripts reference these

```json
"compodoc": "compodoc --config config/.compodocrc.json",
"typedoc":  "typedoc --options config/typedoc.json",
```

The Angular `serve` target reads the path from `angular.json`:

```json
"proxyConfig": "config/proxy.conf.json"
```

## Related

- `.gitlab-ci.yml` — `sonar-analysis` / `docs` jobs that consume these.
- `../CLAUDE.md` — notes on SonarCloud org/project key setup.
