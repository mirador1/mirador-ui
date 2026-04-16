# ADR-0003: Raw SVG for all visualizations, no charting library

- **Status**: Accepted
- **Date**: 2026-04-16

## Context

The app has ~15 visualisations (dashboard heatmap, topology graph,
Sankey flow, waterfall, latency histogram, error timeline, gauges,
etc.). All could be done with a library: Chart.js, Apache ECharts,
Plotly, D3. But:

- Charting libraries are heavy. The smallest mature option (Chart.js)
  ships 60-80 kB gzipped. Multiple viz types push past 200 kB.
- Libraries abstract SVG with their own DSL. When we want custom
  interactions (click-to-drill, colour-by-threshold, animated
  particles along edges), we fight the library.
- Our visualisations are bespoke one-offs, not dashboards driven by a
  schema. There's little reuse to amortise a library's weight.

## Decision

Every visualisation is **raw SVG** in an Angular template:

```html
<svg [attr.viewBox]="viewBox()">
  @for (p of points(); track p.id) {
    <circle [attr.cx]="p.x" [attr.cy]="p.y" ...></circle>
  }
</svg>
```

No charting library is a dependency. Math helpers (linear scales,
percentile buckets, path generators) live as plain TS utilities, not as
a lib.

## Consequences

### Positive
- Zero library weight in the bundle for visualisations.
- Full control: any SVG property can be bound to a signal; any effect
  can be composed.
- Trivial interop with themes — SVG `fill`, `stroke` use CSS custom
  properties that switch with dark/light mode automatically.
- `.svg` files are viewable in the browser without building the app.

### Negative
- Each new viz is ~50-300 lines of SVG + TS. A library would shorten
  some of those.
- Reimplementing axes, legends, tooltips each time is boilerplate.
- Learning curve for new contributors unfamiliar with SVG coordinate
  systems (`viewBox`, `transform`).

### Neutral
- If we ever need a complex geospatial map or a dense financial chart,
  this ADR gets revisited.

## Alternatives considered

### Alternative A — Chart.js

Rejected: too abstracted for our custom interactions (particle
animations on edges, live-colouring by threshold).

### Alternative B — D3

Rejected: D3 is a DOM manipulation library, not a chart library. Using
it from inside Angular fights the framework's data flow (D3 wants
ownership of the DOM). We ended up writing raw SVG templates anyway.

### Alternative C — ECharts

Closest match technically (declarative, themeable). Rejected for
bundle weight + abstraction distance for our custom viz types.

## References

- `src/app/features/visualizations/*` — ten+ raw-SVG visualisations.
- `src/app/features/dashboard/dashboard.component.html` — heatmap,
  sparklines, dependency graph.
- CLAUDE.md — global rule "All charts and visualizations use raw SVG".
