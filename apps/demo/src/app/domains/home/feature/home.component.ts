import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AgentService } from '@reins-ai/angular';

import { SessionStore } from '../../../core/auth';
import { AppointmentStore } from '../../appointments';
import { PrescriptionStore, ScheduleTodayComponent } from '../../medication';
import { NoticeStore } from '../data-access/notice.store';
import { NextAppointmentComponent } from '../ui/next-appointment.component';
import { NoticeListComponent } from '../ui/notice-list.component';
import { type QuickLink, QuickLinksComponent } from '../ui/quick-links.component';
import { WelcomeComponent } from '../ui/welcome.component';

const LINKS: QuickLink[] = [
  { id: '/citas/nueva', label: 'Pedir cita', hint: 'Con tu médico o con un especialista', icon: 'event' },
  { id: '/informes', label: 'Mis informes', hint: 'Consultas, análisis y urgencias', icon: 'description' },
  { id: '/medicacion', label: 'Medicación', hint: 'Qué tomar hoy y renovar recetas', icon: 'medication' },
  { id: '/centros', label: 'Centros de salud', hint: 'Direcciones y horarios', icon: 'location_on' },
];

/**
 * Home. Without a session, what Vitalia is; with one, the patient's day: next appointment, notices and
 * medication due.
 */
@Component({
  selector: 'vt-home',
  imports: [WelcomeComponent, NextAppointmentComponent, NoticeListComponent, QuickLinksComponent, ScheduleTodayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  protected readonly session = inject(SessionStore);
  protected readonly appointments = inject(AppointmentStore);
  protected readonly medication = inject(PrescriptionStore);
  protected readonly notices = inject(NoticeStore);
  private readonly router = inject(Router);
  protected readonly links = LINKS;

  constructor() {
    effect(() => {
      if (!this.session.signedIn()) return;
      void this.appointments.load();
      void this.medication.load();
      void this.notices.load();
    });

    const remove = inject(AgentService).agent.provideContent('summary', () => ({
      data: this.session.signedIn()
        ? {
            patient: this.session.patient()?.firstName,
            nextAppointment: this.appointments.next()?.label ?? null,
            today: this.medication.today(),
            notices: this.notices.notices().map(({ title, body }) => ({ title, body })),
          }
        : { signedIn: false, message: 'La paciente aún no ha entrado. Solo ella puede entrar, con el botón Entrar.' },
    }));
    inject(DestroyRef).onDestroy(remove);
  }

  protected go(url: string): void {
    void this.router.navigateByUrl(url);
  }
}
