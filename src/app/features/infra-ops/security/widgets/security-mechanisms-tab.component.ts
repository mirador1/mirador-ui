/**
 * SecurityMechanismsTabComponent — production security mechanisms table.
 *
 * Renders the static SECURITY_MECHANISMS catalogue as a grouped table
 * (rowspan-merged categories). No inputs — pure self-contained widget.
 *
 * Extracted from security.component.ts (`mechanisms` field, ~141 LOC of
 * static data) + the corresponding template block in security.component.html
 * per B-7-4 follow-up, 2026-04-23.
 */
import { Component } from '@angular/core';
import { SECURITY_MECHANISMS, type SecurityMechanismGroup } from '../security-mechanisms-data';

@Component({
  selector: 'app-security-mechanisms-tab',
  standalone: true,
  styleUrl: '../security.component.scss',
  template: `
    <div class="tab-content">
      <div class="explanation-card info">
        <strong>ℹ️ Production security</strong> — These mechanisms are active in the running
        application and are <em>not</em> intentionally vulnerable. The other tabs demo OWASP
        vulnerabilities for educational purposes.
      </div>

      <table class="mech-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Mechanism</th>
            <th>Status</th>
            <th>Description</th>
            <th>Config / Location</th>
          </tr>
        </thead>
        <tbody>
          @for (group of mechanisms; track group.category) {
            @for (item of group.items; track item.name; let first = $first) {
              <tr [class.mech-optional-row]="item.status === 'optional'">
                @if (first) {
                  <td class="mech-cat-cell" [attr.rowspan]="group.items.length">
                    {{ group.category }}
                  </td>
                }
                <td class="mech-name-cell">{{ item.name }}</td>
                <td>
                  <span
                    class="mech-badge"
                    [class.mech-badge-optional]="item.status === 'optional'"
                    >{{ item.status === 'optional' ? 'optional' : 'active' }}</span
                  >
                </td>
                <td class="mech-desc-cell">{{ item.description }}</td>
                <td class="mech-config-cell">{{ item.config }}</td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
})
export class SecurityMechanismsTabComponent {
  readonly mechanisms: SecurityMechanismGroup[] = SECURITY_MECHANISMS;
}
