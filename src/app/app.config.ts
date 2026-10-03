import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { ToastErrorHandler, httpErrorInterceptor } from './core/error-reporting';
import { ThemeService } from './core/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([httpErrorInterceptor])),
    { provide: ErrorHandler, useClass: ToastErrorHandler },
    // Hold the first render until the theme is known, so it never flashes a stale one.
    provideAppInitializer(() => inject(ThemeService).ready()),
  ],
};
