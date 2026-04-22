// quality-types.ts — TypeScript interfaces for the quality-report JSON
// returned by /actuator/quality. Extracted 2026-04-22 from quality.component.ts
// under Phase B-7 (split quality.component.ts 764 → ~210 component + 550 types).
//
// All 9 QcTab* children import from here instead of from quality.component,
// avoiding the coupling-to-component that would force re-imports on every
// component-level refactor.
//
// No Angular, no RxJS, no runtime dependencies — pure types. Tree-shake-
// friendly for consumers that only need one or two interfaces.

/**
 * A slow test entry from the Surefire report.
 * Listed in the "Slowest Tests" section of the Overview tab.
 */
export interface SlowTest {
  /** Fully-qualified test method name (e.g., `'com.example.CustomerServiceTest#testCreate'`). */
  name: string;
  /** Human-readable duration string (e.g., `'2.345 s'`). */
  time: string;
  /** Duration in milliseconds for sorting. */
  timeMs: number;
}

/**
 * Aggregated results for one Surefire test suite (JUnit class).
 * Shown in the per-suite breakdown table in the Tests tab.
 */
export interface TestSuite {
  /** Test class name (short). */
  name: string;
  /** Total number of test methods in this class. */
  tests: number;
  /** Number of tests that threw an `AssertionError`. */
  failures: number;
  /** Number of tests that threw an unexpected exception. */
  errors: number;
  /** Number of tests annotated `@Disabled` or otherwise skipped. */
  skipped: number;
  /** Total elapsed time string for the suite. */
  time: string;
}

/**
 * Overall test results from Maven Surefire, sourced from `/actuator/quality`.
 * The `available` flag is false when the quality endpoint has no test data
 * (e.g., tests have not been run since the last build).
 */
export interface TestsReport {
  /** True when test data is available in the quality endpoint response. */
  available: boolean;
  /** Overall pass/fail status. */
  status?: 'PASSED' | 'FAILED';
  /** Total number of test methods across all suites. */
  total?: number;
  /** Number of passing tests. */
  passed?: number;
  /** Number of failing tests (assertion errors). */
  failures?: number;
  /** Number of errored tests (unexpected exceptions). */
  errors?: number;
  /** Number of skipped tests. */
  skipped?: number;
  /** Total elapsed time string for the full test run. */
  time?: string;
  /** ISO-8601 timestamp of when the tests were run. */
  runAt?: string;
  /** Per-class suite results. */
  suites?: TestSuite[];
  /** Top slowest individual test cases. */
  slowestTests?: SlowTest[];
}

/**
 * A generic coverage counter for one coverage dimension.
 * Used across JaCoCo metrics (instructions, branches, lines, methods).
 */
export interface Counter {
  /** Number of covered items. */
  covered: number;
  /** Total items (covered + uncovered). */
  total: number;
  /** Coverage percentage (0–100). */
  pct: number;
}

/** JaCoCo coverage data for one Java package. */
export interface PackageCoverage {
  /** Package name (e.g., `'com.example.service'`). */
  name: string;
  /** Instruction coverage percentage for this package. */
  instructionPct: number;
  /** Line coverage percentage for this package. */
  linePct: number;
}

/**
 * JaCoCo code coverage report, sourced from `/actuator/quality`.
 * Shown in the Coverage tab with overall counters and per-package bars.
 */
export interface CoverageReport {
  /** True when JaCoCo data is available (tests must have been run). */
  available: boolean;
  /** Byte-code instruction coverage. */
  instructions?: Counter;
  /** Branch coverage (if/switch decisions). */
  branches?: Counter;
  /** Line coverage. */
  lines?: Counter;
  /** Method coverage. */
  methods?: Counter;
  /** Per-package coverage breakdown. */
  packages?: PackageCoverage[];
}

/** A single SpotBugs bug pattern finding. */
export interface BugItem {
  /** SpotBugs bug category (e.g., `'CORRECTNESS'`, `'PERFORMANCE'`). */
  category: string;
  /** SpotBugs priority: `'1'` (highest) to `'5'` (lowest). */
  priority: string;
  /** SpotBugs bug pattern type (e.g., `'NP_NULL_ON_SOME_PATH'`). */
  type: string;
  /** Fully-qualified class name where the bug was found. */
  className: string;
}

/**
 * SpotBugs static analysis report, sourced from `/actuator/quality`.
 */
