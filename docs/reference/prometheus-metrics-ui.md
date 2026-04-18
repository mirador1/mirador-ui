# UI Prometheus metrics inventory

## Summary
- **Total unique metric names**: 79
- **Categories**: jvm_* (22), http_* (4), process_* (3), system_* (3), hikaricp_* (7), kafka_* (3), spring_* (4), customer_* (7), logback_* (1), tomcat_* (3), jdbc_* (6), executor_* (5), lettuce_* (3), disk_* (2), application_* (1), tasks_* (2)

---

## Per-category listing

### jvm_* (22 metrics)

| Metric | File | Component | Line(s) |
| --- | --- | --- | --- |
| `jvm_memory_used_bytes` | metrics.service.ts | MetricsService.parsePrometheus() | 233 |
| `jvm_memory_max_bytes` | metrics.service.ts | MetricsService.parsePrometheus() | 237 |
| `jvm_threads_live_threads` | metrics.service.ts | MetricsService.parsePrometheus() | 255 |
| `jvm_memory_used_bytes` | visualizations.component.ts | Gauge: Heap Used | 326 |
| `jvm_memory_max_bytes` | visualizations.component.ts | Gauge: Heap Used | 328 |
| `jvm_memory_committed_bytes` | visualizations.component.ts | Gauge: Heap Committed | 346 |
| `jvm_memory_usage_after_gc` | visualizations.component.ts | Gauge: Heap After GC | 361 |
| `jvm_gc_live_data_size_bytes` | visualizations.component.ts | Gauge: GC Live Data | 407 |
| `jvm_gc_max_data_size_bytes` | visualizations.component.ts | Gauge: GC Live Data | 408 |
| `jvm_gc_memory_allocated_bytes_total` | visualizations.component.ts | Gauge: GC Allocated | 425 |
| `jvm_gc_memory_promoted_bytes_total` | visualizations.component.ts | Gauge: GC Promoted | 437 |
| `jvm_buffer_memory_used_bytes` | visualizations.component.ts | Gauge: Direct Buffers | 449 |
| `jvm_buffer_total_capacity_bytes` | visualizations.component.ts | Gauge: Buffer Capacity | 466 |
| `jvm_buffer_count_buffers` | visualizations.component.ts | Gauge: Buffer Count | 477 |
| `jvm_threads_live_threads` | visualizations.component.ts | Gauge: Live Threads | 561 |
| `jvm_threads_peak_threads` | visualizations.component.ts | Gauge: Peak Threads | 572 |
| `jvm_threads_daemon_threads` | visualizations.component.ts | Gauge: Daemon Threads | 583 |
| `jvm_threads_started_threads_total` | visualizations.component.ts | Gauge: Threads Started | 594 |
| `jvm_gc_pause_seconds_sum` | visualizations.component.ts | Gauge: GC Pause Total | 662 |
| `jvm_gc_pause_seconds_count` | visualizations.component.ts | Gauge: GC Collections | 678 |
| `jvm_gc_pause_seconds_max` | visualizations.component.ts | Gauge: GC Max Pause | 694 |
| `jvm_gc_overhead` | visualizations.component.ts | Gauge: GC Overhead | 710 |
| `jvm_gc_concurrent_phase_time_seconds_sum` | visualizations.component.ts | Gauge: GC Concurrent | 727 |
| `jvm_compilation_time_ms_total` | visualizations.component.ts | Gauge: JIT Compilation | 549 |
| `jvm_classes_loaded_classes` | visualizations.component.ts | Gauge: Loaded Classes | 1083 |
| `jvm_classes_loaded_count_classes_total` | visualizations.component.ts | Gauge: Classes Loaded (total) | 1099 |
| `jvm_classes_unloaded_classes_total` | visualizations.component.ts | Gauge: Classes Unloaded | 1110 |

### http_* (4 metrics)

