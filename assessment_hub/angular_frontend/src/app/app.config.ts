import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors} from '@angular/common/http';
import { xsrfInterceptor } from './core/services/xsrf.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes, 
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled'
      })
    ),
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([xsrfInterceptor])),
  ]
};
