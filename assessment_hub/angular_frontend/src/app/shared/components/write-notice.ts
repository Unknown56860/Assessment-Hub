import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { AuthStore } from '../../core/auth/auth.store';
import { ProfileStatus } from '../models/common.types';

@Component({
  selector: 'app-write-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status() === 'PENDING') {
      <div class="rounded-sm border border-warning bg-warning-bg p-4 text-sm" role="status">
        <p><span class="font-semibold">Pending approval!</span> You can only view your resources, but creating and
        editing unlock once administrator approves your profile.</p>
        <button type="button" class="btn btn-secondary mt-3" (click)="recheck()">Check again</button>
      </div>
    } @else if (status() === 'RESTRICTED') {
      <div class="rounded-sm border border-error bg-error-bg p-4 text-sm" role="alert">
        <p><span class="font-semibold">Restricted!</span> Creating and editing is disabled. Please contact administrator.</p>
        <button type="button" class="btn btn-secondary mt-3" (click)="recheck()">Check again</button>
      </div>
    }
  `,
})
export class WriteNotice {
  private readonly auth = inject(AuthStore);
  readonly status = input.required<ProfileStatus | null>();

  protected recheck(): void {
    // A dropped session here just means "still not writable" — swallow the error
    // instead of surfacing an uncaught observer exception.
    this.auth.refresh().subscribe({ error: () => {} });
  }
}
