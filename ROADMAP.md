# Mirador — Roadmap (tâches non-validées)

> **Statut** — Ce fichier contient des propositions **pas encore validées**
> par l'utilisateur. Rien n'est committé, rien n'est en cours. Il sert
> d'atterrissage pour les discussions sur la maturité industrielle au-delà
> du scope couvert par les ADR-0001 à ADR-0009.
>
> À ne pas confondre avec `TASKS.md` : TASKS.md liste du travail **engagé**
> (en cours ou planifié court terme), supprimé dès qu'il est vide. ROADMAP.md
> est une **liste d'options** ; un item passe dans TASKS.md **après validation
> explicite** par l'utilisateur.
>
> Chaque item inclut : effort estimé, répartition UI / service, justification,
> ce que ça attrape que l'existant ne voit pas, et ce que ça coûte en
> complexité long terme. Le rejet motivé figure aussi — savoir **pourquoi on
> ne fait pas** certaines choses est aussi important que savoir pourquoi on
> les fait.

## Légende

- `[ ]` — proposition ouverte, pas encore arbitrée
- `[~]` — arbitrage en cours (jamais persisté ici ; passe immédiatement en TASKS.md)
- Effort : heures de dev pour une première version livrable et testée localement
- Repo : `ui` (mirador-ui), `svc` (mirador-service), `both` (change les deux)

---

## Tier 1 — Vrais trous industriels à combler

Ces trois items forment la **boucle ops fermée** :
SLO définit la cible, Playwright vérifie qu'on l'atteint en CI,
Argo Rollouts la protège en prod à chaque déploiement.

### 1. `[ ]` SLO + error budget via Sloth — `svc` — **2 h**

**Ce qu'on ajoute.** Un fichier `slo/mirador.yml` en YAML Sloth, un job CI
qui fait `sloth generate` pour produire les `PrometheusRule` correspondants,
commit des règles générées, Mimir les ingère automatiquement.

**Justification — pourquoi c'est le #1.**

- **Le langage ops officiel.** Les alertes "CPU > 80 %" ou "heap > 70 %" ne
  disent rien à l'utilisateur. Une SLO comme *"99.5 % des requêtes sous
  500 ms sur 30 jours"* est directement lisible par un stakeholder non-tech
  et directement mesurable côté code. C'est ce qui sépare un projet "je
  sais déployer" d'un projet "j'opère avec des engagements de service".
- **Error budget = outil de gouvernance.** Si on a brûlé 80 % du budget de
  la fenêtre de 30 jours, la règle écrite d'avance dit "on gèle les
  déploiements non-critiques et on stabilise". Ça remplace la discussion
  "on livre ou pas ?" par une valeur booléenne. Google SRE Book, chapitre 4.
- **Multi-window multi-burn-rate.** Sloth génère les alertes à 6 h (burn
  rate 14.4× → page immédiate) + 3 j (burn rate 1× → warning tranquille)
  automatiquement. Ça évite le piège "alerte qui sonne sur un spike
  isolé" et "alerte qu'on voit 4 h après que le budget est cramé".
- **Existe déjà dans la stack.** Mimir est la cible ; Grafana affiche les
  dashboards Sloth déjà packagés. Zéro nouvel outil runtime, juste un
  générateur qui tourne en CI.

**Ce que ça attrape que l'existant ne voit pas.** Une dégradation progressive
(p99 qui passe de 200 ms à 480 ms sur 10 jours) est invisible aux probes
`UP/DOWN`, aux seuils CPU, aux alertes "error rate > 1 % pendant 5 min". Le
burn rate sur 30 j détecte la dérive *avant* qu'elle devienne un incident.

**Coût long terme.** Une SLO mal calibrée (trop stricte) génère du bruit et
on finit par l'ignorer. Nécessite une revue trimestrielle pour ajuster au
trafic réel. Acceptable : c'est le même coût de maintenance qu'une doc
vivante.

**Livrable attendu.**
- `slo/mirador.yml` — 1 à 3 SLOs (availability, latency, éventuellement
  error-rate `customer.enrich` Kafka request-reply spécifique)
- `PrometheusRule` généré + commité (reproducibilité)
- Job CI `sloth:lint` qui échoue si quelqu'un modifie la règle à la main
  sans régénérer
- Dashboard Grafana "Error Budget" provisioné

---

### 2. `[ ]` Playwright E2E dans kind-in-CI — `ui` (+ `svc` côté job CI) — **3 h**

**Ce qu'on ajoute.** Une suite Playwright (3-5 specs) lancée dans le stage
`k8s` existant de mirador-service, après le `kubectl apply` sur kind. Un
`kubectl port-forward svc/mirador-ui 4200:80 &` expose l'UI, Playwright
attaque `http://localhost:4200`, échec → screenshot + vidéo en artefact
GitLab.

