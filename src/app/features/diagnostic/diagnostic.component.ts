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
