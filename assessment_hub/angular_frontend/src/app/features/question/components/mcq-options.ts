import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { McqOption } from '../question-set.models';

@Component({
  selector: 'app-mcq-options',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="mt-2 space-y-1 text-base text-secondary">
      @for (option of options(); track option.id) {
        <li class="flex items-baseline gap-2"
            [class]="isCorrect(option.id) ? 'rounded-sm bg-success-bg px-1.5 -mx-1.5 py-0.5 font-semibold text-success-strong' : ''">
          <span class="w-6 shrink-0 font-medium">{{ option.id }}.</span>
          <span class="min-w-0 flex-1 whitespace-pre-wrap">{{ option.text }}</span>
        </li>
      }
    </ul>
  `,
})
export class McqOptions {
  readonly options = input.required<McqOption[]>();
  readonly correctIds = input<string[]>([]);
  readonly revealCorrect = input(false);

  protected isCorrect(id: string): boolean {
    return this.revealCorrect() && this.correctIds().includes(id);
  }
}
