import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { StudentRowDto } from '../assessment.dto';
import { STUDENT_STATUS_BADGE, STUDENT_STATUS_INFO_BG, STUDENT_STATUS_LABEL } from './student-status';

@Component({
  selector: 'app-student-enquiry-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-[1200] flex animate-fade-in items-center justify-center bg-overlay p-4" (click)="close.emit()">
      <div
        class="w-full max-w-(--modal-width) animate-fade-in rounded-sm border border-border bg-surface p-6"
        role="dialog" aria-modal="true" aria-labelledby="seq-title"
        (click)="$event.stopPropagation()"
      >
        <div class="relative">
          <button
            type="button"
            class="absolute top-0 right-0 grid h-8 w-8 place-items-center rounded-sm text-secondary hover:bg-hover hover:text-text"
            aria-label="Close"
            (click)="close.emit()"
          >✕</button>
          <h2 id="seq-title" class="text-center text-lg font-semibold">Student details</h2>
        </div>

        <dl class="mt-5 space-y-2 rounded-sm p-3 text-sm" [class]="STUDENT_STATUS_INFO_BG[student().status]">
          <div class="flex gap-3">
            <dt class="w-24 shrink-0 text-secondary">Roll</dt>
            <dd class="min-w-0 font-mono font-semibold break-all">{{ student().roll }}</dd>
          </div>
          <div class="flex gap-3">
            <dt class="w-24 shrink-0 text-secondary">Name</dt>
            <dd class="min-w-0 font-semibold break-words">{{ student().name }}</dd>
          </div>
          <div class="flex gap-3">
            <dt class="w-24 shrink-0 text-secondary">Status</dt>
            <dd><span [class]="STUDENT_STATUS_BADGE[student().status]">{{ STUDENT_STATUS_LABEL[student().status] }}</span></dd>
          </div>
        </dl>

        <div class="mt-6 flex justify-end gap-3">
          @if (student().status === 'CONNECTED' || student().status === 'DISCONNECTED') {
            <button type="button" class="btn btn-danger" [disabled]="busy()" (click)="kick.emit(student().roll)">
              Remove from assessment
            </button>
          } @else if (student().status === 'KICKED') {
            <button type="button" class="btn btn-success" [disabled]="busy()" (click)="unkick.emit(student().roll)">
              Readmit
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class StudentEnquiryDialog {
  readonly student = input.required<StudentRowDto>();
  readonly busy = input(false);
  readonly kick = output<string>();
  readonly unkick = output<string>();
  readonly close = output<void>();

  protected readonly STUDENT_STATUS_LABEL = STUDENT_STATUS_LABEL;
  protected readonly STUDENT_STATUS_BADGE = STUDENT_STATUS_BADGE;
  protected readonly STUDENT_STATUS_INFO_BG = STUDENT_STATUS_INFO_BG;
}
