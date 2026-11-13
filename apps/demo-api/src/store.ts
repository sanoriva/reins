import {
  type Appointment,
  CENTERS,
  DOCTORS,
  generateAppointments,
  generatePrescriptions,
  generateReports,
  generateSlots,
  HISTORY,
  NOTICES,
  PATIENTS,
  SPECIALTIES,
} from './data/seed.js';

/** Vitalia's data, in memory. Restarting the backend resets it to the seed. */
const slots = generateSlots();
const appointments = generateAppointments();
const reports = generateReports();
const prescriptions = generatePrescriptions();

const doctor = (id: string) => DOCTORS.find((d) => d.id === id);
const specialtyName = (slug: string) => SPECIALTIES.find((s) => s.slug === slug)?.name ?? slug;
const centerName = (id: string) => CENTERS.find((c) => c.id === id)?.name ?? id;
const plain = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** An appointment with its doctor, specialty and centre resolved. */
const withDoctor = (a: Appointment) => {
  const d = doctor(a.doctorId)!;
  return { ...a, doctor: d.name, specialty: specialtyName(d.specialty), center: centerName(d.centerId) };
};

export const store = {
  patient: (id: string) => PATIENTS.find((p) => p.id === id),
  patients: () => PATIENTS.map(({ id, name, birthYear }) => ({ id, name, birthYear })),
  me(id: string) {
    const patient = PATIENTS.find((p) => p.id === id)!;
    return { ...patient, center: centerName(patient.centerId), doctor: doctor(patient.doctorId)?.name ?? '' };
  },

  /** Centres whose name, town or services contain the query (ignoring accents and case). */
  centers(q?: string) {
    const word = q ? plain(q) : '';
    return CENTERS.filter((c) => !word || plain(`${c.name} ${c.town} ${c.services.join(' ')}`).includes(word));
  },

  specialties: () => SPECIALTIES,

  /** Free slots of a specialty, by date. */
  slots(specialty: string) {
    return slots
      .filter((s) => doctor(s.doctorId)?.specialty === specialty)
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((s) => {
        const d = doctor(s.doctorId)!;
        return { ...s, doctor: d.name, center: centerName(d.centerId) };
      });
  },

  appointments: (patientId: string) => appointments.filter((a) => a.patientId === patientId).map(withDoctor),

  /** Books a free slot, which stops being free. */
  book(patientId: string, slotId: string, reason: string) {
    const index = slots.findIndex((s) => s.id === slotId);
    if (index < 0) return undefined;
    const [slot] = slots.splice(index, 1);
    const appointment: Appointment = { id: `c-${Date.now() % 100000}`, patientId, doctorId: slot!.doctorId, start: slot!.start, reason, status: 'confirmada' };
    appointments.push(appointment);
    return withDoctor(appointment);
  },

  /** Cancels a future appointment; its slot becomes free again. */
  cancel(patientId: string, id: string) {
    const appointment = appointments.find((a) => a.id === id && a.patientId === patientId && a.status === 'confirmada');
    if (!appointment) return undefined;
    appointment.status = 'anulada';
    slots.push({ id: `${appointment.doctorId}-${appointment.start.replace(/[-:T]/g, '')}`, doctorId: appointment.doctorId, start: appointment.start });
    return withDoctor(appointment);
  },

  reports: (patientId: string) =>
    reports
      .filter((r) => r.patientId === patientId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(({ html: _, glossary: __, previous: ___, ...r }) => ({ ...r, doctor: doctor(r.doctorId)?.name ?? '' })),

  report(patientId: string, id: string) {
    const report = reports.find((r) => r.id === id && r.patientId === patientId);
    return report && { ...report, doctor: doctor(report.doctorId)?.name ?? '' };
  },

  prescriptions: (patientId: string) => prescriptions.filter((p) => p.patientId === patientId),

  requestRenewal(patientId: string, id: string) {
    const prescription = prescriptions.find((p) => p.id === id && p.patientId === patientId);
    if (!prescription) return undefined;
    prescription.renewalRequested = true;
    return prescription;
  },

  notices: () => NOTICES,
  history: (patientId: string) => HISTORY[patientId] ?? [],
};
