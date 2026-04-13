import { Injectable, inject, computed } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EnvService } from '../env/env.service';

export interface Customer {
  id?: number;
  name: string;
  email: string;
  createdAt?: string;
}

export interface CustomerSummary {
  id: number;
  name: string;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface EnrichedCustomer {
  id: number;
  name: string;
  email: string;
  displayName: string;
}

export interface TodoItem {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
}

export interface AggregatedResponse {
  customerData: unknown;
  stats: unknown;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly env = inject(EnvService);
  readonly baseUrl = computed(() => this.env.baseUrl());

  private get url(): string { return this.baseUrl(); }

  // ── Auth ──────────────────────────────────────────────────────────────────
  login(username: string, password: string): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.url}/auth/login`, { username, password });
  }

  // ── Actuator ──────────────────────────────────────────────────────────────
  getHealth(): Observable<unknown> {
    return this.http.get(`${this.url}/actuator/health`);
  }
  getReadiness(): Observable<unknown> {
    return this.http.get(`${this.url}/actuator/health/readiness`);
  }
  getLiveness(): Observable<unknown> {
    return this.http.get(`${this.url}/actuator/health/liveness`);
  }
  getPrometheusMetrics(): Observable<string> {
    return this.http.get(`${this.url}/actuator/prometheus`, { responseType: 'text' });
  }

  // ── Customers ─────────────────────────────────────────────────────────────
  getCustomers(page = 0, size = 10, version = '1.0', search?: string, sort?: string): Observable<Page<Customer>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    if (search) params = params.set('search', search);
    if (sort) params = params.set('sort', sort);
    return this.http.get<Page<Customer>>(`${this.url}/customers`, {
      headers: new HttpHeaders({ 'X-API-Version': version }),
      params
    });
  }

  getCustomerSummary(page = 0, size = 20): Observable<Page<CustomerSummary>> {
    return this.http.get<Page<CustomerSummary>>(`${this.url}/customers/summary`, {
      params: { page: page.toString(), size: size.toString() }
    });
  }

  getRecentCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.url}/customers/recent`);
  }

  getAggregate(): Observable<AggregatedResponse> {
    return this.http.get<AggregatedResponse>(`${this.url}/customers/aggregate`);
  }

  createCustomer(
    payload: { name: string; email: string },
    idempotencyKey?: string
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

  getCustomerBio(id: number): Observable<{ bio: string }> {
    return this.http.get<{ bio: string }>(`${this.url}/customers/${id}/bio`);
  }

  getCustomerTodos(id: number): Observable<TodoItem[]> {
    return this.http.get<TodoItem[]>(`${this.url}/customers/${id}/todos`);
  }

  enrichCustomer(id: number): Observable<EnrichedCustomer> {
    return this.http.get<EnrichedCustomer>(`${this.url}/customers/${id}/enrich`);
  }
}
