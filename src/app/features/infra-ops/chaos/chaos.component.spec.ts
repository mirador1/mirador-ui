/**
 * Smoke spec — catches broken imports, circular deps, template parse errors.
 * Does NOT exercise component behavior — see TASKS.md for behavioral test backlog.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ChaosComponent } from './chaos.component';

describe('ChaosComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  it('exports the component class', () => {
    expect(ChaosComponent).toBeDefined();
  });

  it('creates without error', () => {
    const fixture = TestBed.createComponent(ChaosComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
