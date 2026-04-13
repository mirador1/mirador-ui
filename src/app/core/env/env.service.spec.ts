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

  it('should have multiple environments available', () => {
    expect(service.environments.length).toBeGreaterThan(1);
  });

  it('should switch environment', () => {
    const docker = service.environments.find((e) => e.name === 'Docker')!;
    service.select(docker);
    expect(service.current().name).toBe('Docker');
    expect(service.baseUrl()).toBe('http://localhost:9080');
  });

  it('should persist selection to localStorage', () => {
    const staging = service.environments.find((e) => e.name === 'Staging')!;
    service.select(staging);
    const stored = JSON.parse(localStorage.getItem('env')!);
    expect(stored.name).toBe('Staging');
  });
});
