import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  it('should default to light theme', () => {
    expect(service.theme()).toBe('light');
  });

  it('should toggle to dark and back', () => {
    service.toggle();
    expect(service.theme()).toBe('dark');

    service.toggle();
    expect(service.theme()).toBe('light');
  });

  it('should apply data-theme attribute on init', () => {
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
