# Tasks — `mirador-ui`

## 🎯 Surface fonctionnelle — pages e-commerce

Foundation **shippée 2026-04-26** dans [stable-v1.1.3](https://gitlab.com/mirador1/mirador-ui/-/tags/stable-v1.1.3) :
- ✅ `ApiService` : `Product` + `Order` interfaces + 8 CRUD methods (`OrderStatus`)
- ✅ `OrdersComponent` (standalone, OnPush, signals, mobile-responsive 44px) :
  liste paginée + create empty + delete. Route `/orders` lazy-loaded.

### Reste à compléter — 9 écrans + tests

**Order** (3 écrans manquants sur 4) :
- ☐ **Détail** : header (customer, statut, total) + table OrderLine read-only,
  actions "Add line" / "Cancel line" / "Cancel order".
- ☐ **Création** : signal-driven form, Customer autocomplete, ajout dynamique
  de lignes avec sélection Product + qty + calcul total live.
- ☐ **Édition** : modifier statut + lignes (add/remove/change qty), total
  recalculé live. Submit → PUT, Cancel → revert + redirect détail.

**Product** (4 écrans manquants sur 4) :
- ☐ **Liste** : table paginée + recherche par nom + filtre stock.
- ☐ **Détail** : caractéristiques + stock + lien vers Orders consommateurs.
- ☐ **Création** : form (name, description, prix, stock), validation
  prix > 0 + stock ≥ 0.
- ☐ **Édition** : modifier prix (NE PAS toucher `unit_price_at_order` des
  OrderLines existantes — snapshot immutable côté backend).

**Navigation + ergonomie** :
- ☐ Sidebar entry groupée sous "Commerce".
- ☐ Form validation visible (feedback rouge, disabled submit, loading state).
- ☐ Toast notifications sur succès/erreur (déjà fait dans Orders foundation).

**Tests** :
- ☐ Vitest unit sur services (`OrderService`, `ProductService` — actuellement
  inlined dans `ApiService`, à extraire ?) : mocks HTTP, error handling.
- ☐ Vitest component tests sur forms d'édition : validation + computed signals
  (total live) + interactions utilisateur simulées.
- ☐ Playwright E2E happy path : login → créer Order avec 2 OrderLines →
  éditer qty → cancel ligne → vérifier total → cancel order. Mobile 390×844 +
  desktop.

### Cross-repo coordination (ADR-0001 polyrepo)

API client doit fonctionner contre [Java](https://gitlab.com/mirador1/mirador-service-java)
ET [Python](https://gitlab.com/mirador1/mirador-service-python) — même contract
OpenAPI. Tester contre les 2 backends.
