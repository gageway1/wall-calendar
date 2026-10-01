import { Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';
import { Icon } from './icon';

@Component({
  selector: 'app-toasts',
  imports: [Icon],
  templateUrl: './toasts.html',
  styleUrl: './toasts.scss',
})
export class Toasts {
  protected readonly toasts = inject(ToastService);
}
