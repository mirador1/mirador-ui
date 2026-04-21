/**
 * InfoTipComponent — Contextual tooltip popover.
 *
 * Displays an "i" icon that shows a popup on hover or click with:
 * - Optional title (bold header)
 * - Text body — automatically formatted:
 *     * single paragraph          → plain line
 *     * contains `\n`             → each line becomes its own block
 *     * lines like `Label: value` → rendered as a definition list with
 *       bold key + monospace value, aligned in two columns. Makes the old
 *       "Heap: jvm_memory_used_bytes / jvm_memory_max_bytes. CPU: ..." wall
 *       of prose readable.
 *     * lines starting with `-` or `•` → bullet list
 * - Optional command (monospace code block)
 * - Optional source attribution (italic footer)
 *
 * Used throughout the app to provide inline documentation for metrics,
 * features, and configuration values without cluttering the UI.
 */
import { Component, Input, signal, ElementRef, inject, computed } from '@angular/core';

/** One rendered entry inside the popup body. */
interface TipLine {
  /** Line type — controls which template block renders it. */
  readonly kind: 'kv' | 'bullet' | 'text';
  /** For kv: the key (left column). For bullet/text: the full line. */
  readonly key: string;
  /** For kv: the value (right column). Empty for bullet/text. */
  readonly value: string;
}

