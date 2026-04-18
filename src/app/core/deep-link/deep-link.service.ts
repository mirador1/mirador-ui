/**
 * DeepLinkService — URI helpers for desktop / IDE deep-links.
 *
 * Browsers honour custom URI schemes by delegating them to the OS, which
 * routes to the registered application (VS Code, IntelliJ, Docker
 * Desktop, …). If the app is not installed the browser silently does
 * nothing — no feature detection needed, no error to surface.
 *
 * Rationale for making this a service rather than inline strings: a
 * single place to add "sanitise absolute path", "fail-safe on empty
 * input", and any future URI-scheme tweaks as the target apps evolve.
 *
 * Target apps + their URI templates are documented in
 * <https://gitlab.com/mirador1/mirador-service/-/blob/main/docs/getting-started/dev-tooling.md>.
 */
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DeepLinkService {
  /**
   * `vscode://file/<abs-path>[:<line>[:<col>]]` — opens a file in VS Code.
   * Absolute path required; relative paths are ignored by VS Code.
   */
  vscode(absPath: string, line?: number): string {
    const anchor = line !== undefined ? `:${line}` : '';
    return `vscode://file${absPath}${anchor}`;
  }

  /**
   * `idea://open?file=<abs-path>[&line=<n>]` — opens a file in IntelliJ
   * IDEA. Requires the JetBrains Toolbox or a recent IDEA install
   * (2022.3+) that registers the URI handler.
   */
  idea(absPath: string, line?: number): string {
    const params = new URLSearchParams({ file: absPath });
    if (line !== undefined) params.set('line', String(line));
    return `idea://open?${params.toString()}`;
  }

  /**
   * `docker-desktop://dashboard/container/<id>` — opens Docker Desktop
   * on the container detail view. Accepts either a container ID
   * (preferred, immutable) or a container name (stable across
   * restarts, less precise).
   */
  dockerContainer(idOrName: string): string {
    return `docker-desktop://dashboard/container/${idOrName}`;
  }
}
