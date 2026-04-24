/**
 * database-health-checks.ts — pure data for DatabaseHealthTabComponent.
 *
 * Extracted 2026-04-24 under Phase B-7-7b file-length hygiene : the parent
 * `database.component.ts` dropped the 130-line `healthChecks` literal so
 * the component file stays focused on signals + SQL execution behaviour.
 *
 * Pattern : "1 concern per file" from CLAUDE.md → each widget's data
 * sits in its own TypeScript module alongside the widget component.
 * Matches `customers-data.ts`, `quality-helpers.ts`, `security-types.ts`
 * already landed under this rule.
 */
import type { HealthCheck } from './database-types';

/**
 * 8 PostgreSQL health checks exposed in the Database → Health tab.
 *
 * Each check runs a read-only SQL via pgweb and emits a traffic-light
 * status (`ok` / `warn` / `crit`) through its `evaluate()` callback.
 * Queries are designed to surface production-relevant signals :
 * cache-hit ratio, bloat, lock waits, idle-in-transaction connections…
 *
 * Keep this list sorted by concern (performance → stability → data
 * integrity) so the Health tab reads top-to-bottom as a tiered
 * diagnostic.
 */
export const HEALTH_CHECKS: HealthCheck[] = [
  {
    id: 'cache_hit',
    label: '🎯 Cache hit ratio',
    description: 'Shared-buffer cache hit rate — should be >99% in production.',
    query:
      'SELECT ROUND(sum(heap_blks_hit)::numeric / GREATEST(sum(heap_blks_hit)+sum(heap_blks_read),1)*100,2) as hit_pct FROM pg_statio_user_tables',
    evaluate: (rows) => {
      const pct = parseFloat(rows[0]?.[0] ?? '0');
      if (pct >= 99) return { status: 'ok', detail: `${pct}% (target ≥ 99%)` };
      if (pct >= 90)
        return {
          status: 'warn',
          detail: `${pct}% — below 99%, consider increasing shared_buffers`,
        };
      return { status: 'crit', detail: `${pct}% — critical, most reads hit disk` };
    },
  },
  {
    id: 'unused_indexes',
    label: '🗑️ Unused indexes',
    description:
      'Indexes never scanned since last stats reset. Normal in dev (small tables), investigate in prod.',
    query:
      "SELECT COUNT(*) as cnt FROM pg_stat_user_indexes WHERE idx_scan = 0 AND indexrelname NOT LIKE '%pkey%'",
    evaluate: (rows) => {
      const cnt = parseInt(rows[0]?.[0] ?? '0', 10);
      if (cnt === 0) return { status: 'ok', detail: 'No unused indexes' };
      if (cnt <= 3)
        return {
          status: 'warn',
          detail: `${cnt} unused index(es) — normal in dev (small table = seq scan preferred)`,
        };
      return { status: 'warn', detail: `${cnt} unused indexes — review in production` };
    },
  },
  {
    id: 'bloat',
    label: '🧹 Table bloat',
    description: 'Dead tuples waiting for VACUUM. High values slow queries and waste disk.',
    query:
      'SELECT COALESCE(MAX(CASE WHEN n_live_tup>0 THEN ROUND(n_dead_tup::numeric/n_live_tup*100,1) ELSE 0 END),0) as max_dead_pct FROM pg_stat_user_tables',
    evaluate: (rows) => {
      const pct = parseFloat(rows[0]?.[0] ?? '0');
      if (pct < 5) return { status: 'ok', detail: `Max dead tuple ratio: ${pct}%` };
      if (pct < 20)
        return {
          status: 'warn',
          detail: `${pct}% dead tuples — autovacuum should clean this soon`,
        };
      return { status: 'crit', detail: `${pct}% dead tuples — run VACUUM ANALYZE` };
    },
  },
  {
    id: 'blocked',
    label: '🔒 Blocked processes',
    description: 'Queries waiting on a lock held by another connection.',
    query:
      "SELECT COUNT(*) as cnt FROM pg_stat_activity WHERE wait_event_type='Lock' AND datname=current_database()",
    evaluate: (rows) => {
      const cnt = parseInt(rows[0]?.[0] ?? '0', 10);
      if (cnt === 0) return { status: 'ok', detail: 'No lock contention' };
      if (cnt <= 2) return { status: 'warn', detail: `${cnt} blocked query/queries` };
      return { status: 'crit', detail: `${cnt} blocked queries — lock storm detected` };
    },
  },
  {
    id: 'idle_in_tx',
    label: '🧵 Idle in transaction',
    description: 'Connections stuck in "idle in transaction" — hold locks, prevent VACUUM.',
    query:
      "SELECT COUNT(*) as cnt FROM pg_stat_activity WHERE state='idle in transaction' AND datname=current_database()",
    evaluate: (rows) => {
      const cnt = parseInt(rows[0]?.[0] ?? '0', 10);
      if (cnt === 0) return { status: 'ok', detail: 'No idle-in-transaction connections' };
      if (cnt <= 2) return { status: 'warn', detail: `${cnt} idle-in-transaction connection(s)` };
      return { status: 'crit', detail: `${cnt} idle-in-transaction — possible transaction leak` };
    },
  },
  {
    id: 'long_queries',
    label: '🐢 Long-running queries',
    description: 'Queries running for more than 5 seconds.',
    query:
      "SELECT COUNT(*) as cnt FROM pg_stat_activity WHERE state!='idle' AND query_start < now()-interval '5 seconds' AND datname=current_database()",
    evaluate: (rows) => {
      const cnt = parseInt(rows[0]?.[0] ?? '0', 10);
      if (cnt === 0) return { status: 'ok', detail: 'No long-running queries' };
      if (cnt <= 2) return { status: 'warn', detail: `${cnt} query/queries running >5s` };
      return {
        status: 'crit',
        detail: `${cnt} long-running queries — check for missing indexes or locks`,
      };
    },
  },
  {
    id: 'duplicates',
    label: '👥 Duplicate emails',
    description: 'Customer records sharing the same email address.',
    query:
      'SELECT COUNT(*) as cnt FROM (SELECT email FROM customer GROUP BY email HAVING COUNT(*)>1) t',
    evaluate: (rows) => {
      const cnt = parseInt(rows[0]?.[0] ?? '0', 10);
      if (cnt === 0) return { status: 'ok', detail: 'No duplicate emails' };
      return {
        status: 'crit',
        detail: `${cnt} duplicate email(s) found — idempotency key may be broken`,
      };
    },
  },
  {
    id: 'seq_scans',
    label: '📊 Sequential scan ratio',
    description: 'Tables where seq scans greatly outnumber index scans (excluding tiny tables).',
    query:
      'SELECT COUNT(*) as cnt FROM pg_stat_user_tables WHERE n_live_tup>500 AND seq_scan > idx_scan*2',
    evaluate: (rows) => {
      const cnt = parseInt(rows[0]?.[0] ?? '0', 10);
      if (cnt === 0)
        return {
          status: 'ok',
          detail: 'No suspicious seq scan patterns (or table too small to matter)',
        };
      return {
        status: 'warn',
        detail: `${cnt} table(s) with seq scans >> index scans — consider adding indexes`,
      };
    },
  },
];
