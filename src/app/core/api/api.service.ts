import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Customer {
  id?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8080';

  getHealth(): Observable<unknown> {
    return this.http.get(`${this.baseUrl}/actuator/health`);
  }

  getReadiness(): Observable<unknown> {
    return this.http.get(`${this.baseUrl}/actuator/health/readiness`);
  }

  getLiveness(): Observable<unknown> {
    return this.http.get(`${this.baseUrl}/actuator/health/liveness`);
  }

  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.baseUrl}/customers`);
  }

  createCustomer(customer: Customer): Observable<Customer> {
    return this.http.post<Customer>(`${this.baseUrl}/customers`, customer);
  }
}
