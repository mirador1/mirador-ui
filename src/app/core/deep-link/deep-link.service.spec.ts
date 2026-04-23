/**
 * Unit tests for DeepLinkService — URI builders for VS Code, IntelliJ
 * IDEA, and Docker Desktop deep-links. Pure string-formatting service,
 * no Angular DI needed beyond instantiation.
 */
import { DeepLinkService } from './deep-link.service';

// eslint-disable-next-line max-lines-per-function
describe('DeepLinkService', () => {
  let service: DeepLinkService;

  beforeEach(() => {
    service = new DeepLinkService();
  });

  describe('vscode()', () => {
    it('builds the vscode://file URI from an absolute path', () => {
      expect(service.vscode('/Users/me/repo/src/app.ts')).toBe(
        'vscode://file/Users/me/repo/src/app.ts',
      );
    });

    it('appends :line when a line number is provided', () => {
      expect(service.vscode('/abs/file.ts', 42)).toBe('vscode://file/abs/file.ts:42');
    });

    it('omits :line when no line number is provided (undefined)', () => {
      expect(service.vscode('/abs/file.ts')).toBe('vscode://file/abs/file.ts');
    });

    it('handles line=0 (first line, valid VS Code anchor)', () => {
      // Pinned: line=0 must produce :0, not be silently dropped (the
      // `!== undefined` check is what enables this — using truthy check
      // would lose line 0).
      expect(service.vscode('/file.ts', 0)).toBe('vscode://file/file.ts:0');
    });

    it('preserves spaces and special chars in path verbatim', () => {
      // Pinned: VS Code accepts the URI as-is. No encoding; the OS URI
      // handler does what it does. Re-encoding here would double-encode
      // already-percent-encoded paths.
      expect(service.vscode('/path with spaces/file.ts')).toBe(
        'vscode://file/path with spaces/file.ts',
      );
    });
  });

  describe('idea()', () => {
    it('builds the idea://open URI with file query parameter', () => {
      expect(service.idea('/Users/me/repo/src/app.ts')).toBe(
        'idea://open?file=%2FUsers%2Fme%2Frepo%2Fsrc%2Fapp.ts',
      );
    });

    it('appends line query parameter when provided', () => {
      const url = service.idea('/abs/file.ts', 42);

      // URLSearchParams encodes; just verify both params are present.
      expect(url).toContain('file=%2Fabs%2Ffile.ts');
      expect(url).toContain('line=42');
    });

    it('does NOT append line when undefined', () => {
      const url = service.idea('/abs/file.ts');

      expect(url).not.toContain('line=');
    });

    it('handles line=0 (preserves explicit zero)', () => {
      const url = service.idea('/abs/file.ts', 0);

      expect(url).toContain('line=0');
    });

    it('URL-encodes paths with spaces and special chars', () => {
      // Different from vscode() — IDEA uses query string, so URLSearchParams
      // applies standard URL-encoding. Note: URLSearchParams.toString()
      // encodes spaces as `+` (form-encoding) rather than `%20`. Both are
      // valid in query strings per RFC 3986. Pinned because if IDEA ever
      // rejects `+` we'd need to switch to encodeURIComponent — this test
      // would fail loud.
      const url = service.idea('/path with spaces/file.ts');

      expect(url).toContain('+'); // space → + (URLSearchParams form-encoding)
      expect(url).toContain('%2F'); // forward slash in path
    });
  });

  describe('dockerContainer()', () => {
    it('builds the docker-desktop://dashboard/container URI from a container ID', () => {
      expect(service.dockerContainer('abc123def456')).toBe(
        'docker-desktop://dashboard/container/abc123def456',
      );
    });

    it('accepts a container name as well as an ID', () => {
      // Both forms documented as valid (ID = preferred, name = stable
      // across restarts but less precise).
      expect(service.dockerContainer('postgres-demo')).toBe(
        'docker-desktop://dashboard/container/postgres-demo',
      );
    });

    it('passes the input verbatim (no encoding, no validation)', () => {
      // Pinned: container IDs/names are restricted by Docker to safe
      // characters [a-zA-Z0-9_.-], so URL-encoding is unnecessary.
      // Adding it would double-encode and break the deep link.
      expect(service.dockerContainer('weird_container.name-123')).toBe(
        'docker-desktop://dashboard/container/weird_container.name-123',
      );
    });
  });
});
