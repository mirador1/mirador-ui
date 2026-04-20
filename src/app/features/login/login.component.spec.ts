/**
 * Smoke spec — catches broken imports, circular deps, template parse errors.
 * Does NOT exercise component behavior — see TASKS.md for behavioral test backlog.
 *
 * Note: LoginComponent injects @auth0/auth0-angular's AuthService, so
 * provideAuth0 with dummy credentials is required. No real Auth0 network
 * calls are made — the domain/clientId are placeholders.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideAuth0 } from '@auth0/auth0-angular';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideAuth0({ domain: 'test.auth0.com', clientId: 'test-client-id' }),
      ],
    });
  });

  it('exports the component class', () => {
    expect(LoginComponent).toBeDefined();
  });

  it('creates without error', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
