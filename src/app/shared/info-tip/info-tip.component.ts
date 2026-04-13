import { Component, Input, signal } from '@angular/core';

@Component({
  selector: 'app-info-tip',
  standalone: true,
  template: `
    <span class="info-trigger" (click)="open.set(!open())" (mouseenter)="hover.set(true)" (mouseleave)="hover.set(false)">
      <span class="info-icon">i</span>
      @if (open() || hover()) {
        <span class="info-popup" [class.info-wide]="wide">
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
  styles: [`
    :host { display: inline-block; position: relative; }

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

      &:hover { opacity: 1; }
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

      &.info-wide { min-width: 300px; max-width: 420px; }

      &::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: var(--border-default);
      }
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
      from { opacity: 0; transform: translateX(-50%) translateY(4px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `]
})
export class InfoTipComponent {
  @Input() text = '';
  @Input() title = '';
  @Input() command = '';
  @Input() source = '';
  @Input() wide = false;

  open = signal(false);
  hover = signal(false);
}
