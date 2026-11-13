import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE } from '../../../core/api.config';
import type { PrescriptionDto } from './prescription.dto';
import { toPrescription } from './prescription.mapper';
import type { Prescription } from './prescription.model';
import { PrescriptionPort } from './prescription.port';

@Injectable()
export class PrescriptionHttpAdapter extends PrescriptionPort {
  private readonly http = inject(HttpClient);

  async mine(): Promise<Prescription[]> {
    return (await firstValueFrom(this.http.get<PrescriptionDto[]>(`${API_BASE}/prescriptions`))).map(toPrescription);
  }

  async requestRenewal(prescriptionId: string): Promise<Prescription> {
    return toPrescription(await firstValueFrom(this.http.post<PrescriptionDto>(`${API_BASE}/prescriptions/${encodeURIComponent(prescriptionId)}/renewal`, {})));
  }
}
