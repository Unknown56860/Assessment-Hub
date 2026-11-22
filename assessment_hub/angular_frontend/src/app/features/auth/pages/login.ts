import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import { ToastService } from '../../../core/services/toast.service';
import { apiErrorMessage } from '../auth.api';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-screen items-center justify-center bg-bg-alt px-4 py-8">
      <section
        aria-labelledby="login-title"
        class="w-full max-w-md rounded-sm border border-border bg-surface p-6 sm:p-8"
      >
        <header class="flex flex-col gap-2">
          <span class="text-xl font-semibold text-primary">Assessment Hub</span>
          <h1 id="login-title">Welcome back</h1>
          <p class="text-sm text-secondary">Sign in to manage your assessments and continue your work.</p>
        </header>

        <form novalidate class="mt-6 flex flex-col gap-4" [formGroup]="form" (ngSubmit)="submit()">
          <div class="flex flex-col gap-2">
            @let emailErr = errorFor('email');
            <label for="login-email" class="text-sm font-medium">Email</label>
            <input
              id="login-email"
              type="email"
              formControlName="email"
              autocomplete="email"
              placeholder="Enter your email"
              [class]="inputClass"
              [class.border-error]="!!emailErr"
              [attr.aria-invalid]="emailErr ? true : null"
              [attr.aria-describedby]="emailErr ? 'login-email-error' : null"
            />
            @if (emailErr; as msg) {
              <p id="login-email-error" class="text-xs text-error">{{ msg }}</p>
            }
          </div>

          <div class="flex flex-col gap-2">
            @let passwordErr = errorFor('password');
            <label for="login-password" class="text-sm font-medium">Password</label>
            <div class="relative">
              <input
                id="login-password"
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="password"
                autocomplete="current-password"
                placeholder="Enter your password"
                class="pr-10"
                [class]="inputClass"
                [class.border-error]="!!passwordErr"
                [attr.aria-invalid]="passwordErr ? true : null"
                [attr.aria-describedby]="passwordErr ? 'login-password-error' : null"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted transition-colors hover:text-text"
                (click)="showPassword.set(!showPassword())"
                [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                [attr.aria-pressed]="showPassword()"
              >
                @if (showPassword()) {
                  <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                } @else {
                  <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                }
              </button>
            </div>
            @if (passwordErr; as msg) {
              <p id="login-password-error" class="text-xs text-error">{{ msg }}</p>
            }
          </div>

          <button type="submit" [class]="primaryBtnClass" [disabled]="isSubmitting()">
            {{ isSubmitting() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <footer class="mt-6 border-t border-border pt-4">
          <p class="text-sm text-secondary">
            New teacher?
            <a routerLink="/register">Create an account</a>
          </p>
        </footer>
      </section>
    </main>
  `,
})
export class Login {
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly toast = inject(ToastService);

  protected readonly isSubmitting = signal(false);
  protected readonly showPassword = signal(false);

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected readonly inputClass =
    'h-[var(--input-height)] w-full rounded-sm border border-border bg-surface px-3 ' +
    'text-base text-text placeholder:text-muted focus:border-border-strong ' +
    'disabled:cursor-not-allowed disabled:bg-bg-alt disabled:text-muted';

  protected readonly primaryBtnClass =
    'h-[var(--button-height)] w-full rounded-sm bg-primary text-sm font-medium text-text-inverse ' +
    'transition-colors hover:bg-primary-hover active:bg-primary-active ' +
    'disabled:cursor-not-allowed disabled:opacity-60';

  /** Shows a message once the field has been touched (blur) or an invalid submit marked it. */
  protected errorFor(field: 'email' | 'password'): string | null {
    const control = this.form.controls[field];
    if (control.valid || !control.touched) return null;
    if (control.hasError('required')) return field === 'email' ? 'Email is required.' : 'Password is required.';
    return control.hasError('email') ? 'Enter a valid email address.' : null;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.store
      .login(this.form.getRawValue())
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        // Teacher → host page, Admin → dashboard
        next: (user) => void this.router.navigateByUrl(user.role === 'ADMIN' ? '/admin/dashboard' : '/assessment/host'),
        error: (err: unknown) =>
          this.toast.show(apiErrorMessage(err, 'Unable to sign in. Check your email and password.'), 'error'),
      });
  }
}
