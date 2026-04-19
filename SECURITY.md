# Security policy

## Reporting a vulnerability

Mirador is a **portfolio demo project**, not a production system with
real users. It still takes security seriously because the same code
and configuration patterns are used by others as a reference.

**Please do not file public issues for security vulnerabilities.**

Instead, report them privately:

- **Email**: security@mirador1.com (monitored)
- **GitLab**: open a
  [confidential issue](https://gitlab.com/mirador1/mirador-ui/-/issues/new?issue[confidential]=true)
  — only maintainers can see it.
- **GitHub**: the mirror accepts
  [security advisories](https://github.com/mirador1/mirador-ui/security/advisories/new)
  (private to maintainers).

Include, at minimum:

- A short description of the issue
- Reproduction steps (curl command, file path, log excerpt)
- Affected version(s) — the tag or commit SHA
- Your assessment of severity (CVSS optional)

## Response timeline

| Step | Target |
|---|---|
| Acknowledge receipt | 48 hours |
| Initial triage + severity assessment | 7 days |
| Fix ready OR mitigation published | 30 days for high/critical, 90 days for medium/low |
| Public disclosure | After fix lands on `main` + 14-day embargo |

These are **targets**, not contractual commitments. This is a solo-
maintained project; response times may slip during vacation or
illness. Urgent severity is paged via the email above.

## Scope

**In scope** (we will accept reports):

- The Spring Boot 4 application (`src/main/java/com/mirador/**`)
- Container image published to the Artifact Registry
- Kubernetes manifests in `deploy/kubernetes/`
- Terraform configuration in `deploy/terraform/`
- CI configuration (`.gitlab-ci.yml`, `Jenkinsfile`, `.github/workflows/`)
- Scripts in `bin/` and `scripts/`

**Out of scope**:

- Third-party dependencies (report upstream — Renovate auto-patches
  what upstream ships)
- Configuration provided by downstream users (environment variables,
  OIDC providers they connect)
- Attacks requiring local admin access on a developer workstation
- DoS via legitimate feature use (rate-limit is configurable —
  tighten per deployment)
- Social engineering

## Security controls already in place

If you're preparing a report, check whether the issue is already
mitigated:

- **Dependency scanning**: OWASP Dep-Check + Renovate run weekly on
  every main pipeline. Known CVEs are caught.
- **Image scanning**: Trivy + Grype scan every built image on
  `main`. Grype fails the pipeline on `HIGH+`.
- **Static analysis**: Sonar + Semgrep + SpotBugs run on every MR.
- **Secret scanning**: gitleaks pre-commit + GitLab's built-in.
- **Supply chain**: SBOM generated + cosign-signed on every image.
- **Runtime policy**: PodSecurity `restricted` on the `app`
  namespace, NetworkPolicy default-deny.
- **Auth**: JWT HS256 with opaque refresh tokens in Postgres + Redis
  blacklist (see ADR-0018). OIDC path via Keycloak and Auth0.
- **Rate limit**: Bucket4j 100 req/min per IP.

If a report concerns one of these layers not working, attach the
reproduction to show where the control failed.

## Coordinated disclosure

We work with reporters on a disclosure timeline. The typical shape:

1. You report, we acknowledge.
2. We verify + develop a fix in a private branch.
3. We release the fix on `main` with minimal public commit detail.
4. 14 days after release, we publish a full advisory on GitLab +
   GitHub with credit to the reporter (unless you prefer to remain
   anonymous).

## Hall of fame

Nobody yet. Be the first — your name goes here.
