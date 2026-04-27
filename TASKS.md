# Tasks — `mirador-ui`

## 🎯 Surface fonctionnelle — pages e-commerce

Order + Product CRUD shipped in [stable-v1.1.6](https://gitlab.com/mirador1/mirador-ui/-/tags/stable-v1.1.6) :
all 7 screens (Orders list/create/detail/edit + Products list/create/detail/edit),
sidebar Commerce grouping, search + stock filter on Products, consumer-orders
fan-out on Product detail, Vitest specs (54 cases) + Playwright e2e + mobile
smoke. Form validation visible (disabled submit, hint banners) ; toast
notifications on every mutation ; mobile-card layouts below 700 px.

### 🤔 To consider

- ☐ **Server-side product search** — `/products?search=` not yet on backend.
  Current implementation filters client-side over the current page slice.
  Migration path documented in `products.component.ts` (300ms debounce
  pattern from order-create autocomplete is the model).
- ☐ **`PUT /orders/{id}/status` backend endpoint** — order edit shows a
  status select but cannot save it yet. Fronted with a hint banner.
  When backend ships, add `updateOrderStatus()` to `ApiService` + Save
  button + dirty-tracking signal in `OrderEditComponent`.
- ☐ **Per-line refund state machine** — `OrderLineStatus` PENDING →
  SHIPPED → REFUNDED currently displays only ; transition actions missing
  pending shared ADR for the state machine + backend write endpoint.
- ☐ **`/products/{id}/orders` server-side filter** — replace the 50-order
  client-side fan-out in `ProductDetailComponent#findConsumerOrders` once
  backend ships the dedicated endpoint.

### Cross-repo coordination (ADR-0001 polyrepo)

API client must function against
[Java](https://gitlab.com/mirador1/mirador-service-java) AND
[Python](https://gitlab.com/mirador1/mirador-service-python) — same
OpenAPI contract. Test against both backends.
