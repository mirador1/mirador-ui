/**
 * Unit tests for quality-helpers.ts — pure functions extracted under
 * Phase B-5 (2026-04-22) and shared between QualityComponent + 9
 * QcTab* children. Zero TestBed: every helper is referentially
 * transparent. Phase 4.2 coverage push.
 */
import {
  severityColor,
  priorityLabel,
  nvdUrl,
  entriesOf,
  coverageColor,
  gitWebUrl,
  commitUrl,
} from './quality-helpers';

describe('quality-helpers', () => {
  describe('severityColor()', () => {
    it("maps CRITICAL/HIGH/'1' to 'bad' (red)", () => {
      expect(severityColor('CRITICAL')).toBe('bad');
      expect(severityColor('HIGH')).toBe('bad');
      expect(severityColor('1')).toBe('bad');
      expect(severityColor('critical')).toBe('bad'); // case-insensitive
    });

    it("maps MEDIUM/WARNING/'2' to 'warn' (orange)", () => {
      expect(severityColor('MEDIUM')).toBe('warn');
      expect(severityColor('WARNING')).toBe('warn');
      expect(severityColor('2')).toBe('warn');
    });

    it("falls through to 'ok' for LOW / unknown / empty", () => {
      expect(severityColor('LOW')).toBe('ok');
      expect(severityColor('3')).toBe('ok');
      expect(severityColor('INFO')).toBe('ok');
      expect(severityColor('')).toBe('ok');
    });
  });

  describe('priorityLabel()', () => {
    it("returns 'High' for '1'", () => {
      expect(priorityLabel('1')).toBe('High');
    });

    it("returns 'Medium' for '2'", () => {
      expect(priorityLabel('2')).toBe('Medium');
    });

    it("returns 'Low' for everything else", () => {
      expect(priorityLabel('3')).toBe('Low');
      expect(priorityLabel('99')).toBe('Low');
      expect(priorityLabel('')).toBe('Low');
    });
  });

  describe('nvdUrl()', () => {
    it('builds the NVD detail URL for a CVE id', () => {
      expect(nvdUrl('CVE-2023-12345')).toBe('https://nvd.nist.gov/vuln/detail/CVE-2023-12345');
    });

    it('passes the input verbatim — no encoding (CVE ids are URL-safe)', () => {
      // Pinned: CVE ids are always [A-Z0-9-]; encoding would add ugly %2D
      // for the hyphens with zero benefit.
      expect(nvdUrl('CVE-2024-99999')).toContain('CVE-2024-99999');
    });
  });

  describe('entriesOf()', () => {
    it('returns Object.entries for a normal map', () => {
      expect(entriesOf({ a: 1, b: 2 })).toEqual([
        ['a', 1],
        ['b', 2],
      ]);
    });

    it('returns [] for undefined (template safety)', () => {
      // Critical: the template uses `@for` over the result. Returning
      // undefined would crash with "Cannot read properties of undefined".
      // The empty-array guard lets the template render zero rows.
      expect(entriesOf(undefined)).toEqual([]);
    });

    it('returns [] for an empty map', () => {
      expect(entriesOf({})).toEqual([]);
    });
  });

  describe('coverageColor()', () => {
    it("maps ≥ 70% to 'good' (green)", () => {
      expect(coverageColor(70)).toBe('good');
      expect(coverageColor(85.5)).toBe('good');
      expect(coverageColor(100)).toBe('good');
    });

    it("maps 50-69% to 'warn' (orange)", () => {
      expect(coverageColor(50)).toBe('warn');
      expect(coverageColor(69.9)).toBe('warn');
    });

    it("maps < 50% to 'bad' (red)", () => {
      expect(coverageColor(49.9)).toBe('bad');
      expect(coverageColor(0)).toBe('bad');
      expect(coverageColor(-5)).toBe('bad'); // sanity on negative
    });
  });

  describe('gitWebUrl()', () => {
    it('converts an SSH git URL to its HTTPS browse URL', () => {
      expect(gitWebUrl('git@gitlab.com:mirador1/mirador-service.git')).toBe(
        'https://gitlab.com/mirador1/mirador-service',
      );
    });

    it('handles SSH URLs without .git suffix', () => {
      expect(gitWebUrl('git@github.com:user/repo')).toBe('https://github.com/user/repo');
    });

    it('strips .git from already-HTTPS URLs', () => {
      expect(gitWebUrl('https://gitlab.com/foo/bar.git')).toBe('https://gitlab.com/foo/bar');
    });

    it('passes plain HTTPS URLs through unchanged', () => {
      expect(gitWebUrl('https://gitlab.com/foo/bar')).toBe('https://gitlab.com/foo/bar');
    });
  });

  describe('commitUrl()', () => {
    it('uses GitLab path style (/-/commit/)', () => {
      expect(commitUrl('git@gitlab.com:mirador1/mirador-service.git', 'abc123')).toBe(
        'https://gitlab.com/mirador1/mirador-service/-/commit/abc123',
      );
    });

    it('uses GitHub path style (/commit/, no dash)', () => {
      expect(commitUrl('git@github.com:user/repo.git', 'def456')).toBe(
        'https://github.com/user/repo/commit/def456',
      );
    });

    it("detection is by substring 'gitlab' anywhere in the URL", () => {
      // Pinned: hosted GitLab instances often have non-standard hostnames
      // (gitlab.example.com, code.gitlab.org). Substring detection covers
      // them all without an enum.
      expect(commitUrl('https://gitlab.example.com/team/proj.git', 'sha1')).toContain(
        '/-/commit/sha1',
      );
    });
  });
});
