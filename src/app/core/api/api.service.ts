/**
 * ApiService — Central HTTP client for all backend REST endpoints.
 *
 * All requests use the dynamic base URL from `EnvService`, allowing seamless
 * environment switching (Local, Docker, Staging, Production) at runtime.
 *
 * Endpoints covered:
 * - Auth: JWT login
 * - Actuator: health, readiness, liveness, Prometheus metrics
 * - Customers: CRUD, search, sort, pagination, summary view, recent (Redis),
 *   aggregate (virtual threads), bio (Ollama LLM), todos, enrich (Kafka)
 */
import { Injectable, inject, computed } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { EnvService } from '../env/env.service';

/**
 * Full customer entity returned by `GET /customers` and write endpoints.
 * `id` and `createdAt` are absent on create payloads and present on responses.
 * `createdAt` is only included when the `X-API-Version: 2.0` header is sent.
 */
export interface Customer {
  /** Server-assigned primary key. Absent in create request bodies. */
  id?: number;
  /** Customer's full name. Required for create and update. */
  name: string;
  /** Customer's email address. Must be unique per backend validation. */
  email: string;
  /** ISO-8601 creation timestamp. Only present in v2.0 API responses. */
  createdAt?: string;
}

/**
 * Lightweight customer projection returned by `GET /customers/summary`.
 * Used in the summary view mode to reduce payload size when only id+name are needed.
 */
export interface CustomerSummary {
  /** Server-assigned primary key. */
  id: number;
  /** Customer's display name. */
  name: string;
}

/** Order lifecycle states (mirrors Java's OrderStatus enum). */
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'CANCELLED';

/**
 * Order entity returned by `GET /orders` and write endpoints.
 * Mirrors Java's `OrderDto` + Python's `OrderResponse`.
 *
 * Foundation MR : header only. OrderLine list embedded in follow-up
 * MR once OrderLine entity ships (V9 / alembic 0004).
 */
export interface Order {
  /** Server-assigned primary key. Absent in create request bodies. */
  id?: number;
  /** FK to customer. Required. */
  customerId: number;
  /** Order lifecycle state. Default PENDING on create. */
  status: OrderStatus;
  /** Sum of OrderLine.quantity × unit_price_at_order. App-managed. */
  totalAmount: number;
  /** ISO-8601 creation timestamp (response only). */
  createdAt?: string;
  /** ISO-8601 last-update timestamp (response only). */
  updatedAt?: string;
}

/** OrderLine status (mirrors Java's OrderLineStatus). PENDING → SHIPPED → REFUNDED. */
export type OrderLineStatus = 'PENDING' | 'SHIPPED' | 'REFUNDED';

/**
 * OrderLine entity returned by `GET /orders/{orderId}/lines`.
 * Mirrors Java's `OrderLineDto` + Python's `OrderLineResponse`.
 *
 * Carries quantity + a SNAPSHOT of `Product.unitPrice` at insert time.
 * The snapshot is immutable post-insert — see shared ADR-0059.
 */
export interface OrderLine {
  /** Server-assigned primary key. */
  id: number;
  /** Parent order ID. */
  orderId: number;
  /** Catalogue product ID. */
  productId: number;
  /** Strictly positive quantity. */
  quantity: number;
  /** Snapshot of Product.unitPrice at the moment of order — never mutated. */
  unitPriceAtOrder: number;
  /** Per-line status (independent of parent Order). */
  status: OrderLineStatus;
  /** ISO-8601 creation timestamp. */
  createdAt?: string;
}

/**
 * Product entity returned by `GET /products` and write endpoints.
 * Mirrors Java's `ProductDto` + Python's `ProductResponse` schemas.
 *
 * Foundation MR (2026-04-26) — entity from the e-commerce surface
 * extension (TASKS.md). Two sibling entities are coming :
 * - `Order` : FK customer_id, list of OrderLines
 * - `OrderLine` : FK order_id + product_id, quantity + unit_price_at_order
 *   (immutable price snapshot at the moment of order)
 */
export interface Product {
  /** Server-assigned primary key. Absent in create request bodies. */
  id?: number;
  /** Product name (unique across the catalogue). 1-255 chars. */
  name: string;
  /** Optional long-form description (up to 10 000 chars). */
  description?: string;
  /** Unit price as a number. Backend stores NUMERIC(12,2) — UI uses number. */
  unitPrice: number;
  /** Current stock balance. >= 0. */
  stockQuantity: number;
  /** ISO-8601 creation timestamp (response only). */
  createdAt?: string;
  /** ISO-8601 last-update timestamp (response only). */
  updatedAt?: string;
}