**Justification — pourquoi c'est le #2.**

- **L'angle mort actuel.** Les tests Vitest valident des composants isolés
  avec des mocks partout. Les `@SpringBootTest` valident les controllers
  avec Testcontainers. **Aucun** ne teste le vrai flux utilisateur
  `login → action → feedback → assertion`. Un bug de CORS préflight, un
  JWT mal propagé dans l'`authInterceptor`, une route `loadComponent` qui
  404, un Flyway migration qui casse un `select` — aucun ne se voit avant
  la prod.
- **L'infra est déjà là (ADR-0028).** kind-in-CI existe, le runner
  macbook-local peut builder kind, `test:k8s-apply` tourne 5-6 min
  aujourd'hui avec juste `kubectl apply`. Ajouter 3 specs Playwright ajoute
  ~2 min et fait passer le stage de "le YAML est valide" à "l'appli
  fonctionne".
- **Bonus traceparent.** Avec ADR-0009 Phase B, chaque action Playwright
  émet une trace OTel qui traverse browser → API → DB. Un échec CI =
  trace Tempo disponible pour debug immédiat, pas un `screenshot` aveugle.
- **Coût marginal très bas.** Playwright est zéro-config pour Angular,
  pas besoin de Selenium ni d'images supplémentaires (image
  `mcr.microsoft.com/playwright` sur l'arm64 runner).

**Ce que ça attrape que l'existant ne voit pas.**

| Classe de bug | Attrapé par |
|---|---|
| Controller → repository | `@SpringBootTest` existant |
| Composant Angular isolé | Vitest existant |
| JWT propagation, CORS, preflight | **Playwright seul** |
| Flyway migration qui casse un select | **Playwright seul** |
| `@if (auth.isAuthenticated())` oublie un cas | **Playwright seul** |
| Route `loadComponent` qui 404 | **Playwright seul** |
| Kafka enrich timeout affiché à l'utilisateur | **Playwright seul** |
| Manifest K8s qui laisse un pod en Pending | `test:k8s-apply` existant |

**Coût long terme.** Les tests E2E sont notoirement flaky — la parade
standard : `retries: 2` sur Playwright, chaque spec < 10 s avec waiters
explicites (`expect(locator).toContainText()` pas de `setTimeout`). Budget
3 à 5 specs max, pas 50 (l'E2E est pour le *golden path*, pas l'exhaustif).

**Livrable attendu.**
- `e2e/login.spec.ts`, `e2e/customer-crud.spec.ts`, `e2e/health.spec.ts`
- `playwright.config.ts` avec `baseURL` et `retries: 2`
- Job CI `e2e:kind` dans le stage `k8s`, dépend du `test:k8s-apply`
- Script `npm run e2e:local` pour boucle dev rapide

---

### 3. `[ ]` Argo Rollouts AnalysisTemplate — `svc` — **2 h**

