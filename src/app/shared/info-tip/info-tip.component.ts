/**
 * InfoTipComponent — Contextual tooltip popover.
 *
 * Displays an "i" icon that shows a popup on hover or click with:
 * - Optional title (bold header)
 * - Text body (main explanation)
 * - Optional command (monospace code block)
 * - Optional source attribution (italic footer)
 *
 * Used throughout the app to provide inline documentation for metrics,
 * features, and configuration values without cluttering the UI.
 */
import { Component, Input, signal, ElementRef, inject } from '@angular/core';

@Component({
  selector: 'app-info-tip',
  standalone: true,
  template: `
    <span
      class="info-trigger"
      (click)="open.set(!open())"
      (mouseenter)="onEnter()"
      (mouseleave)="hover.set(false)"
    >
      <span class="info-icon">i</span>
      @if (open() || hover()) {
        <span class="info-popup" [class.info-wide]="wide || image" [class.info-below]="showBelow()">
          @if (image) {
            <img class="info-image" [src]="image" [alt]="title || 'Preview'" loading="lazy" />
          }
          @if (title) {
            <strong class="info-title">{{ title }}</strong>
          }
          <span class="info-body">{{ text }}</span>
          @if (command) {
            <code class="info-command">{{ command }}</code>
          }
          @if (source) {
            <span class="info-source">Source: {{ source }}</span>
          }
        </span>
      }
    </span>
  `,
  styles: [
    `
      :host {
        display: inline-block;
        position: relative;
      }

      .info-trigger {
        position: relative;
        cursor: help;
        display: inline-flex;
        align-items: center;
      }

      .info-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        text-transform: none;
        letter-spacing: normal;
        border-radius: 50%;
        background: var(--color-accent);
        color: white;
        font-size: 0.6rem;
        font-weight: 800;
        font-style: italic;
        font-family: Georgia, serif;
        flex-shrink: 0;
        opacity: 0.7;
        transition: opacity 0.15s;

        &:hover {
          opacity: 1;
        }
      }

      .info-popup {
        position: absolute;
        bottom: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        text-transform: none;
        letter-spacing: normal;
        font-weight: normal;
        background: var(--bg-card);
        border: 1px solid var(--border-default);
        border-radius: 8px;
        padding: 0.65rem 0.85rem;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
        z-index: 500;
        min-width: 220px;
        max-width: 320px;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        animation: fade-in 0.15s ease-out;

        &.info-wide {
          min-width: 300px;
          max-width: 440px;
        }

        &::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: var(--border-default);
        }

        &.info-below {
          bottom: auto;
          top: calc(100% + 8px);

          &::after {
            top: auto;
            bottom: 100%;
            border-top-color: transparent;
            border-bottom-color: var(--border-default);
          }
        }
      }

      .info-image {
        width: 100%;
        border-radius: 4px;
        border: 1px solid var(--border-default);
        max-height: 180px;
        object-fit: cover;
        object-position: top left;
      }

      .info-title {
        font-size: 0.82rem;
        color: var(--text-primary);
        display: block;
      }

      .info-body {
        font-size: 0.78rem;
        color: var(--text-secondary);
        line-height: 1.4;
      }

      .info-command {
        display: block;
        font-size: 0.72rem;
        font-family: monospace;
        background: var(--bg-terminal);
        color: #86efac;
        padding: 0.3rem 0.5rem;
        border-radius: 4px;
        margin-top: 0.15rem;
        word-break: break-all;
      }

      .info-source {
        font-size: 0.65rem;
        color: var(--text-muted);
        font-style: italic;
      }

      @keyframes fade-in {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(4px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
    `,
  ],
})
export class InfoTipComponent {
  private readonly el = inject(ElementRef);

  @Input() text = '';
  @Input() title = '';
  @Input() command = '';
  @Input() source = '';
  @Input() image = '';
  @Input() wide = false;

  open = signal(false);
  hover = signal(false);
  showBelow = signal(false);

  onEnter(): void {
    // If the element is in the top 250px of the viewport, show popup below instead of above
    const rect = this.el.nativeElement.getBoundingClientRect();
    this.showBelow.set(rect.top < 250);
    this.hover.set(true);
  }
}
