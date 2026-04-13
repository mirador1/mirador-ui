import { TestBed } from '@angular/core/testing';
import { EnvService } from './env.service';

describe('EnvService', () => {
  let service: EnvService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(EnvService);
  });

  it('should default to Local environment', () => {
    expect(service.current().name).toBe('Local');
    expect(service.baseUrl()).toBe('http://localhost:8080');
  });

  it('should have at least one environment', () => {
    expect(service.environments.length).toBeGreaterThan(0);
  });

  it('should persist selection to localStorage', () => {
    const local = service.environments[0];
    service.select(local);
    const stored = JSON.parse(localStorage.getItem('env')!);
    expect(stored.name).toBe('Local');
  });
});
