import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { RuntimeReport } from '../quality.component';

/**
 * Runtime tab — active profiles, JVM uptime, startup time, JAR layers.
 * Extracted 2026-04-22 from quality.component.html under Phase B-5.
 */
@Component({
  selector: 'app-qt-runtime',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../quality.component.scss',
  template: `
    @let rt = runtime();
    <section class="report-section">
      <h3>Runtime</h3>
      @if (rt?.available) {
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Active Profiles</span>
            <span class="info-value">
              @for (profile of rt!.activeProfiles; track profile) {
                <span class="badge badge-profile">{{ profile }}</span>
              }
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Uptime</span>
            <span class="info-value">{{ rt!.uptimeHuman }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Started At</span>
            <span class="info-value">{{ rt!.startedAt }}</span>
          </div>
          @if (rt!.startupDurationMs) {
            <div class="info-row">
              <span class="info-label">Startup Time</span>
              <span class="info-value">{{ rt!.startupDurationSeconds!.toFixed(2) }}s</span>
            </div>
          }
        </div>

        @if (rt!.jarLayers && rt!.jarLayers!.length > 0) {
          <h4>JAR Layers</h4>
          <div class="table-wrap">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Layer</th>
                  <th class="num-col">Entries</th>
                </tr>
              </thead>
              <tbody>
                @for (layer of rt!.jarLayers; track layer.name) {
                  <tr>
                    <td>{{ layer.name }}</td>
                    <td class="num-col">{{ layer.entries }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      } @else {
        <p class="na-message">Runtime info not available.</p>
      }
    </section>
  `,
})
export class QcTabRuntimeComponent {
  readonly runtime = input<RuntimeReport | undefined>();
}
