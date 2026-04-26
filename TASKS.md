# Tasks — `mirador-ui`

## 🎯 Augmenter la surface fonctionnelle — nouvelles entités

☐ Ajouter les pages UI pour les nouvelles entités (mirror du backend
java + python).

**Scope final (validé utilisateur 2026-04-26)** : Pattern A (e-commerce)
+ relation `User` extraite du Pattern B (SaaS rôles) :

- **`User`** — identité auth avec rôles (USER / ADMIN / MANAGER), linked
  to `Customer` via `customer_id`
- **`Order`** — DEUX FKs : `customer_id` (buyer) + `created_by_user_id`
  (opérateur). Statut + total
- **`Product`** — name, prix, stock
- **`OrderLine`** — Order ↔ Product, quantité + prix snapshot

### Acceptance criteria

- [ ] Services Angular : `UserService`, `OrderService`, `ProductService`
      dans `src/app/core/api/` (pattern existant pour `CustomerService`)
- [ ] Pages list + detail + create / edit pour chaque entité (Angular 21
      zoneless + signals — pas de `ngModel` ni `*ngIf`)
- [ ] Routes dans `app.routes.ts` (lazy-loaded per ADR-0005 standalone-components)
- [ ] Sidebar entries groupées sous "Commerce" (ou label retenu après
      validation utilisateur) ; "Users" sous "Admin"
- [ ] **Role-aware UI** : afficher / cacher les actions selon le rôle de
      l'utilisateur connecté (lecture du JWT côté client). Endpoints
      ADMIN-only doivent avoir un bouton/lien hidden pour USER.
- [ ] Mobile-responsive (cf. ADR-0010 + global CLAUDE.md "Mobile-responsive by default")
- [ ] Vitest unit tests (coverage maintained)
- [ ] Playwright E2E happy path : créer un Order avec 2 OrderLines + login
      avec un User MANAGER
- [ ] Pas de jQuery, pas de `*ngIf` / `*ngFor` (use `@if` / `@for` per
      critical Angular rules)
- [ ] CHANGELOG entry au prochain `stable-vX.Y.Z`

### Cross-repo coordination (cf. common ADR-0001 polyrepo)

API client doit pointer vers les nouveaux endpoints. Tester contre LES
DEUX backends (java + python) — même réponse attendue par contract
OpenAPI. Acceptance partielle si l'un des 3 repos n'a pas livré.
