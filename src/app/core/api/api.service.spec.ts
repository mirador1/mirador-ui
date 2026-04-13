import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should call login endpoint', () => {
    service.login('admin', 'admin').subscribe(res => {
      expect(res.token).toBe('jwt-123');
    });
    const req = httpMock.expectOne(`${service.baseUrl()}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'admin', password: 'admin' });
    req.flush({ token: 'jwt-123' });
  });

  it('should fetch customers with version header', () => {
    service.getCustomers(0, 10, '2.0').subscribe(res => {
      expect(res.content.length).toBe(1);
    });
    const req = httpMock.expectOne(r => r.url.includes('/customers') && !r.url.includes('/summary'));
    expect(req.request.headers.get('X-API-Version')).toBe('2.0');
    req.flush({ content: [{ id: 1, name: 'A', email: 'a@b.com' }], totalElements: 1, totalPages: 1, size: 10, number: 0 });
  });

  it('should pass search param when provided', () => {
    service.getCustomers(0, 10, '1.0', 'alice').subscribe();
    const req = httpMock.expectOne(r => r.url.includes('/customers'));
    expect(req.request.params.get('search')).toBe('alice');
    req.flush({ content: [], totalElements: 0, totalPages: 0, size: 10, number: 0 });
  });

  it('should create customer with idempotency key', () => {
    service.createCustomer({ name: 'A', email: 'a@b.com' }, 'key-123').subscribe();
    const req = httpMock.expectOne(`${service.baseUrl()}/customers`);
    expect(req.request.headers.get('Idempotency-Key')).toBe('key-123');
    req.flush({ id: 1, name: 'A', email: 'a@b.com' });
  });

  it('should call delete endpoint', () => {
    service.deleteCustomer(5).subscribe();
    const req = httpMock.expectOne(`${service.baseUrl()}/customers/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('should call update endpoint', () => {
    service.updateCustomer(3, { name: 'B', email: 'b@c.com' }).subscribe();
    const req = httpMock.expectOne(`${service.baseUrl()}/customers/3`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ name: 'B', email: 'b@c.com' });
    req.flush({ id: 3, name: 'B', email: 'b@c.com' });
  });

  it('should fetch health endpoints', () => {
    service.getHealth().subscribe();
    service.getReadiness().subscribe();
    service.getLiveness().subscribe();

    const healthReq = httpMock.expectOne(`${service.baseUrl()}/actuator/health`);
    healthReq.flush({ status: 'UP' });

    const readyReq = httpMock.expectOne(`${service.baseUrl()}/actuator/health/readiness`);
    readyReq.flush({ status: 'UP' });

    const liveReq = httpMock.expectOne(`${service.baseUrl()}/actuator/health/liveness`);
    liveReq.flush({ status: 'UP' });
  });
});
