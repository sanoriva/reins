import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE } from '../../../core/api.config';
import type { AppointmentDto, SlotDto, SpecialtyDto } from './appointment.dto';
import { toAppointment, toSlot, toSpecialty } from './appointment.mapper';
import type { Appointment, Slot, Specialty } from './appointment.model';
import { AppointmentPort } from './appointment.port';

@Injectable()
export class AppointmentHttpAdapter extends AppointmentPort {
  private readonly http = inject(HttpClient);

  async specialties(): Promise<Specialty[]> {
    return (await firstValueFrom(this.http.get<SpecialtyDto[]>(`${API_BASE}/specialties`))).map(toSpecialty);
  }

  async freeSlots(specialty: string): Promise<Slot[]> {
    return (await firstValueFrom(this.http.get<SlotDto[]>(`${API_BASE}/slots`, { params: { specialty } }))).map(toSlot);
  }

  async mine(): Promise<Appointment[]> {
    return (await firstValueFrom(this.http.get<AppointmentDto[]>(`${API_BASE}/appointments`))).map(toAppointment);
  }

  async book(slotId: string, reason: string): Promise<Appointment> {
    return toAppointment(await firstValueFrom(this.http.post<AppointmentDto>(`${API_BASE}/appointments`, { slotId, reason })));
  }

  async cancel(appointmentId: string): Promise<Appointment> {
    return toAppointment(await firstValueFrom(this.http.delete<AppointmentDto>(`${API_BASE}/appointments/${encodeURIComponent(appointmentId)}`)));
  }
}