**Ce qu'on ajoute.** Remplacement de `Deployment/mirador` par un
`Rollout/mirador` (CRD Argo Rollouts, déjà installé côté cluster selon
l'historique). Définition d'un `AnalysisTemplate` qui interroge Mimir sur
le taux de succès HTTP pendant la progression du rollout. Auto-rollback si
la métrique sort du seuil.

**Justification — pourquoi c'est le #3.**

- **Le déploiement K8s par défaut est du 0-ou-100.** Un `Deployment` classique
  pousse la nouvelle image à 100 % des pods (avec rolling update, certes,
  mais sans **mesurer la santé de la version déployée avant de continuer**).
  Si la v1.4 introduit une régression qui ne se voit qu'en charge, on
  l'apprend par un utilisateur, pas par la plateforme.
- **Le cerveau qui manque.** Argo Rollouts a atterri avec l'installation
  helm (note dans l'historique), mais il est utilisé en mode "replica count
  canary" sans Analysis — donc il pousse à 25 %, attend 5 min, pousse à
  50 %, etc., mais sans mesure. **Ajouter l'AnalysisTemplate, c'est brancher
  le cerveau sur les yeux**.
- **Automated rollback.** Le comportement clé : si `success-rate < 0.99`
  sur 3 mesures consécutives (90 s), Rollouts rollback **automatiquement**
  vers le revision précédent en ~2 min. L'ingénieur reçoit un mail avec la
  trace Tempo du problème ; personne ne dort mal le vendredi soir.
- **Combo avec SLO (#1).** L'`AnalysisTemplate` peut interroger la burn
  rate SLO directement : *"si on brûle plus de 10× le budget pendant le
  canary, rollback"*. Le SLO devient le gardien automatique de chaque
  livraison. C'est là que les trois items s'emboîtent.

**Ce que ça attrape que l'existant ne voit pas.**

- Régression de latence découverte uniquement sous charge.
- OOM qui tue les nouveaux pods (taux de restart élevé côté canary, pas
  côté stable).
- Baisse du taux de succès Kafka request-reply (timeout passe à 8 s au lieu
  de 2 s par exemple) invisible sur une probe `/actuator/health`.
- Tout bug qui se manifeste sous trafic réel et pas sous load de CI.

**Coût long terme.** L'`AnalysisTemplate` est du YAML stable, une fois
calibré il bouge peu. Seul coût récurrent : calibrer les seuils au
démarrage (3 itérations typiques).

**Livrable attendu.**
- `deploy/kubernetes/base/backend/rollout.yaml` (remplace
  `deployment.yaml` existant)
- `deploy/kubernetes/base/backend/analysis-template.yaml` avec 2 métriques
  (success-rate, p99-latency)
- Steps canary : 25 → pause + analysis → 50 → pause + analysis → 100
- Doc `docs/adr/0010-progressive-delivery.md`

---

## Tier 2 — Nice-to-have (ordre de valeur)

### 4. `[ ]` Kill-switch Unleash réel sur un endpoint — `both` — **1 h**

Unleash + unleash-proxy sont installés (ADR-0026 côté svc, FeatureFlagService
côté ui) mais aucune feature flag n'est branchée. Un flag démonstratif —
par ex. *"désactiver le bio-generation quand Ollama est down"* — prouve
que l'infra sert à quelque chose. **Sinon Unleash est un pod qui consomme
de la ressource Autopilot pour rien**, et ça se voit en review.

**À valider avec l'utilisateur :** quel endpoint cibler ? Le `/bio/{id}`
était pré-identifié dans la conversation initiale comme candidat (il a
déjà un circuit breaker + bulkhead, donc un kill-switch s'aligne).

---

### 5. `[ ]` OpenAPI breaking-change detection — `svc` — **1 h**

`openapi-lint` existe déjà (stage `lint`) mais ne lint que la conformité
du spec. Ajouter `openapi-diff` qui compare `target/openapi.json` contre
la version sur `main` : échec CI si un endpoint est retiré, un champ
required ajouté, un type changé. **Attrape les ruptures de contrat avant
merge**, pas au moment où un client tiers (UI, k6, tests) crash.

Utile même avec une seule UI cliente : le changement de contrat cassera
les tests E2E (#2) en CI, mais le message "endpoint X a disparu" est plus
clair que "Playwright a timeout sur la page Y".

---

### 6. `[ ]` Kyverno policies validées en CI + admission — `svc` — **2 h**

Kyverno est mentionné installé dans l'historique mais aucun policy actif.
Règles à ajouter :

- `require-resource-limits` — bloquer tout pod sans `resources.limits`
  (évite les débordements sur Autopilot qui se facture au burst).
- `disallow-privileged` — bloquer `securityContext.privileged: true`.
- `require-probes` — livenessProbe + readinessProbe obligatoires.

La boucle est double : `kyverno apply` dans le CI valide le manifeste
avant push, le controller admission en cluster bloque si quelqu'un
bypass le CI. **Montre qu'on opère en zero-trust sur le propre cluster**,
pas juste "oh je fais confiance au dev qui push".

---

### 7. `[ ]` Lighthouse CI + axe-core dans la pipeline UI — `ui` — **2 h**

Lighthouse CI enforce un budget Web Vitals (LCP, CLS, INP) à chaque MR.
Actuel : ADR-0009 envoie les Web Vitals à Tempo **en runtime**, mais
aucune garantie au moment du merge. Lighthouse CI build l'app avec
`ng build`, lance Chrome headless, publie un score ; échec CI si LCP > 2 s.

axe-core analyse l'accessibilité (WCAG AA) sur chaque page. Typiquement
attrape : images sans `alt`, contrastes insuffisants, ordre de focus
tab cassé. **Posture accessibilité = posture qualité**, même pour un
portfolio sans handicap déclaré dans l'audience.

---

### 8. `[ ]` Cosign-verify à l'admission — `svc` — **1 h**

Les images mirador-service sont déjà signées cosign (historique mentionne
"Docker image security: SBOM, Grype, dockle, cosign"). Ce qui manque :
**la vérification à l'admission**. Un Kyverno `verifyImages` rule qui
refuse tout pod dont l'image n'a pas de signature cosign valide
contre la clé publique du repo. **Fin de la supply chain en bout de
course** : une image maveillante pushée sur le registry (poste compromis,
token CI fuité) ne peut pas être schedulée.

---

### 9. `[ ]` Dashboard-as-code Grafana — `svc` — **3 h**

Grafana utilise actuellement des dashboards JSON provisionnés par le
helm chart LGTM. **Le custom (dashboards créés dans l'UI Grafana) n'est
pas versionné**. Cible : `grafonnet-lib` + `jsonnet` pour générer les
dashboards depuis du code, committés dans `deploy/observability/dashboards/`.
Benefit : un reviewer peut commenter sur un dashboard comme sur du code,
les changements ont une diff lisible, rollback par `git revert`.

Tier 2 et pas Tier 1 parce que **ce n'est pas bloquant** — les dashboards
de la LGTM sont déjà très bons par défaut. C'est du nice-to-have de
team senior qui valorise la reproductibilité > la customisation rapide.

---

## Tier 3 — Explicitement rejetés (Too much pour un portfolio demo)

Ces items sont mentionnés **pour être écartés avec justification**. Les
documenter comme rejetés évite de se poser la question deux fois et montre
au reviewer qu'on a discriminé.

### Service mesh (Istio / Linkerd)

Déjà décliné par **ADR-0027** côté mirador-service. Raison : le sidecar
envoy sur GKE Autopilot facture +70 % de la baseline (chaque sidecar compte
comme un pod billable). Sur un budget €2/mois (ADR-0022), ça passe à €6+.
Les bénéfices (mTLS intra-cluster, traffic split canary) sont couverts
différemment : mTLS = NetworkPolicy + Kyverno policy, canary = Argo
Rollouts replica-count (Tier 1 #3).

### Backstage / IDP interne

Backstage met 2-3 semaines à livrer la première valeur et nécessite au
moins 5 services pour être utile. Mirador a **un seul service backend +
une UI** : Backstage ajouterait une page qui dit "vous avez un service".

### SLSA level 3 provenance

SLSA L3 exige un builder signé par un TPM hardware + chaîne d'attestation
complète + non-falsifiabilité prouvée. C'est pertinent pour du release
open-source distribué (Kubernetes, Istio) où les utilisateurs finaux
n'ont pas confiance dans le pipeline. **Pour un portfolio consommé par
l'auteur seul**, L2 (le niveau actuel, SBOM + cosign) est suffisant.

### Kubecost / FinOps avancé

La facture GCP Mirador est de €2/mois en mode ephemeral (ADR-0022). Outils
FinOps calibrés pour €50k+/mois. **Le gain d'optimisation serait sous le
bruit**. Remis au jour où un coût à 4 chiffres apparaît.

### Multi-region active-active

Zéro utilisateur réel. Le disaster recovery d'un portfolio est
`terraform apply` qui recrée le cluster en 15 min — *c'est* la recovery
strategy (ADR-0022). Multi-region coûterait +300 % et apporterait zéro
valeur mesurable.

### Operator Spring Boot custom

Un operator gère des **CRDs métier** (ex. `kind: KafkaTopic`). Mirador a
zéro besoin métier qui dépasse ce que Kustomize + Helm couvrent déjà.
Écrire un operator ici = sur-ingénierie affichée.

### Chaos Mesh nightly en cron

Les CRDs Chaos Mesh sont installés (historique mentionne les tests chaos
CRD). Les exercer en nightly, sur un cluster ephemeral qui n'existe que
pendant les démos, n'a pas de sens. Les injections manuelles depuis la
page Chaos de l'UI couvrent le cas "montrer qu'on sait résister".

### PagerDuty / oncall rotation

Zéro utilisateur, zéro SLA commercial, zéro team. **PagerDuty sur un
projet solo est theater pur.**

### Datadog / Dynatrace / New Relic

La stack LGTM locale (Tempo, Loki, Mimir, Pyroscope) **fait le même
travail gratuitement**. Passer en SaaS = €50-500/mois pour zéro capacité
nouvelle.

### Threat modeling STRIDE formalisé

Pour un portfolio démo consommé par l'auteur, l'attack surface est
connue et les ADR (sécurité, auth) tracent déjà les choix. STRIDE
formel nécessite 2-3 participants stakeholders. Remis au jour où
une vraie team / un vrai usage justifie la démarche.

---

## Processus

1. L'utilisateur choisit un item du Tier 1 ou 2 → passe en `[~]` → migre
   immédiatement vers `TASKS.md` du repo concerné.
2. Un item du Tier 3 qui deviendrait pertinent (ex. coût GCP passe à
   €100+/mois) remonte explicitement en Tier 2 avec une note de révision.
3. Ce ROADMAP reste **court**. Si une section Tier 2 dépasse 10 items, on
   arbitre et on archive les plus vieux.
4. Un item livré est **supprimé** d'ici (pas marqué `[x]`) ; la trace est
   dans les commits, pas dans ce fichier.
