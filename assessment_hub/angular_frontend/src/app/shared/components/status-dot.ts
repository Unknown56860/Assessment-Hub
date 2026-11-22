import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type DotStatus = 'UNREAD' | 'READ' | 'ANSWERED' | 'PENDING' | 'ACTIVE' | 'RESTRICTED' | 'EVALUATED' | 'NOT_EVALUATED';

/** Each status maps to exactly one semantic color. */
const DOT: Record<DotStatus, { cls: string; label: string }> = {
  UNREAD:     { cls: 'bg-warning', label: 'Unread' },
  READ:       { cls: 'bg-info',    label: 'Read' },
  ANSWERED:   { cls: 'bg-success', label: 'Answered' },
  PENDING:    { cls: 'bg-warning', label: 'Pending' },
  ACTIVE:     { cls: 'bg-success', label: 'Active' },
  RESTRICTED: { cls: 'bg-error',   label: 'Restricted' },
  EVALUATED:     { cls: 'bg-success', label: 'Evaluated' },
  NOT_EVALUATED: { cls: 'bg-warning', label: 'Not evaluated' },
};

@Component({
  selector: 'app-status-dot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-block h-3 w-3 rounded-full align-middle"
      [class]="dot()"
      role="img"
      [attr.aria-label]="label()"
      [title]="label()"
    ></span>
  `,
})
export class StatusDot {
  readonly status = input.required<DotStatus>();
  protected readonly dot = computed(() => DOT[this.status()].cls);
  protected readonly label = computed(() => DOT[this.status()].label);
}
