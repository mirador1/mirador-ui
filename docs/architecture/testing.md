# Testing

Test layers, frameworks, coverage and CI integration for the full stack.

## Test Layers

| Layer | Framework | Coverage | Run with |
| --- | --- | --- | --- |
| **Angular unit tests** | Vitest + jsdom | 21 tests · 6 spec files — services, auth, env config, toast, theme | `npm test` |
| **Spring unit tests** | JUnit 5 + Mockito | JwtTokenProvider · RecentCustomerBuffer · AggregationService — no Spring context | `mvn test` |
| **Spring integration tests** | JUnit 5 + `@SpringBootTest` | CustomerApiITest · CustomerNewEndpointsITest · CustomerRestClientITest — H2 + embedded Kafka | `mvn verify` |
| **Architecture rules** | ArchUnit | Package boundaries · no circular deps · naming conventions | `mvn test` |
| **Pre-push hook** | Lefthook | Typecheck + Prettier + unit tests + production build — runs before every `git push` | Automatic |

## Test Counts & CI

- **60 Spring tests** — Unit + integration + architecture rules. Testcontainers spins up H2 and embedded Kafka — no external services needed.
- **21 Angular tests** — Pure signal-based tests — no Zone.js, no `fakeAsync`, no `detectChanges`. Signals are tested directly.
- **GitLab CI pipeline** — Full pipeline mirrors `./run.sh verify`: lint → unit → integration → build. Runs on every push to `dev`.

---
[← Back to architecture index](README.md)
