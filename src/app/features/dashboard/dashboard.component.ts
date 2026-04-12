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
