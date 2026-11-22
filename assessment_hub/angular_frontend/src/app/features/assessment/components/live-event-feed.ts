import {
  ChangeDetectionStrategy, Component, ElementRef, effect, input, viewChild,
} from '@angular/core';
import { EventLogDto } from '../assessment.dto';

/** Bottom-anchored scrollable event feed — new items rise in at the bottom, YouTube-chat style. */
@Component({
  selector: 'app-live-event-feed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex h-full flex-col rounded-sm border border-border bg-surface">
      <h2 class="border-b border-border px-4 py-3 text-lg">Live events</h2>
      <div #scrollBox class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3">
        <!-- mt-auto anchors to the bottom while keeping earlier entries reachable by scroll -->
        <div class="mt-auto flex flex-col gap-1">
          @for (event of events(); track event.ts + '|' + event.type + '|' + event.message) {
            <p class="animate-rise-in text-sm leading-snug">
              <span class="text-muted">{{ shortTime(event.ts) }}</span>
              <span class="ml-2" [class]="messageClass(event.type)">{{ event.message }}</span>
            </p>
          } @empty {
            <p class="text-sm text-secondary">No events yet.</p>
          }
        </div>
      </div>
    </section>
  `,
})
export class LiveEventFeed {
  readonly events = input.required<EventLogDto[]>();
  private readonly scrollBox = viewChild<ElementRef<HTMLDivElement>>('scrollBox');
  private stick = true;

  constructor() {
    effect(() => {
      this.events();
      const el = this.scrollBox()?.nativeElement;
      if (!el) return;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48;
      if (this.stick || atBottom) {
        queueMicrotask(() => { el.scrollTop = el.scrollHeight; });
      }
    });
  }

  protected onScroll(): void {
    const el = this.scrollBox()?.nativeElement;
    if (el) this.stick = el.scrollTop + el.clientHeight >= el.scrollHeight - 48;
  }

  protected shortTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  protected messageClass(type: string): string {
    switch (type) {
      case 'JOINED': case 'REJOINED': case 'STARTED': case 'FOCUS_BACK': case 'READY': case 'EXTENDED': case 'UNKICKED':
        return 'text-success-strong';
      case 'KICKED': case 'DUPLICATE_JOIN': case 'ERROR': case 'ENDED': case 'TIME_OVER':
        return 'text-error-strong';
      case 'VIOLATION': case 'DISCONNECTED': case 'CONFLICT': case 'FLUSH_FAILED':
        return 'text-warning-strong';
      default:
        return 'text-secondary';
    }
  }
}
