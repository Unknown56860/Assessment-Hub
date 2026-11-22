import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastMessage, ToastService } from '../services/toast.service';

// const toastStyles: Record<ToastMessage['type'], string> = {
//   success: 'border-success-strong bg-success text-text-inverse',
//   info: 'border-info-strong bg-info text-text-inverse',
//   warn: 'border-warning-strong bg-warning-strong text-text-inverse',
//   error: 'border-error-strong bg-error text-text-inverse',
// };

// @Component({
//   selector: 'app-toast',
//   changeDetection: ChangeDetectionStrategy.OnPush,
//   template: `
//     @if (toastService.currentToast(); as toast) {
//       <div
//         role="status"
//         aria-live="polite"
//         class="animate-toast-in fixed inset-x-4 top-4 z-[2000] flex min-h-12 min-w-0 items-center gap-4 rounded-md border py-3 pr-3 pl-4 text-sm leading-normal shadow-lg text-text-inverse sm:inset-x-auto sm:top-6 sm:right-6 sm:min-w-(--toast-min-width) sm:max-w-(--toast-max-width)"
//         [class]="toastStyles[toast.type]"
//       >
//         <span class="flex-1">{{ toast.text }}</span>

//         <button
//           type="button"
//           aria-label="Close notification"
//           class="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-sm bg-transparent p-0 text-xl leading-none text-current hover:bg-hover-tint active:bg-hover-tint-strong"
//           (click)="toastService.clear()"
//         >
//           ×
//         </button>
//       </div>
//     }
//   `,
// })
// export class Toast {
//   protected readonly toastService = inject(ToastService);
//   protected readonly toastStyles = toastStyles;
// }

const toastStyles: Record<ToastMessage['type'], string> = {
  success: 'border-success-strong bg-success text-text-inverse',
  info: 'border-info-strong bg-info text-text-inverse',
  warn: 'border-warning-strong bg-warning-strong text-text-inverse',
  error: 'border-error-strong bg-error text-text-inverse',
};

@Component({
  selector: 'app-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (toastService.currentToast(); as toast) {
      <div
        [attr.role]="toast.type === 'error' || toast.type === 'warn' ? 'alert' : 'status'"
        [attr.aria-live]="toast.type === 'error' || toast.type === 'warn' ? 'assertive' : 'polite'"
        class="animate-toast-in fixed inset-x-4 top-4 z-[2000] flex min-h-12 min-w-0 items-center gap-4 rounded-md border py-3 pr-3 pl-4 text-sm leading-normal shadow-lg text-text-inverse sm:inset-x-auto sm:top-6 sm:right-6 sm:min-w-(--toast-min-width) sm:max-w-(--toast-max-width)"
        [class]="toastStyles[toast.type]"
      >
        <span class="flex-1">{{ toast.text }}</span>

        <button
          type="button"
          aria-label="Close notification"
          class="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-sm bg-transparent p-0 text-xl leading-none text-current hover:bg-hover-tint active:bg-hover-tint-strong"
          (click)="toastService.clear()"
        >
          ×
        </button>
      </div>
    }
  `,
})
export class Toast {
  protected readonly toastService = inject(ToastService);
  protected readonly toastStyles = toastStyles;
}

