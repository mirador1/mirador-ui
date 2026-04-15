/**
 * EnvService — Multi-environment URL management.
 *
 * Manages the active backend environment (Local, Docker, Staging, etc.).
 * All API calls use `baseUrl()` to resolve the target server dynamically.
 * The selected environment is persisted in localStorage and restored on reload.
 */
import { Injectable, signal, computed } from '@angular/core';

export interface Environment {
  name: string;
  baseUrl: string;
  /** URL of the dedicated Maven site static server (nginx port 8084 locally).
   *  Separate from the backend so the report server has an independent lifecycle
   *  (regenerated daily by CI, not on every backend deploy). */
  mavenSiteUrl?: string;
}

/** Available backend environments — add entries here for Docker/Staging/Prod */
const ENVIRONMENTS: Environment[] = [
  {
    name: 'Local',
    baseUrl: 'http://localhost:8080',
    // nginx container serving target/site/ — start with `./run.sh site`
    mavenSiteUrl: 'http://localhost:8084',
  },
];

@Injectable({ providedIn: 'root' })
export class EnvService {
  readonly environments = ENVIRONMENTS;

  private readonly _current = signal<Environment>(this.restore() ?? ENVIRONMENTS[0]);

  readonly current = this._current.asReadonly();
  readonly baseUrl = computed(() => this._current().baseUrl);
  readonly mavenSiteUrl = computed(() => this._current().mavenSiteUrl ?? null);

  select(env: Environment): void {
    this._current.set(env);
    localStorage.setItem('env', JSON.stringify(env));
  }

  private restore(): Environment | null {
    const raw = localStorage.getItem('env');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Environment;
      return ENVIRONMENTS.find((e) => e.name === parsed.name) ?? null;
    } catch {
      return null;
    }
  }
}
