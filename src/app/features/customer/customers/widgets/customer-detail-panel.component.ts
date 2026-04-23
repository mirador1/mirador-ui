/**
 * CustomerDetailPanelComponent — the 3-tab detail panel shown when the
 * user clicks a row in the customer list.
 *
 * Tabs :
 *  - Bio     : Ollama LLM bio generation + circuit breaker narrative
 *  - Todos   : JSONPlaceholder external API via @HttpExchange + retry
 *  - Enrich  : Kafka request/reply demo via ReplyingKafkaTemplate
 *
 * Pure presentational widget : all state + fetching lives in the parent
 * CustomersComponent ; the widget emits `tabChanged` and `closeRequested`
 * events. Parent decides which tab to activate + what data to load.
 *
 * Extracted from customers.component.html (lines 322-491 pre-extraction)
 * per B-7-2b follow-up, 2026-04-23.
 */
import { Component, input, output } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { InfoTipComponent } from '../../../../shared/info-tip/info-tip.component';
import type { Customer, TodoItem, EnrichedCustomer } from '../../../../core/api/api.service';
import type { DetailTab } from '../customers-types';

@Component({
  selector: 'app-customer-detail-panel',
  standalone: true,
  imports: [JsonPipe, InfoTipComponent],
  styleUrl: '../customers.component.scss',
  templateUrl: './customer-detail-panel.component.html',
})
export class CustomerDetailPanelComponent {
  /** The customer whose detail is shown. Null = no panel. */
  readonly selectedCustomer = input<Customer | null>(null);
  /** Which tab is currently active. */
  readonly activeTab = input<DetailTab>('bio');
  /** Is the Bio tab available (Unleash flag gate) ? */
  readonly bioEnabled = input<boolean>(true);
  /** True while the parent's HTTP fetch is in flight. */
  readonly detailLoading = input<boolean>(false);
  /** Non-empty = show the error banner. */
  readonly detailError = input<string>('');
  /** Bio text from /customers/{id}/bio (null while loading / no data). */
  readonly bio = input<string | null>(null);
  /** Todo list from /customers/{id}/todos (null while loading / no data). */
  readonly todos = input<TodoItem[] | null>(null);
  /** Enriched customer payload from /customers/{id}/enrich. */
  readonly enriched = input<EnrichedCustomer | null>(null);

  /** Emitted when the user clicks a tab button ; parent updates activeTab. */
  readonly tabChanged = output<DetailTab>();
  /** Emitted when the user clicks the ✕ Close button. */
  readonly closeRequested = output<void>();
}
