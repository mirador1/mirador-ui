# ADR-0001: Record architecture decisions

- **Status**: Accepted
- **Date**: 2026-04-16

## Context

Over the past few months the UI accumulated several non-obvious
decisions — zoneless change detection, raw SVG visualisations, Vitest
over Jest, standalone components with no NgModules. These choices are
easy to overlook or relitigate without a written record.

## Decision

Adopt the **Michael Nygard ADR format** in `docs/adr/`. One file per
decision, numbered sequentially. ADRs are required for:

- New tooling at the build / runtime level
- Replacing one library or framework with another
- Architectural patterns other contributors are expected to follow
- Trade-offs that are likely to be questioned later

ADRs are **not** required for code style, typo fixes, or library patch
bumps.

## Consequences

### Positive
- Decisions are greppable and survive context window resets.
- New Claude sessions can read the index in 15 minutes and understand
  the constraints.
- Superseded decisions are kept and pointered, preserving history.

### Negative
- Small overhead: ~15 minutes per decision.

## Alternatives considered

### Alternative A — Tribal knowledge / Slack

Rejected. We've tried it; nobody finds the right thread six months later.

### Alternative B — Heavyweight RFC process

Rejected. Most ADRs are one page. RFCs are for proposals needing
cross-team buy-in before code; ADRs document after the fact.

## References

- Michael Nygard — [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- Sibling service repo `docs/adr/` — same pattern.
