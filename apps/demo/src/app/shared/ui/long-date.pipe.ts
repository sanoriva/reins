import { Pipe, type PipeTransform } from '@angular/core';

const formats = {
  day: new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }),
  date: new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
  month: new Intl.DateTimeFormat('es-ES', { month: 'short' }),
  time: new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }),
};

/** Dates as they are said: «martes, 14 de noviembre», «14 de noviembre de 2026», «10:30». */
@Pipe({ name: 'longDate' })
export class LongDatePipe implements PipeTransform {
  transform(value: Date | null | undefined, format: keyof typeof formats | 'full' = 'day'): string {
    if (!value) return '';
    if (format === 'full') return `${formats.day.format(value)} · ${formats.time.format(value)}`;
    return formats[format].format(value);
  }
}
