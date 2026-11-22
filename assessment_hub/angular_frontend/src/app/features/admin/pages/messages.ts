import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs';

import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog';
import { PaginationBar } from '../../../shared/components/pagination-bar';
import { StatusDot } from '../../../shared/components/status-dot';
import { MessageStatus } from '../../../shared/models/common.types';
import { apiErrorMessage } from '../../auth/auth.api';
import { AdminService } from '../admin.api';
import { AdminMessageDto } from '../admin.models';

@Component({
  selector: 'app-messages',
  imports: [DatePipe, PaginationBar, StatusDot, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-container section">
    <h1>Messages</h1>

    @if (loadError()) {
        <div class="mt-6 rounded-sm border border-error bg-error-bg p-4" role="alert">
        <p><span class="font-semibold">Error</span> — we couldn't load the visitor messages.</p>
        <button type="button" class="btn btn-secondary mt-3" (click)="reload()">Retry</button>
        </div>
    } @else {
        <!-- "Showing x - y of z" on the left, pager on the right -->
        <app-pagination-bar
        class="mt-6 block"
        [page]="page()"
        (pageChange)="onPageChange($event)"
        [total]="total()"
        [size]="pageSize"
        [loading]="loading()"
        />

        <!-- Message list -->
        <div class="mt-4 overflow-x-auto rounded-sm border border-border bg-surface">
        @if (loading()) {
            <p class="p-4 text-secondary">Loading messages…</p>
        } @else if (!hasItems()) {
            <p class="p-4 text-muted">No visitor messages yet.</p>
        } @else {
            <table class="w-full table-fixed text-left">
            <thead>
                <tr class="border-b border-border bg-bg-alt text-sm">
                <th scope="col" class="w-16 px-3 py-3 text-center font-medium">No.</th>
                <th scope="col" class="w-16 px-3 py-3 text-center font-medium"><span class="sr-only">Status</span></th>
                <th scope="col" class="w-56 px-4 py-3 font-medium">Name</th>
                <th scope="col" class="px-4 py-3 font-medium">Subject</th>
                <th scope="col" class="w-56 px-4 py-3 text-right font-medium">Received</th>
                </tr>
            </thead>
            <tbody>
                @for (row of numberedItems(); track row.msg.message_id) {
                <tr
                    class="cursor-pointer border-b border-border last:border-b-0 hover:bg-hover"
                    tabindex="0"
                    (click)="openDetails(row.msg)"
                    (keydown.enter)="openDetails(row.msg)"
                >
                    <td class="px-3 py-3 text-center">{{ row.index }}.</td>
                    <td class="px-3 py-3 text-center"><app-status-dot [status]="row.msg.status" /></td>
                    <td class="px-4 py-3">
                    <p class="truncate font-medium" [title]="row.msg.name">{{ row.msg.name }}</p>
                    </td>
                    <td class="px-4 py-3">
                    @if (row.msg.subject) {
                        <p class="truncate text-secondary" [title]="row.msg.subject">{{ row.msg.subject }}</p>
                    } @else {
                        <span class="text-sm text-muted">—</span>
                    }
                    </td>
                    <td class="px-4 py-3 text-right text-sm whitespace-nowrap text-secondary">
                    {{ row.msg.created_at | date: 'MMM d, y, h:mm a' }}
                    </td>
                </tr>
                }
            </tbody>
            </table>
        }
        </div>
    }

    <!-- Detail modal -->
    @if (selected(); as msg) {
        <div class="fixed inset-0 z-[1100] flex animate-fade-in items-center justify-center bg-overlay p-4" (click)="closeDetails()">
        <div
            class="w-full max-w-(--modal-width-lg) animate-fade-in rounded-sm border border-border bg-surface p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-detail-title"
            (click)="$event.stopPropagation()"
        >
            <div class="flex items-center justify-between gap-3 border-b border-border pb-4">
            <h2 id="message-detail-title" class="min-w-0 truncate">{{ msg.name }}</h2>
            <button
                type="button"
                class="btn btn-secondary w-(--button-height) shrink-0 px-0 text-base"
                (click)="closeDetails()"
                aria-label="Close details"
            >
                ✕
            </button>
            </div>

            <div class="grid gap-5 py-5">
            <!-- Email left, time right -->
            <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm">
                <a class="truncate" [href]="'mailto:' + msg.email">{{ msg.email }}</a>
                <p class="whitespace-nowrap text-secondary">{{ msg.created_at | date: 'EEE, MMM d, y, h:mm a' }}</p>
            </div>

            <div>
                <p class="text-xs font-medium text-secondary">Subject</p>
                @if (msg.subject) {
                <p class="mt-1 break-words font-medium">{{ msg.subject }}</p>
                } @else {
                <p class="mt-1 text-muted">—</p>
                }
            </div>

            <div>
                <p class="text-xs font-medium text-secondary">Message</p>
                <p
                class="mt-2 max-h-(--modal-description-max-height) overflow-y-auto break-words whitespace-pre-wrap leading-relaxed"
                tabindex="0"
                >{{ msg.message }}</p>
            </div>
            </div>

            <!-- Status actions left, delete right -->
            <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div class="flex flex-wrap gap-3">
                <button type="button" class="btn btn-warning" [disabled]="busy() || msg.status === 'UNREAD'" (click)="setStatus(msg, 'UNREAD')">
                Mark unread
                </button>
                <button type="button" class="btn btn-info" [disabled]="busy() || msg.status === 'READ'" (click)="setStatus(msg, 'READ')">
                Mark read
                </button>
                <button type="button" class="btn btn-success" [disabled]="busy() || msg.status === 'ANSWERED'" (click)="setStatus(msg, 'ANSWERED')">
                Answered
                </button>
            </div>
            <button type="button" class="btn btn-danger" [disabled]="busy()" (click)="requestDelete()">Delete</button>
            </div>
        </div>
        </div>
    }

    <!-- Delete confirmation (stacks above the detail modal) -->
    @if (confirmingDelete()) {
        <app-confirm-dialog
        title="Delete message"
        [message]="'Permanently delete the message from ' + (selected()?.name ?? 'this visitor') + '? This cannot be undone.'"
        confirmLabel="Delete"
        [busy]="busy()"
        (confirm)="deleteSelected()"
        (cancel)="cancelDelete()"
        />
    }
    </div>
  `,
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class Messages {
  private readonly api = inject(AdminService);
  private readonly toast = inject(ToastService);

  protected readonly pageSize = 25;

  readonly page = signal(1);
  readonly loading = signal(false);
  readonly loadError = signal(false);

  private readonly items = signal<AdminMessageDto[]>([]);
  readonly totalRead = signal(0);
  readonly totalUnread = signal(0);
  readonly totalAnswered = signal(0);

  /** Total visitor messages = read + unread + answered. */
  readonly total = computed(() => this.totalRead() + this.totalUnread() + this.totalAnswered());
  readonly hasItems = computed(() => this.items().length > 0);
  readonly numberedItems = computed(() =>
    this.items().map((msg, i) => ({ index: (this.page() - 1) * this.pageSize + i + 1, msg })),
  );

  readonly selected = signal<AdminMessageDto | null>(null);
  readonly confirmingDelete = signal(false);
  /** A status/delete call is in flight. */
  readonly busy = signal(false);

  constructor() {
    this.load();
  }

  reload(): void {
    this.load();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.load();
  }

  openDetails(msg: AdminMessageDto): void {
    this.selected.set(msg);
    this.confirmingDelete.set(false);
  }

  closeDetails(): void {
    if (this.busy()) return; // keep the dialog while an action is running
    this.selected.set(null);
    this.confirmingDelete.set(false);
  }

  onEscape(): void {
    if (this.confirmingDelete()) {
      this.confirmingDelete.set(false);
      return;
    }
    if (this.selected()) this.closeDetails();
  }

  setStatus(msg: AdminMessageDto, status: MessageStatus): void {
    if (this.busy() || msg.status === status) return;
    this.busy.set(true);
    this.api
      .updateMessageStatus(msg.message_id, status)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          const updated = { ...msg, status };
          this.items.update((list) => list.map((m) => (m.message_id === msg.message_id ? updated : m)));
          this.selected.update((cur) => (cur && cur.message_id === msg.message_id ? updated : cur));
          this.shiftCount(msg.status, status);
          this.toast.show(`Message from ${msg.name} marked as ${status.toLowerCase()}.`, 'success');
        },
        error: (err) => this.toast.show(apiErrorMessage(err, 'Could not update the message status.'), 'error'),
      });
  }

  requestDelete(): void {
    this.confirmingDelete.set(true);
  }

  cancelDelete(): void {
    if (!this.busy()) this.confirmingDelete.set(false);
  }

  deleteSelected(): void {
    const msg = this.selected();
    if (!msg || this.busy()) return;
    this.busy.set(true);
    this.api
      .deleteMessage(msg.message_id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.selected.set(null);
          this.confirmingDelete.set(false);
          this.toast.show(`Message from ${msg.name} deleted.`, 'success');
          this.load();
        },
        error: (err) => this.toast.show(apiErrorMessage(err, 'Could not delete the message.'), 'error'),
      });
  }

  private load(): void {
    const requestedPage = this.page();
    this.loading.set(true);
    this.loadError.set(false);
    this.api
      .getMessages(requestedPage, this.pageSize)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          if (requestedPage !== this.page()) return; // a newer request superseded this one
          // Last page became empty (e.g. after a delete) → step back one page.
          if (res.messages.length === 0 && requestedPage > 1) {
            this.page.update((p) => p - 1);
            this.load();
            return;
          }
          this.items.set(res.messages);
          this.totalRead.set(res.total_read);
          this.totalUnread.set(res.total_unread);
          this.totalAnswered.set(res.total_answered);
        },
        error: () => {
          if (requestedPage !== this.page()) return;
          this.loadError.set(true);
        },
      });
  }

  private shiftCount(from: MessageStatus, to: MessageStatus): void {
    if (from === to) return;
    const buckets = { UNREAD: this.totalUnread, READ: this.totalRead, ANSWERED: this.totalAnswered } as const;
    buckets[from].update((n) => Math.max(0, n - 1));
    buckets[to].update((n) => n + 1);
  }
}
