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

/** Full customer entity returned by the API */
export interface Customer {
  id?: number;
  name: string;
  email: string;
  createdAt?: string;
}

/** Lightweight projection (id + name only) used in summary view */
export interface CustomerSummary {
  id: number;
  name: string;
}

/** Spring Data Page wrapper for paginated responses */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

/** Customer enriched via Kafka request-reply pattern */
export interface EnrichedCustomer {
  id: number;
  name: string;
  email: string;
  displayName: string;
}

/** Todo item from external JSONPlaceholder API, linked to a customer */
export interface TodoItem {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
}

/** Response from /customers/aggregate — two parallel virtual thread tasks */
export interface AggregatedResponse {
  customerData: unknown;
  stats: unknown;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly env = inject(EnvService);
  readonly baseUrl = computed(() => this.env.baseUrl());

  private get url(): string {
    return this.baseUrl();
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  login(
    username: string,
    password: string,
  ): Observable<{ accessToken: string; refreshToken: string }> {
    return this.http.post<{ accessToken: string; refreshToken: string }>(`${this.url}/auth/login`, {
      username,
      password,
    });
  }

  refreshToken(refreshToken: string): Observable<{ accessToken: string; refreshToken: string }> {
    return this.http.post<{ accessToken: string; refreshToken: string }>(
      `${this.url}/auth/refresh`,
      { refreshToken },
    );
  }

  // ── Actuator ──────────────────────────────────────────────────────────────
  // Spring Boot returns HTTP 503 when health status is DOWN.
  // HttpClient treats 503 as an error, but the response body still contains
  // the composite health JSON (status + components). We catch HTTP errors
  // that have a JSON body and return them as successful values so the
  // dashboard can display "DOWN" with component details instead of "UNREACHABLE".
  getHealth(): Observable<unknown> {
    return this.http
      .get(`${this.url}/actuator/health`)
      .pipe(catchError((err) => (err.error?.status ? of(err.error) : throwError(() => err))));
  }
  getReadiness(): Observable<unknown> {
    return this.http
      .get(`${this.url}/actuator/health/readiness`)
      .pipe(catchError((err) => (err.error?.status ? of(err.error) : throwError(() => err))));
  }
  getLiveness(): Observable<unknown> {
    return this.http
      .get(`${this.url}/actuator/health/liveness`)
      .pipe(catchError((err) => (err.error?.status ? of(err.error) : throwError(() => err))));
  }
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

  getCustomerSummary(page = 0, size = 20): Observable<Page<CustomerSummary>> {
    return this.http.get<Page<CustomerSummary>>(`${this.url}/customers/summary`, {
      params: { page: page.toString(), size: size.toString() },
    });
  }

  /** Fetch last 10 created customers from the Redis ring buffer */
  getRecentCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.url}/customers/recent`);
  }

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

  updateCustomer(id: number, payload: { name: string; email: string }): Observable<Customer> {
    return this.http.put<Customer>(`${this.url}/customers/${id}`, payload);
  }

  deleteCustomer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/customers/${id}`);
  }

  /** Generate a customer bio using Ollama LLM (may be slow ~500ms+) */
  getCustomerBio(id: number): Observable<{ bio: string }> {
    return this.http.get<{ bio: string }>(`${this.url}/customers/${id}/bio`);
  }

  getCustomerTodos(id: number): Observable<TodoItem[]> {
    return this.http.get<TodoItem[]>(`${this.url}/customers/${id}/todos`);
  }

  /** Enrich customer via Kafka request-reply (5s timeout, returns 504 on timeout) */
  enrichCustomer(id: number): Observable<EnrichedCustomer> {
    return this.http.get<EnrichedCustomer>(`${this.url}/customers/${id}/enrich`);
  }
}