| Metric | File | Component | Line(s) |
| --- | --- | --- | --- |
| `http_server_requests_seconds_count` | metrics.service.ts | MetricsService.parsePrometheus() | 172 |
| `http_server_requests_seconds_bucket` | metrics.service.ts | MetricsService.parsePrometheus() | 182 |
| `http_server_requests_seconds_max` | visualizations.component.ts | Metric: Max Request Duration | 1411 |
| `http_server_requests_active_seconds_gcount` | visualizations.component.ts | Metric: Active Requests | 854, 1396 |
| `http_server_requests_seconds_count` | visualizations.component.ts | Golden Signal / Metrics | 1327-1380 |

### process_* (3 metrics)

| Metric | File | Component | Line(s) |
| --- | --- | --- | --- |
| `process_cpu_usage` | metrics.service.ts | MetricsService.parsePrometheus() | 251 |
| `process_uptime_seconds` | visualizations.component.ts | Gauge: Uptime, Metric: Uptime | 1121, 1291 |
| `process_files_open_files` | visualizations.component.ts | Gauge: Open Files | 1037 |
| `process_files_max_files` | visualizations.component.ts | Gauge: Open Files | 1038 |

### system_* (3 metrics)

| Metric | File | Component | Line(s) |
| --- | --- | --- | --- |
| `system_cpu_usage` | visualizations.component.ts | Gauge: System CPU, Metric: System CPU | 505, 2249 |
| `system_cpu_count` | visualizations.component.ts | Gauge: CPU Cores, Metric: CPU Cores | 521, 2264 |
| `system_load_average_1m` | visualizations.component.ts | Gauge: Load Average, Metric: Load Average | 532, 2275 |

### hikaricp_* (7 metrics)

| Metric | File | Component | Line(s) |
| --- | --- | --- | --- |
| `hikaricp_connections_active` | metrics.service.ts | MetricsService.parsePrometheus() | 261 |
| `hikaricp_connections_idle` | metrics.service.ts | MetricsService.parsePrometheus() | 264 |
| `hikaricp_connections_pending` | metrics.service.ts | MetricsService.parsePrometheus() | 267 |
| `hikaricp_connections_active` | visualizations.component.ts | Gauge: HikariCP Active | 739, 1771 |
| `hikaricp_connections_max` | visualizations.component.ts | Gauge: HikariCP Active | 740, 1772 |
| `hikaricp_connections_idle` | visualizations.component.ts | Gauge: HikariCP Idle | 756 |
| `hikaricp_connections_pending` | visualizations.component.ts | Gauge: HikariCP Pending | 768 |
| `hikaricp_connections` | visualizations.component.ts | Gauge: HikariCP Total | 779 |
| `hikaricp_connections_timeout_total` | visualizations.component.ts | Gauge: HikariCP Timeouts, Metric | 791, 1802 |
| `hikaricp_connections_acquire_seconds_count` | visualizations.component.ts | Metric: HikariCP Acquire Time | 1817 |
| `hikaricp_connections_acquire_seconds_sum` | visualizations.component.ts | Metric: HikariCP Acquire Time | 1818 |
| `hikaricp_connections_usage_seconds_count` | visualizations.component.ts | Metric: HikariCP Usage Time | 1834 |
| `hikaricp_connections_usage_seconds_sum` | visualizations.component.ts | Metric: HikariCP Usage Time | 1835 |

### kafka_* (3 metrics)

| Metric | File | Component | Line(s) |
| --- | --- | --- | --- |
| `kafka_consumer_fetch_manager_records_lag_max` | visualizations.component.html | Error timeline tab info-tip | 308 |
| `kafka_customer_created_processed_total` | visualizations.component.ts | Gauge: Created Events | 932, 2007 |
| `kafka_customer_enrich_handled_total` | visualizations.component.ts | Gauge: Enrich Cycles, Metric: Kafka Enrich | 943, 2018 |

### spring_* (4 metrics)

