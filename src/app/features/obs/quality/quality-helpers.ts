/**
 * Pure helper functions shared between `QualityComponent` (parent) and
 * `QcTab*Component` children. Extracted 2026-04-22 under Phase B-5 so each
 * tab component can format severity / CVE / git-URL values locally without
 * re-implementing the logic. No signals, no DI — pure functions.
 */

/**
 * Convert a severity string to a CSS class suffix for badge colouring.
 * Accepts both CVSS severity names (CRITICAL/HIGH/MEDIUM) and numeric
 * PMD priorities (1/2/3).
 *
 * @param severity Severity string or priority number.
 * @returns CSS class suffix: `'bad'`=red, `'warn'`=orange, `'ok'`=green/gray.
 */
export function severityColor(severity: string): string {
  const s = severity.toUpperCase();
  if (s === 'CRITICAL' || s === 'HIGH' || s === '1') return 'bad';
  if (s === 'MEDIUM' || s === 'WARNING' || s === '2') return 'warn';
  return 'ok';
}

/**
 * Convert a numeric SpotBugs/PMD priority to a human-readable label.
 *
 * @param p Priority string: `'1'`, `'2'`, or other.
 * @returns `'High'`, `'Medium'`, or `'Low'`.
 */
export function priorityLabel(p: string): string {
  return p === '1' ? 'High' : p === '2' ? 'Medium' : 'Low';
}

/**
 * Build the NVD (National Vulnerability Database) detail URL for a CVE ID.
 *
 * @param cve CVE identifier string (e.g., `'CVE-2023-12345'`).
 * @returns Full NVD URL for the CVE.
 */
export function nvdUrl(cve: string): string {
  return `https://nvd.nist.gov/vuln/detail/${cve}`;
}

/**
 * Lenient `Object.entries` wrapper tolerant of `undefined` — returns an
 * empty array when the input is missing so `@for` blocks just render zero
 * rows instead of a template error.
 */
export function entriesOf(obj: Record<string, number> | undefined): [string, number][] {
  if (!obj) return [];
  return Object.entries(obj);
}

/**
 * Coverage % → CSS class suffix (used for colour coding coverage bars).
 * - `good` (≥ 70 %) — green
 * - `warn` (≥ 50 %) — orange
 * - `bad`  (< 50 %) — red
 */
export function coverageColor(pct: number): string {
  if (pct >= 70) return 'good';
  if (pct >= 50) return 'warn';
  return 'bad';
}

/**
 * Converts a git remote URL (SSH or HTTPS) to a browseable web URL.
 *   git@gitlab.com:foo/bar.git → https://gitlab.com/foo/bar
 *   https://gitlab.com/foo/bar → https://gitlab.com/foo/bar
 */
export function gitWebUrl(remoteUrl: string): string {
  const ssh = remoteUrl.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
  return remoteUrl.replace(/\.git$/, '');
}

/**
 * Commit URL for a given hash on the git remote. GitLab uses `-/commit/`,
 * GitHub uses `commit/` — detected via `gitlab` substring in the host.
 */
export function commitUrl(remoteUrl: string, hash: string): string {
  const base = gitWebUrl(remoteUrl);
  if (base.includes('gitlab')) return `${base}/-/commit/${hash}`;
  return `${base}/commit/${hash}`;
}
