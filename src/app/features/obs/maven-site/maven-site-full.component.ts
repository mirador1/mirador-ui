import { Component, DestroyRef, inject, signal, computed, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { EnvService } from '../../../core/env/env.service';

/**
 * Full-viewport Maven Site viewer — accessible at /quality/site.
 *
 * Fills the entire viewport with the Maven site iframe so large reports
 * (Javadoc, JaCoCo, Surefire, Pitest) are usable without the tab chrome
 * from the quality page cutting off vertical space.
 *
 * The component probes /maven-site/index.html before rendering the iframe
 * so it can show a helpful error when the backend/nginx is unreachable.
 */
@Component({
  selector: 'app-maven-site-full',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './maven-site-full.component.html',
  styleUrl: './maven-site-full.component.scss',
})
export class MavenSiteFullComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly env = inject(EnvService);
  private readonly sanitizer = inject(DomSanitizer);

  /**
   * DestroyRef used by `takeUntilDestroyed()` on every HTTP subscribe to
   * stop the post-destroy `signal.set()` callback (Phase 4.1, 2026-04-22).
   */
  private readonly destroyRef = inject(DestroyRef);
  readonly available = signal<boolean | null>(null); // null = loading

  /** Raw URL string — used for the anchor href and the availability probe. */
  get siteUrl(): string {
    return this.env.mavenSiteUrl() ?? `${this.env.baseUrl()}/maven-site`;
  }

  /**
   * Sanitized URL for the iframe [src] binding.
   * Angular's DomSanitizer blocks iframe URLs unless explicitly trusted.
   * This URL is safe: it always points to our own backend (same origin in prod).
   */
  readonly safeSiteUrl = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(
      this.env.mavenSiteUrl() ?? `${this.env.baseUrl()}/maven-site`,
    ),
  );

  ngOnInit(): void {
    this.http
      .get(`${this.siteUrl}/index.html`, { responseType: 'text', observe: 'response' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.available.set(true),
        error: () => this.available.set(false),
      });
  }
}
