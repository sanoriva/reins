import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { SessionStore } from './core/auth';
import { AgentIndicatorComponent, AgentShellComponent } from './transversal/agent';
import { HelpComponent } from './transversal/help';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const PUBLIC: NavItem[] = [
  { path: '/', label: 'Inicio', icon: 'home' },
  { path: '/centros', label: 'Centros de salud', icon: 'location_on' },
];
const PRIVATE: NavItem[] = [
  { path: '/', label: 'Inicio', icon: 'home' },
  { path: '/asistente', label: 'Asistente', icon: 'auto_awesome' },
  { path: '/citas/nueva', label: 'Pedir cita', icon: 'add_circle' },
  { path: '/citas', label: 'Mis citas', icon: 'event' },
  { path: '/informes', label: 'Mis informes', icon: 'description' },
  { path: '/medicacion', label: 'Medicación', icon: 'medication' },
  { path: '/historial', label: 'Historial clínico', icon: 'history' },
  { path: '/centros', label: 'Centros de salud', icon: 'location_on' },
];

/** The Vitalia shell: top bar, menu, screen, the code dialogs and the help button. */
@Component({
  selector: 'app-root',
  imports: [MatButtonModule, MatIconModule, RouterLink, RouterLinkActive, RouterOutlet, AgentIndicatorComponent, AgentShellComponent, HelpComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  protected readonly nav = computed(() => (this.session.signedIn() ? PRIVATE : PUBLIC));
  /** The assistant page has no menu: the page is only what the assistant shows. */
  protected readonly assistantMode = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url.startsWith('/asistente')),
    ),
    { initialValue: this.router.url.startsWith('/asistente') },
  );

  protected async signOut(): Promise<void> {
    await this.session.signOut();
    await this.router.navigateByUrl('/');
  }
}
