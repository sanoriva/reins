import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';

import { SessionStore } from './data-access/session.store';

/**
 * Screens that need a session. If the AI tries to open one without a session, navigate answers NOT_AVAILABLE.
 */
export const authGuard: CanActivateFn = () => inject(SessionStore).signedIn();
