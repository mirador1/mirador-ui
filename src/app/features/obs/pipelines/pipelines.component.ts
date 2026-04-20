/**
 * PipelinesComponent — live view of recent GitLab CI/CD pipelines.
 *
 * Reads from the local docker-api.mjs `/gitlab/*` proxy — intentionally
 * bypasses the Java backend so pipeline polling adds zero load to the
 * Spring Boot process.
 *
 * Features:
 * - Project switch (mirador-ui / mirador-service)
 * - Auto-refresh (10 s / 30 s / 60 s / off)
 * - Per-pipeline job drill-down with runner tag + duration
 * - Status-aware styling (success / failed / running / …)
 */
import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe, KeyValuePipe } from '@angular/common';
import {
  GitlabJob,
  GitlabPipeline,
  PipelinesService,
  ProjectKey,
} from '../../../core/pipelines/pipelines.service';
import { ToastService } from '../../../core/toast/toast.service';

type IntervalChoice = 0 | 10 | 30 | 60;

@Component({
  selector: 'app-pipelines',
  standalone: true,
  imports: [DatePipe, KeyValuePipe],
  templateUrl: './pipelines.component.html',
  styleUrl: './pipelines.component.scss',
})
export class PipelinesComponent implements OnInit, OnDestroy {
  private readonly api = inject(PipelinesService);
  private readonly toast = inject(ToastService);

  // ── State ─────────────────────────────────────────────────────────────────

  readonly project = signal<ProjectKey>('service');
  readonly pipelines = signal<GitlabPipeline[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastFetchedAt = signal<Date | null>(null);

  /** Currently-expanded pipeline id (for job drill-down). */
  readonly openPipelineId = signal<number | null>(null);
  readonly openJobs = signal<GitlabJob[]>([]);
  readonly jobsLoading = signal(false);

  /** Auto-refresh cadence, seconds. 0 = off. */
  readonly interval = signal<IntervalChoice>(30);
  private timer: ReturnType<typeof setInterval> | null = null;

  // ── Derived ───────────────────────────────────────────────────────────────

  /** Short-form ref (chops `refs/merge-requests/NN/head` → `MR !NN`). */
  readonly niceRef = (ref: string): string => {
    const mr = ref.match(/^refs\/merge-requests\/(\d+)\//);
    if (mr) return `MR !${mr[1]}`;
    return ref.replace(/^refs\/heads\//, '');
  };

  /** Human-readable duration (42s, 2m 15s, 1h 4m). */
  readonly niceDuration = (sec: number | null | undefined): string => {
    if (sec == null) return '—';
    if (sec < 60) return `${Math.round(sec)}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
    return `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m`;
  };

  /** Aggregate counts per status — shown as a quick header strip. */
  readonly statusCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const p of this.pipelines()) counts[p.status] = (counts[p.status] ?? 0) + 1;
    return counts;
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.refresh();
    this.arm();
  }

  ngOnDestroy(): void {
    if (this.timer !== null) clearInterval(this.timer);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  setProject(p: ProjectKey): void {
    if (p === this.project()) return;
    this.project.set(p);
    this.openPipelineId.set(null);
    this.pipelines.set([]);
    this.refresh();
  }

  setInterval(secondsRaw: string | number): void {
    const seconds = Number(secondsRaw) as IntervalChoice;
    this.interval.set(seconds);
    this.arm();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list(this.project(), 20).subscribe({
      next: (ps) => {
        this.pipelines.set(ps);
        this.lastFetchedAt.set(new Date());
        this.loading.set(false);
      },
      error: (e) => {
        // Most likely cause when running dev without the proxy: ECONNREFUSED.
        // Keep the prior list so the view degrades gracefully.
        const msg = e?.error?.error ?? e?.message ?? 'Unknown error';
        this.error.set(`Could not reach the GitLab proxy (docker-api.mjs at /gitlab/*). ${msg}`);
        this.loading.set(false);
      },
    });
  }

  togglePipeline(p: GitlabPipeline): void {
    if (this.openPipelineId() === p.id) {
      this.openPipelineId.set(null);
      this.openJobs.set([]);
      return;
    }
    this.openPipelineId.set(p.id);
    this.openJobs.set([]);
    this.jobsLoading.set(true);
    this.api.jobs(this.project(), p.id).subscribe({
      next: (jobs) => {
        this.openJobs.set(jobs);
        this.jobsLoading.set(false);
      },
      error: () => {
        this.toast.show('Failed to load jobs for this pipeline.', 'error');
        this.jobsLoading.set(false);
      },
    });
  }

  /** Convenience: true if at least one job ran on a `macbook-local` runner. */
  isLocalJob(j: GitlabJob): boolean {
    const tags = j.runner?.tag_list ?? [];
    return tags.some((t) => t === 'macbook-local' || t === 'macbook_local');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private arm(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const s = this.interval();
    if (s > 0) {
      this.timer = setInterval(() => this.refresh(), s * 1000);
    }
  }
}
