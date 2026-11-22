import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthStore } from '../auth/auth.store';
import { nameInitial } from '../../shared/utils/name.utils';
import { trackPicFailures } from '../../features/profile/profile.utils';

type NavbarRole = 'guest' | 'admin' | 'teacher';

interface NavItem {
  label: string;
  link: string;
  fragment?: string;
}

const NAV_LINKS: Record<NavbarRole, NavItem[]> = {
  guest: [
    { label: 'Features', link: '/', fragment: 'features' },
    { label: 'About', link: '/', fragment: 'about' },
    { label: 'Contact', link: '/', fragment: 'contact' },
  ],
  admin: [
    { label: 'Messages', link: '/admin/messages' },
    { label: 'Users', link: '/admin/users' },
    { label: 'Dashboard', link: '/admin/dashboard' },
  ],
  teacher: [
    { label: 'Question Sets', link: '/question-sets' },
    { label: 'Assessments', link: '/assessments' },
    { label: 'Host/Live', link: '/assessment/host' },
  ],
};

const SCROLL_THRESHOLD_PX = 8;
const TOP_OFFSET_PX = 64; // = --navbar-height

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:scroll)': 'onWindowScroll()',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeProfileMenu()',
  },
  template: `
    <header
      class="sticky top-0 z-[1000] h-16 border-b border-border bg-bg transition-transform duration-200"
      [class]="isHidden() ? '-translate-y-full' : 'translate-y-0'"
    >
      <div class="page-container grid h-full grid-cols-[1fr_auto_1fr] items-center gap-6">
        <!-- Brand -->
        <a
          routerLink="/"
          aria-label="Assessment Hub home"
          class="col-start-1 inline-flex w-fit items-center gap-2 text-xl font-semibold text-text no-underline hover:text-primary hover:no-underline"
        >
          <img
            src="GIETU_logo.png"
            alt=""
            aria-hidden="true"
            class="h-8 w-8 shrink-0 rounded-sm object-cover"
            width="32"
            height="32"
          />

          <span class="whitespace-nowrap max-sm:text-base">Assessment Hub</span>
        </a>

        <!-- Primary navigation (dynamic by role) -->
        <nav class="hidden h-full items-center justify-center gap-6 md:flex" aria-label="Primary navigation">
          @for (item of navLinks(); track item.label) {
            <a
              [routerLink]="item.link"
              [fragment]="item.fragment"
              class="flex h-full items-center text-sm font-medium text-text-secondary no-underline hover:text-primary hover:no-underline"
            >
              {{ item.label }}
            </a>
          }
        </nav>

        <!-- Authentication / profile area -->
        <div class="col-start-3 flex items-center justify-end gap-2">
          @if (role() === 'guest') {
            <a
              routerLink="/login"
              class="inline-flex h-9 items-center rounded-sm border border-border bg-surface px-3 text-sm font-medium text-text no-underline hover:border-border-strong hover:bg-bg-alt hover:no-underline"
            >
              Login
            </a>
            <a
              routerLink="/register"
              class="inline-flex h-9 items-center rounded-sm bg-primary px-3 text-sm font-medium text-text-inverse no-underline hover:bg-primary-hover active:bg-primary-active hover:no-underline"
            >
              Register
            </a>
          } @else {
            <!-- Profile dropdown -->
            <div class="relative" data-profile-menu>
              <button
                type="button"
                class="flex h-9 items-center gap-2 rounded-sm py-0.5 pl-0.5 pr-2 text-sm font-medium text-text transition-colors hover:bg-hover"
                (click)="toggleProfileMenu()"
                [attr.aria-expanded]="isProfileMenuOpen()"
                aria-haspopup="menu"
              >
                <!-- Served by GET /profile/pfp (session-cookie auth); on load failure, fall back to the initial -->
                @if (pic.src(); as src) {
                  <img
                    [src]="src"
                    alt=""
                    class="h-8 w-8 shrink-0 rounded-full object-cover"
                    width="32"
                    height="32"
                    (error)="pic.onError()"
                  />
                } @else {
                  <span
                    aria-hidden="true"
                    class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-text-inverse"
                  >
                    {{ initial() }}
                  </span>
                }
                <span class="max-w-40 truncate max-sm:hidden">{{ userName() }}</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  class="h-4 w-4 shrink-0 text-text-secondary transition-transform duration-200"
                  [class.rotate-180]="isProfileMenuOpen()"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="m5 7.5 5 5 5-5" />
                </svg>
              </button>

              @if (isProfileMenuOpen()) {
                <div
                  role="menu"
                  aria-label="Account"
                  class="absolute top-full right-0 z-10 mt-2 w-48 animate-menu-in rounded-sm border border-border bg-surface py-1 shadow-lg"
                >
                  <a
                    role="menuitem"
                    routerLink="/profile"
                    (click)="closeProfileMenu()"
                    class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text no-underline hover:bg-hover hover:text-text hover:no-underline"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      class="h-4 w-4 shrink-0 text-text-secondary"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Profile
                  </a>
                  <div role="separator" class="my-1 h-px bg-border"></div>
                  <button
                    role="menuitem"
                    type="button"
                    (click)="logout()"
                    [disabled]="isLoggingOut()"
                    class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      class="h-4 w-4 shrink-0 text-text-secondary"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="m16 17 5-5-5-5" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M21 12H9" />
                    </svg>
                    {{ isLoggingOut() ? 'Signing out…' : 'Logout' }}
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </header>
  `,
})
export class Navbar {
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly pic = trackPicFailures(() => this.store.profilePicUrl());
  
  protected readonly initial = computed(() => nameInitial(this.userName()));

  protected readonly userName = computed(() => this.store.currentUser()?.name ?? '');
  protected readonly isLoggingOut = signal(false);
  protected readonly isProfileMenuOpen = signal(false);

  protected readonly role = computed<NavbarRole>(() => {
    switch (this.store.role()) {
      case 'ADMIN':
        return 'admin';
      case 'TEACHER':
        return 'teacher';
      default:
        return 'guest';
    }
  });

  protected readonly navLinks = computed(() => NAV_LINKS[this.role()]);

  protected toggleProfileMenu(): void {
    this.isProfileMenuOpen.update((open) => !open);
  }

  protected closeProfileMenu(): void {
    this.isProfileMenuOpen.set(false);
  }

  protected logout(): void {
    this.isLoggingOut.set(true);
    this.store.logout().subscribe({
      next: () => {
        this.isLoggingOut.set(false);
        void this.router.navigateByUrl('/');
      },
      error: () => this.isLoggingOut.set(false),
    });
  }

  private lastScrollY: number | null = null;

  protected onWindowScroll(): void {
    if (this.isProfileMenuOpen()) {
      this.closeProfileMenu();
    }

    const y = Math.max(0, window.scrollY);

    if (this.lastScrollY === null) {
      this.lastScrollY = y;
      return;
    }

    const delta = y - this.lastScrollY;
    this.lastScrollY = y;

    if (y <= TOP_OFFSET_PX) {
      this.isHidden.set(false);
    } else if (delta >= SCROLL_THRESHOLD_PX) {
      this.isHidden.set(true);
    } else if (delta <= -SCROLL_THRESHOLD_PX) {
      this.isHidden.set(false);
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.isProfileMenuOpen()) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-profile-menu]')) {
      return; // click on the trigger or inside the menu — let it be
    }
    this.closeProfileMenu();
  }

  protected readonly isHidden = signal(false);
}
