import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { store } from './store.js';

/**
 * Fake session: signing in means picking one of the demo patients, with no password or certificate. It
 * returns a token the front end sends with every request (Authorization: Bearer …).
 */
const sessions = new Map<string, string>();

export function fakeLogin(patientId: string): string | undefined {
  if (!store.patient(patientId)) return undefined;
  const token = randomUUID();
  sessions.set(token, patientId);
  return token;
}

export function logout(token: string | undefined): void {
  if (token) sessions.delete(token);
}

export function tokenOf(req: Request): string | undefined {
  return req.header('authorization')?.replace(/^Bearer /, '') || undefined;
}

/** The patient of the request, if it carries a valid token. */
export function patientOf(req: Request) {
  const token = tokenOf(req);
  const id = token && sessions.get(token);
  return id ? store.patient(id) : undefined;
}

/** Answers 401 without a session; otherwise stores the patient in res.locals.patient. */
export function requirePatient(req: Request, res: Response, next: NextFunction): void {
  const patient = patientOf(req);
  if (!patient) {
    res.status(401).json({ error: 'Sign in to Vitalia first' });
    return;
  }
  res.locals['patient'] = patient;
  next();
}
