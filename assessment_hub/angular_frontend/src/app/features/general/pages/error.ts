import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

/**
 * Route registration (app.routes.ts):
 *   { path: 'error', component: Error },
 *   { path: 'error/:code', component: Error },
 *
 * '/error' shows the generic fallback. '/error/404' etc. adapt to the code.
 * Unknown codes (e.g. 402, 501) keep their number as the code display and
 * fall back to the generic copy.
 */

interface ErrorPageData {
  title: string;
  message: string;
}

@Component({
  selector: 'app-error',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Layout assumes the fixed navbar (64px token) overlays the page. -->
    <main
      class="min-h-[calc(100vh-var(--navbar-height))] bg-bg pt-[calc(var(--navbar-height)+var(--space-12))] pb-12"
    >
      <div class="page-container">
        <section
          class="mx-auto grid max-w-4xl items-center gap-10 md:grid-cols-[minmax(0,1fr)_420px] md:gap-12 lg:gap-16"
        >
          <div class="max-w-xl">
            <p class="text-sm font-medium tracking-wide text-text-secondary">Assessment Hub</p>

            <h1 class="mt-3 text-3xl font-bold">{{ errorTitle() }}</h1>

            <p class="mt-4 font-mono text-xl font-semibold text-primary">{{ errorCode() }}</p>

            <p class="mt-4 text-lg leading-relaxed text-text-secondary">{{ errorMessage() }}</p>

            <div class="mt-6 flex flex-wrap gap-3">
              <a
                routerLink="/"
                class="inline-flex h-[var(--button-height)] items-center justify-center rounded-sm bg-primary px-4 text-sm font-medium text-inverse transition-colors duration-150 hover:bg-primary-hover active:bg-primary-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Go to Home
              </a>
              <button
                type="button"
                (click)="goBack()"
                class="inline-flex h-[var(--button-height)] items-center justify-center rounded-sm border border-border bg-surface px-4 text-sm font-medium text-text transition-colors duration-150 hover:bg-bg-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Go Back
              </button>
            </div>
          </div>

          <div class="order-first flex justify-start md:order-none md:justify-center">
            <!-- Placeholder illustration: drop in the actual asset here.
                 Flat vector, single color (primary or text), no gradients.
                 Rendered inside a 420x320 box (object-contain). -->
            <img
              src=""
              [alt]="errorTitle() + ' illustration'"
              width="420"
              height="320"
              class="h-auto w-full max-w-[280px] object-contain md:max-w-[420px]"
            />
          </div>
        </section>
      </div>
    </main>
  `,
})
export class Error {
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: null });

  private readonly fallback: ErrorPageData = {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred while processing your request. Please try again.',
  };

  private readonly errorMap: Record<string, ErrorPageData> = {
    '400': {
      title: 'Invalid Request',
      message: "The request didn't make sense to the server. Check the address or the details you submitted and try again.",
    },
    '401': {
      title: 'Authentication Required',
      message: 'This page requires you to be signed in. Log in with your Assessment Hub account to continue.',
    },
    '403': {
      title: 'Access Denied',
      message: "You don't have access to this page. If you think this is a mistake, reach out to the test organizer.",
    },
    '404': {
      title: 'Page Not Found',
      message: "We couldn't find this page. The link may be outdated, or the content may have been moved.",
    },
    '429': {
      title: 'Too Many Requests',
      message: "You've made too many requests in a short window. Take a short break and try again.",
    },
    '500': {
      title: 'Internal Server Error',
      message: 'Something broke on our side while handling the request. The issue has been logged for our team.',
    },
    '502': {
      title: 'Bad Gateway',
      message: 'Our server received an unclear response from an upstream service. This is usually temporary — try again shortly.',
    },
    '503': {
      title: 'Service Unavailable',
      message: 'Assessment Hub is temporarily unavailable, likely due to maintenance or high load. Please check back soon.',
    },
    '504': {
      title: 'Gateway Timeout',
      message: 'A server behind the scenes took too long to respond. Refresh the page to try once more.',
    },
  };

  readonly code = computed(() => this.params()?.get('code') ?? 'error');
  readonly data = computed(() => this.errorMap[this.code()] ?? this.fallback);

  readonly errorTitle = computed(() => this.data().title);
  readonly errorMessage = computed(() => this.data().message);

  readonly errorCode = computed(() => (this.code() === 'error' ? 'Error' : this.code()));

  goBack(): void {
    window.history.back();
  }
}
