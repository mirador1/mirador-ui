/**
 * DatabaseComponent — PostgreSQL explorer via pgweb.
 *
 * Sections:
 * - SQL Explorer: execute read-only SQL via pgweb REST API (port 8081)
 * - 27 preset queries in 5 categories: Customer Data, PG Diagnostics,
 *   Schema & Flyway, Production Investigation, Performance Optimization
 */
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/auth/auth.service';
import { EnvService } from '../../../core/env/env.service';
import { RouterLink } from '@angular/router';

/** Active tab in the Database page explorer. */
type DbTab = 'health' | 'customer' | 'diagnostics' | 'schema' | 'investigation' | 'performance';

/**
 * Shape returned by the pgweb REST API (`GET /api/query`) for SQL execution.
 * Rows contain mixed primitive types (number, string, boolean, null) from PostgreSQL.
 * The `error` field is set when the SQL fails or pgweb is unreachable.
 */
interface SqlQueryResult {
  /** Column names from the SELECT result set. */
  columns?: string[];
  /** Row data as a 2D array indexed `[row][column]`. */
  rows?: unknown[][];
  /** Error message from pgweb or the proxy if the query failed. */
  error?: string;
}

/**
 * Shape returned by the Spring Boot `/actuator/maintenance` custom endpoint.
 * Called when the user triggers a VACUUM operation from the Health tab.
 */
interface MaintenanceResult {
  /** The operation type that was executed (e.g., `'vacuum'`, `'vacuumFull'`). */
  operation: string;
  /** How long the maintenance operation took in milliseconds. */
  durationMs: number;
  /** Result status string (e.g., `'OK'`). */
  status: string;
}

/**
 * Definition of a database health check displayed in the Health tab.
 * Each check runs a read-only SQL query via pgweb and evaluates the result.
 */
interface HealthCheck {
  /** Unique string identifier for this check (used as a React-style key). */
  id: string;
  /** Display label shown as the check's heading. */
  label: string;
  /** Tooltip description explaining what the check measures. */
  description: string;
  /** The SQL query to execute against PostgreSQL via pgweb. */
  query: string;
  /**
   * Evaluate the first row's first value and return a traffic-light status.
   * @param rows Result rows from the SQL query.
   * @returns Status (`'ok'`=green, `'warn'`=orange, `'crit'`=red) with a detail message.
   */
  evaluate: (rows: string[][]) => { status: 'ok' | 'warn' | 'crit'; detail: string };
}

@Component({
  selector: 'app-database',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './database.component.html',
  styleUrl: './database.component.scss',
})
export class DatabaseComponent {
  private readonly http = inject(HttpClient);
  readonly auth = inject(AuthService);
  /**
   * Env-aware URLs for the DB admin buttons. `cloudbeaverUrl()` is only set on
   * the Local environment (compose) — in Prod tunnel mode the button is hidden.
   * Ad-hoc SQL in prod goes through a local CloudBeaver pointed at
   * `kubectl port-forward svc/postgresql 15432:5432`.
   */
  readonly env = inject(EnvService);

  /** Signal: currently active tab in the Database page. */
  activeTab = signal<DbTab>('health');

  // ── Health checks ─────────────────────────────────────────────────────────

  /**
   * Signal: list of health check results from the most recent batch run.
   * Populated by running all `healthChecks` queries against pgweb in sequence.
   */
  healthResults = signal<
    Array<{
      check: HealthCheck;
      status: 'ok' | 'warn' | 'crit' | 'loading' | 'error';
      detail: string;
      rows: string[][];
    }>
  >([]);

  /** Signal: true while the batch health check queries are in flight. */
  healthRunning = signal(false);

  // ── Maintenance actions (VACUUM via /actuator/maintenance) ──────────────

  /** Signal: true while a VACUUM request to `/actuator/maintenance` is in flight. */
  vacuumRunning = signal(false);

  /** Signal: result of the last VACUUM operation. Null until first run. */
  vacuumResult = signal<{ operation: string; durationMs: number; status: string } | null>(null);

  /** Signal: error message if the VACUUM request failed. */
  vacuumError = signal('');

