import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { splitOnBlanks } from '../question-json.util';

/**
 * Renders question text. Every exactly-four-underscore blank becomes a slot.
 * When `blankAnswers` is provided (fb + answers shown), the correct answer is
 * written into the slot in dark green; otherwise the slot stays empty.
 */
@Component({
  selector: 'app-question-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="whitespace-pre-wrap text-[17px] font-semibold leading-relaxed">
      @for (seg of segments(); track $index) {
        @if (seg.blank) {
          <span class="mx-1 inline-block min-w-16 border-b border-border-strong px-1 align-baseline" aria-label="blank">
            @if (seg.blankIndex !== null && segmentAnswer(seg.blankIndex); as answer) {
              <span class="rounded-sm bg-success-bg px-1 font-semibold text-success-strong">{{ answer }}</span>
            } @else {
              &nbsp;
            }
          </span>
        } @else {
          <span>{{ seg.text }}</span>
        }
      }
    </p>
  `,
})
export class QuestionText {
  readonly question = input.required<string>();
  /** fb answers in blank order — null renders empty slots. */
  readonly blankAnswers = input<string[] | null>(null);

  protected readonly segments = computed(() => splitOnBlanks(this.question()));

  protected segmentAnswer(blankIndex: number): string | null {
    const answers = this.blankAnswers();
    if (!answers) return null;
    const value = answers[blankIndex]?.trim();
    return value || null;
  }
}
