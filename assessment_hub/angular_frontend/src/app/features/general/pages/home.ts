import { Component, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ToastService } from '../../../core/services/toast.service';
import { MessageService } from '../message.api';


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    <main class="w-full bg-bg">

      <!-- ==================== HERO ==================== -->
      <section class="hero-offset section">
        <div class="page-container grid items-center gap-16 lg:grid-cols-2">

          <div class="max-w-2xl">
            <span class="text-sm font-medium text-primary">Assessment Hub</span>

            <h1 class="mt-3">
              Conduct Secure, Real-Time Assessments — Anytime, Anywhere
            </h1>

            <p class="mt-6 text-lg leading-relaxed text-text-secondary">
              A powerful online assessment platform that lets teachers create, host,
              and evaluate tests in real time — while students join instantly with
              just a code, a roll number, and a name. No accounts, no hassle, no
              cheating.
            </p>

            <div class="mt-6 flex flex-wrap items-center gap-3">
              <a
                routerLink="/assessment/join"
                class="flex h-[var(--button-height)] items-center justify-center rounded-sm bg-primary px-6 text-sm font-medium text-text-inverse transition-colors duration-150 hover:bg-primary-hover active:bg-primary-active"
              >
                Join a Test
              </a>

              <a
                routerLink="/login"
                class="flex h-[var(--button-height)] items-center justify-center rounded-sm border border-border bg-surface px-6 text-sm font-medium text-text transition-colors duration-150 hover:bg-bg-alt"
              >
                Teacher Login
              </a>
            </div>

            <p class="mt-3 text-sm text-text-muted">
              No account is required — students join with a test code, roll number, and name.
            </p>
          </div>

          <!-- Hero illustration placeholder:
               Students in a classroom taking a live online assessment on laptops.
               Flat illustration, light background, no shadows or gradients. -->
          <div class="flex justify-center lg:justify-end">
            <img
              src="img/classroom.png"
              alt=""
              width="560"
              height="420"
              class="h-auto w-full max-w-xl object-contain"
            />
          </div>

        </div>
      </section>

      <!-- ==================== FEATURES ==================== -->
      <section id="features" class="section bg-bg-alt">
        <div class="page-container">

          <div class="mx-auto max-w-2xl text-center">
            <span class="text-sm font-medium text-primary">Features</span>
            <h2 class="mt-3">Why Choose Us?</h2>
            <p class="mt-4 text-base text-text-secondary">
              Everything needed to run a fair, live assessment — from creation to
              final evaluation.
            </p>
          </div>

          <div class="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            @for (feature of features; track feature.title) {
              <article class="rounded-md border border-border bg-surface p-6">
                <div
                  class="mb-4 flex h-9 w-9 items-center justify-center rounded-sm border border-primary text-xs"
                  aria-hidden="true"
                >
                  {{ feature.icon }}
                </div>
                <h3 class="mb-3">{{ feature.title }}</h3>
                <p class="mb-0 text-sm leading-relaxed text-text-secondary">
                  {{ feature.description }}
                </p>
              </article>
            }
          </div>

        </div>
      </section>

      <!-- ==================== ABOUT ==================== -->
      <section id="about" class="section">
        <div class="page-container grid items-center gap-16 lg:grid-cols-2">

          <!-- About illustration placeholder:
               Teacher creating a question set and hosting a live assessment.
               Flat illustration, light background, no shadows or gradients. -->
          <div class="flex justify-center lg:justify-start">
            <img
              src="img/evaluation.svg"
              alt=""
              width="480"
              height="360"
              class="h-auto w-full max-w-xl object-contain"
            />
          </div>

          <div class="max-w-2xl">
            <span class="text-sm font-medium text-primary">About</span>
            <h2 class="mt-3">About the Platform</h2>

            <p class="mt-6 leading-relaxed text-text-secondary">
              Built for modern classrooms, this platform bridges the gap between
              teachers and students in a fully digital testing environment. Teachers
              can build rich question sets — question-answer, single or
              multiple-choice MCQs, and fill-in-the-blanks with image support — and
              host them live with unique assessment codes.
            </p>

            <p class="mt-4 leading-relaxed text-text-secondary">
              Students don't need to register or remember passwords. With a test
              code, roll number, and name, they can join an assessment instantly —
              and rejoin automatically if their connection drops.
            </p>

            <p class="mt-4 leading-relaxed text-text-secondary">
              Every submission is securely bundled and stored for evaluation, giving
              teachers a complete, organized view of every student's performance —
              all in one place.
            </p>
          </div>

        </div>
      </section>

      <!-- ==================== CONTACT ==================== -->
      <section id="contact" class="section bg-bg-alt">
        <div class="page-container">

          <div class="mx-auto max-w-2xl text-center">
            <span class="text-sm font-medium text-primary">Contact</span>
            <h2 class="mt-3">Get in Touch</h2>
            <p class="mt-4 text-base text-text-secondary">
              Questions, feedback, or partnership inquiries? Drop us a message and
              our team will get back to you.
            </p>
          </div>

          <div class="mt-12 grid gap-8 lg:grid-cols-[3fr_5fr]">

            <div class="max-w-md">
              <h3>Send us a message</h3>
              <p class="mt-4 leading-relaxed text-text-secondary">
                Messages go directly to the admin team for review.
              </p>

              <div class="mt-6 flex flex-col gap-2 border-l-2 border-primary bg-surface p-4">
                <strong class="text-sm">Assessment Hub</strong>
                <span class="text-sm text-text-secondary">
                  A secure and organised platform for live academic assessments.
                </span>
              </div>
            </div>

            <form
              [formGroup]="contactForm"
              (ngSubmit)="onSubmit()"
              class="flex flex-col gap-4 rounded-md border border-border bg-surface p-6"
            >
              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label for="contact-name" class="mb-2 block text-sm font-medium">
                    Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    formControlName="name"
                    placeholder="Enter your name"
                    class="h-[var(--input-height)] w-full rounded-sm border border-border bg-surface px-3 text-base text-text transition-colors duration-150 placeholder:text-text-muted focus:border-border-strong disabled:bg-bg-alt disabled:text-text-muted"
                    [class.input-invalid]="isInvalid('name')"
                  />
                  @if (isInvalid('name')) {
                    <p class="mt-2 text-sm text-error">Name must be provided.</p>
                  }
                </div>

                <div>
                  <label for="contact-email" class="mb-2 block text-sm font-medium">
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    formControlName="email"
                    placeholder="Enter your email"
                    class="h-[var(--input-height)] w-full rounded-sm border border-border bg-surface px-3 text-base text-text transition-colors duration-150 placeholder:text-text-muted focus:border-border-strong disabled:bg-bg-alt disabled:text-text-muted"
                    [class.input-invalid]="isInvalid('email')"
                  />
                  @if (isInvalid('email')) {
                    <p class="mt-2 text-sm text-error">{{ emailError() }}</p>
                  }
                </div>
              </div>

              <div>
                <label for="contact-subject" class="mb-2 block text-sm font-medium">
                  Subject
                </label>
                <input
                  id="contact-subject"
                  type="text"
                  formControlName="subject"
                  placeholder="Enter the subject"
                  class="h-[var(--input-height)] w-full rounded-sm border border-border bg-surface px-3 text-base text-text transition-colors duration-150 placeholder:text-text-muted focus:border-border-strong disabled:bg-bg-alt disabled:text-text-muted"
                />
              </div>

              <div>
                <label for="contact-message" class="mb-2 block text-sm font-medium">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  formControlName="message"
                  rows="5"
                  placeholder="Write your message"
                  class="min-h-28 w-full rounded-sm border border-border bg-surface px-3 py-2 text-base text-text transition-colors duration-150 placeholder:text-text-muted focus:border-border-strong disabled:bg-bg-alt disabled:text-text-muted"
                ></textarea>
              </div>

              <div class="mt-2">
                <button
                  type="submit"
                  [disabled]="contactForm.invalid || sending"
                  class="flex h-[var(--button-height)] items-center justify-center rounded-sm bg-primary px-6 text-sm font-medium text-text-inverse transition-colors duration-150 hover:bg-primary-hover active:bg-primary-active disabled:cursor-not-allowed disabled:opacity-50"
                >
                  @if (sending) { Sending… } @else { Send Message }
                </button>
              </div>
            </form>

          </div>
        </div>
      </section>

    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* Hero clears the fixed navbar; uses theme tokens only. */
      .hero-offset {
        padding-top: calc(var(--navbar-height) + var(--space-16));
      }

      @media (max-width: 600px) {
        .hero-offset {
          padding-top: calc(var(--navbar-height) + var(--space-12));
        }
      }

      /* Error border for form controls — component-scoped so it
         reliably wins over the default border-border utility. */
      .input-invalid {
        border-color: var(--color-error);
      }
    `,
  ],
})
export class Home {
  private readonly messageService = inject(MessageService);
  private readonly toastService = inject(ToastService);

  sending = false;

  readonly features = [
    {
      icon: '🛡️',
      title: 'Anti-Cheating by Design',
      description:
        'Full-screen locked testing mode — no tab switching, no copy-paste, no right-click. Assessments stay fair and focused.',
    },
    {
      icon: '⚡',
      title: 'Real-Time Assessments',
      description:
        'Teachers control the clock: set timers, enforce time limits, or end the test anytime. Students join live, and a dropped network never costs a submission.',
    },
    {
      icon: '✍️',
      title: 'Flexible Question Types',
      description:
        'Question-answer, single or multiple-choice MCQs, and fill-in-the-blanks — with image support for richer, more engaging questions.',
    },
    {
      icon: '🚀',
      title: 'Join in Seconds',
      description:
        'No sign-up required. One test code, a roll number, and a name — that is all it takes to enter an assessment.',
    },
    {
      icon: '📊',
      title: 'Complete Evaluation Workflow',
      description:
        'Submissions are grouped per test and ready for review. Evaluate the entire class or drill down to a single student.',
    },
    {
      icon: '👨‍🏫',
      title: 'Verified Teachers',
      description:
        'Every teacher profile is reviewed and approved by an administrator, keeping the platform authentic and trusted.',
    },
  ];

  contactForm = new FormGroup({
    name: new FormControl('', { validators: [Validators.required], nonNullable: true }),
    email: new FormControl('', {
      validators: [Validators.required, Validators.email],
      nonNullable: true,
    }),
    subject: new FormControl('', { nonNullable: true }),
    message: new FormControl('', { nonNullable: true }),
  });

  isInvalid(name: 'name' | 'email'): boolean {
    const control = this.contactForm.controls[name];
    return control.touched && control.invalid;
  }

  emailError(): string {
    const control = this.contactForm.controls.email;
    return control.hasError('required') ? 'Email must be provided.' : 'Invalid email format.';
  }

  onSubmit(): void {
    if (this.contactForm.invalid || this.sending) {
      this.toastService.show('Please fill all the required fields correctly.', 'error');
      return;
    }

    this.sending = true;
    const formData = this.contactForm.getRawValue();

    this.messageService.sendMessage(formData).subscribe({
      next: () => {
        this.sending = false;
        this.toastService.show('Thank you for reaching out to us!', 'success');
        this.contactForm.reset();
      },
      error: () => {
        this.sending = false;
        this.toastService.show('Failed to send message. Please try again later!', 'error');
      },
    });
  }
}
