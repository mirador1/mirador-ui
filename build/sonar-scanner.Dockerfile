# =============================================================================
# Custom SonarScanner CLI image for Mirador UI's CI sonarcloud job.
#
# WHY this exists (waves 1-10 history, 2026-04-23 → 2026-04-25):
#
#   The upstream `sonarsource/sonar-scanner-cli:11.x` image runs as the
#   non-root `scanner-cli` user but ships `/home/scanner-cli` owned by
#   root with mode 0755 — meaning the user CANNOT create subdirectories
#   inside its own home. The Sonar JS/TS analyser ("bridge server")
#   downloads the `tree-sitter` native parser at runtime and tries to
#   write it under `~/.tree-sitter/lib`, which crashes with:
#
#     java.lang.RuntimeException: Failed to create directory:
#       /home/scanner-cli/.tree-sitter/lib
#
#   followed by:
#
#     java.lang.IllegalStateException: WebSocket connection closed
#       abnormally
#
#   when the bridge subprocess dies and Java's JS sensor loses its
#   WebSocket connection.
#
#   Waves 7-10 tried HOME override, chmod, XDG_DATA_HOME, and finally
#   a symlink from /home/scanner-cli/.tree-sitter to a writable
#   $SONAR_USER_HOME/.tree-sitter — all failed because Node's
#   `os.homedir()` reads /etc/passwd (it ignores the HOME env var
#   inside the bundled Node runtime), AND because the symlink rm/ln
#   ran as `scanner-cli` against a root-owned directory (`|| true`
#   silently swallowed the EACCES, leaving the original directory
#   in place).
#
#   The only fix that actually closes the loop is to chown the home
#   directory ONCE at image build time, while we're still root.
#   That's what this thin layer does.
#
# WHAT this image adds on top of the upstream:
#
#   1. /home/scanner-cli is chowned to scanner-cli:scanner-cli with
#      mode 0775, so the runtime user can mkdir -p ~/.tree-sitter/lib
#      without further hacks.
#   2. /home/scanner-cli/.tree-sitter is pre-created with the right
#      ownership — eliminates the race where Node tries to mkdir the
#      directory before the chown propagates through the overlay FS.
#
# WHAT this image deliberately does NOT add:
#
#   - No SONAR_TOKEN baked in. The token still comes from a CI variable
#     at job-run time (mounted via $SONAR_TOKEN). Baking secrets into
#     images is an anti-pattern even for "private" registries.
#   - No project.properties. The scanner reads
#     config/sonar-project.properties from the checked-out source.
#   - No version bump strategy. Renovate (if configured) or a manual
#     bump tracks the upstream pin; this Dockerfile pins to a SPECIFIC
#     full version (not a floating major) per CLAUDE.md "pin every
#     upstream reference. No floating tags." rule.
#
# Build + push:
#
#   docker buildx build --platform linux/amd64 \
#     -f build/sonar-scanner.Dockerfile \
#     -t registry.gitlab.com/mirador1/mirador-ui/sonar-scanner:11.5.0.2154 \
#     --push .
#
#   The CI job `sonar-scanner:image` automates this — runs only when
#   this Dockerfile changes (path-filtered) so we don't rebuild the
#   image on every commit.
# =============================================================================

# Pinned to the FULL version (scanner CLI 11.5.0.2154 + bundled Sonar
# scanner 7.3.0). The `:11` floating tag would silently roll forward
# the next time SonarSource ships an 11.x release — that's exactly
# the class of breakage CLAUDE.md "pin every upstream" exists to
# prevent. When we want a newer scanner, bump this line in a dedicated
# commit so the upgrade is auditable.
FROM sonarsource/sonar-scanner-cli:11.5.0.2154_7.3.0

# Switch to root just long enough to fix the home directory permissions.
# The upstream image's runtime CMD already runs as scanner-cli (uid 1000),
# so this USER root only affects build-time RUN steps.
USER root

# 1. Make /home/scanner-cli writable by the scanner-cli user.
# 2. Pre-create .tree-sitter so the bridge subprocess never has to
#    mkdir at runtime (eliminates a race with overlay-fs propagation
#    on first analysis).
# 3. Pre-create .sonar (cache dir) for the same reason — it's
#    overridden by SONAR_USER_HOME=$CI_PROJECT_DIR/.sonar in the CI
#    job, but having it here doesn't hurt and matches the symmetry.
RUN chown -R scanner-cli:scanner-cli /home/scanner-cli && \
    chmod -R u+rwX,g+rwX /home/scanner-cli && \
    mkdir -p /home/scanner-cli/.tree-sitter/lib && \
    mkdir -p /home/scanner-cli/.sonar && \
    chown -R scanner-cli:scanner-cli /home/scanner-cli/.tree-sitter \
                                     /home/scanner-cli/.sonar

# Drop back to the upstream runtime user. CMD/ENTRYPOINT inherit
# from the base image — `sonar-scanner` on PATH is unchanged.
USER scanner-cli

# OCI labels — traceability for cosign / Trivy / GitLab registry UI.
# These mirror the labels on build/Dockerfile (the SPA image).
LABEL org.opencontainers.image.title="mirador-ui-sonar-scanner" \
      org.opencontainers.image.description="Mirador UI custom SonarScanner CLI image with writable /home/scanner-cli for the JS/TS bridge tree-sitter cache" \
      org.opencontainers.image.source="https://gitlab.com/mirador1/mirador-ui" \
      org.opencontainers.image.licenses="Proprietary" \
      org.opencontainers.image.vendor="mirador1" \
      org.opencontainers.image.base.name="sonarsource/sonar-scanner-cli:11.5.0.2154_7.3.0"
