import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

/** Searches by town, name or service. */
@Component({
  selector: 'vt-center-search',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './center-search.component.html',
  styleUrl: './center-search.component.scss',
})
export class CenterSearchComponent {
  readonly query = input('');
  readonly searched = output<string>();
  protected text = '';

  ngOnChanges(): void {
    this.text = this.query();
  }
}
