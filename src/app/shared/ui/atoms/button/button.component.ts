import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ButtonColor, ButtonSize, ButtonVariant } from './button.model';

const variantClassMap: Record<ButtonVariant, string> = {
  primary: 'primary',
  'primary-outline': 'primaryOutline',
  'primary-inverted-outline': 'primaryInvertedOutline',
  danger: 'danger',
  'danger-outline': 'dangerOutline',
  ghost: 'ghost',
};

@Component({
  selector: 'app-button',
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonComponent {
  size = input<ButtonSize>('md');
  variant = input<ButtonVariant>('primary');
  color = input<ButtonColor>('blue');
  type = input<'button' | 'submit' | 'reset'>('button');
  disabled = input(false);
  form = input<string>();
  buttonClass = input<string>();

  protected classes = computed(() => {
    return ['button', this.size(), variantClassMap[this.variant()], this.color(), this.buttonClass()]
      .filter(Boolean)
      .join(' ');
  });
}
