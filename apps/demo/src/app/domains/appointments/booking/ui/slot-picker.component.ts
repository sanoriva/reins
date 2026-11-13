import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { EmptyStateComponent } from '../../../../shared/ui/empty-state.component';
import { LongDatePipe } from '../../../../shared/ui/long-date.pipe';

export interface SlotOption {
  id: string;
  start: Date;
  doctor: string;
  label: string;
}

/** Free slots by day. The box scrolls on its own and is marked so the AI can scroll it. */
@Component({
  selector: 'vt-slot-picker',
  imports: [LongDatePipe, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './slot-picker.component.html',
  styleUrl: './slot-picker.component.scss',
})
export class SlotPickerComponent {
  readonly slots = input.required<SlotOption[]>();
  readonly selected = input<string | null>(null);
  readonly picked = output<string>();

  protected readonly days = computed(() => {
    const groups = new Map<string, { key: string; date: Date; slots: SlotOption[] }>();
    for (const slot of this.slots()) {
      const key = slot.start.toDateString();
      if (!groups.has(key)) groups.set(key, { key, date: slot.start, slots: [] });
      groups.get(key)!.slots.push(slot);
    }
    return [...groups.values()];
  });
}
