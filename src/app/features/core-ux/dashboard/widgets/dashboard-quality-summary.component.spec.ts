/**
 * Smoke test for DashboardQualitySummaryComponent — pure presentational
 * widget with a single signal input and no business-logic methods.
 *
 * Template rendering is integration-tested via the parent
 * dashboard.component.spec.ts ; this smoke test just ensures the class
 * + imports are intact.
 *
 * Widget extracted in Phase B-6b (2026-04-23).
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DashboardQualitySummaryComponent } from './dashboard-quality-summary.component';

describe('DashboardQualitySummaryComponent', () => {
  beforeEach(() => {
    // RouterLink is declared in the widget imports → provideRouter([])
    // is required for instantiation even though we don't navigate in
    // the unit test.
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('exports the component class', () => {
    expect(DashboardQualitySummaryComponent).toBeDefined();
  });

  it('instantiates cleanly with a null summary input by default', () => {
    const fixture = TestBed.createComponent(DashboardQualitySummaryComponent);
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.summary()).toBeNull();
  });
});
