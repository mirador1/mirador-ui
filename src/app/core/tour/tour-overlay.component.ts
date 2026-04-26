/**
 * TourOverlayComponent — renders the active tour step over the app.
 *
 * Two visual modes:
 *   1. Anchored  — `step.targetSelector` resolves to an element in the DOM.
 *                  We draw a CSS-ring highlight around it and place the
 *                  tooltip according to `step.position` (default: bottom).
 *   2. Centred   — `step.targetSelector` is `null` or doesn't resolve. The
 *                  tooltip renders as a centred modal (welcome + closing
 *                  card, or degraded fallback if the target isn't mounted
 *                  on the active route).
 *
 * Positioning strategy: we read the target's bounding rect on step enter
 * (or window resize) via `getBoundingClientRect` + CSS `position: fixed`.
 * Simpler than @angular/cdk Overlay and good enough — this is a tutorial
 * walkthrough, not a live-data popover. Keyboard: Esc ends, ← and → navigate.
 */
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { TourService } from './tour.service';

/**
 * Per-step position + rect computed from the resolved target element.
 * `null` means the step renders centred (welcome / closing / no target).
 */
interface StepPlacement {
  readonly tooltipTop: number;
  readonly tooltipLeft: number;
  readonly ringTop: number;
  readonly ringLeft: number;
  readonly ringWidth: number;
  readonly ringHeight: number;
  readonly arrow: 'top' | 'bottom' | 'left' | 'right';
}

@Component({
  standalone: true,
  selector: 'app-tour-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Kept inline so the overlay is self-contained — this is a narrow util
  // that's always mounted once, it doesn't need a separate template file.
  template: `
    @if (service.isActive() && service.currentStep(); as step) {
      <!-- Full-screen backdrop; click to dismiss. aria-hidden so the screen
           reader focuses on the card only, not the dim layer. -->
      <div class="tour-backdrop" (click)="service.end()" aria-hidden="true"></div>

      <!-- Highlight ring — rendered only when we resolved the target rect. -->
      @if (placement(); as p) {
        <div
          class="tour-ring"
          [style.top.px]="p.ringTop"
          [style.left.px]="p.ringLeft"
          [style.width.px]="p.ringWidth"
          [style.height.px]="p.ringHeight"
          aria-hidden="true"
        ></div>
      }

      <!-- The card itself — either anchored to a target or centred. -->
      <div
        class="tour-card"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="step.title"
        [class.tour-card-centred]="!placement()"
        [style.top.px]="placement()?.tooltipTop ?? null"
        [style.left.px]="placement()?.tooltipLeft ?? null"
      >
        <h3>{{ step.title }}</h3>
        <p>{{ step.body }}</p>
        <div class="tour-nav">
          <span class="tour-progress" aria-live="polite">
            {{ (service.stepIndex() ?? 0) + 1 }} / {{ service.steps().length }}
          </span>
          <div class="tour-actions">
            <button type="button" class="tour-btn" (click)="service.end()">Skip</button>
            <button
              type="button"
              class="tour-btn"
              (click)="service.prev()"
              [disabled]="service.isFirstStep()"
            >
              ← Prev
            </button>
            <button type="button" class="tour-btn tour-btn-primary" (click)="service.next()">
              {{ service.isLastStep() ? 'Done' : 'Next →' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './tour-overlay.component.scss',
})
export class TourOverlayComponent {
  readonly service = inject(TourService);
  private readonly destroyRef = inject(DestroyRef);

  /** Resolved placement for the current step. `null` = render centred. */
  readonly placement = signal<StepPlacement | null>(null);

  constructor() {
    // Recompute placement whenever the step changes. Using `effect` over a
    // computed signal because we need the DOM to be painted before calling
    // getBoundingClientRect — a requestAnimationFrame ensures that.
    effect(() => {
      const step = this.service.currentStep();
      if (!step || !step.targetSelector) {
        this.placement.set(null);
        return;
      }
      // One frame later → Angular has applied any class/template changes
      // that may have caused the target to re-render.
      requestAnimationFrame(() => this.placement.set(this.computePlacement()));
    });

    // Keep the ring + tooltip aligned when the user resizes or scrolls
    // (e.g. expanding the sidebar while the tour is active — the sidebar
    // step's target widens and the ring must follow).
    fromEvent(window, 'resize')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.service.isActive()) this.placement.set(this.computePlacement());
      });
  }

  /** Esc closes, arrow keys navigate — global shortcuts while tour is up. */
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (!this.service.isActive()) return;
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.service.end();
        break;
      case 'ArrowRight':
      case 'Enter':
        event.preventDefault();
        this.service.next();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.service.prev();
        break;
      default:
        // no-op — let other shortcuts (Ctrl+K, D) keep working while the
        // tour is up so the user can explore what the step describes.
        break;
    }
  }

  /**
   * Resolve the current step's target element via CSS selector and compute
   * the pixel coordinates of the highlight ring + the tooltip. Returns
   * `null` if the target isn't in the DOM (e.g. user navigated away),
   * which makes the template fall back to centred rendering.
   */
  private computePlacement(): StepPlacement | null {
    const step = this.service.currentStep();
    if (!step || !step.targetSelector) return null;

    const el = document.querySelector(step.targetSelector);
    if (!(el instanceof HTMLElement)) return null;

    const rect = el.getBoundingClientRect();
    // 6 px breathing room between the ring and the target's actual edge.
    const padding = 6;
    const ringTop = rect.top - padding;
    const ringLeft = rect.left - padding;
    const ringWidth = rect.width + padding * 2;
    const ringHeight = rect.height + padding * 2;

    // Tooltip position — adjacent to the ring in the requested direction.
    // Width 360px (matches .tour-card max-width). We compute the raw
    // position then CLAMP both axes so the card never exits the viewport.
    // Without clamp, a target close to the right/bottom edge (e.g. the
    // search button on the topbar's right) places the tooltip off-screen.
    const gap = 14;
    const cardWidth = 360;
    const cardHeight = 160; // approximate ; CSS clamps height to content
    const margin = 16; // breathing room from viewport edges
    const position = step.position ?? 'bottom';
    let tooltipTop: number;
    let tooltipLeft: number;
    switch (position) {
      case 'top':
        tooltipTop = ringTop - gap - cardHeight;
        tooltipLeft = ringLeft;
        break;
      case 'bottom':
        tooltipTop = ringTop + ringHeight + gap;
        tooltipLeft = ringLeft;
        break;
      case 'left':
        tooltipTop = ringTop;
        tooltipLeft = ringLeft - gap - cardWidth;
        break;
      case 'right':
        tooltipTop = ringTop;
        tooltipLeft = ringLeft + ringWidth + gap;
        break;
    }

    // Clamp to viewport. `Math.max(margin, …)` keeps the card from going
    // off the LEFT/TOP edges ; `Math.min(maxLeft/maxTop, …)` keeps it
    // from leaving the RIGHT/BOTTOM. The ring stays anchored to the real
    // target — only the tooltip card moves.
    const maxLeft = window.innerWidth - cardWidth - margin;
    const maxTop = window.innerHeight - cardHeight - margin;
    tooltipLeft = Math.max(margin, Math.min(tooltipLeft, maxLeft));
    tooltipTop = Math.max(margin, Math.min(tooltipTop, maxTop));

    return {
      tooltipTop,
      tooltipLeft,
      ringTop,
      ringLeft,
      ringWidth,
      ringHeight,
      arrow: position,
    };
  }
}