export interface BugsReport {
  /** True when SpotBugs data is available. */
  available: boolean;
  /** Total number of bugs found. */
  total?: number;
  /** Bug counts grouped by category. */
  byCategory?: Record<string, number>;
  /** Bug counts grouped by priority. */
  byPriority?: Record<string, number>;
  /** Full list of individual bug items. */
  items?: BugItem[];
}

/**
 * Maven build metadata, sourced from `/actuator/quality`.
 * Shown in the Build section of the Overview tab.
 */
export interface BuildReport {
  /** True when build metadata is available. */
  available: boolean;
  /** Maven `artifactId`. */
  artifact?: string;
  /** Maven project version. */
  version?: string;
  /** Build timestamp. */
  time?: string;
  /** Java version used to compile the project (e.g., `'25'`). */
  javaVersion?: string;
  /** Spring Boot version (e.g., `'4.0.0'`). */
  springBootVersion?: string;
}

/** A single PMD (Java static analysis) rule violation. */
export interface PmdViolation {
  /** Source file path (relative to project root). */
  file: string;
  /** PMD rule name that was violated (e.g., `'UnusedImports'`). */
  rule: string;
  /** PMD ruleset the rule belongs to (e.g., `'Best Practices'`). */
  ruleset: string;
  /** Priority level string: `'1'` (highest) to `'5'` (lowest). */
  priority: string;
  /** Human-readable violation message. */
  message: string;
}

/**
 * PMD static analysis report, sourced from `/actuator/quality`.
 */
export interface PmdReport {
  /** True when PMD data is available. */
  available: boolean;
  /** Total violation count. */
  total?: number;
  /** Violations grouped by ruleset. */
  byRuleset?: Record<string, number>;
  /** Violations grouped by priority. */
  byPriority?: Record<string, number>;
  /** Most frequently violated rules. */
  topRules?: { rule: string; count: number }[];
  /** Full violation list. */
  violations?: PmdViolation[];
}

/** A single Checkstyle style violation. */
export interface CheckstyleViolation {
  /** Source file path. */
  file: string;
  /** Line number where the violation occurs. */
  line: string;
  /** Severity level (e.g., `'error'`, `'warning'`). */
  severity: string;
  /** Checkstyle checker class name (e.g., `'LineLength'`). */
  checker: string;
  /** Human-readable violation message. */
  message: string;
}

/**
 * Checkstyle code style report, sourced from `/actuator/quality`.
 */
export interface CheckstyleReport {
  /** True when Checkstyle data is available. */
  available: boolean;
  /** Total violation count. */
  total?: number;
  /** Violations grouped by severity. */
  bySeverity?: Record<string, number>;
  /** Most frequent checker violations. */
  topCheckers?: { checker: string; count: number }[];
  /** Full violation list. */
  violations?: CheckstyleViolation[];
}

/** A single CVE found by the OWASP Dependency-Check scan. */
export interface OwaspVuln {
  /** CVE identifier (e.g., `'CVE-2023-12345'`). */
  cve: string;
  /** CVSS severity string: `'CRITICAL'`, `'HIGH'`, `'MEDIUM'`, `'LOW'`. */
  severity: string;
  /** CVSS base score (0.0–10.0). */
  score: number;
  /** Maven `groupId:artifactId:version` of the affected dependency. */
  dependency: string;
  /** CVE description text. */
  description: string;
}

/**
 * OWASP Dependency-Check CVE scan report, sourced from `/actuator/quality`.
 */
export interface OwaspReport {
  /** True when OWASP scan data is available. */
  available: boolean;
  /** Total CVE count. */
  total?: number;
  /** CVEs grouped by severity. */
  bySeverity?: Record<string, number>;
  /** Full list of vulnerabilities. */
  vulnerabilities?: OwaspVuln[];
}

/** One layer in the Spring Boot executable JAR structure. */
export interface JarLayer {
  /** Layer name (e.g., `'application'`, `'dependencies'`, `'spring-boot-loader'`). */
  name: string;
  /** Number of entries (files) in this layer. */
  entries: number;
}

/**
 * Runtime metadata about the currently running Spring Boot application.
 * Sourced from `/actuator/quality` — useful for correlating report data with the live instance.
 */
export interface RuntimeReport {
  /** True when runtime data is available. */
  available: boolean;
  /** Active Spring profiles (e.g., `['default']`, `['docker', 'metrics']`). */
  activeProfiles?: string[];
  /** Application uptime in seconds. */
  uptimeSeconds?: number;
  /** Human-readable uptime string (e.g., `'2h 35m'`). */
  uptimeHuman?: string;
  /** ISO-8601 timestamp when the application started. */
  startedAt?: string;
  /** Spring Boot startup duration in milliseconds (JVM launch → ApplicationReady). */
  startupDurationMs?: number;
  /** Spring Boot startup duration in seconds (convenience field). */
  startupDurationSeconds?: number;
  /** JAR layer breakdown (from Spring Boot layered JAR tooling). */
  jarLayers?: JarLayer[];
}

