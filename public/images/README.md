# `public/images/` — Static images used in the UI

Images served as-is (no Angular processing) and referenced by their exact
URL path from TypeScript components. Used for documentation/demo
screenshots embedded inline in the app.

## Sub-directories

| Directory         | Role                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| `tools/`          | Screenshots of the admin UIs exposed in the observability/diagnostic pages (Grafana, pgAdmin, Prometheus, Kafka UI, Keycloak). Displayed as preview tiles next to the "Open ↗" buttons so the user knows what each tool looks like before clicking. |

## Naming convention

- `<tool-name>.png` for static screenshots (PNG preferred over JPG for UI shots — sharper text, smaller for flat UI).
- `<tool-name>.gif` for animated demos (keep under 2 MB — larger files block
  initial page load).

## When to add a new image here

- A new third-party tool is added to the Docker Compose stack **and**
  referenced from an info-tip or dashboard widget → capture a clean
  screenshot at 1200×800 or similar and drop it here with the matching
  component's reference.

## When NOT to add an image here

- Component-specific icons used in a single template → prefer inline SVG
  in the template (vectorial, themeable, zero HTTP call).
- Dynamic data (charts, sparklines) → render as SVG with the data service,
  not a PNG.
