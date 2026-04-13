import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';
import { vi } from 'vitest';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('should start with no toasts', () => {
    expect(service.toasts().length).toBe(0);
  });

  it('should add a toast', () => {
    service.show('Hello', 'info');
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].message).toBe('Hello');
    expect(service.toasts()[0].type).toBe('info');
  });

  it('should dismiss a toast by id', () => {
    service.show('A', 'info');
    service.show('B', 'error');
    const idToDismiss = service.toasts()[0].id;
    service.dismiss(idToDismiss);
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].message).toBe('B');
  });

  it('should auto-dismiss after duration', () => {
    vi.useFakeTimers();
    service.show('Auto', 'success', 1000);
    expect(service.toasts().length).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(service.toasts().length).toBe(0);
    vi.useRealTimers();
  });
});