/** A single PIT mutation testing mutation result. */
export interface PitestMutation {
  /** Fully-qualified class name where the mutation was applied. */
  class: string;
  /** Method name that was mutated. */
  method: string;
  /** PIT mutator name (e.g., `'CONDITIONALS_BOUNDARY'`). */
  mutator: string;
  /** Human-readable description of the mutation applied. */
  description: string;
}

/**
 * PIT mutation testing report, sourced from `/actuator/quality`.
 * The mutation score measures test suite effectiveness — 100% means all mutations were killed.
 */
export interface PitestReport {
  /** True when PIT data is available. */
  available: boolean;
  /** Optional note (e.g., if PIT was not run). */
  note?: string;
  /** Total number of mutations generated. */
  total?: number;
  /** Number of mutations detected (killed) by the test suite. */
  killed?: number;
  /** Number of mutations not detected (survived) — test gaps to investigate. */
  survived?: number;
  /** Number of mutations in code with no test coverage at all. */
  noCoverage?: number;
  /** Mutation score as a percentage (killed / total × 100). */
  score?: number;
  /** Mutation counts grouped by status. */
  byStatus?: Record<string, number>;
  /** Mutation counts grouped by mutator type. */
  byMutator?: Record<string, number>;
  /** Surviving mutations that tests failed to detect. */
  survivingMutations?: PitestMutation[];
}

/**
 * Root type returned by `GET /actuator/quality`.
 * Aggregates all quality report sections into a single response.
 * Each sub-report has an `available` flag — sections are omitted or marked unavailable
 * if the corresponding tool was not run during the last Maven build.
 */
export interface QualityReport {
  /** ISO-8601 timestamp when the report was generated. */
  generatedAt: string;
  /** Surefire test results. */
  tests: TestsReport;
  /** JaCoCo code coverage results. */
  coverage: CoverageReport;
  /** SpotBugs static analysis results. */
  bugs: BugsReport;
  /** Maven build metadata. */
  build: BuildReport;
  /** Git commit history and remote URL. */
  git?: {
    available: boolean;
    remoteUrl?: string;
    commits?: { hash: string; author: string; date: string; message: string }[];
  };
  /** REST API endpoint inventory from SpringDoc. */
  api?: {
    available: boolean;
    total?: number;
    endpoints?: { path: string; methods: string[]; handler: string }[];
  };
  /** Maven dependency list from the POM, with optional freshness data from Maven Central. */
  dependencies?: {
    available: boolean;
    total?: number;
    /** Number of dependencies with a newer version available on Maven Central. */
    outdatedCount?: number;
    /** Full transitive dependency tree (generated by maven-dependency-plugin:tree). */
    dependencyTree?: {
      available: boolean;
      /** Raw indented tree text from `mvn dependency:tree`. */
      tree?: string;
      /** Total transitive dependency count (lines with indentation in tree). */
      totalTransitive?: number;
    };
    /** Output of maven-dependency-plugin:analyze-only — dependency hygiene issues. */
    dependencyAnalysis?: {
      available: boolean;
      /** Dependencies used at compile time but not declared in pom.xml (transitive leakage). */
      usedUndeclared?: string[];
      usedUndeclaredCount?: number;
      /** Dependencies declared in pom.xml but not detected in compiled bytecode. */
      unusedDeclared?: string[];
      unusedDeclaredCount?: number;
    };
    dependencies?: {
      groupId: string;
      artifactId: string;
      version: string;
      scope: string;
      /** Latest version on Maven Central (undefined when dep is BOM-managed or check timed out). */
      latestVersion?: string;
      /** True when latestVersion differs from version (and version is not a pre-release). */
      outdated?: boolean;
    }[];
  };
  /** Source code metrics (class/method/line counts and complexity). */
  metrics?: {
    available: boolean;
    totalClasses?: number;
    totalMethods?: number;
    totalLines?: number;
    totalComplexity?: number;
    packages?: {
      name: string;
      classes: number;
      methods: number;
      lines: number;
      complexity?: number;
    }[];
    /** Top 10 most complex classes by cyclomatic complexity (COMPLEXITY_MISSED + COMPLEXITY_COVERED). */
    topComplexClasses?: {
      class: string;
      complexity: number;
    }[];
    /** Classes with 0% method coverage (METHOD_COVERED=0 but METHOD_TOTAL>0). */
    untestedClasses?: string[];
    /** Number of classes with 0% method coverage. */
    untestedCount?: number;
  };
  /** PMD static analysis results. */
  pmd?: PmdReport;
  /** Checkstyle code style results. */
  checkstyle?: CheckstyleReport;
  /** OWASP CVE scan results. */
  owasp?: OwaspReport;
  /** PIT mutation testing results. */
  pitest?: PitestReport;
  /** Live runtime metadata. */
  runtime?: RuntimeReport;
  /**
   * @deprecated Removed 2026-04-22 per ADR-0052 — the backend no longer
   * calls the GitLab REST API. Dashboard's Pipeline tab links to
   * gitlab.com/mirador1/mirador-service/-/pipelines directly. Kept on
   * the interface with an optional type so older cached responses don't
   * fail to parse; new responses never set it.
   */
  pipeline?: PipelineReport;
  /**
   * @deprecated Removed 2026-04-22 per ADR-0052 — SonarCloud REST call
   * moved out of the runtime path. Dashboard links to sonarcloud.io
   * directly.
   */
  sonar?: SonarReport;
  /** Remote git branches with last-commit date (up to 20, sorted by recency). */
  branches?: BranchesReport;
  /** Third-party dependency license compliance (from license-maven-plugin:add-third-party). */
  licenses?: {
    available: boolean;
    total?: number;
    /** Number of dependencies with potentially incompatible licenses (GPL, AGPL, LGPL, CDDL, EPL). */
    incompatibleCount?: number;
    /** License names grouped by usage count, sorted by count desc. */
    licenses?: { license: string; count: number; incompatible: boolean }[];
    dependencies?: {
      group: string;
      artifact: string;
      version: string;
      license: string;
      /** True when license is GPL/AGPL/LGPL/CDDL/EPL — may be incompatible with commercial use. */
      incompatible: boolean;
    }[];
  };
}

