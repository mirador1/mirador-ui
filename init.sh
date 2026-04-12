#!/usr/bin/env bash
set -euo pipefail

echo "==> Initialisation du projet customer-observability-ui"

if [[ ! -f "angular.json" || ! -f "package.json" ]]; then
  echo "Erreur: lance ce script à la racine du projet Angular."
  exit 1
fi

if [[ ! -d "src/app" ]]; then
  echo "Erreur: src/app introuvable."
  exit 1
fi

PROJECT_NAME=$(node -e "const p=require('./package.json'); console.log(p.name || '')")
if [[ -z "${PROJECT_NAME}" ]]; then
  echo "Erreur: impossible de lire le nom du projet dans package.json."
  exit 1
fi

echo "Projet détecté: ${PROJECT_NAME}"

timestamp="$(date +%Y%m%d%H%M%S)"
backup_dir=".backup-init-${timestamp}"
mkdir -p "${backup_dir}"

echo "==> Sauvegarde"
cp angular.json "${backup_dir}/angular.json.bak"
cp package.json "${backup_dir}/package.json.bak"
[[ -f README.md ]] && cp README.md "${backup_dir}/README.md.bak"

echo "==> Passage CSS -> SCSS"

python3 <<'PY'
import json
from pathlib import Path

p = Path("angular.json")
data = json.loads(p.read_text(encoding="utf-8"))

project_name = next(iter(data["projects"].keys()))
project = data["projects"][project_name]
build = project["architect"]["build"]["options"]

styles = build.get("styles", [])
new_styles = []
for s in styles:
    if isinstance(s, str) and s.endswith("styles.css"):
        new_styles.append(s[:-4] + "scss")
    else:
        new_styles.append(s)
build["styles"] = new_styles

schematics = project.setdefault("schematics", {})
component_cfg = schematics.setdefault("@schematics/angular:component", {})
component_cfg["style"] = "scss"

test = project["architect"].get("test")
if test and "options" in test:
    tstyles = test["options"].get("styles", [])
    out = []
    for s in tstyles:
        if isinstance(s, str) and s.endswith("styles.css"):
            out.append(s[:-4] + "scss")
        else:
            out.append(s)
    test["options"]["styles"] = out

p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
PY

if [[ -f "src/styles.css" ]]; then
  mv src/styles.css src/styles.scss
fi

find src/app -type f -name "*.css" | while read -r f; do
  mv "$f" "${f%.css}.scss"
done

find src/app -type f \( -name "*.ts" -o -name "*.html" \) -print0 | xargs -0 sed -i '' 's/\.css/\.scss/g' 2>/dev/null || true
find src/app -type f \( -name "*.ts" -o -name "*.html" \) -print0 | xargs -0 sed -i 's/\.css/\.scss/g' || true

echo "==> Création de l'arborescence"
mkdir -p src/app/core/api
mkdir -p src/app/shared/layout
mkdir -p src/app/features/dashboard
mkdir -p src/app/features/customers
mkdir -p src/app/features/diagnostic

echo "==> Écriture des fichiers"

