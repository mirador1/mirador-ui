# `public/` — Static assets served as-is

Angular 17+ uses this directory as the **default static-asset folder**.
Files here are copied verbatim to `dist/browser/` at build time and served
by nginx (or the dev server) without any processing, hashing, or
bundling. They keep their path: a file at `public/favicon.svg` is reachable
at `/favicon.svg` in the deployed app.

## Files and sub-directories

| Entry            | Role                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| `banner.svg`     | Mirador banner, referenced in the root `README.md` and embedded in the app's home screen.                  |
| `favicon.svg`    | Browser tab icon.                                                                                          |
| `icon-white.svg` | Monochrome variant used in the dark-mode header.                                                           |
| `manifest.json`  | PWA manifest (app name, icons, theme color) — enables "Add to Home Screen" on mobile.                      |
| [`images/`](images/) | Dashboard screenshots and tool icons shown in the observability/security/diagnostic pages.              |
| `README.md`      | This file.                                                                                                |

## When to put a file here

✅ **Yes** — assets that should be served as-is with a stable URL:
- Favicons and PWA icons
- OpenGraph images
- Manifest / robots.txt / sitemap.xml
- Pre-rendered screenshots embedded in the UI

❌ **No** — anything Angular should process:
- Component-scoped images (use `src/assets/` or import from the component)
- Hashed CDN bundles (Angular already does this under `dist/`)
- Environment-specific content (use `environments/*.ts`)

## Why not `src/assets/`?

Angular 17 deprecated `src/assets/` in favor of `public/`. Files in
`public/` do NOT go through the Angular build pipeline — they're served
at their exact path, which matches how real-world web apps consume
favicons and manifest files. `src/assets/` files get hashed and referenced
via `assets/` URL; that's overkill for static icons.
