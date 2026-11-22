import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { UserDto } from '../../../core/auth/auth.model';
import { toAbsoluteUrl } from '../../../core/auth/auth.store';
import { ToastService } from '../../../core/services/toast.service';
import { PaginationBar } from '../../../shared/components/pagination-bar';
import { StatusDot } from '../../../shared/components/status-dot';
import { ProfileStatus } from '../../../shared/models/common.types';
import { apiErrorMessage } from '../../auth/auth.api';
import { AdminService } from '../admin.api';
import { nameInitial } from '../../../shared/utils/name.utils';
import { trackPicFailuresByKey } from '../../profile/profile.utils';

interface RowAction {
  label: string;
  target: ProfileStatus;
  buttonClass: string;
}

const ROW_ACTIONS: Record<ProfileStatus, RowAction> = {
  PENDING:    { label: 'Approve',     target: 'ACTIVE',     buttonClass: 'btn-success' },
  ACTIVE:     { label: 'Restrict',    target: 'RESTRICTED', buttonClass: 'btn-danger' },
  RESTRICTED: { label: 'Un-restrict', target: 'ACTIVE',     buttonClass: 'btn-primary' },
};

@Component({
  selector: 'app-users',
  imports: [PaginationBar, StatusDot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-container section">
    <h1>Users</h1>

    @if (loadError()) {
        <div class="mt-6 rounded-sm border border-error bg-error-bg p-4" role="alert">
        <p><span class="font-semibold">Error</span> — we couldn't load the users.</p>
        <button type="button" class="btn btn-secondary mt-3" (click)="reload()">Retry</button>
        </div>
    } @else {
        <app-pagination-bar
        class="mt-6 block"
        [page]="page()"
        (pageChange)="onPageChange($event)"
        [total]="total()"
        [size]="pageSize"
        [loading]="loading()"
        />

        <div class="mt-4 overflow-x-auto rounded-sm border border-border bg-surface">
        @if (loading()) {
            <p class="p-4 text-secondary">Loading users…</p>
        } @else if (!hasItems()) {
            <p class="p-4 text-muted">No users yet.</p>
        } @else {
            <table class="w-full table-fixed text-left">
            <thead>
                <tr class="border-b border-border bg-bg-alt text-sm">
                <th scope="col" class="w-16 px-3 py-3 text-center font-medium">No.</th>
                <th scope="col" class="w-16 px-3 py-3 text-center font-medium"><span class="sr-only">Status</span></th>
                <th scope="col" class="px-4 py-3 font-medium">User</th>
                <th scope="col" class="w-44 px-4 py-3 text-right font-medium">Action</th>
                </tr>
            </thead>
            <tbody>
                @for (row of numberedItems(); track row.user.email) {
                <tr class="border-b border-border last:border-b-0 hover:bg-hover">
                    <td class="px-3 py-3 text-center align-middle">{{ row.index }}.</td>
                    <td class="px-3 py-3 text-center align-middle"><app-status-dot [status]="row.user.status" /></td>
                    <td class="px-4 py-3">
                    <div class="flex items-center gap-4">
                        @if (pic.src(row.user); as src) {
                          <img
                            [src]="src"
                            alt=""
                            class="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
                            width="40"
                            height="40"
                            loading="lazy"
                            (error)="pic.onError(row.user)"
                          />
                        } @else {
                          <span
                            aria-hidden="true"
                            class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-inverse"
                          >
                            {{ initial(row.user.name) }}
                          </span>
                        }

                        <!-- Double-line row: name/designation, then email/mobile -->
                        <div class="min-w-0 flex-1">
                        <div class="flex items-baseline justify-between gap-4">
                            <p class="truncate font-medium" [title]="row.user.name">{{ row.user.name }}</p>
                            <p class="max-w-40 truncate text-sm text-secondary" [title]="row.user.designation ?? ''">
                            {{ row.user.designation ?? '—' }}
                            </p>
                        </div>
                        <div class="mt-0.5 flex items-baseline justify-between gap-4 text-sm">
                            <p class="truncate text-secondary" [title]="row.user.email">{{ row.user.email }}</p>
                            <p class="whitespace-nowrap text-secondary">{{ row.user.mobileNo ?? '—' }}</p>
                        </div>
                        </div>
                    </div>
                    </td>
                    <td class="px-4 py-3 text-right">
                    <button
                        type="button"
                        class="btn"
                        [class]="rowAction(row.user).buttonClass"
                        [disabled]="busyEmail() === row.user.email"
                        (click)="runAction(row.user)"
                    >
                        {{ rowAction(row.user).label }}
                    </button>
                    </td>
                </tr>
                }
            </tbody>
            </table>
        }
        </div>
    }
    </div>
  `,
})
export class Users {
  private readonly api = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly items = signal<UserDto[]>([]);
  
  protected readonly pageSize = 10;

  readonly page = signal(1);
  readonly loading = signal(false);
  readonly loadError = signal(false);

  readonly totalPending = signal(0);
  readonly totalActive = signal(0);
  readonly totalRestricted = signal(0);

  readonly total = computed(() => this.totalPending() + this.totalActive() + this.totalRestricted());
  readonly hasItems = computed(() => this.items().length > 0);
  readonly numberedItems = computed(() =>
    this.items().map((user, i) => ({ index: (this.page() - 1) * this.pageSize + i + 1, user })),
  );

  /** Email of the row with an action in flight (disables just that row's button). */
  readonly busyEmail = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected rowAction(user: UserDto): RowAction {
    return ROW_ACTIONS[user.status];
  }

  reload(): void {
    this.load();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  runAction(user: UserDto): void {
    if (this.busyEmail()) return;
    const action = ROW_ACTIONS[user.status];
    this.busyEmail.set(user.email);
    this.api
      .updateUserStatus(user.email, action.target)
      .pipe(finalize(() => this.busyEmail.set(null)))
      .subscribe({
        next: () => {
          this.items.update((list) => list.map((u) => (u.email === user.email ? { ...u, status: action.target } : u)));
          this.shiftCount(user.status, action.target);
          this.toast.show(`${user.name} is now ${action.target.toLowerCase()}.`, 'success');
        },
        error: (err) => this.toast.show(apiErrorMessage(err, 'Could not update the user status.'), 'error'),
      });
  }

  protected readonly pic = trackPicFailuresByKey<UserDto>(
    (user) => user.email,
    (user) => (user.profilePic ? toAbsoluteUrl(user.profilePic) : null),
  );

  protected initial(name: string): string {
    return nameInitial(name);
  }


  private load(): void {
    const requestedPage = this.page();
    this.loading.set(true);
    this.loadError.set(false);
    this.api
      .getUsers(requestedPage, this.pageSize)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          if (requestedPage !== this.page()) return;
          if (res.users.length === 0 && requestedPage > 1) {
            this.page.update((p) => p - 1);
            this.load();
            return;
          }
          this.items.set(res.users);
          this.totalPending.set(res.total_pending);
          this.totalActive.set(res.total_active);
          this.totalRestricted.set(res.total_restricted);
        },
        error: () => {
          if (requestedPage !== this.page()) return;
          this.loadError.set(true);
        },
      });
  }

  private shiftCount(from: ProfileStatus, to: ProfileStatus): void {
    if (from === to) return;
    const buckets = { PENDING: this.totalPending, ACTIVE: this.totalActive, RESTRICTED: this.totalRestricted } as const;
    buckets[from].update((n) => Math.max(0, n - 1));
    buckets[to].update((n) => n + 1);
  }
}