cat > src/app/core/api/api.service.ts <<'EOF'
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Customer {
  id?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8080';

  getHealth(): Observable<unknown> {
    return this.http.get(`${this.baseUrl}/actuator/health`);
  }

  getReadiness(): Observable<unknown> {
    return this.http.get(`${this.baseUrl}/actuator/health/readiness`);
  }

  getLiveness(): Observable<unknown> {
    return this.http.get(`${this.baseUrl}/actuator/health/liveness`);
  }

  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.baseUrl}/customers`);
  }

  createCustomer(customer: Customer): Observable<Customer> {
    return this.http.post<Customer>(`${this.baseUrl}/customers`, customer);
  }
}
EOF

cat > src/app/shared/layout/app-shell.component.ts <<'EOF'
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent {}
EOF

cat > src/app/shared/layout/app-shell.component.html <<'EOF'
<div class="shell">
  <header class="topbar">
    <h1>Customer Observability UI</h1>
    <nav>
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a>
      <a routerLink="/customers" routerLinkActive="active">Customers</a>
      <a routerLink="/diagnostic" routerLinkActive="active">Diagnostic</a>
    </nav>
  </header>

  <main class="content">
    <router-outlet />
  </main>
</div>
EOF

cat > src/app/shared/layout/app-shell.component.scss <<'EOF'
:host {
  display: block;
}

.shell {
  min-height: 100vh;
  background: #f3f6fa;
  color: #1f2937;
  font-family: Arial, Helvetica, sans-serif;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: #dde6ef;
  border-bottom: 1px solid #c8d4e0;
}

.topbar h1 {
  margin: 0;
  font-size: 1.2rem;
}

.topbar nav {
  display: flex;
  gap: 1rem;
}

.topbar a {
  text-decoration: none;
  color: #334155;
  font-weight: 600;
}

.topbar a.active {
  color: #0f172a;
}

.content {
  padding: 1.5rem;
}
EOF

cat > src/app/features/dashboard/dashboard.component.ts <<'EOF'
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/api/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private readonly api = inject(ApiService);

  health: unknown = null;
  readiness: unknown = null;
  liveness: unknown = null;
  error = '';

  ngOnInit(): void {
    this.api.getHealth().subscribe({
      next: (value) => (this.health = value),
      error: () => (this.error = 'Backend inaccessible')
    });

    this.api.getReadiness().subscribe({
      next: (value) => (this.readiness = value)
    });

    this.api.getLiveness().subscribe({
      next: (value) => (this.liveness = value)
    });
  }
}
EOF

cat > src/app/features/dashboard/dashboard.component.html <<'EOF'
<section>
  <h2>Dashboard</h2>
  <p>Vue simple de l'état du backend.</p>

  <p *ngIf="error" class="error">{{ error }}</p>

  <div class="grid">
    <article class="card">
      <h3>Health</h3>
      <pre>{{ health | json }}</pre>
    </article>

    <article class="card">
      <h3>Readiness</h3>
      <pre>{{ readiness | json }}</pre>
    </article>

    <article class="card">
      <h3>Liveness</h3>
      <pre>{{ liveness | json }}</pre>
    </article>
  </div>
</section>
EOF

cat > src/app/features/dashboard/dashboard.component.scss <<'EOF'
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.card {
  background: white;
  border: 1px solid #dbe4ee;
  border-radius: 8px;
  padding: 1rem;
}

pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.85rem;
}

.error {
  color: #b91c1c;
  font-weight: 600;
}
EOF

cat > src/app/features/customers/customers.component.ts <<'EOF'
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Customer } from '../../core/api/api.service';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss'
})
export class CustomersComponent {
  private readonly api = inject(ApiService);

  customers: Customer[] = [];
  error = '';
  model: Customer = {
    firstName: '',
    lastName: '',
    email: ''
  };

  ngOnInit(): void {
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.api.getCustomers().subscribe({
      next: (value) => {
        this.customers = value;
        this.error = '';
      },
      error: () => {
        this.error = 'Impossible de charger les clients';
      }
    });
  }

  submit(): void {
    this.api.createCustomer(this.model).subscribe({
      next: () => {
        this.model = { firstName: '', lastName: '', email: '' };
        this.loadCustomers();
      },
      error: () => {
        this.error = 'Impossible de créer le client';
      }
    });
  }
}
EOF

cat > src/app/features/customers/customers.component.html <<'EOF'
<section>
  <h2>Customers</h2>

  <p *ngIf="error" class="error">{{ error }}</p>

  <div class="grid">
    <article class="card">
      <h3>Create customer</h3>

      <label>
        First name
        <input [(ngModel)]="model.firstName" />
      </label>

      <label>
        Last name
        <input [(ngModel)]="model.lastName" />
      </label>

      <label>
        Email
        <input [(ngModel)]="model.email" />
      </label>

      <button type="button" (click)="submit()">Create</button>
    </article>

    <article class="card">
      <h3>Customer list</h3>

      <ul *ngIf="customers.length; else empty">
        <li *ngFor="let customer of customers">
          {{ customer.firstName }} {{ customer.lastName }} — {{ customer.email }}
        </li>
      </ul>

      <ng-template #empty>
        <p>No customers loaded.</p>
      </ng-template>
    </article>
  </div>
</section>
EOF

cat > src/app/features/customers/customers.component.scss <<'EOF'
.grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 1rem;
}

.card {
  background: white;
  border: 1px solid #dbe4ee;
  border-radius: 8px;
  padding: 1rem;
}

label {
  display: block;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
}

input {
  display: block;
  width: 100%;
  margin-top: 0.25rem;
  padding: 0.5rem;
  box-sizing: border-box;
}

button {
  padding: 0.55rem 0.9rem;
  cursor: pointer;
}

.error {
  color: #b91c1c;
  font-weight: 600;
}
EOF

cat > src/app/features/diagnostic/diagnostic.component.ts <<'EOF'
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-diagnostic',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './diagnostic.component.html',
  styleUrl: './diagnostic.component.scss'
})
export class DiagnosticComponent {
  scenarios = [
    'PostgreSQL unavailable -> impact sur readiness',
    'Latency on /customers/aggregate -> analyse via métriques',
    'Kafka timeout -> comportement de dégradation'
  ];
}
EOF

cat > src/app/features/diagnostic/diagnostic.component.html <<'EOF'
<section>
  <h2>Diagnostic</h2>
  <p>Scénarios backend mis en avant par l'IHM.</p>

  <article class="card">
    <ul>
      <li *ngFor="let scenario of scenarios">{{ scenario }}</li>
    </ul>
  </article>
</section>
EOF

cat > src/app/features/diagnostic/diagnostic.component.scss <<'EOF'
.card {
  background: white;
  border: 1px solid #dbe4ee;
  border-radius: 8px;
  padding: 1rem;
}
EOF

cat > src/app/app.routes.ts <<'EOF'
import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { CustomersComponent } from './features/customers/customers.component';
import { DiagnosticComponent } from './features/diagnostic/diagnostic.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'customers', component: CustomersComponent },
  { path: 'diagnostic', component: DiagnosticComponent },
  { path: '**', redirectTo: '' }
];
EOF

cat > src/app/app.ts <<'EOF'
import { Component } from '@angular/core';
import { AppShellComponent } from './shared/layout/app-shell.component';

@Component({
  selector: 'app-root',
  imports: [AppShellComponent],
  template: '<app-shell />'
})
export class App {}
EOF

cat > src/app/app.config.ts <<'EOF'
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient()
  ]
};
EOF

cat > src/styles.scss <<'EOF'
html, body {
  margin: 0;
  padding: 0;
  background: #f3f6fa;
}

body {
  min-height: 100vh;
}
EOF

cat > README.md <<'EOF'
# Customer Observability UI

IHM Angular minimale branchée sur un backend Spring Boot orienté observabilité.

## Objectif

Rendre visibles des scénarios backend déjà présents dans `customer-service` :

- état du système
- endpoints health / readiness / liveness
- consultation et création simple de clients
- scénarios de diagnostic

## Écrans

- Dashboard
- Customers
- Diagnostic

## Lancement

```bash
npm install
npm start
