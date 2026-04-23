/**
 * Unit tests for KeyboardService — global keyboard shortcut handler.
 * Tests dispatch the actual `keydown` events on document and assert
 * the resulting state changes / router navigation / theme toggling.
 */
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { KeyboardService } from './keyboard.service';
import { ThemeService } from '../theme/theme.service';

/** Helper: dispatch a synthetic keydown on document (or a target). */
function pressKey(
  key: string,
  options: {
    ctrl?: boolean;
    meta?: boolean;
    target?: HTMLElement;
  } = {},
): KeyboardEvent {
  const target = options.target ?? document.body;
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: options.ctrl ?? false,
    metaKey: options.meta ?? false,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

// eslint-disable-next-line max-lines-per-function
describe('KeyboardService', () => {
  let service: KeyboardService;
  let router: Router;
  let theme: ThemeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
    // Instantiate the service — the constructor adds the document
    // event listener.
    service = TestBed.inject(KeyboardService);
    router = TestBed.inject(Router);
    theme = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    // Reset service state to avoid leaks across tests.
    service.showHelp.set(false);
    service.showSearch.set(false);
  });

  describe('shortcuts list', () => {
    it('exposes the canonical 10 shortcuts', () => {
      // Pinned: the help overlay reads this list verbatim. Removing or
      // re-categorizing without test update would silently change UI.
      expect(service.shortcuts).toHaveLength(10);
      expect(service.shortcuts.filter((s) => s.category === 'Navigation')).toHaveLength(8);
      expect(service.shortcuts.filter((s) => s.category === 'Actions')).toHaveLength(2);
    });
  });

  describe('Ctrl+K / Cmd+K', () => {
    it('toggles search overlay (works even when typing in input)', () => {
      // Pinned: Ctrl+K MUST work in inputs (otherwise the user has to
      // unfocus before opening search — bad UX). The Ctrl+K branch
      // returns BEFORE the isInput guard.
      expect(service.showSearch()).toBe(false);

      const input = document.createElement('input');
      document.body.appendChild(input);
      try {
        pressKey('k', { ctrl: true, target: input });
        expect(service.showSearch()).toBe(true);

        // Toggle off
        pressKey('k', { ctrl: true, target: input });
        expect(service.showSearch()).toBe(false);
      } finally {
        document.body.removeChild(input);
      }
    });

    it('Cmd+K (meta) also toggles search', () => {
      pressKey('k', { meta: true });
      expect(service.showSearch()).toBe(true);
    });

    it('preventDefault is called (browser shortcut bypassed)', () => {
      const event = pressKey('k', { ctrl: true });
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('Escape', () => {
    it('closes help + search modals', () => {
      service.showHelp.set(true);
      service.showSearch.set(true);

      pressKey('Escape');

      expect(service.showHelp()).toBe(false);
      expect(service.showSearch()).toBe(false);
    });

    it('works even when typing in input', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      try {
        service.showHelp.set(true);
        pressKey('Escape', { target: input });
        expect(service.showHelp()).toBe(false);
      } finally {
        document.body.removeChild(input);
      }
    });
  });

  describe('? (help)', () => {
    it('toggles help overlay', () => {
      pressKey('?');
      expect(service.showHelp()).toBe(true);

      pressKey('?');
      expect(service.showHelp()).toBe(false);
    });

    it('does NOT fire when typing in input (focus guard)', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      try {
        pressKey('?', { target: input });
        expect(service.showHelp()).toBe(false);
      } finally {
        document.body.removeChild(input);
      }
    });
  });

  describe('G then X navigation', () => {
    let navSpy: ReturnType<typeof vi.spyOn> | undefined;

    beforeEach(() => {
      navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    });

    afterEach(() => {
      navSpy?.mockRestore();
    });

    it('G then D navigates to /', () => {
      pressKey('g');
      pressKey('d');

      expect(navSpy).toHaveBeenCalledWith('/');
    });

    it('G then C navigates to /customers', () => {
      pressKey('g');
      pressKey('c');

      expect(navSpy).toHaveBeenCalledWith('/customers');
    });

    it('G then T navigates to /diagnostic', () => {
      pressKey('g');
      pressKey('t');

      expect(navSpy).toHaveBeenCalledWith('/diagnostic');
    });

    it('G then S navigates to /settings', () => {
      pressKey('g');
      pressKey('s');

      expect(navSpy).toHaveBeenCalledWith('/settings');
    });

    it('G then A navigates to /activity', () => {
      pressKey('g');
      pressKey('a');

      expect(navSpy).toHaveBeenCalledWith('/activity');
    });

    it('G then unknown key does NOT navigate (silent no-op)', () => {
      pressKey('g');
      pressKey('z');

      expect(navSpy).not.toHaveBeenCalled();
    });

    it('G alone does NOT navigate (waits for second key)', () => {
      pressKey('g');

      expect(navSpy).not.toHaveBeenCalled();
    });
  });

  describe('Single-key actions', () => {
    it('D toggles theme', () => {
      const toggleSpy = vi.spyOn(theme, 'toggle').mockReturnValue(undefined);
      pressKey('d');

      expect(toggleSpy).toHaveBeenCalledTimes(1);
      toggleSpy.mockRestore();
    });

    it('R dispatches the app:refresh custom event', () => {
      const handler = vi.fn();
      window.addEventListener('app:refresh', handler);
      try {
        pressKey('r');

        expect(handler).toHaveBeenCalledTimes(1);
      } finally {
        window.removeEventListener('app:refresh', handler);
      }
    });

    it('D in input field does NOT toggle theme', () => {
      const toggleSpy = vi.spyOn(theme, 'toggle').mockReturnValue(undefined);
      const input = document.createElement('textarea');
      document.body.appendChild(input);
      try {
        pressKey('d', { target: input });
        expect(toggleSpy).not.toHaveBeenCalled();
      } finally {
        document.body.removeChild(input);
        toggleSpy.mockRestore();
      }
    });
  });
});
