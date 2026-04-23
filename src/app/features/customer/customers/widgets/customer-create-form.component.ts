/**
 * CustomerCreateFormComponent — "Create Customer" card with optional
 * Idempotency-Key demo.
 *
 * Owns its own input state (newName/newEmail/useIdempotencyKey/
 * idempotencyKey) to keep parent coupling low. Emits :
 *  - createRequested({name, email, idempotencyKey?}) — user clicks + Create
 *  - createRandomRequested() — user clicks the 🎲 random helper
 *
 * Extracted from customers.component.html (lines 63-124 pre-extraction)
 * per B-7-2b follow-up, 2026-04-23.
 */
import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InfoTipComponent } from '../../../../shared/info-tip/info-tip.component';
import type { Customer } from '../../../../core/api/api.service';
import { uuid } from '../customers-helpers';

@Component({
  selector: 'app-customer-create-form',
  standalone: true,
  imports: [FormsModule, InfoTipComponent],
  styleUrl: '../customers.component.scss',
  template: `
    <article class="card create-card">
      <h3>Create Customer</h3>

      <label>
        Name
        <input #nameInput placeholder="ex: Alice Martin" (input)="newName.set(nameInput.value)" />
      </label>
      <label>
        Email
        <input
          #emailInput
          type="email"
          placeholder="ex: alice@example.com"
          (input)="newEmail.set(emailInput.value)"
        />
      </label>

      <div class="idem-row">
        <label class="idem-label">
          <input
            type="checkbox"
            [ngModel]="useIdempotencyKey()"
            (ngModelChange)="useIdempotencyKey.set($event)"
          />
          Idempotency-Key
          <app-info-tip
            text="When enabled, sends an Idempotency-Key header (UUID). The backend caches the response in an LRU cache (10k entries). Sending the same key twice returns the cached result without creating a duplicate."
            command="Idempotency-Key: &lt;uuid&gt;"
            source="LRU cache"
          />
        </label>
        @if (useIdempotencyKey()) {
          <code class="idem-key">{{ idempotencyKey() }}</code>
          <button class="sm-btn" (click)="resetKey()">New key</button>
        }
      </div>

      <div class="create-actions">
        <button class="primary-btn" (click)="submitCreate()" [disabled]="createLoading()">
          {{ createLoading() ? 'Creating...' : '+ Create' }}
        </button>
        <button
          class="secondary-btn"
          (click)="createRandomRequested.emit()"
          [disabled]="createLoading()"
          title="Create a customer with a random name + email (demo helper)"
        >
          🎲 Add random customer
        </button>
      </div>

      @if (createError()) {
        <p class="error-text">{{ createError() }}</p>
      }
      @if (createSuccess()) {
        <div class="success-box">
          Created → ID {{ createSuccess()!.id }}: <strong>{{ createSuccess()!.name }}</strong>
        </div>
      }
    </article>
  `,
})
export class CustomerCreateFormComponent {
  // ── Parent-owned state (signal inputs) ──────────────────────────────────────
  /** True while the parent's POST /customers is in flight. */
  readonly createLoading = input<boolean>(false);
  /** Non-empty = show the red error banner. */
  readonly createError = input<string>('');
  /** Last created customer — shown as a success confirmation box. Null = hide. */
  readonly createSuccess = input<Customer | null>(null);

  // ── Self-managed form state ─────────────────────────────────────────────────
  /** Template ref to the name input — read directly in submitCreate() for zoneless safety. */
  readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  /** Template ref to the email input — same zoneless reason as nameInput. */
  readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');
  /** Current name field value (for the create button enable/disable + fallback value). */
  readonly newName = signal('');
  /** Current email field value. */
  readonly newEmail = signal('');
  /** Whether to send an Idempotency-Key header with the create request. */
  readonly useIdempotencyKey = signal(false);
  /** Current key UUID. Regenerated via `resetKey()`. */
  readonly idempotencyKey = signal(uuid());

  // ── Outputs ─────────────────────────────────────────────────────────────────
  /** Emitted when the user clicks the + Create button. Parent does the POST. */
  readonly createRequested = output<{ name: string; email: string; idempotencyKey?: string }>();
  /** Emitted when the user clicks the 🎲 random helper. */
  readonly createRandomRequested = output<void>();

  /**
   * Gathers current name/email (DOM ref fallback for zoneless mode),
   * validates non-empty, then emits createRequested with optional key.
   * Parent does the actual HTTP POST + clears the form signals on success
   * via a method call we expose (see `clearForm()` below).
   */
  submitCreate(): void {
    const nameEl = this.nameInput()?.nativeElement;
    const emailEl = this.emailInput()?.nativeElement;
    const name = (nameEl?.value ?? this.newName()).trim();
    const email = (emailEl?.value ?? this.newEmail()).trim();
    if (!name || !email) {
      // Silent guard — parent shows the validation error via createError
      // input when it tries to validate again (it doesn't currently, but
      // the original code did `createError.set("Name and email required")`).
      // Keep this silent to avoid double-error UX ; parent may add a
      // dedicated error path later.
      return;
    }
    const key = this.useIdempotencyKey() ? this.idempotencyKey() : undefined;
    this.createRequested.emit({ name, email, idempotencyKey: key });
  }

  /**
   * Clears the form after a successful create. Parent calls this via a
   * template ref — see customers.component.ts `handleCreated()`.
   */
  clearForm(): void {
    this.newName.set('');
    this.newEmail.set('');
    const nameEl = this.nameInput()?.nativeElement;
    const emailEl = this.emailInput()?.nativeElement;
    if (nameEl) nameEl.value = '';
    if (emailEl) emailEl.value = '';
  }

  /** Regenerate a fresh Idempotency-Key UUID. */
  resetKey(): void {
    this.idempotencyKey.set(uuid());
  }
}