/** Remote git branches with last-commit date, from `git for-each-ref refs/remotes`. */
export interface BranchesReport {
  available: boolean;
  reason?: string;
  total?: number;
  branches?: {
    name: string;
    lastCommit: string;
    author: string;
  }[];
}

/** GitLab CI/CD pipeline history fetched from the GitLab REST API. */
export interface PipelineReport {
  available: boolean;
  reason?: string;
  projectId?: string;
  host?: string;
  pipelines?: {
    id: number;
    ref: string;
    status: string;
    createdAt: string;
    durationSeconds?: number;
    webUrl: string;
  }[];
}

/**
 * SonarQube analysis metrics returned by `/actuator/quality` sonar section.
 * Populated by the backend calling the SonarQube REST API — returns `available: false`
 * if SonarQube is unreachable, has no token, or the project key has no analysis yet.
 */
export interface SonarReport {
  /** True when a SonarQube instance was reachable and returned data for this project. */
  available: boolean;
  /** SonarQube project key (e.g., `'mirador'`). */
  projectKey?: string;
  /** Direct URL to the SonarQube project dashboard (used for "Open ↗" links). */
  url?: string;
  /** Number of bugs detected. */
  bugs?: number;
  /** Number of security vulnerabilities. */
  vulnerabilities?: number;
  /** Number of code smells (maintainability issues). */
  codeSmells?: number;
  /** Test coverage percentage as reported by SonarQube (from JaCoCo XML). */
  coverage?: number;
  /** Code duplication percentage. */
  duplications?: number;
  /** Total non-commented lines of code. */
  linesOfCode?: number;
  /** Reliability rating: A (0 bugs) through E (≥1 blocker). */
  reliabilityRating?: string;
  /** Security rating: A (0 vulnerabilities) through E (≥1 blocker). */
  securityRating?: string;
  /** Maintainability (technical debt) rating: A through E. */
  maintainabilityRating?: string;
}

/**
 * Descriptor for one raw Maven Site HTML report shown at the bottom of the Overview tab.
 * Each entry links to a static HTML file served by the nginx Maven site server (port 8084).
 */
export interface MavenSiteReport {
  /** Display label for the report link (e.g., `'JaCoCo Coverage'`). */
  label: string;
  /** Relative file path within the Maven site root (e.g., `'jacoco/index.html'`). */
  file: string;
  /** Emoji icon displayed beside the label. */
  icon: string;
}