| Metric | File | Component | Line(s) |
| --- | --- | --- | --- |
| `spring_kafka_template_seconds_count` | visualizations.component.ts | Gauge: Kafka Produced, Metric | 910, 1985 |
| `spring_kafka_listener_seconds_count` | visualizations.component.ts | Gauge: Kafka Consumed, Metric | 921, 1996 |
| `spring_data_repository_invocations_seconds_count` | visualizations.component.ts | Metric: JPA Queries | 1908 |
| `spring_data_repository_invocations_seconds_sum` | visualizations.component.ts | Metric: JPA Queries | 1926 |
| `spring_kafka_template_seconds_sum` | visualizations.component.ts | Metric: Kafka Produce Time | 2030 |
| `spring_kafka_listener_seconds_sum` | visualizations.component.ts | Metric: Kafka Consume Time | 2047 |
| `spring_security_filterchains_seconds_count` | visualizations.component.ts | Metric: Security Filter | 2172 |
| `spring_security_filterchains_seconds_sum` | visualizations.component.ts | Metric: Security Filter | 2176 |
| `spring_security_authorizations_seconds_count` | visualizations.component.ts | Metric: Authorization Time | 2192 |
| `spring_security_authorizations_seconds_sum` | visualizations.component.ts | Metric: Authorization Time | 2197 |
| `spring_security_filterchains_access_exceptions_after_total` | visualizations.component.ts | Gauge: Access Denied, Metric | 980, 2217 |

### customer_* (7 metrics)

| Metric | File | Component | Line(s) |
| --- | --- | --- | --- |
| `customer_created_count_total` | visualizations.component.ts | Gauge: Customers Created, Metric | 955, 2064 |
| `customer_recent_buffer_size` | visualizations.component.ts | Gauge: Recent Buffer, Metric | 966, 2143 |
| `customer_create_seconds_count` | visualizations.component.ts | Metric: Create Latency | 2075 |
| `customer_create_seconds_sum` | visualizations.component.ts | Metric: Create Latency | 2076 |
| `customer_find_all_seconds_count` | visualizations.component.ts | Metric: List Latency | 2092 |
| `customer_find_all_seconds_sum` | visualizations.component.ts | Metric: List Latency | 2093 |
| `customer_enrich_seconds_count` | visualizations.component.ts | Metric: Enrich Latency | 2109 |
| `customer_enrich_seconds_sum` | visualizations.component.ts | Metric: Enrich Latency | 2110 |
| `customer_aggregate_seconds_count` | visualizations.component.ts | Metric: Aggregate Latency | 2126 |
| `customer_aggregate_seconds_sum` | visualizations.component.ts | Metric: Aggregate Latency | 2127 |
| `customer_recent_seconds_count` | visualizations.component.ts | Metric: Recent Latency | 2154 |
| `customer_recent_seconds_sum` | visualizations.component.ts | Metric: Recent Latency | 2155 |

### logback_* (1 metric)

| Metric | File | Component | Line(s) |
| --- | --- | --- | --- |
| `logback_events_total` | visualizations.component.ts | Gauge: Log Errors, Log Warns, Log Info | 998, 1014, 1025, 1381 |

### tomcat_* (3 metrics)

| Metric | File | Component | Line(s) |
| --- | --- | --- | --- |
| `tomcat_sessions_active_current_sessions` | visualizations.component.ts | Gauge: Tomcat Sessions, Metric | 1155, 2398 |
| `tomcat_sessions_rejected_sessions_total` | visualizations.component.ts | Gauge: Tomcat Rejected, Metric | 1166, 2428 |
| `tomcat_sessions_created_sessions_total` | visualizations.component.ts | Metric: Tomcat Sessions Created | 2413 |

### jdbc_* (6 metrics)

| Metric | File | Component | Line(s) |
| --- | --- | --- | --- |
| `jdbc_connections_active` | visualizations.component.ts | Gauge: JDBC Active, Metric | 802, 1745 |
| `jdbc_connections_max` | visualizations.component.ts | Gauge: JDBC Active, Metric | 803, 1746 |
| `jdbc_connections_idle` | visualizations.component.ts | Gauge: JDBC Idle, Metric | 819, 1760 |
| `jdbc_connection_commit_total` | visualizations.component.ts | Gauge: JDBC Commits, Metric | 831, 1879 |
| `jdbc_query_seconds_count` | visualizations.component.ts | Metric: JDBC Queries | 1851 |
| `jdbc_query_seconds_sum` | visualizations.component.ts | Metric: JDBC Query Latency | 1863 |
| `jdbc_result_set_seconds_count` | visualizations.component.ts | Metric: JDBC ResultSet Time | 1890 |
| `jdbc_result_set_seconds_sum` | visualizations.component.ts | Metric: JDBC ResultSet Time | 1891 |
| `jdbc_connection_acquired_total` | visualizations.component.ts | Gauge: JDBC Acquired | 842 |

