/**
 * PipelinesService — talks to the local docker-api.mjs `/gitlab/*` proxy
 * (which forwards to gitlab.com/api/v4 with the PRIVATE-TOKEN injected
 * server-side). The Java backend is intentionally not involved — pipeline
 * monitoring must not add load to the Spring Boot process.
 */
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** One row of the GitLab pipelines list. Fields mirror the REST payload. */
export interface GitlabPipeline {
  id: number;
  iid: number;
  status: string; // 'success' | 'failed' | 'running' | 'pending' | 'canceled' | 'skipped' | 'manual'
  ref: string; // branch or MR ref (refs/merge-requests/N/head)
  sha: string;
  web_url: string;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  duration?: number | null;
  source: string; // 'push' | 'merge_request_event' | 'schedule' | ...
}

/** Minimal job shape used by the per-pipeline drill-down. */
export interface GitlabJob {
  id: number;
  name: string;
  stage: string;
  status: string;
  duration?: number | null;
  allow_failure: boolean;
  runner?: { id: number; description: string; tag_list?: string[] } | null;
  started_at?: string | null;
  finished_at?: string | null;
  web_url: string;
}

/**
 * Pre-configured project slugs that the UI can monitor. URL-encoded so
 * they're safe to paste into the GitLab REST path directly.
 */
export const PROJECTS = {
  ui: 'mirador1%2Fmirador-ui',
  service: 'mirador1%2Fmirador-service',
} as const;

export type ProjectKey = keyof typeof PROJECTS;

@Injectable({ providedIn: 'root' })
export class PipelinesService {
  private readonly http = inject(HttpClient);

  /**
   * Base URL of the docker-api.mjs proxy. Exposed as a signal so a future
   * Settings panel could let the operator point it elsewhere (remote
   * runner, tunnel, etc.). Defaults to the convention used by run.sh.
   */
  readonly proxyBase = signal<string>(this.detectProxyBase());

  list(project: ProjectKey, perPage = 20): Observable<GitlabPipeline[]> {
    const path = `/projects/${PROJECTS[project]}/pipelines`;
    return this.http.get<GitlabPipeline[]>(
      `${this.proxyBase()}/gitlab${path}?per_page=${perPage}&order_by=id&sort=desc`,
    );
  }

  jobs(project: ProjectKey, pipelineId: number): Observable<GitlabJob[]> {
    const path = `/projects/${PROJECTS[project]}/pipelines/${pipelineId}/jobs`;
    return this.http.get<GitlabJob[]>(`${this.proxyBase()}/gitlab${path}?per_page=100`);
  }

  /**
   * When the app runs via `ng serve` (port 4200) or nginx (port 80 / 4200
   * in the docker-compose stack) the docker-api.mjs process sits on the
   * HOST at port 3333. Prefer a same-origin path if the app is served
   * through a reverse proxy that exposes /docker-api/ already; fall back
   * to the absolute localhost URL. The env service is the source of
   * truth for the backend; here we just hard-wire the local convention.
   */
  private detectProxyBase(): string {
    return 'http://localhost:3333';
  }
}
