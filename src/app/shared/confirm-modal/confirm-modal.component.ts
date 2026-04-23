/**
 * ConfirmModalComponent — generic Yes/No confirmation dialog.
 *
 * Reusable for any "are you sure?" UX : delete confirmations, batch
 * actions, destructive operations. Click on the overlay or Cancel
 * button emits `cancel` ; click on the primary button emits `confirm`.
 *
 * Inputs :
 *  - title       : modal heading
 *  - body        : main paragraph (supports plain text — for HTML use ng-content)
 *  - confirmLabel: label of the primary action button
 *  - cancelLabel : label of the cancel button (default 'Cancel')
 *  - loading     : disables + replaces label with cancelLabel + 'ing…'
 *  - variant     : 'primary' (default blue) | 'danger' (red, for delete-like actions)
 *
 * If callers need rich body content (interpolation, multi-paragraph),
 * project via `<ng-content>` instead of using the `body` input.
 *
 * Created 2026-04-23 to consolidate 3 near-identical confirmation modals
 * in customers.component.html (delete + batch delete) into one widget.
 */
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  template: `
    <div class="modal-overlay" (click)="cancelled.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <h3>{{ title() }}</h3>
        @if (body()) {
          <p class="modal-text" [innerHTML]="body()"></p>
        }
        <ng-content></ng-content>
        <div class="modal-actions">
          <button class="sm-btn" (click)="cancelled.emit()">{{ cancelLabel() }}</button>
          <button
            [class]="variant() === 'danger' ? 'danger-btn' : 'primary-btn'"
            (click)="confirmed.emit()"
            [disabled]="loading()"
          >
            {{ loading() ? loadingLabel() : confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      /* Reuses .modal-overlay / .modal / .modal-text / .modal-actions / .sm-btn /
       * .primary-btn / .danger-btn from the global styles + per-feature SCSS.
       * No local styles needed — keeps the widget portable across features. */
    `,
  ],
})
export class ConfirmModalComponent {
  readonly title = input.required<string>();
  readonly body = input<string>('');
  readonly confirmLabel = input<string>('Confirm');
  readonly cancelLabel = input<string>('Cancel');
  /** Label shown when loading=true. Defaults to confirmLabel + 'ing…' fallback. */
  readonly loadingLabel = input<string>('Working…');
  readonly loading = input<boolean>(false);
  /** 'primary' (default blue) or 'danger' (red) — matches global button styles. */
  readonly variant = input<'primary' | 'danger'>('primary');

  // ESLint @angular-eslint/no-output-native flags `cancel` + `confirm` as
  // shadowing native DOM events ; renamed to `cancelled` / `confirmed` past
  // tense (avoids the lint error + keeps semantic meaning clear).
  readonly cancelled = output<void>();
  readonly confirmed = output<void>();
}
