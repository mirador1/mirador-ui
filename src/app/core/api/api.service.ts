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
}
