# Compatibility

Supported combinations of Spring Boot version and Java release, plus the source-overlay technique that keeps them building from the same codebase.

## Maven Build Profiles

Five build profiles cover every supported combination of Spring Boot version and Java release. The default profile always targets the latest stack.

| Command | Spring Boot | Java | Notable differences |
| --- | --- | --- | --- |
| `mvn verify` | 4.x | 25 | Virtual threads, ScopedValue, pattern matching — default profile |
| `mvn verify -Dcompat` | 4.x | 21 | ScopedValue replaced by ThreadLocal overlay |
| `mvn verify -Dcompat -Djava17` | 4.x | 17 | ThreadLocal + switch pattern matching rewritten as if/else |
| `mvn verify -Dsb3` | 3.4.5 | 21 | OTel via micrometer bridge; `@GetMapping(version=…)` → manual Accept-header dispatch |
| `mvn verify -Dsb3 -Djava17` | 3.4.5 | 17 | Combines SB3 bridge + Java 17 overlays |

## Source Overlay Technique

Main sources are copied to `target/merged-sources`. Version-specific directories then overwrite only the files that differ — the rest compiles unchanged.

- **`src/main/java-compat`** — ScopedValue → ThreadLocal replacement for Java < 25
- **`src/main/java-compat-java17`** — Switch pattern matching → if/else for Java 17
- **`src/main/java-sb3`** — `@GetMapping(version=…)` → manual Accept-header dispatch for Spring Boot 3

---
[← Back to architecture index](README.md)