### executor_* (5 metrics)

| Metric | File | Component | Line(s) |
| --- | --- | --- | --- |
| `executor_active_threads` | visualizations.component.ts | Gauge: Executor Active, Metric | 605, 1614 |
| `executor_pool_max_threads` | visualizations.component.ts | Gauge: Executor Active | 606 |
| `executor_pool_size_threads` | visualizations.component.ts | Gauge: Executor Pool Size, Metric | 622, 1615 |
| `executor_queued_tasks` | visualizations.component.ts | Gauge: Executor Queued, Metric | 634, 1641 |
| `executor_completed_tasks_total` | visualizations.component.ts | Gauge: Executor Completed, Metric | 650, 1630 |

### lettuce_* (3 metrics)

| Metric | File | Component | Line(s) |
| --- | --- | --- | --- |
| `lettuce_seconds_count` | visualizations.component.ts | Gauge: Redis Ops, Metric: Redis Operations | 887, 1945 |
| `lettuce_active_seconds_count` | visualizations.component.ts | Gauge: Redis Active, Metric | 898, 1973 |
| `lettuce_seconds_sum` | visualizations.component.ts | Metric: Redis Latency | 1957 |

### disk_* (2 metrics)

| Metric | File | Component | Line(s) |
| --- | --- | --- | --- |
| `disk_free_bytes` | visualizations.component.ts | Gauge: Disk Free, Metric | 1054, 2340 |
| `disk_total_bytes` | visualizations.component.ts | Gauge: Disk Total, Metric | 1056, 1072 |

### application_* (1 metric)

| Metric | File | Component | Line(s) |
| --- | --- | --- | --- |
| `application_ready_time_seconds` | visualizations.component.ts | Gauge: Startup Time, Metric: Startup Time | 1138, 2308 |

### tasks_* (2 metrics)

| Metric | File | Component | Line(s) |
| --- | --- | --- | --- |
| `tasks_scheduled_execution_seconds_count` | visualizations.component.ts | Gauge: Scheduled Tasks, Metric | 1178, 2444 |
| `tasks_scheduled_execution_seconds_sum` | visualizations.component.ts | Metric: Scheduled Task Latency | 2456 |

---

## Notes on implementation

1. **Metric Discovery Method**: All metric names were extracted from:
   - `metrics.service.ts`: Raw regex patterns used for Prometheus text format parsing
   - `visualizations.component.ts`: 78 gauge definitions + 78 metric card definitions (some reused metrics)
   - HTML tooltips and info-tips referencing metric names

2. **Ambiguous/Variable Names**: None detected. All metric names are literal string constants or simple regex patterns.

3. **Coverage**:
   - **Golden Signals metrics**: 5 (Latency p50/p95/p99, Traffic, Error Rate)
   - **JVM metrics**: 22 (memory, threads, GC, buffer pools, class loading)
   - **HTTP metrics**: 5 (active requests, latencies, status codes)
   - **Database metrics**: 16 (HikariCP + JDBC + JPA)
   - **Infrastructure metrics**: 8 (CPU, disk, system load, process uptime)
   - **Custom App metrics**: 12 (customer CRUD, enrich, aggregate, recent)
   - **Message Queue metrics**: 6 (Kafka producer/consumer, lag, custom events)
   - **Caching metrics**: 3 (Redis/Lettuce operations and latency)
   - **Security metrics**: 3 (filter chain, authorization, access denied)
   - **Scheduled Tasks**: 2
   - **Logging metrics**: 4 (Logback events by level)
   - **Web Server metrics**: 3 (Tomcat sessions)

4. **Metric Aggregation**:
   - Prometheus histogram buckets are aggregated via `promSum()` method
   - Percentiles (p50/p95/p99) are computed via linear interpolation within buckets
   - Most status gauges use color thresholds (green/yellow/red)

