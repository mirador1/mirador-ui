import { Component } from '@angular/core';
import { AppShellComponent } from './shared/layout/app-shell.component';

/**
 * Root component — renders the application shell which contains
 * the topbar, sidebar navigation, and router outlet for feature pages.
 */
@Component({
  selector: 'app-root',
  imports: [AppShellComponent],
  template: '<app-shell />',
})
export class App {}