@Component({
  selector: 'app-info-tip',
  standalone: true,
  template: `
    <span
      class="info-trigger"
      role="button"
      tabindex="0"
      [attr.aria-label]="title ? 'Info: ' + title : 'Info'"
      [attr.aria-expanded]="open() || hover()"
      (click)="open.set(!open())"
      (keydown.enter)="open.set(!open()); $event.preventDefault()"
      (keydown.space)="open.set(!open()); $event.preventDefault()"
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
          <div class="info-body">
            @for (line of parsedLines(); track $index) {
              @switch (line.kind) {
                @case ('kv') {
                  <div class="info-kv">
                    <span class="info-kv-key">{{ line.key }}</span>
                    <span class="info-kv-value">{{ line.value }}</span>
                  </div>
                }
                @case ('bullet') {
                  <div class="info-bullet">• {{ line.key }}</div>
                }
                @default {
                  <div class="info-text">{{ line.key }}</div>
                }
              }
            }
          </div>
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
        min-width: 240px;
        max-width: 360px;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        animation: fade-in 0.15s ease-out;

        &.info-wide {
          min-width: 320px;
          max-width: 480px;
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
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.78rem;
        color: var(--text-secondary);
        line-height: 1.4;
      }

      /* Plain paragraph line */
      .info-text {
        /* Default styling inherited from .info-body. */
      }

      /* Bullet-list item */
      .info-bullet {
        padding-left: 0.35rem;
      }

      /* key-value row — bold key on the left, value on the right,
       * values wrap cleanly via the flex layout. A min-width on the key
       * prevents long values from pushing short keys around. */
      .info-kv {
        display: flex;
        gap: 0.5rem;
        align-items: baseline;
      }

      .info-kv-key {
        flex-shrink: 0;
        font-weight: 600;
        color: var(--text-primary);
        min-width: 3.5rem;
        max-width: 8rem;
      }

      .info-kv-value {
        flex: 1 1 auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.72rem;
        word-break: break-word;
        color: var(--text-secondary);
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

  /** Required. Main explanation text shown in the popup body.
   *  Auto-formatting:
   *    - lines starting with `-` or `•`        → bullet list
   *    - lines matching /^[\w.\s/-]{1,30}:\s/   → key-value row (two columns)
   *    - everything else                        → plain text line
   *  Separate lines with `\n` OR `. ` when you want the auto-splitter to run
   *  on a single-line string (e.g. prose-style "Heap: X. CPU: Y. Threads: Z.").
   */
  @Input() text = '';

  /** Optional bold header displayed above the body text. */
  @Input() title = '';

  /** Optional monospace code block shown below the body (e.g., a CLI command). */
  @Input() command = '';

  /** Optional italic attribution footer (e.g., the documentation source). */
  @Input() source = '';

  /** Optional image URL shown at the top of the popup (e.g., a tool screenshot). */
  @Input() image = '';

  /**
   * When true, the popup uses a wider min/max width (320–480px vs 240–360px).
   * Set this for popups with long text or an image to prevent wrapping.
   */
  @Input() wide = false;

  /**
   * Signal: true when the user has clicked the icon (click-to-pin behavior).
   * Keeps the popup open until the user clicks again.
   */
  open = signal(false);

  /**
   * Signal: true while the mouse is hovering over the icon.
   * Set in `onEnter()` and cleared on `mouseleave`.
   */
  hover = signal(false);

  /**
   * Signal: true when the popup should appear below the icon instead of above.
   * Set based on the icon's viewport position to prevent the popup from
   * being clipped by the top edge of the viewport.
   */
  showBelow = signal(false);

  /**
   * Parsed view of `text` as a list of TipLine rows.
   * Split strategy:
   *   1. If text contains `\n`, split on newlines.
   *   2. Otherwise, heuristic split on ". " boundaries BETWEEN `Label: value`
   *      pairs — this rescues legacy dashboards that built one-line prose
   *      like "Heap: X / Y. CPU: Z. Threads: W.".
   * Each line is then classified as kv | bullet | text.
   */
  parsedLines = computed<TipLine[]>(() => {
    const raw = (this.text || '').trim();
    if (!raw) return [];

    const segments = raw.includes('\n')
      ? raw.split(/\r?\n/)
      : InfoTipComponent.splitPseudoSentences(raw);

    return segments
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((segment) => InfoTipComponent.classify(segment));
  });

  /**
   * Split a single-line prose string into logical segments when it contains
   * multiple `Label:` markers. "Heap: X / Y. CPU: Z. Threads: W." → 3 chunks.
   * Falls back to [raw] if the string has 0 or 1 label marker.
   */
  private static splitPseudoSentences(raw: string): string[] {
    // `;` and `/` don't need to be escaped in regex literals or character
    // classes; ESLint `no-useless-escape` flags them. `-` at the end of
    // a character class is a literal hyphen, no escape needed either.
    const labelMatches = [...raw.matchAll(/(?:^|\.\s+|;\s+)([\w][\w ./-]{0,28}):\s/g)];
    if (labelMatches.length < 2) return [raw];

    const chunks: string[] = [];
    for (let i = 0; i < labelMatches.length; i++) {
      const start = labelMatches[i].index ?? 0;
      const end =
        i + 1 < labelMatches.length ? (labelMatches[i + 1].index ?? raw.length) : raw.length;
      let chunk = raw
        .slice(start, end)
        .replace(/^[.\s;]+/, '')
        .trim();
      // Strip trailing period + space left over from the split boundary.
      chunk = chunk.replace(/[.\s;]+$/, '');
      if (chunk) chunks.push(chunk);
    }
    return chunks;
  }

  /**
   * Classify one trimmed segment into kv | bullet | text.
   * - Bullet: starts with `-`, `•`, or `*` followed by whitespace.
   * - kv: starts with a short label (≤30 chars of word/dot/slash/space/dash)
   *       then `:` + whitespace + any value. Longer labels mean it's prose.
   * - text: everything else.
   */
  private static classify(segment: string): TipLine {
    // `-` at start of a character class is a literal hyphen, no escape
    // needed (`[-•*]` is identical to `[\-•*]`).
    const bulletMatch = /^[-•*]\s+(.*)$/.exec(segment);
    if (bulletMatch) {
      return { kind: 'bullet', key: bulletMatch[1], value: '' };
    }

    // Same `/` + `-` escaping cleanup as the matcher above.
    const kvMatch = /^([\w][\w ./-]{0,28}):\s+(.+)$/.exec(segment);
    if (kvMatch) {
      return { kind: 'kv', key: kvMatch[1].trim(), value: kvMatch[2].trim() };
    }

    return { kind: 'text', key: segment, value: '' };
  }

  /**
   * Handle mouse-enter: compute viewport position and update `showBelow`,
   * then set `hover` to true to show the popup.
   * If the icon is in the top 250px of the viewport, the popup opens below to avoid clipping.
   */
  onEnter(): void {
    const rect = this.el.nativeElement.getBoundingClientRect();
    this.showBelow.set(rect.top < 250);
    this.hover.set(true);
  }
}
