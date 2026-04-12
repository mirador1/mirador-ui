import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  readonly baseUrl = 'http://localhost:8080';

  // ── Auth ──────────────────────────────────────────────────────────────────
  login(username: string, password: string): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.baseUrl}/auth/login`, { username, password });
  }

  // ── Actuator ──────────────────────────────────────────────────────────────
  getHealth(): Observable<unknown> {
    return this.http.get(`${this.baseUrl}/actuator/health`);
  }
  getReadiness(): Observable<unknown> {
    return this.http.get(`${this.baseUrl}/actuator/health/readiness`);
  }
  getLiveness(): Observable<unknown> {
    return this.http.get(`${this.baseUrl}/actuator/health/liveness`);
  }

  // ── Customers ─────────────────────────────────────────────────────────────
  getCustomers(page = 0, size = 10, version = '1.0'): Observable<Page<Customer>> {
    return this.http.get<Page<Customer>>(`${this.baseUrl}/customers`, {
      headers: new HttpHeaders({ 'X-API-Version': version }),
      params: { page: page.toString(), size: size.toString() }
    });
  }

  getCustomerSummary(page = 0, size = 20): Observable<Page<CustomerSummary>> {
    return this.http.get<Page<CustomerSummary>>(`${this.baseUrl}/customers/summary`, {
      params: { page: page.toString(), size: size.toString() }
    });
  }

  getRecentCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.baseUrl}/customers/recent`);
  }

  getAggregate(): Observable<AggregatedResponse> {
    return this.http.get<AggregatedResponse>(`${this.baseUrl}/customers/aggregate`);
  }

  createCustomer(
    payload: { name: string; email: string },
    idempotencyKey?: string
  ): Observable<Customer> {
    let headers = new HttpHeaders();
    if (idempotencyKey) {
      headers = headers.set('Idempotency-Key', idempotencyKey);
    }
    return this.http.post<Customer>(`${this.baseUrl}/customers`, payload, { headers });
  }

  getCustomerBio(id: number): Observable<{ bio: string }> {
    return this.http.get<{ bio: string }>(`${this.baseUrl}/customers/${id}/bio`);
  }

  getCustomerTodos(id: number): Observable<TodoItem[]> {
    return this.http.get<TodoItem[]>(`${this.baseUrl}/customers/${id}/todos`);
  }

  enrichCustomer(id: number): Observable<EnrichedCustomer> {
    return this.http.get<EnrichedCustomer>(`${this.baseUrl}/customers/${id}/enrich`);
  }
}
