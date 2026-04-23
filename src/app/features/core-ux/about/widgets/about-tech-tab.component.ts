/**
 * AboutTechTabComponent — sortable A→Z technologies table.
 *
 * 207 entries imported directly from sibling about-data.ts. Pure
 * presentational — parent doesn't prop-drill the array.
 *
 * Extracted from about.component.html per Phase B-7-5 P1B, 2026-04-24.
 */
import { Component } from '@angular/core';
import { TECHNOLOGIES } from '../about-data';

@Component({
  selector: 'app-about-tech-tab',
  standalone: true,
  styleUrl: '../about.component.scss',
  template: `
    <article class="card tech-card">
      <h3>All Technologies — A → Z</h3>
      <p class="card-desc">
        {{ technologies.length }} technologies used in this project, alphabetically sorted.
      </p>
      <table class="tech-table">
        <thead>
          <tr>
            <th class="tech-col-name">Technology</th>
            <th class="tech-col-desc">What it is</th>
            <th class="tech-col-usage">How it's used here</th>
          </tr>
        </thead>
        <tbody>
          @for (t of technologies; track t.name) {
            <tr>
              <td class="tech-name">
                {{ t.icon }}
                @if (t.url) {
                  <a [href]="t.url" target="_blank" rel="noopener" class="tech-link">{{
                    t.name
                  }}</a>
                } @else {
                  {{ t.name }}
                }
              </td>
              <td class="tech-desc">{{ t.description }}</td>
              <td class="tech-usage">{{ t.usage }}</td>
            </tr>
          }
        </tbody>
      </table>
    </article>
  `,
})
export class AboutTechTabComponent {
  readonly technologies = TECHNOLOGIES;
}
