import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { QuestionType } from '../../../shared/models/common.types';
import { formatAnswer } from '../question-json.util';
import { Answer } from '../question-set.models';

@Component({
  selector: 'app-answer-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-2">
      <p class="text-sm font-semibold text-secondary">Answer</p>
      <p class="mt-1 inline-block rounded-sm border border-success/30 bg-success-bg px-2 py-1 text-[17px] font-medium whitespace-pre-wrap text-success-strong">{{ text() }}</p>
    </div>
  `,
})
export class AnswerView {
  readonly type = input.required<QuestionType>();
  readonly answer = input<Answer | null>(null);
  protected readonly text = computed(() => formatAnswer(this.type(), this.answer()));
}
