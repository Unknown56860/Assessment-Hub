import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { UserDto } from '../../../core/auth/auth.model';
import { AuthStore, toAbsoluteUrl } from '../../../core/auth/auth.store';
import { ToastService } from '../../../core/services/toast.service';
import { apiErrorMessage } from '../../auth/auth.api';
import { ProfileService } from '../profile.api';
import { ActivityLogDto, ProfileUpdateDto, PasswordChangeDto, DeleteAccountDto } from '../profile.models';
import { nameMonogram } from '../../../shared/utils/name.utils';
import { ProfileStatus } from '../../../shared/models/common.types';
import { trackPicFailures } from '../profile.utils';

const MAX_PIC_BYTES = 5 * 1024 * 1024; // 5MB size cap

type ModalKind = 'pic' | 'pic-remove' | 'edit' | 'password' | 'delete' | null;

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const next = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return next && confirm && next !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closeModal()' },
  template: `
    <main class="page-container section">
      <h1 class="mb-8">My profile</h1>
      @if (loadState() === 'loading') {
        <p class="text-secondary">Loading your profile…</p>
      } @else if (loadState() === 'error') {
        <div class="alert alert-error" role="alert">
          <p><span class="font-semibold">Error</span> - we couldn't load your profile.</p>
          <button type="button" class="btn btn-secondary mt-3" (click)="reload()">Retry</button>
        </div>
      } @else {
        @if (profile(); as p) {
          <!-- Profile area -->
          <section class="rounded-sm border border-border bg-surface">
            <div class="flex flex-col items-center gap-8 p-6 sm:flex-row sm:items-start">
              <!-- Left: picture + actions -->
              <div class="flex shrink-0 flex-col gap-4 sm:self-stretch">
                <!-- Image centers itself in the space above the buttons -->
                <div class="flex flex-1 items-center justify-center">
                  @if (pic.src(); as src) {
                    <img
                      [src]="src"
                      alt="Profile picture of {{ p.name }}"
                      class="h-40 w-40 rounded-full border border-border object-cover"
                      (error)="pic.onError()"
                    />
                  } @else {
                    <div
                      class="flex h-40 w-40 items-center justify-center rounded-full border border-border bg-primary-subtle text-3xl font-semibold text-primary"
                      aria-hidden="true"
                    >
                      {{ initials() }}
                    </div>
                  }
                </div>
                <!-- Buttons pinned to bottom-right -->
                <div class="flex justify-end gap-2">
                  <button type="button" class="btn btn-secondary" (click)="openPicModal()">
                    {{ picUrl() ? 'Change image' : 'Upload image' }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-danger"
                    [disabled]="!picUrl()"
                    (click)="openRemovePicModal()"
                  >
                    Remove image
                  </button>
                </div>
              </div>

              <!-- Right: details + actions -->
              <div class="min-w-0 flex-1">
                <div class="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  <!-- Left column -->
                  <div class="grid gap-y-5">
                    <div>
                      <p class="field-label">Name</p>
                      <p class="font-medium break-words">{{ p.name }}</p>
                    </div>
                    <div>
                      <p class="field-label">Email</p>
                      <p class="break-words">{{ p.email }}</p>
                    </div>
                    <div>
                      <p class="field-label">Mobile number</p>
                      <p>{{ p.mobileNo || '---' }}</p>
                    </div>
                    <div>
                      <p class="field-label">Designation</p>
                      <p>{{ p.designation || '---' }}</p>
                    </div>
                  </div>
                  <!-- Right column -->
                  <div class="grid gap-y-5">
                    <div>
                      <p class="field-label">Role</p>
                      <p class="font-medium">{{ p.role }}</p>
                    </div>
                    <div>
                      <p class="field-label">Profile status</p>
                      <p><span [class]="statusBadge(p.status)">{{ p.status }}</span></p>
                    </div>
                    <div>
                      <p class="field-label">Created at</p>
                      <p class="break-words">{{ p.createdAt | date: 'MMM d, y' }}</p>
                    </div>
                    <div>
                      <p class="field-label">Last modified</p>
                      <p class="break-words">{{ p.updatedAt | date: 'MMM d, y' }}</p>
                    </div>
                  </div>
                </div>

                <div class="mt-6 flex flex-wrap justify-end gap-2">
                  <button type="button" class="btn btn-primary" (click)="openEdit()">Edit profile</button>
                  <button type="button" class="btn btn-secondary" (click)="openPassword()">Change password</button>
                  <button type="button" class="btn btn-danger" (click)="openDelete()">Delete profile</button>
                </div>
              </div>
            </div>
          </section>

          <!-- Activity -->
          <section class="mt-12">
            <div class="flex items-center justify-between gap-4">
              <h2>Recent activity</h2>
              <a routerLink="/profile/logs" class="btn btn-primary">View all logs</a>
            </div>
            <div class="mt-4 rounded-sm border border-border bg-surface">
              @if (logsLoading()) {
                <p class="p-4 text-secondary">Loading activity…</p>
              } @else if (logs().length === 0) {
                <p class="p-4 text-muted">No activity yet.</p>
              } @else {
                <ul>
                  @for (log of logs(); track $index) {
                    <li
                      class="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0 hover:bg-hover"
                    >
                      <span class="min-w-0 truncate font-medium">{{ log.action }}</span>
                      <span class="shrink-0 text-sm text-secondary">{{ log.time | date: 'MMM d, y, h:mm a' }}</span>
                    </li>
                  }
                </ul>
              }
            </div>
          </section>
        }
      }
    </main>

    @if (modal() === 'pic') {
      <div class="modal-overlay" (click)="closeModal()" aria-hidden="true"></div>
      <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="pic-title">
        <h3 id="pic-title">Change profile image</h3>
        <p class="mt-2 text-sm text-secondary">PNG or JPEG, up to 5 MB.</p>
        <div class="mt-5 grid gap-4">
          <div class="flex items-center gap-3">
            <label class="btn btn-secondary cursor-pointer">
              Choose file
              <input type="file" accept="image/png,image/jpeg" class="sr-only" (change)="onFileSelected($event)" />
            </label>
            <span class="min-w-0 truncate text-sm text-secondary">{{ selectedPic()?.name ?? 'No file chosen' }}</span>
          </div>
          @if (picError(); as error) {
            <p class="field-error">{{ error }}</p>
          }
          @if (picPreview(); as preview) {
            <img
              [src]="preview"
              alt="Selected image preview"
              class="h-24 w-24 rounded-full border border-border object-cover"
            />
          }
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancel</button>
            <button type="button" class="btn btn-primary" [disabled]="!selectedPic() || busy()" (click)="submitPic()">
              {{ busy() ? 'Uploading…' : 'Save image' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (modal() === 'pic-remove') {
      <div class="modal-overlay" (click)="closeModal()" aria-hidden="true"></div>
      <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="pic-remove-title">
        <h3 id="pic-remove-title">Remove profile image</h3>
        <p class="mt-2 text-sm text-secondary">Your current profile image will be removed.</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancel</button>
          <button type="button" class="btn btn-danger" [disabled]="busy()" (click)="submitRemovePic()">
            {{ busy() ? 'Removing…' : 'Remove image' }}
          </button>
        </div>
      </div>
    }

    @if (modal() === 'edit') {
      <div class="modal-overlay" (click)="closeModal()" aria-hidden="true"></div>
      <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <h3 id="edit-title">Edit profile</h3>
        <p class="mt-1 text-sm text-secondary">Signed in as {{ profile()?.email }} (email cannot be changed).</p>
        <form [formGroup]="editForm" (ngSubmit)="submitEdit()" class="mt-5 grid gap-4" novalidate>
          <div>
            <label class="label" for="edit-name">Name</label>
            <input
              id="edit-name"
              type="text"
              class="input"
              formControlName="name"
              maxlength="100"
              [class.input-error]="editForm.controls.name.invalid && editForm.controls.name.touched"
            />
            @if (editForm.controls.name.invalid && editForm.controls.name.touched) {
              <p class="field-error">Name is required.</p>
            }
          </div>
          <div>
            <label class="label" for="edit-mobile">Mobile number</label>
            <input id="edit-mobile" type="tel" class="input" formControlName="mobileNo" maxlength="50" placeholder="Optional" />
          </div>
          <div>
            <label class="label" for="edit-designation">Designation</label>
            <input
              id="edit-designation"
              type="text"
              class="input"
              formControlName="designation"
              maxlength="100"
              placeholder="Optional"
            />
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" [disabled]="busy() || editForm.invalid">
              {{ busy() ? 'Saving…' : 'Save changes' }}
            </button>
          </div>
        </form>
      </div>
    }

    @if (modal() === 'password') {
      <div class="modal-overlay" (click)="closeModal()" aria-hidden="true"></div>
      <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="password-title">
        <h3 id="password-title">Change password</h3>
        <form [formGroup]="passwordForm" (ngSubmit)="submitPassword()" class="mt-5 grid gap-4" novalidate>
          <div>
            <label class="label" for="pw-current">Current password</label>
            <input
              id="pw-current"
              type="password"
              class="input"
              formControlName="currentPassword"
              autocomplete="current-password"
              [class.input-error]="passwordForm.controls.currentPassword.invalid && passwordForm.controls.currentPassword.touched"
            />
            @if (passwordForm.controls.currentPassword.invalid && passwordForm.controls.currentPassword.touched) {
              <p class="field-error">Current password is required.</p>
            }
          </div>
          <div>
            <label class="label" for="pw-new">New password</label>
            <input
              id="pw-new"
              type="password"
              class="input"
              formControlName="newPassword"
              autocomplete="new-password"
              [class.input-error]="passwordForm.controls.newPassword.invalid && passwordForm.controls.newPassword.touched"
            />
            @if (passwordForm.controls.newPassword.invalid && passwordForm.controls.newPassword.touched) {
              <p class="field-error">Use 4 to 64 characters.</p>
            }
          </div>
          <div>
            <label class="label" for="pw-confirm">Confirm new password</label>
            <input
              id="pw-confirm"
              type="password"
              class="input"
              formControlName="confirmPassword"
              autocomplete="new-password"
              [class.input-error]="passwordForm.controls.confirmPassword.invalid && passwordForm.controls.confirmPassword.touched"
            />
            @if (passwordForm.controls.confirmPassword.invalid && passwordForm.controls.confirmPassword.touched) {
              <p class="field-error">Please confirm the new password.</p>
            } @else if (passwordForm.hasError('mismatch') && passwordForm.controls.confirmPassword.touched) {
              <p class="field-error">Passwords do not match.</p>
            }
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" [disabled]="busy() || passwordForm.invalid">
              {{ busy() ? 'Saving…' : 'Change password' }}
            </button>
          </div>
        </form>
      </div>
    }

    @if (modal() === 'delete') {
      <div class="modal-overlay" (click)="closeModal()" aria-hidden="true"></div>
      <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <h3 id="delete-title">Delete profile</h3>
        <p class="mt-2 text-sm text-secondary">
          This permanently removes your account and its activity logs. This cannot be undone.
        </p>
        <form [formGroup]="deleteForm" (ngSubmit)="submitDelete()" class="mt-5 grid gap-4" novalidate>
          <div>
            <label class="label" for="delete-password">Password</label>
            <input
              id="delete-password"
              type="password"
              class="input"
              formControlName="password"
              autocomplete="current-password"
              [class.input-error]="deleteForm.controls.password.invalid && deleteForm.controls.password.touched"
            />
            @if (deleteForm.controls.password.invalid && deleteForm.controls.password.touched) {
              <p class="field-error">Password is required.</p>
            }
          </div>
          <div>
            <label class="label" for="delete-confirm">Type "Delete" to confirm</label>
            <input
              id="delete-confirm"
              type="text"
              class="input"
              formControlName="confirmation"
              placeholder="Delete"
              autocomplete="off"
              [class.input-error]="deleteForm.controls.confirmation.invalid && deleteForm.controls.confirmation.touched"
            />
            @if (
              deleteForm.controls.confirmation.value.length > 0 &&
              deleteForm.controls.confirmation.value !== 'Delete'
            ) {
              <p class="field-error">Type Delete exactly to enable the button.</p>
            }
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancel</button>
            <button
              type="submit"
              class="btn btn-danger"
              [disabled]="busy() || deleteForm.invalid || deleteForm.controls.confirmation.value !== 'Delete'"
            >
              {{ busy() ? 'Deleting…' : 'Delete profile' }}
            </button>
          </div>
        </form>
      </div>
    }
  `,
  styles: `
    /* Buttons — shared height token, small radius, medium weight, color-only transitions */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      height: var(--button-height);
      padding-inline: var(--space-4);
      border: var(--border-width) solid transparent;
      border-radius: var(--radius-sm);
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      text-decoration: none;
      transition:
        background-color 0.15s ease,
        color 0.15s ease,
        border-color 0.15s ease;
    }
    .btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .btn-primary {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }
    .btn-primary:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }
    .btn-primary:active:not(:disabled) {
      background: var(--color-primary-active);
    }
    .btn-secondary {
      background: var(--color-bg);
      border-color: var(--color-border-strong);
      color: var(--color-text);
    }
    .btn-secondary:hover:not(:disabled) {
      background: var(--color-bg-alt);
    }
    .btn-danger {
      background: var(--color-error);
      color: var(--color-text-inverse);
    }
    .btn-danger:hover:not(:disabled) {
      background: var(--color-error-strong);
    }
    .btn:focus-visible,
    label.btn:focus-within {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }

    /* Form controls */
    .label {
      display: block;
      margin-bottom: var(--space-2);
      font-size: var(--text-sm);
      font-weight: var(--font-weight-medium);
    }
    .input {
      width: 100%;
      height: var(--input-height);
      padding-inline: var(--space-3);
      background: var(--color-bg);
      color: var(--color-text);
      border: var(--border-width) solid var(--color-border-strong);
      border-radius: var(--radius-sm);
    }
    .input::placeholder {
      color: var(--color-text-muted);
    }
    .input:disabled {
      background: var(--color-bg-alt);
      color: var(--color-text-muted);
    }
    .input-error {
      border-color: var(--color-error);
    }
    .field-error {
      margin-top: var(--space-1);
      font-size: var(--text-xs);
      color: var(--color-error);
    }
    .field-label {
      margin-bottom: var(--space-1);
      font-size: var(--text-xs);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-secondary);
      text-transform: uppercase;
    }

    /* Badges — one status, one color pair */
    .badge {
      display: inline-block;
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
      font-size: var(--text-xs);
      font-weight: var(--font-weight-medium);
    }
    .badge-success {
      background: var(--color-success-bg);
      color: var(--color-success-strong);
    }
    .badge-warning {
      background: var(--color-warning-bg);
      color: var(--color-warning-strong);
    }
    .badge-error {
      background: var(--color-error-bg);
      color: var(--color-error-strong);
    }
    .badge-info {
      background: var(--color-info-bg);
      color: var(--color-info-strong);
    }

    /* Alerts */
    .alert {
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: var(--space-4);
    }
    .alert-error {
      background: var(--color-error-bg);
      border-color: var(--color-error);
    }

    /* Modals — overlay token, bordered surface panel, subtle fade only */
    @keyframes modal-fade {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    .modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 40;
      background: var(--color-overlay);
      animation: modal-fade 0.15s ease-out both;
    }
    .modal-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 50;
      width: var(--modal-width);
      max-width: calc(100vw - 2 * var(--container-padding-x));
      max-height: calc(100vh - 2 * var(--space-8));
      overflow-y: auto;
      background: var(--color-surface);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: var(--space-6);
      animation: modal-fade 0.15s ease-out both;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      margin-top: var(--space-6);
    }
  `,
})
export class Profile {
  private readonly api = inject(ProfileService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly auth = inject(AuthStore);

  readonly profile = signal<UserDto | null>(null);
  readonly loadState = signal<'loading' | 'ready' | 'error'>('loading');

  readonly logs = signal<ActivityLogDto[]>([]);
  readonly logsLoading = signal(true);

  readonly modal = signal<ModalKind>(null);
  readonly busy = signal(false);

  readonly selectedPic = signal<File | null>(null);
  readonly picPreview = signal<string | null>(null);
  readonly picError = signal<string | null>(null);

  /** Backend-built URL (GET /profile/pfp?user=…&v=…), made absolute for the <img>. */
  readonly picUrl = computed(() => {
    const pic = this.profile()?.profilePic;
    return pic ? toAbsoluteUrl(pic) : null;
  });

  readonly pic = trackPicFailures(() => this.picUrl());

  readonly initials = computed(() =>
    nameMonogram(this.profile()?.name ?? this.auth.currentUser()?.name),
  );

  readonly editForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    mobileNo: ['', Validators.maxLength(50)],
    designation: ['', Validators.maxLength(100)],
  });

  readonly passwordForm = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(64)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  readonly deleteForm = this.fb.group({
    password: ['', Validators.required],
    confirmation: ['', Validators.required],
  });

  constructor() {
    this.reload();
    this.reloadLogs();
    this.destroyRef.onDestroy(() => this.revokePreview());
  }

  // ----- data -----

  reload(): void {
    this.loadState.set('loading');
    this.api.getProfile().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loadState.set('ready');
      },
      error: () => this.loadState.set('error'),
    });
  }

  reloadLogs(): void {
    this.logsLoading.set(true);
    this.api
      .getLogs(0, 10)
      .pipe(finalize(() => this.logsLoading.set(false)))
      .subscribe({
        next: (page) => this.logs.set(page.logs),
        error: () => this.logs.set([]),
      });
  }

  /** One status → one badge color; anything unknown falls back to info. */
  statusBadge(status: ProfileStatus): string {
    switch (status) {
      case 'ACTIVE':     return 'badge badge-success';
      case 'PENDING':    return 'badge badge-warning';
      case 'RESTRICTED': return 'badge badge-error';
      default:           return 'badge badge-info';
    }
  }


  // ----- modal plumbing -----

  closeModal(): void {
    if (this.busy()) return; // don't strand an in-flight request
    this.modal.set(null);
    this.revokePreview();
  }

  private revokePreview(): void {
    const url = this.picPreview();
    if (url) URL.revokeObjectURL(url);
    this.picPreview.set(null);
  }

  openPicModal(): void {
    this.selectedPic.set(null);
    this.picError.set(null);
    this.revokePreview();
    this.modal.set('pic');
  }

  openRemovePicModal(): void {
    this.modal.set('pic-remove');
  }

  openEdit(): void {
    const p = this.profile();
    this.editForm.reset({
      name: p?.name ?? '',
      mobileNo: p?.mobileNo ?? '',
      designation: p?.designation ?? '',
    });
    this.modal.set('edit');
  }

  openPassword(): void {
    this.passwordForm.reset();
    this.modal.set('password');
  }

  openDelete(): void {
    this.deleteForm.reset();
    this.modal.set('delete');
  }

  // ----- picture -----

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = ''; // allows re-choosing the same file after a failed attempt
    this.picError.set(null);
    this.revokePreview();
    this.selectedPic.set(null);

    if (!file) return;
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      this.picError.set('Only PNG or JPEG images are allowed.');
      return;
    }
    if (file.size > MAX_PIC_BYTES) {
      this.picError.set('The image must be 5 MB or smaller.');
      return;
    }
    this.selectedPic.set(file);
    this.picPreview.set(URL.createObjectURL(file));
  }

  submitPic(): void {
    const file = this.selectedPic();
    if (!file || this.busy()) return;
    this.busy.set(true);
    this.api
      .updateProfilePic(file)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (profile) => this.afterProfileMutation(profile, 'Profile image updated.'),
        error: (err) => this.toast.show(apiErrorMessage(err, 'Could not update your profile image.'), 'error'),
      });
  }

  submitRemovePic(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api
      .updateProfilePic(null)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (profile) => this.afterProfileMutation(profile, 'Profile image removed.'),
        error: (err) => this.toast.show(apiErrorMessage(err, 'Could not remove your profile image.'), 'error'),
      });
  }

  // ----- profile / password / delete -----

  submitEdit(): void {
    if (this.editForm.invalid || this.busy()) return;
    this.busy.set(true);
    const dto: ProfileUpdateDto = {
      name: this.editForm.controls.name.value.trim(),
      mobileNo: this.editForm.controls.mobileNo.value.trim() || null,
      designation: this.editForm.controls.designation.value.trim() || null,
    };
    this.api
      .updateProfile(dto)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (profile) => this.afterProfileMutation(profile, 'Profile updated.'),
        error: (err) => this.toast.show(apiErrorMessage(err, 'Could not update your profile.'), 'error'),
      });
  }

  private afterProfileMutation(profile: UserDto, message: string): void {
    this.modal.set(null);
    this.revokePreview();
    this.profile.set(profile);
    this.auth.refresh().subscribe({ error: () => {} }); // keep navbar name/avatar in sync
    this.reloadLogs(); // the change just produced a new activity log
    this.toast.show(message, 'success');
  }

  submitPassword(): void {
    if (this.passwordForm.invalid || this.busy()) return;
    this.busy.set(true);
    const dto: PasswordChangeDto = {
      currentPassword: this.passwordForm.controls.currentPassword.value,
      newPassword: this.passwordForm.controls.newPassword.value,
    };
    this.api
      .changePassword(dto)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.modal.set(null);
          this.toast.show('Password changed. Please sign in with your new password.', 'success');
          this.auth
            .logout()
            .pipe(
              finalize(() => {
                this.auth.forceSignOut();
                this.router.navigate(['/login']);
              }),
            )
            .subscribe({ error: () => {} });
        },
        error: (err) => this.toast.show(apiErrorMessage(err, 'Could not change your password.'), 'error'),
      });
  }

  submitDelete(): void {
    if (this.deleteForm.invalid || this.busy()) return;
    this.busy.set(true);
    const dto: DeleteAccountDto = {
      password: this.deleteForm.controls.password.value,
      confirmation: this.deleteForm.controls.confirmation.value,
    };
    this.api
      .deleteProfile(dto)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.modal.set(null);
          this.toast.show('Your profile has been deleted.', 'success');
          this.auth.forceSignOut(); // backend already invalidated the session
          this.router.navigate(['/']);
        },
        error: (err) => this.toast.show(apiErrorMessage(err, 'Could not delete your profile.'), 'error'),
      });
  }
}
