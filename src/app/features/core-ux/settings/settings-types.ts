/**
 * settings-types.ts — types used by `settings.component.ts`.
 *
 * Extracted 2026-04-22 under Phase B-7 file-length hygiene. Completes
 * the type-extraction pass across every feature component with inline
 * interfaces (pattern: `quality-types.ts`, `diagnostic-types.ts`,
 * `customers-types.ts`, `security-types.ts`, `database-types.ts`,
 * `chaos-types.ts`).
 *
 * Settings component at 290 LOC is below the 600 trigger, but keeping
 * the type-file convention uniform across features avoids the
 * "why is THIS one inline?" question on the next review.
 */

/**
 * A single ShedLock scheduled job entry from `GET /scheduled/jobs`.
 * Allows the Settings page to show which jobs are currently locked (running).
 */
export interface ScheduledJob {
  /** Spring `@Scheduled` method name used as the ShedLock lock key. */
  name: string;
  /** ISO-8601 timestamp until which the lock is held. Null when not locked. */
  lockUntil: string | null;
  /** ISO-8601 timestamp when the lock was acquired. Null when not locked. */
  lockedAt: string | null;
  /** Hostname of the node that holds the lock. Null when not locked. */
  lockedBy: string | null;
}

/**
 * Minimal shape of the Spring Boot `/actuator/env` response.
 * Only the fields needed to display property sources are typed here.
 */
export interface ActuatorEnv {
  /** List of Spring property sources (application.yml, system properties, env vars, etc.). */
  propertySources?: {
    /** Name of the property source (e.g., `'Config resource [classpath:/application.yml]'`). */
    name: string;
    /** Map of property name → value wrapper. */
    properties: Record<string, { value: string }>;
  }[];
}

/**
 * Minimal shape of the Spring Boot `/actuator/beans` response.
 * Used only to count the total number of beans in the application context.
 */
export interface ActuatorBeans {
  /** Map of application context ID → context detail including the bean map. */
  contexts?: Record<string, { beans?: Record<string, unknown> }>;
}
