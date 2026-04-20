/**
 * Smoke spec — catches broken imports, circular deps, template parse errors.
 * Does NOT exercise component behavior — see TASKS.md for behavioral test backlog.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { SecurityComponent } from './security.component';

describe('SecurityComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  it('exports the component class', () => {
    expect(SecurityComponent).toBeDefined();
  });

  it('creates without error', () => {
    const fixture = TestBed.createComponent(SecurityComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
