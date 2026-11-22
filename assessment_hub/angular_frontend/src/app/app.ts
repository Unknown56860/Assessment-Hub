import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';

import { Navbar } from './core/layout/navbar';
import { Footer } from './core/layout/footer';
import { Toast } from './core/layout/toast';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer, Toast],
  template: `
    <app-navbar />
    <div class="min-h-[calc(100dvh_-_var(--navbar-height))]">
      <router-outlet />
    </div>
    <app-footer />
    <app-toast />
  `
})
export class App {
  private readonly router = inject(Router);

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((e) => {
      if (e instanceof NavigationEnd) {
        let route = this.router.routerState.snapshot.root;
        while (route.firstChild) route = route.firstChild;
        document.body.classList.toggle('test-mode', route.data?.['testMode'] === true);
      }
    });
  }
}