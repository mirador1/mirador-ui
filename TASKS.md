# Tasks — `mirador-ui`

## 🎯 Surface fonctionnelle — pages e-commerce

Order + Product CRUD shipped in [stable-v1.1.6](https://gitlab.com/mirador1/mirador-ui/-/tags/stable-v1.1.6),
followed by a 2026-04-27 wave that closed every "🤔 To consider" item :

- ✅ Server-side product search ([!171](https://gitlab.com/mirador1/mirador-ui/-/merge_requests/171))
- ✅ `PUT /orders/{id}/status` Save button + dirty tracking ([!172](https://gitlab.com/mirador1/mirador-ui/-/merge_requests/172))
- ✅ `GET /products/{id}/orders` server-side filter (drops the
  50-order client-side fan-out, [!172](https://gitlab.com/mirador1/mirador-ui/-/merge_requests/172))
- ✅ ML/Insights surface : `/insights/churn` page ([!169](https://gitlab.com/mirador1/mirador-ui/-/merge_requests/169))

### 🤔 To consider

- ☐ **Per-line refund state machine** — `OrderLineStatus` PENDING →
  SHIPPED → REFUNDED currently displays only ; transition actions
  missing pending the backend write endpoint
  `PATCH /orders/{order_id}/lines/{line_id}/status` (spec gelée in
  [shared ADR-0063](https://gitlab.com/mirador1/mirador-service-shared/-/blob/main/docs/adr/0063-order-line-refund-state-machine.md)).
  When the Java + Python implementations land, add a "Refund" button +
  dialog (reason + actor) on `OrderEditComponent` rows where
  `status = SHIPPED`.

### Cross-repo coordination (ADR-0001 polyrepo)

API client must function against
[Java](https://gitlab.com/mirador1/mirador-service-java) AND
[Python](https://gitlab.com/mirador1/mirador-service-python) — same
OpenAPI contract. Test against both backends.