/**
 * Spring Data Page wrapper for paginated list responses.
 * All paginated endpoints (`/customers`, `/customers/summary`, `/audit`) return this shape.
 *
 * @template T The item type contained in the `content` array.
 */
export interface Page<T> {
  /** The items on the current page. */
  content: T[];
  /** Total number of items across all pages (used to compute page count). */
  totalElements: number;
  /** Total number of available pages given the current `size`. */
  totalPages: number;
  /** Number of items per page as requested. */
  size: number;
  /** Current zero-based page index. */
  number: number;
}

/**
 * Customer enriched via the Kafka request-reply pattern.
 * Returned by `GET /customers/{id}/enrich` which sends a message on
 * `customer.request` and awaits a reply on `customer.reply` (5s timeout → 504).
 */
export interface EnrichedCustomer {
  id: number;
  name: string;
  email: string;
  /** Computed display name added by the Kafka consumer enrichment service. */
  displayName: string;
}

/**
 * Todo item fetched from the external JSONPlaceholder API via the backend proxy.
 * Returned by `GET /customers/{id}/todos` — the customer `id` maps to the JSONPlaceholder `userId`.
 */
export interface TodoItem {
  /** JSONPlaceholder user ID (maps to customer ID in the UI). */
  userId: number;
  /** JSONPlaceholder todo item ID. */
  id: number;
  /** Todo description text. */
  title: string;
  /** Whether the todo has been marked complete in JSONPlaceholder. */
  completed: boolean;
}

/**
 * Response from `GET /customers/aggregate` which runs two tasks in parallel
 * using Java virtual threads. Demonstrates Project Loom's structured concurrency.
 */
export interface AggregatedResponse {
  /** Customer list result from the first parallel virtual thread task. */
  customerData: unknown;
  /** Statistics result from the second parallel virtual thread task. */
  stats: unknown;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly env = inject(EnvService);

  /**
   * Computed signal proxying `EnvService.baseUrl()`.
   * Exposed so components can read the current base URL reactively
   * (e.g., for constructing link hrefs in the template).
   */
  readonly baseUrl = computed(() => this.env.baseUrl());

