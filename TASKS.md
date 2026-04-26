# Tasks — `mirador-ui`

## 🎯 Augmenter la surface fonctionnelle — nouvelles entités

**🚩 État au flush 2026-04-26 12:14** : work pas encore démarré en UI.
Bloqué sur backend (java + python) — UI ne peut commencer que quand
les endpoints Order/Product/OrderLine existent. Voir
[Java TASKS.md](https://gitlab.com/mirador1/mirador-service-java/-/blob/main/TASKS.md)
"Awaiting clarification" : foundation Java a été démarrée puis
interrompue par utilisateur, en attente de confirmation scope avant de
reprendre.

☐ Ajouter les pages UI pour les 3 nouvelles entités (mirror du backend
java + python).

**Scope final (validé utilisateur 2026-04-26)** : Pattern A simplifié —
`Customer` existant reste tel quel, 3 nouvelles entités :

- **`Order`** — FK `customer_id`, statut, total
- **`Product`** — name, prix, stock
- **`OrderLine`** — entité avec quantité + prix snapshot + statut
  individuel (PAS juste un join Order ↔ Product)

### Acceptance criteria

#### Services + composants

- [ ] Services Angular typés : `OrderService`, `ProductService` dans
      `src/app/core/api/` (pattern existant `CustomerService`). HTTP client
      typed avec OpenAPI-generated interfaces si possible.
- [ ] Composants standalone (pas de NgModule per ADR-0005), zoneless +
      signals, control flow `@if` / `@for` (PAS `*ngIf` / `*ngFor`).

#### Écrans (3 entités × 4 écrans = 12 écrans minimum)

**Order** :
- [ ] **Liste** : table paginée (signals), filtre statut + customer +
      date range, sortable. Lien "Détail" + "Éditer" par ligne.
- [ ] **Détail** : header (customer, statut, total) + table des
      `OrderLine` (read-only). Actions : "Add line", "Cancel line"
      individuelle, "Cancel order".
- [ ] **Création** : formulaire (signal-driven, pas `ngModel`) avec
      sélection Customer (autocomplete), ajout dynamique de lignes
      (sélection Product + quantité, calcul total live).
- [ ] **Édition** : modifier statut, modifier les lignes (add /
      remove / change qty), recalcul total live. Submit → PUT
      /orders/{id}. Cancel → revert + redirect détail.

**Product** :
- [ ] **Liste** : table paginée + recherche par nom + filtre stock.
- [ ] **Détail** : caractéristiques + stock + lien vers les Orders
      qui contiennent ce Product.
- [ ] **Création** : formulaire (name, description, prix, stock).
      Validation prix > 0 + stock ≥ 0.
- [ ] **Édition** : modifier prix (NE PAS modifier
      `unit_price_at_order` des OrderLines existantes — c'est snapshot
      immutable côté backend).

**OrderLine** :
- [ ] **Pas d'écran dédié** — toujours affichée dans le contexte d'un
      Order (page détail + édition Order).

#### Navigation + ergonomie

- [ ] Routes dans `app.routes.ts` (lazy-loaded per ADR-0005 standalone)
- [ ] Sidebar entries groupées sous "Commerce" (ou label retenu après
      validation utilisateur)
- [ ] Mobile-responsive (cf. ADR-0010 + global CLAUDE.md "Mobile-responsive
      by default") : viewport 375px verified, sidebar collapse, tap
      targets ≥ 44 px, no horizontal scrollbar
- [ ] Form validation : visible feedback (rouge en erreur), disabled
      submit si invalid, loading state pendant POST/PUT
- [ ] Toast notifications via `ToastService` (existant) sur succès/erreur

#### Tests

- [ ] **Vitest unit tests** sur les services (`OrderService`,
      `ProductService`) : mocks HTTP, error handling, retry logic.
      Coverage maintenue (cf. CI bundle-size + coverage rules).
- [ ] **Vitest component tests** sur les forms d'édition : validation,
      computed signals (total live), interaction utilisateur simulée.
- [ ] **Playwright E2E happy path** : (1) login Customer existant,
      (2) créer un `Order` avec 2 `OrderLine`, (3) éditer la quantité
      d'une ligne, (4) cancel une ligne, (5) vérifier le total
      recalculé, (6) cancel l'order entière. Mobile viewport variant
      (390 × 844) en plus du desktop.
- [ ] **Coverage maintained** : pas de drop sous le seuil global Vitest.
      Stability-check passe sur le nouveau code.

#### Hygiène

- [ ] Pas de jQuery, pas de `*ngIf` / `*ngFor` (use `@if` / `@for` per
      critical Angular rules)
- [ ] Type safety : pas d'`any`, error handlers non-vides (cf. global
      CLAUDE.md "Error handling")
- [ ] CHANGELOG entry au prochain `stable-vX.Y.Z`

### Cross-repo coordination (cf. common ADR-0001 polyrepo)

API client doit pointer vers les nouveaux endpoints. Tester contre LES
DEUX backends (java + python) — même réponse attendue par contract
OpenAPI. Acceptance partielle si l'un des 3 repos n'a pas livré.
