/**
 * Application entry point.
 *
 * Bootstraps the root `App` component with the providers defined in `appConfig`
 * (zoneless change detection, router, HTTP client with JWT interceptor).
 */
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
