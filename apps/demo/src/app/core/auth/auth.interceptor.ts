import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { SessionStore } from './data-access/session.store';

/** Sends the session token with every backend request. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(SessionStore).token();
  return next(token ? req.clone({ setHeaders: { authorization: `Bearer ${token}` } }) : req);
};
