import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('should start unauthenticated', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.token()).toBeNull();
  });

  it('should set token and become authenticated', () => {
    service.setToken('test-jwt');
    expect(service.isAuthenticated()).toBe(true);
    expect(service.token()).toBe('test-jwt');
    expect(localStorage.getItem('jwt')).toBe('test-jwt');
  });

  it('should logout and clear token', () => {
    service.setToken('test-jwt');
    service.logout();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.token()).toBeNull();
    expect(localStorage.getItem('jwt')).toBeNull();
  });
});
