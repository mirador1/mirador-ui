import { Injectable, signal, computed } from '@angular/core';

export interface Environment {
  name: string;
  baseUrl: string;
}

const ENVIRONMENTS: Environment[] = [
  { name: 'Local', baseUrl: 'http://localhost:8080' },
];

@Injectable({ providedIn: 'root' })
export class EnvService {
  readonly environments = ENVIRONMENTS;

  private readonly _current = signal<Environment>(this.restore() ?? ENVIRONMENTS[0]);

  readonly current = this._current.asReadonly();
  readonly baseUrl = computed(() => this._current().baseUrl);

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