  /** Convenience getter returning the current base URL string for use in method bodies. */
  private get url(): string {
    return this.baseUrl();
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  /**
   * Authenticate with username/password credentials.
   * Normalizes the response to handle both the current `{accessToken, refreshToken}` shape
   * and the legacy `{token}` shape from older backend versions.
   *
   * @param username Login username (default: `admin`).
   * @param password Login password (default: `admin`).
   * @returns Observable of `{accessToken, refreshToken}` on success.
   */
  login(
    username: string,
    password: string,
  ): Observable<{ accessToken: string; refreshToken: string }> {
    // Accept both new format {accessToken, refreshToken} and legacy format {token}
    return this.http
      .post<Record<string, string>>(`${this.url}/auth/login`, { username, password })
      .pipe(
        map((res) => ({
          accessToken: res['accessToken'] ?? res['token'],
          refreshToken: res['refreshToken'] ?? '',
        })),
      );
  }

  /**
   * Exchange a refresh token for a new access token + refresh token pair.
   * Called automatically by `authInterceptor` when a 401 is received.
   *
   * @param refreshToken The current refresh token from `AuthService.refreshToken()`.
   * @returns Observable of new `{accessToken, refreshToken}`.
   */
  refreshToken(refreshToken: string): Observable<{ accessToken: string; refreshToken: string }> {
    return this.http.post<{ accessToken: string; refreshToken: string }>(
      `${this.url}/auth/refresh`,
      { refreshToken },
    );
  }

  // ── Actuator ──────────────────────────────────────────────────────────────

  /**
   * Fetch the composite Spring Boot health status from `/actuator/health`.
   *
   * Spring Boot returns HTTP 503 when health status is DOWN.
   * HttpClient treats 503 as an error, but the response body still contains
   * the composite health JSON (status + components). We catch HTTP errors
   * that have a JSON body and return them as successful values so the
   * dashboard can display "DOWN" with component details instead of "UNREACHABLE".
   *
   * @returns Observable of the raw health JSON (shape: `{status, components}`).
   */
  getHealth(): Observable<unknown> {
    return this.http
      .get(`${this.url}/actuator/health`)
      .pipe(catchError((err) => (err.error?.status ? of(err.error) : throwError(() => err))));
  }
  /**
   * Fetch Kubernetes readiness probe from `/actuator/health/readiness`.
   * Same 503→200 normalization as `getHealth()`.
   *
   * @returns Observable of the readiness health JSON.
   */
  getReadiness(): Observable<unknown> {
    return this.http
      .get(`${this.url}/actuator/health/readiness`)
      .pipe(catchError((err) => (err.error?.status ? of(err.error) : throwError(() => err))));
  }

  /**
   * Fetch Kubernetes liveness probe from `/actuator/health/liveness`.
   * Same 503→200 normalization as `getHealth()`.
   *
   * @returns Observable of the liveness health JSON.
   */
  getLiveness(): Observable<unknown> {
    return this.http
      .get(`${this.url}/actuator/health/liveness`)
      .pipe(catchError((err) => (err.error?.status ? of(err.error) : throwError(() => err))));
  }

  /**
   * Fetch the raw Prometheus text exposition from `/actuator/prometheus`.
   * Returns plain text (not JSON). Kept because health / quality views still
   * surface the endpoint; the former in-UI parser (`MetricsService`) was
   * retired in ADR-0007 in favour of Grafana.
   *
   * @returns Observable of the raw Prometheus scrape text.
   */
  getPrometheusMetrics(): Observable<string> {
    return this.http.get(`${this.url}/actuator/prometheus`, { responseType: 'text' });
  }

  /** Get the first available customer ID (for endpoints that need a valid ID) */
  getFirstCustomerId(): Observable<number> {
    return this.getCustomers(0, 1).pipe(
      map((page) => page.content[0]?.id ?? 1),
      catchError(() => of(1)),
    );
  }

  // ── Customers ─────────────────────────────────────────────────────────────
  /** Fetch paginated customers with optional search, sort, and API version header */
  getCustomers(
    page = 0,
    size = 10,
    version = '1.0',
    search?: string,
    sort?: string,
  ): Observable<Page<Customer>> {
    let params = new HttpParams().set('page', page.toString()).set('size', size.toString());
    if (search) params = params.set('search', search);
    if (sort) params = params.set('sort', sort);
    return this.http.get<Page<Customer>>(`${this.url}/customers`, {
      headers: new HttpHeaders({ 'X-API-Version': version }),
      params,
    });
  }

  /**
   * Fetch a lightweight customer summary page (id + name only).
   * Used by the "Summary mode" toggle in the Customers page to reduce payload size.
   *
   * @param page Zero-based page index. Defaults to 0.
   * @param size Items per page. Defaults to 20.
   * @returns Observable of a paginated `CustomerSummary` list.
   */
  getCustomerSummary(page = 0, size = 20): Observable<Page<CustomerSummary>> {
    return this.http.get<Page<CustomerSummary>>(`${this.url}/customers/summary`, {
      params: { page: page.toString(), size: size.toString() },
    });
  }

  /** Fetch last 10 created customers from the Redis ring buffer */
  getRecentCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.url}/customers/recent`);
  }

  /**
   * Call `/customers/aggregate` which executes two tasks in parallel via Java virtual threads.
   * Used by the Customers page to demonstrate Project Loom structured concurrency.
   *
   * @returns Observable of the aggregated response with `customerData` and `stats`.
   */
  getAggregate(): Observable<AggregatedResponse> {
    return this.http.get<AggregatedResponse>(`${this.url}/customers/aggregate`);
  }

  /** Create a customer; optional idempotency key prevents duplicate creation */
  createCustomer(
    payload: { name: string; email: string },
    idempotencyKey?: string,
  ): Observable<Customer> {
    let headers = new HttpHeaders();
    if (idempotencyKey) {
      headers = headers.set('Idempotency-Key', idempotencyKey);
    }
    return this.http.post<Customer>(`${this.url}/customers`, payload, { headers });
  }

  /**
   * Update an existing customer's name and email.
   *
   * @param id      The customer's primary key.
   * @param payload New name and email values (both required).
   * @returns Observable of the updated `Customer` entity.
   */
  updateCustomer(id: number, payload: { name: string; email: string }): Observable<Customer> {
    return this.http.put<Customer>(`${this.url}/customers/${id}`, payload);
  }

  /**
   * Delete a customer by ID.
   *
   * @param id The customer's primary key.
   * @returns Observable<void> — completes on 204 No Content.
   */
  deleteCustomer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/customers/${id}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Product API — added 2026-04-26 (foundation MR — list/get/create/delete).
  // ─────────────────────────────────────────────────────────────────────────

  /** Paginated list of products. Page is 0-indexed. */
  listProducts(page = 0, size = 20): Observable<Page<Product>> {
    const params = new HttpParams().set('page', String(page)).set('size', String(size));
    return this.http.get<Page<Product>>(`${this.url}/products`, { params });
  }

  /** Get a product by ID. Returns 404 → caller handles via catchError. */
  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.url}/products/${id}`);
  }

  /** Create a product. 409 if name conflicts. */
  createProduct(payload: {
    name: string;
    description?: string;
    unitPrice: number;
    stockQuantity: number;
  }): Observable<Product> {
    return this.http.post<Product>(`${this.url}/products`, payload);
  }

  /**
   * Update a product. 404 if absent.
   * Per ADR-0059, modifying unitPrice does NOT affect existing OrderLines —
   * those carry an immutable snapshot.
   */
  updateProduct(
    id: number,
    payload: {
      name: string;
      description?: string;
      unitPrice: number;
      stockQuantity: number;
    },
  ): Observable<Product> {
    return this.http.put<Product>(`${this.url}/products/${id}`, payload);
  }

  /** Delete a product by ID. Returns 204 on success, 404 if absent. */
  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/products/${id}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Order API — added 2026-04-26 (foundation MR — list/get/create/delete).
  // ─────────────────────────────────────────────────────────────────────────

  /** Paginated list of orders, newest first. */
  listOrders(page = 0, size = 20): Observable<Page<Order>> {
    const params = new HttpParams().set('page', String(page)).set('size', String(size));
    return this.http.get<Page<Order>>(`${this.url}/orders`, { params });
  }

  /** Get an order by ID (header only — lines fetched separately). */
  getOrder(id: number): Observable<Order> {
    return this.http.get<Order>(`${this.url}/orders/${id}`);
  }

  /** Create an empty order attached to a customer. Lines added via separate endpoints. */
  createOrder(payload: { customerId: number }): Observable<Order> {
    return this.http.post<Order>(`${this.url}/orders`, payload);
  }

  /** Delete an order by ID. CASCADE removes its lines. */
  deleteOrder(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/orders/${id}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OrderLine API — nested under /orders/{orderId}/lines (foundation MR).
  // ─────────────────────────────────────────────────────────────────────────

  /** List all lines of an order, oldest first. */
  listOrderLines(orderId: number): Observable<OrderLine[]> {
    return this.http.get<OrderLine[]>(`${this.url}/orders/${orderId}/lines`);
  }

  /** Add a line to an order — backend snapshots Product.unitPrice + recomputes Order.total. */
  addOrderLine(
    orderId: number,
    payload: { productId: number; quantity: number },
  ): Observable<OrderLine> {
    return this.http.post<OrderLine>(`${this.url}/orders/${orderId}/lines`, payload);
  }

  /** Delete a line — backend recomputes Order.total. "Cancel" semantics in foundation. */
  deleteOrderLine(orderId: number, lineId: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/orders/${orderId}/lines/${lineId}`);
  }

  /** Generate a customer bio using Ollama LLM (may be slow ~500ms+) */
  getCustomerBio(id: number): Observable<{ bio: string }> {
    return this.http.get<{ bio: string }>(`${this.url}/customers/${id}/bio`);
  }

  /**
   * Fetch todos for a customer from the external JSONPlaceholder API via the backend proxy.
   * The backend maps the customer ID to a JSONPlaceholder userId and proxies the response.
   *
   * @param id Customer primary key.
   * @returns Observable of the todo list.
   */
  getCustomerTodos(id: number): Observable<TodoItem[]> {
    return this.http.get<TodoItem[]>(`${this.url}/customers/${id}/todos`);
  }

  /** Enrich customer via Kafka request-reply (5s timeout, returns 504 on timeout) */
  enrichCustomer(id: number): Observable<EnrichedCustomer> {
    return this.http.get<EnrichedCustomer>(`${this.url}/customers/${id}/enrich`);
  }

  /**
   * Trigger a Chaos Mesh experiment via the backend ChaosController.
   * ADMIN-only — the backend enforces it with `@PreAuthorize("hasRole('ADMIN')")`.
   *
   * The backend creates a PodChaos / NetworkChaos / StressChaos custom
   * resource in the `app` namespace with a unique timestamped name. Chaos
   * Mesh auto-deletes it after the declared duration.
   *
   * @param slug one of `'pod-kill'`, `'network-delay'`, `'cpu-stress'`
   * @returns Observable emitting the created CR name + metadata, or
   *          throwing an HttpErrorResponse with status:
   *          - 400 — unknown slug (should not happen with the typed enum)
   *          - 403 — not ADMIN
   *          - 503 — Chaos Mesh CRDs not installed on this cluster
   *          - 500 — other Kubernetes API failure (RBAC, conflict…)
   */
  triggerChaosExperiment(slug: 'pod-kill' | 'network-delay' | 'cpu-stress'): Observable<{
    experiment: string;
    kind: string;
    customResourceName: string;
    duration: string;
    status: string;
  }> {
    return this.http.post<{
      experiment: string;
      kind: string;
      customResourceName: string;
      duration: string;
      status: string;
    }>(`${this.url}/chaos/${slug}`, {});
  }
}
