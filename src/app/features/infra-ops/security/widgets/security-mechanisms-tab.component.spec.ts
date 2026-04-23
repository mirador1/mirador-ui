/**
 * Smoke test for SecurityMechanismsTabComponent — pure presentational
 * widget, zero inputs, just renders the SECURITY_MECHANISMS catalogue.
 *
 * Created 2026-04-23 alongside the widget extraction (B-7-4 follow-up).
 */
import { TestBed } from '@angular/core/testing';
import { SecurityMechanismsTabComponent } from './security-mechanisms-tab.component';
import { SECURITY_MECHANISMS } from '../security-mechanisms-data';

describe('SecurityMechanismsTabComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('exports the component class', () => {
    expect(SecurityMechanismsTabComponent).toBeDefined();
  });

  it('exposes the SECURITY_MECHANISMS catalogue as readonly mechanisms', () => {
    const fixture = TestBed.createComponent(SecurityMechanismsTabComponent);
    const c = fixture.componentInstance;
    expect(c.mechanisms).toBe(SECURITY_MECHANISMS);
    expect(c.mechanisms.length).toBeGreaterThan(0);
  });

  it('catalogue has expected categories (sanity check the data shape)', () => {
    const cats = SECURITY_MECHANISMS.map((g) => g.category);
    expect(cats).toContain('🔐 Authentication');
    expect(cats).toContain('🛂 Authorization');
    expect(cats).toContain('🚦 Rate Limiting');
  });

  it('every mechanism has a non-empty status + name + description + config', () => {
    for (const group of SECURITY_MECHANISMS) {
      for (const item of group.items) {
        expect(item.name).toBeTruthy();
        expect(item.description).toBeTruthy();
        expect(item.config).toBeTruthy();
        expect(['active', 'optional']).toContain(item.status);
      }
    }
  });
});
