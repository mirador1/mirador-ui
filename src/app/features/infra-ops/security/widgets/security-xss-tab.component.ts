/**
 * SecurityXssTabComponent — Cross-Site Scripting demo (OWASP A07).
 *
 * Form field `name` two-way bound via `model<>()`. Vulnerable output
 * rendered in a sandboxed iframe ; safe output via Angular's
 * DomSanitizer (parent passes safe HTML as input).
 *
 * Extracted from security.component.html per Phase B-7-4 batch, 2026-04-24.
 */
import { Component, input, model, output } from '@angular/core';
import { SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-security-xss-tab',
  standalone: true,
  styleUrl: '../security.component.scss',
  template: `
    <div class="tab-content">
      <div class="explanation-card warn">
        <strong>⚠️ Cross-Site Scripting (OWASP A07)</strong> — Unescaped user input is injected into
        HTML output, allowing an attacker to execute arbitrary JavaScript in the victim's browser.
        The vulnerable endpoint echoes input raw. The safe endpoint uses
        <code>HtmlUtils.htmlEscape()</code> — special characters become <code>&lt;</code>,
        <code>&gt;</code>, etc. Angular also applies <code>DomSanitizer</code> on rendered HTML.
      </div>

      <div class="input-row">
        <label class="input-label">Name parameter</label>
        <input
          type="text"
          class="demo-input"
          [value]="name()"
          (input)="name.set($any($event.target).value)"
        />
        <div class="preset-row">
          <span class="preset-label">Presets:</span>
          <button class="preset-btn" (click)="name.set(presetImgOnerror)">img onerror</button>
          <button class="preset-btn" (click)="name.set(presetScriptTag)">script tag</button>
          <button class="preset-btn" (click)="name.set(presetHtmlFormat)">HTML formatting</button>
          <button class="preset-btn" (click)="name.set('Alice')">Normal name</button>
        </div>
      </div>

      <div class="action-row">
        <button class="btn btn-danger" [disabled]="loading()" (click)="runVulnerable.emit()">
          💉 Vulnerable
        </button>
        <button class="btn btn-success" [disabled]="loading()" (click)="runSafe.emit()">
          🛡️ Safe
        </button>
      </div>

      @if (errorMsg()) {
        <div class="error-banner">{{ errorMsg() }}</div>
      }

      @if (mode() === 'vulnerable' && vulnHtml()) {
        <div class="result-card danger">
          <h3>
            Vulnerable output
            <span class="mode-badge mode-danger">RAW HTML in sandboxed iframe</span>
          </h3>
          <p class="hint">
            The iframe below renders the unescaped server response. Scripts are blocked by the
            <code>sandbox</code> attribute, but in a real browser without sandbox they would
            execute.
          </p>
          <iframe
            class="xss-frame"
            [srcdoc]="vulnHtml()!"
            sandbox=""
            title="Vulnerable XSS output"
          ></iframe>
          <h4>Raw HTML from server</h4>
          <pre class="code-block small">{{ vulnHtml() }}</pre>
        </div>
      }

      @if (mode() === 'safe' && safeHtml()) {
        <div class="result-card safe">
          <h3>Safe output <span class="mode-badge mode-safe">HTML-encoded</span></h3>
          <p class="hint">
            The server returned HTML-encoded output. Angular also sanitises via DomSanitizer.
            Special characters are rendered as text, not executed.
          </p>
          <div class="safe-preview" [innerHTML]="safeHtml()"></div>
          <h4>Raw HTML from server</h4>
          <pre class="code-block small">{{ safeRaw() }}</pre>
        </div>
      }
    </div>
  `,
})
export class SecurityXssTabComponent {
  readonly name = model<string>('Alice');
  readonly loading = input<boolean>(false);
  readonly errorMsg = input<string>('');
  /** Which mode the parent last ran : 'vulnerable' / 'safe' / null (no run yet). */
  readonly mode = input<'vulnerable' | 'safe' | null>(null);
  /** Raw HTML from vulnerable endpoint, for iframe srcdoc. */
  readonly vulnHtml = input<string | null>(null);
  /** Sanitised HTML from safe endpoint (Angular SafeHtml token). */
  readonly safeHtml = input<SafeHtml | null>(null);
  /** Raw text version of safe endpoint response (for pre-block display). */
  readonly safeRaw = input<string>('');

  readonly runVulnerable = output<void>();
  readonly runSafe = output<void>();

  /**
   * Preset payloads — hoisted to TS constants because Angular's template
   * parser chokes on escaped backticks (`\``) inside an inline template
   * literal. Same fix as SqliTab.
   */
  readonly presetImgOnerror = "<img src=x onerror=alert('XSS')>";
  readonly presetScriptTag = "<script>alert('XSS')</script>";
  readonly presetHtmlFormat = '<b>Bold</b> &amp; <i>italic</i>';
}
