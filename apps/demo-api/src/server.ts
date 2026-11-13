import express from 'express';

import { fakeLogin, logout, patientOf, requirePatient, tokenOf } from './auth.js';
import type { Patient } from './data/seed.js';
import { store } from './store.js';

const port = Number(process.env.PORT ?? 3000);
const app = express();
app.use(express.json());

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const me = (res: express.Response) => res.locals['patient'] as Patient;
const param = (req: express.Request, name: string) => String(req.params[name]);

app.get('/api/centers', (req, res) => void res.json(store.centers(text(req.query['q']) || undefined)));
app.get('/api/specialties', (_req, res) => void res.json(store.specialties()));

app.get('/api/patients', (_req, res) => void res.json(store.patients()));
app.post('/api/auth/fake-login', (req, res) => {
  const token = fakeLogin(text(req.body?.patientId));
  if (!token) res.status(400).json({ error: 'No existe esa paciente' });
  else res.json({ token, patient: store.me(text(req.body?.patientId)) });
});
app.post('/api/auth/logout', (req, res) => {
  logout(tokenOf(req));
  res.status(204).end();
});
app.get('/api/me', (req, res) => {
  const patient = patientOf(req);
  if (!patient) res.status(401).json({ error: 'Not signed in' });
  else res.json(store.me(patient.id));
});

app.get('/api/notices', requirePatient, (_req, res) => void res.json(store.notices()));
app.get('/api/slots', requirePatient, (req, res) => void res.json(store.slots(text(req.query['specialty']))));
app.get('/api/appointments', requirePatient, (_req, res) => void res.json(store.appointments(me(res).id)));
app.post('/api/appointments', requirePatient, (req, res) => {
  const booked = store.book(me(res).id, text(req.body?.slotId), text(req.body?.reason));
  if (!booked) res.status(409).json({ error: 'That slot is no longer free' });
  else res.status(201).json(booked);
});
app.delete('/api/appointments/:id', requirePatient, (req, res) => {
  const cancelled = store.cancel(me(res).id, param(req, 'id'));
  if (!cancelled) res.status(404).json({ error: 'No such appointment to cancel' });
  else res.json(cancelled);
});
app.get('/api/reports', requirePatient, (_req, res) => void res.json(store.reports(me(res).id)));
app.get('/api/reports/:id', requirePatient, (req, res) => {
  const report = store.report(me(res).id, param(req, 'id'));
  if (!report) res.status(404).json({ error: 'No existe ese informe' });
  else res.json(report);
});
app.get('/api/prescriptions', requirePatient, (_req, res) => void res.json(store.prescriptions(me(res).id)));
app.post('/api/prescriptions/:id/renewal', requirePatient, (req, res) => {
  const renewed = store.requestRenewal(me(res).id, param(req, 'id'));
  if (!renewed) res.status(404).json({ error: 'No existe esa receta' });
  else res.json(renewed);
});
app.get('/api/history', requirePatient, (_req, res) => void res.json(store.history(me(res).id)));

app.listen(port, () => {
  console.log(`Vitalia backend on http://localhost:${port}`);
});
