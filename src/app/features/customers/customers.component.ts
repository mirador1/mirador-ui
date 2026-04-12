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
