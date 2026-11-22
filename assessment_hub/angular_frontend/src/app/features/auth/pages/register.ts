import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { RegisterRequestDto } from '../../../core/auth/auth.model';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService, apiErrorMessage } from '../auth.api';



const MAX_PROFILE_PIC_BYTES = 5 * 1024 * 1024;

/** Group-level validator: confirm must equal password (only when both are filled). */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { password, confirmPassword } = group.value as { password?: string; confirmPassword?: string };
  return password && confirmPassword && password !== confirmPassword ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-screen items-center justify-center bg-bg-alt px-4 py-8">
      <section
        aria-labelledby="register-title"
        class="w-full max-w-md rounded-sm border border-border bg-surface p-6 sm:p-8"
      >
        <header class="flex flex-col gap-2">
          <span class="text-xl font-semibold text-primary">Assessment Hub</span>
          <h1 id="register-title">Create your profile</h1>
          <p class="text-sm text-secondary">Register as a teacher to create and conduct assessments.</p>
        </header>

        <form novalidate class="mt-6 flex flex-col gap-4" [formGroup]="form" (ngSubmit)="submit()">
          <!-- Profile picture (optional) -->
          <div class="flex items-center gap-4">
            <div class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-alt">
              @if (picPreview(); as src) {
                <img [src]="src" alt="Profile picture preview" class="h-16 w-16 rounded-full object-cover" width="64" height="64" />
              } @else {
                <!-- placeholder: default avatar, square 1:1 source, rendered at 64×64 inside the circle -->
                <img src="/img/profile_icon.jpg" alt="" class="h-16 w-16 rounded-full object-cover" width="64" height="64" />
              }
            </div>

            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <span id="register-pic-label" class="text-sm font-medium">Profile picture</span>
              <span id="register-pic-hint" class="text-xs text-muted">PNG or JPEG, up to 5 MB.</span>
              <div class="flex flex-wrap items-center gap-2">
                <button type="button" [class]="secondaryBtnClass" (click)="pickFile()">Choose image</button>
                @if (picPreview()) {
                  <button type="button" [class]="ghostBtnClass" (click)="clearPic()">Remove</button>
                }
              </div>
              @if (picError(); as msg) {
                <p class="text-xs text-error">{{ msg }}</p>
              }
            </div>

            <input
              #picInput
              id="register-pic"
              type="file"
              accept="image/png,image/jpeg"
              tabindex="-1"
              class="sr-only"
              aria-labelledby="register-pic-label"
              aria-describedby="register-pic-hint"
              (change)="onPicSelected($event)"
            />
          </div>

          <!-- Name -->
          <div class="flex flex-col gap-2">
            @let nameErr = errorFor('name');
            <label for="register-name" class="text-sm font-medium">Name</label>
            <input
              id="register-name"
              type="text"
              formControlName="name"
              autocomplete="name"
              placeholder="Enter your full name"
              [class]="inputClass"
              [class.border-error]="!!nameErr"
              [attr.aria-invalid]="nameErr ? true : null"
              [attr.aria-describedby]="nameErr ? 'register-name-error' : null"
            />
            @if (nameErr; as msg) {
              <p id="register-name-error" class="text-xs text-error">{{ msg }}</p>
            }
          </div>

          <!-- Email -->
          <div class="flex flex-col gap-2">
            @let emailErr = errorFor('email');
            <label for="register-email" class="text-sm font-medium">Email</label>
            <input
              id="register-email"
              type="email"
              formControlName="email"
              autocomplete="email"
              placeholder="Enter your email"
              [class]="inputClass"
              [class.border-error]="!!emailErr"
              [attr.aria-invalid]="emailErr ? true : null"
              [attr.aria-describedby]="emailErr ? 'register-email-error' : null"
            />
            @if (emailErr; as msg) {
              <p id="register-email-error" class="text-xs text-error">{{ msg }}</p>
            }
          </div>

          <!-- Mobile & designation (both optional) -->
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              @let mobileErr = errorFor('mobile');
              <label for="register-mobile" class="text-sm font-medium">Mobile number</label>
              <input
                id="register-mobile"
                type="tel"
                formControlName="mobile"
                autocomplete="tel"
                placeholder="Enter your mobile number"
                [class]="inputClass"
                [class.border-error]="!!mobileErr"
                [attr.aria-invalid]="mobileErr ? true : null"
                [attr.aria-describedby]="mobileErr ? 'register-mobile-error' : null"
              />
              @if (mobileErr; as msg) {
                <p id="register-mobile-error" class="text-xs text-error">{{ msg }}</p>
              }
            </div>

            <div class="flex flex-col gap-2">
              <label for="register-designation" class="text-sm font-medium">Designation</label>
              <input
                id="register-designation"
                type="text"
                formControlName="designation"
                autocomplete="organization-title"
                placeholder="e.g. Assistant Professor"
                [class]="inputClass"
              />
            </div>
          </div>

          <!-- Password -->
          <div class="flex flex-col gap-2">
            @let passwordErr = errorFor('password');
            <label for="register-password" class="text-sm font-medium">Password</label>
            <div class="relative">
              <input
                id="register-password"
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="password"
                autocomplete="new-password"
                placeholder="Create a password"
                class="pr-10"
                [class]="inputClass"
                [class.border-error]="!!passwordErr"
                [attr.aria-invalid]="passwordErr ? true : null"
                [attr.aria-describedby]="passwordErr ? 'register-password-error' : null"
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
              <p id="register-password-error" class="text-xs text-error">{{ msg }}</p>
            }
          </div>

          <!-- Confirm password -->
          <div class="flex flex-col gap-2">
            @let confirmErr = confirmError();
            <label for="register-confirm-password" class="text-sm font-medium">Confirm password</label>
            <div class="relative">
              <input
                id="register-confirm-password"
                [type]="showConfirmPassword() ? 'text' : 'password'"
                formControlName="confirmPassword"
                autocomplete="new-password"
                placeholder="Enter the password again"
                class="pr-10"
                [class]="inputClass"
                [class.border-error]="!!confirmErr"
                [attr.aria-invalid]="confirmErr ? true : null"
                [attr.aria-describedby]="confirmErr ? 'register-confirm-password-error' : null"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted transition-colors hover:text-text"
                (click)="showConfirmPassword.set(!showConfirmPassword())"
                [attr.aria-label]="showConfirmPassword() ? 'Hide password confirmation' : 'Show password confirmation'"
                [attr.aria-pressed]="showConfirmPassword()"
              >
                @if (showConfirmPassword()) {
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
            @if (confirmErr; as msg) {
              <p id="register-confirm-password-error" class="text-xs text-error">{{ msg }}</p>
            }
          </div>

          <button type="submit" [class]="primaryBtnClass" [disabled]="isSubmitting()">
            {{ isSubmitting() ? 'Creating profile…' : 'Create profile' }}
          </button>
        </form>

        <footer class="mt-6 border-t border-border pt-4">
          <p class="text-sm text-secondary">
            Already have an account?
            <a routerLink="/login">Sign in</a>
          </p>
        </footer>
      </section>
    </main>
  `,
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly toast = inject(ToastService);

  private picFile: File | null = null;
  private readonly picInput = viewChild<ElementRef<HTMLInputElement>>('picInput');

  protected readonly isSubmitting = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);
  protected readonly picPreview = signal<string | null>(null);
  protected readonly picError = signal<string | null>(null);

  // free the object URL when the page goes away
  constructor() {
    inject(DestroyRef).onDestroy(() => this.revokePreview());
  }

  protected readonly form = this.fb.group(
    {
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      mobile: ['', [Validators.pattern(/^[0-9+\-\s]{7,15}$/)]], // loose check;
      designation: [''],
      password: ['', [Validators.required, Validators.minLength(4)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [passwordsMatch] },
  );

  protected readonly inputClass =
    'h-[var(--input-height)] w-full rounded-sm border border-border bg-surface px-3 ' +
    'text-base text-text placeholder:text-muted focus:border-border-strong ' +
    'disabled:cursor-not-allowed disabled:bg-bg-alt disabled:text-muted';

  protected readonly primaryBtnClass =
    'h-[var(--button-height)] w-full rounded-sm bg-primary text-sm font-medium text-text-inverse ' +
    'transition-colors hover:bg-primary-hover active:bg-primary-active ' +
    'disabled:cursor-not-allowed disabled:opacity-60';

  protected readonly secondaryBtnClass =
    'h-[var(--button-height)] rounded-sm border border-border bg-surface px-3 text-sm font-medium text-text transition-colors hover:bg-hover';

  protected readonly ghostBtnClass =
    'h-[var(--button-height)] rounded-sm px-2 text-sm font-medium text-text-secondary transition-colors hover:bg-hover hover:text-text';

  private readonly fieldMessages: Record<'name' | 'email' | 'mobile' | 'password', Record<string, string>> = {
    name: { required: 'Name is required.' },
    email: { required: 'Email is required.', email: 'Enter a valid email address.' },
    mobile: { pattern: 'Enter a valid mobile number.' },
    password: { required: 'Password is required.', minlength: 'Password must be at least 4 characters.' },
  };

  protected errorFor(field: 'name' | 'email' | 'mobile' | 'password'): string | null {
    return this.messageFor(this.form.controls[field], this.fieldMessages[field]);
  }

  protected confirmError(): string | null {
    const control = this.form.controls.confirmPassword;
    return (
      this.messageFor(control, { required: 'Confirm your password.' }) ??
      (control.touched && this.form.hasError('passwordMismatch') ? 'Passwords do not match.' : null)
    );
  }

  protected pickFile(): void {
    this.picInput()?.nativeElement.click();
  }

  protected onPicSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      this.picError.set('Only PNG or JPEG images are allowed.');
      this.resetPicInput();
      return;
    }
    if (file.size > MAX_PROFILE_PIC_BYTES) {
      this.picError.set('The image must be 5 MB or smaller.');
      this.resetPicInput();
      return;
    }

    this.picError.set(null);
    this.picFile = file;
    this.revokePreview();
    this.picPreview.set(URL.createObjectURL(file));
  }

  protected clearPic(): void {
    this.picFile = null;
    this.picError.set(null);
    this.picPreview.set(null);
    this.resetPicInput();
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, email, password, mobile, designation } = this.form.getRawValue();
    const dto: RegisterRequestDto = {
      name,
      email,
      password,
      mobileNo: mobile.trim() || null,
      designation: designation.trim() || null,
    };

    this.isSubmitting.set(true);
    this.auth
      .register(dto, this.picFile)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        // account created → user signs in next
        next: () => {
          this.toast.show('Profile created. Please sign in.', 'success');
          void this.router.navigateByUrl('/login');
        },
        error: (err: unknown) =>
          this.toast.show(apiErrorMessage(err, 'Unable to create your profile. Please try again.'), 'error'),
      });
  }

  private messageFor(control: AbstractControl, messages: Record<string, string>): string | null {
    if (control.valid || !control.touched) return null;
    const key = Object.keys(control.errors ?? {})[0];
    return (key && messages[key]) ?? null;
  }

  private revokePreview(): void {
    const url = this.picPreview();
    if (url) URL.revokeObjectURL(url);
  }

  private resetPicInput(): void {
    const input = this.picInput()?.nativeElement;
    if (input) input.value = '';
  }
}