  runVacuum(operation: 'vacuum' | 'vacuumFull' | 'vacuumVerbose'): void {
    this.vacuumRunning.set(true);
    this.vacuumResult.set(null);
    this.vacuumError.set('');
    // Calls the custom Spring Boot actuator endpoint (POST /actuator/maintenance).
    // Base URL is env-aware — Local = :8080, Prod tunnel = :18080.
    this.http
      .post<MaintenanceResult>(`${this.env.baseUrl()}/actuator/maintenance`, { operation })
      .subscribe({
        next: (r) => {
          this.vacuumResult.set(r);
          this.vacuumRunning.set(false);
        },
        error: (e) => {
          this.vacuumError.set(
            e.error?.message ??
              `Maintenance endpoint unreachable (${e.status || 'check Spring Boot'})`,
          );
          this.vacuumRunning.set(false);
        },
      });
  }

  readonly healthChecks: HealthCheck[] = [
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

  runHealthChecks(): void {
    this.healthRunning.set(true);
    this.healthResults.set(
      this.healthChecks.map((c) => ({ check: c, status: 'loading', detail: '…', rows: [] })),
    );
    let done = 0;
    const pgweb = this.env.pgwebUrl();
    if (!pgweb) {
      // Belt-and-braces: the template already gates the "Run Diagnostic" button on
      // `@if (env.pgwebUrl())`, but keep a runtime check so a future code path
      // that forgets the template guard cannot silently 404.
      this.healthRunning.set(false);
      return;
    }
    for (const check of this.healthChecks) {
      this.http
        .get<SqlQueryResult>(`${pgweb}/api/query`, { params: { query: check.query } })
        .subscribe({
          next: (res) => {
            const rows: string[][] = (res.rows ?? []).map((r) =>
              (r as unknown[]).map((c) => String(c ?? '')),
            );
            const evaluation = check.evaluate(rows);
            this.healthResults.update((prev) =>
              prev.map((r) => (r.check.id === check.id ? { ...r, ...evaluation, rows } : r)),
            );
            if (++done === this.healthChecks.length) this.healthRunning.set(false);
          },
          error: () => {
            this.healthResults.update((prev) =>
              prev.map((r) =>
                r.check.id === check.id
                  ? { ...r, status: 'error' as const, detail: 'pgweb unreachable' }
                  : r,
              ),
            );
            if (++done === this.healthChecks.length) this.healthRunning.set(false);
          },
        });
    }
  }

  // ── SQL Explorer ──────────────────────────────────────────────────────────
  sqlQuery = 'SELECT id, name, email FROM customer LIMIT 20';
  sqlResult = signal<{ columns: string[]; rows: string[][] } | null>(null);
  sqlError = signal('');
  sqlLoading = signal(false);

  readonly sqlPresetCategories: Array<{
    id: DbTab;
    label: string;
    presets: Array<{ icon: string; name: string; tip: string; query: string }>;
  }> = [
    {
      id: 'customer' as DbTab,
      label: '📋 Customer Data',
      presets: [
        {
          icon: '📄',
          name: 'All customers',
          tip: 'Browse all customer records with ID, name, email, and creation date. Limited to 50 rows. Use this to verify CRUD operations and data integrity after imports.',
          query: 'SELECT id, name, email, created_at FROM customer ORDER BY id LIMIT 50',
        },
        {
          icon: '🔢',
          name: 'Count',
          tip: 'Total number of customers in the database. Compare with the Dashboard stat card to verify consistency. Useful after bulk import or delete operations.',
          query: 'SELECT COUNT(*) as total FROM customer',
        },
        {
          icon: '🕐',
          name: 'Recent 10',
          tip: 'Last 10 created customers ordered by creation date. Compare with the Redis RecentCustomerBuffer (/customers/recent) to verify the ring buffer is in sync.',
          query:
            'SELECT id, name, email, created_at FROM customer ORDER BY created_at DESC LIMIT 10',
        },
        {
          icon: '👥',
          name: 'Duplicates',
          tip: 'Find customers with duplicate email addresses. Useful to test idempotency — if duplicates exist, the Idempotency-Key mechanism may not be working correctly.',
          query: 'SELECT email, COUNT(*) as cnt FROM customer GROUP BY email HAVING COUNT(*) > 1',
        },
      ],
    },
    {
      id: 'diagnostics' as DbTab,
      label: '🔍 PostgreSQL Diagnostics',
      presets: [
        {
          icon: '⚡',
          name: 'Active queries',
          tip: 'Currently running queries (excluding idle connections). Shows PID, state, start time, and truncated SQL. Use to identify long-running queries or stuck transactions that block other operations.',
          query:
            "SELECT pid, state, query_start, LEFT(query, 80) as query FROM pg_stat_activity WHERE state != 'idle' AND datname = current_database() ORDER BY query_start",
        },
        {
          icon: '📏',
          name: 'Table sizes',
          tip: 'Size of each table including data and indexes. Identifies the largest tables that may need partitioning or archiving.',
          query:
            'SELECT relname as table_name, pg_size_pretty(pg_total_relation_size(relid)) as total_size, pg_size_pretty(pg_relation_size(relid)) as data_size, pg_size_pretty(pg_indexes_size(relid)) as index_size, n_live_tup as live_rows FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC',
        },
        {
          icon: '📊',
          name: 'Index usage',
          tip: 'How often each index is used (scans) and how many tuples it reads. Indexes with high scans are essential.',
          query:
            'SELECT indexrelname as index_name, relname as table_name, idx_scan as scans, idx_tup_read as tuples_read, idx_tup_fetch as tuples_fetched, pg_size_pretty(pg_relation_size(indexrelid)) as size FROM pg_stat_user_indexes ORDER BY idx_scan DESC',
        },
        {
          icon: '🗑️',
          name: 'Unused indexes',
          tip: 'Indexes that have never been used since the last stats reset (excluding primary keys). These waste disk space and slow down writes.',
          query:
            "SELECT indexrelname as index_name, relname as table_name, pg_size_pretty(pg_relation_size(indexrelid)) as size FROM pg_stat_user_indexes WHERE idx_scan = 0 AND indexrelname NOT LIKE '%pkey%'",
        },
        {
          icon: '🎯',
          name: 'Cache hit ratio',
          tip: 'Percentage of data reads served from PostgreSQL shared_buffers cache vs disk. Should be >99% in production.',
          query:
            'SELECT sum(heap_blks_hit) as cache_hits, sum(heap_blks_read) as disk_reads, ROUND(sum(heap_blks_hit)::numeric / GREATEST(sum(heap_blks_hit) + sum(heap_blks_read), 1) * 100, 2) as hit_ratio_pct FROM pg_statio_user_tables',
        },
        {
          icon: '🔄',
          name: 'Sequential scans',
          tip: 'Tables with sequential scans (full table reads). High seq_scan with low idx_scan = missing index.',
          query:
            'SELECT relname as table_name, seq_scan, seq_tup_read, idx_scan, n_live_tup as live_rows, CASE WHEN seq_scan > 0 THEN ROUND(seq_tup_read::numeric / seq_scan) ELSE 0 END as avg_rows_per_seq_scan FROM pg_stat_user_tables WHERE seq_scan > 0 ORDER BY seq_tup_read DESC',
        },
        {
          icon: '🔒',
          name: 'Lock waits',
          tip: 'Queries currently blocked by another transaction holding a lock. Use during chaos testing (concurrent writes) to observe lock contention.',
          query:
            'SELECT blocked_locks.pid as blocked_pid, blocked_activity.query as blocked_query, blocking_locks.pid as blocking_pid, blocking_activity.query as blocking_query FROM pg_catalog.pg_locks blocked_locks JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype AND blocking_locks.relation = blocked_locks.relation AND blocking_locks.pid != blocked_locks.pid JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid WHERE NOT blocked_locks.granted LIMIT 10',
        },
        {
          icon: '💾',
          name: 'Database size',
          tip: 'Total size of the current database on disk. Includes all tables, indexes, and TOAST data.',
          query:
            'SELECT pg_database.datname as database, pg_size_pretty(pg_database_size(pg_database.datname)) as size FROM pg_database WHERE datname = current_database()',
        },
        {
          icon: '🔌',
          name: 'Connection stats',
          tip: 'Breakdown of connection states (active, idle, idle in transaction). Too many "idle in transaction" = unclosed transactions.',
          query:
            'SELECT state, COUNT(*) as count FROM pg_stat_activity WHERE datname = current_database() GROUP BY state ORDER BY count DESC',
        },
        {
          icon: '🐢',
          name: 'Slow query candidates',
          tip: 'Tables where sequential scans outnumber index scans — likely missing indexes.',
          query:
            'SELECT relname as table_name, seq_scan, idx_scan, CASE WHEN idx_scan > 0 THEN ROUND(seq_scan::numeric / idx_scan, 2) ELSE seq_scan END as seq_to_idx_ratio, n_live_tup as live_rows FROM pg_stat_user_tables WHERE n_live_tup > 100 AND seq_scan > idx_scan ORDER BY seq_to_idx_ratio DESC',
        },
        {
          icon: '🧹',
          name: 'Bloat estimate',
          tip: 'Dead tuples (deleted/updated rows not yet vacuumed) per table. High dead_pct means the table is bloated.',
          query:
            'SELECT relname as table_name, n_live_tup as live_rows, n_dead_tup as dead_rows, CASE WHEN n_live_tup > 0 THEN ROUND(n_dead_tup::numeric / n_live_tup * 100, 1) ELSE 0 END as dead_pct, last_vacuum, last_autovacuum FROM pg_stat_user_tables ORDER BY n_dead_tup DESC',
        },
        {
          icon: '🔗',
          name: 'Replication status',
          tip: 'Active replication connections (streaming replicas). Empty result = no replicas configured.',
          query: 'SELECT * FROM pg_stat_replication',
        },
        {
          icon: '📁',
          name: 'Tablespace usage',
          tip: 'Disk space used by each tablespace. Monitor to prevent disk exhaustion.',
          query:
            'SELECT spcname as tablespace, pg_size_pretty(pg_tablespace_size(spcname)) as size FROM pg_tablespace ORDER BY pg_tablespace_size(spcname) DESC',
        },
      ],
    },
    {
      id: 'schema' as DbTab,
      label: '🔧 Schema & Flyway',
      presets: [
        {
          icon: '📜',
          name: 'Flyway history',
          tip: 'All Flyway schema migrations applied to this database, with version, description, execution time, and success status.',
          query:
            'SELECT installed_rank, version, description, type, script, installed_on, execution_time, success FROM flyway_schema_history ORDER BY installed_rank',
        },
        {
          icon: '📋',
          name: 'All tables',
          tip: 'List of all tables in the public schema. Verify that Flyway created the expected tables (customer, flyway_schema_history, shedlock).',
          query:
            "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
        },
        {
          icon: '🏗️',
          name: 'Columns',
          tip: 'Full schema of all tables: column names, data types, nullability, and default values.',
          query:
            "SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position",
        },
        {
          icon: '🔐',
          name: 'Constraints',
          tip: 'All constraints: primary keys (p), unique (u), foreign keys (f), check (c).',
          query:
            "SELECT conname as constraint_name, conrelid::regclass as table_name, contype as type, pg_get_constraintdef(oid) as definition FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY conrelid::regclass::text",
        },
      ],
    },
    {
      id: 'investigation' as DbTab,
      label: '🚨 Production Investigation',
      presets: [
        {
          icon: '🔥',
          name: 'Long-running queries',
          tip: 'Queries running for more than 5 seconds. These block connections and may cause HikariCP pool exhaustion.',
          query:
            "SELECT pid, now() - query_start as duration, state, LEFT(query, 100) as query FROM pg_stat_activity WHERE state != 'idle' AND query_start < now() - interval '5 seconds' AND datname = current_database() ORDER BY duration DESC",
        },
        {
          icon: '💀',
          name: 'Blocked processes',
          tip: 'Processes waiting for a lock held by another process. In a deadlock, both sides appear here.',
          query:
            'SELECT a.pid as blocked_pid, a.query as blocked_query, b.pid as blocking_pid, b.query as blocking_query, a.wait_event_type, a.wait_event FROM pg_stat_activity a JOIN pg_locks l1 ON a.pid = l1.pid AND NOT l1.granted JOIN pg_locks l2 ON l1.locktype = l2.locktype AND l1.relation = l2.relation AND l2.granted AND l2.pid != l1.pid JOIN pg_stat_activity b ON b.pid = l2.pid LIMIT 20',
        },
        {
          icon: '🧵',
          name: 'Idle in transaction',
          tip: 'Connections stuck in "idle in transaction" state. These hold locks and prevent autovacuum. Transactions open >1 minute are likely bugs.',
          query:
            "SELECT pid, now() - xact_start as duration, state, LEFT(query, 80) as last_query FROM pg_stat_activity WHERE state = 'idle in transaction' AND datname = current_database() ORDER BY xact_start",
        },
        {
          icon: '📈',
          name: 'Transaction rate',
          tip: 'Commits and rollbacks per table since last stats reset. High rollback rate indicates application errors or contention.',
          query:
            'SELECT datname, xact_commit as commits, xact_rollback as rollbacks, CASE WHEN xact_commit > 0 THEN ROUND(xact_rollback::numeric / xact_commit * 100, 2) ELSE 0 END as rollback_pct FROM pg_stat_database WHERE datname = current_database()',
        },
        {
          icon: '🔍',
          name: 'Table access patterns',
          tip: 'Read vs write patterns per table. High n_tup_ins = write-heavy. High seq_scan with low idx_scan = missing index.',
          query:
            'SELECT relname as table_name, n_tup_ins as inserts, n_tup_upd as updates, n_tup_del as deletes, n_tup_hot_upd as hot_updates, seq_scan, idx_scan FROM pg_stat_user_tables ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC',
        },
        {
          icon: '⏱️',
          name: 'Oldest transaction',
          tip: 'The oldest open transaction in the database. Long-running transactions prevent VACUUM from reclaiming dead rows.',
          query:
            'SELECT pid, now() - xact_start as age, state, LEFT(query, 80) as query FROM pg_stat_activity WHERE xact_start IS NOT NULL AND datname = current_database() ORDER BY xact_start LIMIT 5',
        },
        {
          icon: '🔔',
          name: 'Temp file usage',
          tip: 'Queries that spill to disk because work_mem is too small. Large temp_bytes = slow queries.',
          query:
            'SELECT datname, temp_files, pg_size_pretty(temp_bytes) as temp_size FROM pg_stat_database WHERE datname = current_database()',
        },
      ],
    },
    {
      id: 'performance' as DbTab,
      label: '🏎️ Performance Optimization',
      presets: [
        {
          icon: '⚙️',
          name: 'PostgreSQL settings',
          tip: 'Key performance-related PostgreSQL settings: shared_buffers, work_mem, max_connections, effective_cache_size.',
          query:
            "SELECT name, setting, unit, short_desc FROM pg_settings WHERE name IN ('shared_buffers', 'work_mem', 'effective_cache_size', 'max_connections', 'maintenance_work_mem', 'random_page_cost', 'effective_io_concurrency', 'max_worker_processes', 'max_parallel_workers_per_gather', 'wal_buffers', 'checkpoint_completion_target') ORDER BY name",
        },
        {
          icon: '📊',
          name: 'Index efficiency',
          tip: 'Index size vs table size ratio. If indexes are larger than the table, consider removing unused indexes.',
          query:
            'SELECT t.relname as table_name, pg_size_pretty(pg_relation_size(t.relid)) as table_size, pg_size_pretty(pg_indexes_size(t.relid)) as total_index_size, CASE WHEN pg_relation_size(t.relid) > 0 THEN ROUND(pg_indexes_size(t.relid)::numeric / pg_relation_size(t.relid) * 100) ELSE 0 END as index_to_data_pct, t.idx_scan as total_index_scans FROM pg_stat_user_tables t ORDER BY pg_total_relation_size(t.relid) DESC',
        },
        {
          icon: '🧮',
          name: 'Seq scan vs idx scan',
          tip: 'Tables where sequential scans dominate. A table with 1000+ rows and more seq_scans than idx_scans almost certainly needs an index.',
          query:
            'SELECT relname, seq_scan, idx_scan, n_live_tup as rows, CASE WHEN seq_scan > 0 THEN n_live_tup * seq_scan ELSE 0 END as est_rows_read_seq FROM pg_stat_user_tables WHERE n_live_tup > 50 ORDER BY est_rows_read_seq DESC',
        },
        {
          icon: '🌡️',
          name: 'HOT update ratio',
          tip: 'Heap-Only Tuple (HOT) updates avoid index updates — much faster. Low HOT ratio on frequently updated tables means the updated columns are indexed.',
          query:
            'SELECT relname, n_tup_upd as updates, n_tup_hot_upd as hot_updates, CASE WHEN n_tup_upd > 0 THEN ROUND(n_tup_hot_upd::numeric / n_tup_upd * 100, 1) ELSE 0 END as hot_pct FROM pg_stat_user_tables WHERE n_tup_upd > 0 ORDER BY n_tup_upd DESC',
        },
        {
          icon: '🔄',
          name: 'Autovacuum status',
          tip: 'When autovacuum last ran on each table and how many dead tuples are waiting.',
          query:
            'SELECT relname, n_live_tup, n_dead_tup, last_vacuum, last_autovacuum, last_analyze, last_autoanalyze FROM pg_stat_user_tables ORDER BY n_dead_tup DESC',
        },
        // VACUUM operations are exposed via /actuator/maintenance (not pgweb — pgweb is read-only)
        // See the dedicated "🧹 Maintenance" section rendered in the Health tab above the SQL panel.
        {
          icon: '💿',
          name: 'WAL statistics',
          tip: 'Write-Ahead Log stats: how many WAL records are generated. High WAL volume = write-heavy workload.',
          query: 'SELECT * FROM pg_stat_wal',
        },
        {
          icon: '🏗️',
          name: 'EXPLAIN customer query',
          tip: 'Query execution plan for the main customer list query. Shows whether PostgreSQL uses an index scan or sequential scan.',
          query:
            'EXPLAIN (FORMAT TEXT) SELECT id, name, email, created_at FROM customer ORDER BY id LIMIT 20',
        },
      ],
    },
  ];

  /**
   * Calls pgweb REST API — read-only SQL proxy. The endpoint is env-aware:
   *   Local       → http://localhost:8081  (pgweb-local → compose `db:5432`)
   *   Prod tunnel → http://localhost:8082  (pgweb-prod  → host.docker.internal:15432)
   * Per ADR-0026 in mirador-service, Spring Boot is not on this path.
   */
  executeSql(): void {
    const pgweb = this.env.pgwebUrl();
    if (!pgweb) {
      this.sqlError.set(
        'SQL Explorer is unavailable in this environment. Start pgweb (bin/pgweb-prod-up.sh) or use CloudBeaver locally.',
      );
      return;
    }
    this.sqlLoading.set(true);
    this.sqlError.set('');
    this.sqlResult.set(null);

    this.http
      .get<SqlQueryResult>(`${pgweb}/api/query`, {
        params: { query: this.sqlQuery },
      })
      .subscribe({
        next: (res) => {
          const rows = res.rows ?? [];
          const columns = res.columns ?? [];
          if (columns.length > 0) {
            this.sqlResult.set({
              columns,
              rows: rows.map((r) => (r as unknown[]).map((c) => String(c ?? ''))),
            });
          } else if (res.error) {
            this.sqlError.set(res.error);
          } else {
            this.sqlResult.set({ columns: ['result'], rows: [[JSON.stringify(res)]] });
          }
          this.sqlLoading.set(false);
        },
        error: (e) => {
          this.sqlError.set(
            `pgweb not available at ${pgweb} (${e.status || 'error'}). Start it with: docker compose up -d pgweb-local  — or for Prod tunnel: bin/pgweb-prod-up.sh`,
          );
          this.sqlLoading.set(false);
        },
      });
  }
}
