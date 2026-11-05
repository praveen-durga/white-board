import { ChangeDetectionStrategy, Component, computed, effect, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BirthDetails } from '../../../shared/models';
import { Ayanamsa } from '../../../shared/services';
import { InputComponent, SelectComponent, SelectOption } from '../../../shared/ui/atoms';
import { CITY_LABELS, findCityByLabel, TIME_ZONES } from '../../../shared/utils';

const AYANAMSA_OPTIONS: SelectOption[] = [
  { value: 'lahiri', label: 'Lahiri' },
  { value: 'raman', label: 'B.V. Raman' },
  { value: 'kp', label: 'KP (Krishnamurti)' },
  { value: 'yukteshwar', label: 'Sri Yukteshwar' },
  { value: 'fagan-bradley', label: 'Fagan–Bradley' },
];

const TIMEZONE_OPTIONS: SelectOption[] = TIME_ZONES.map((timezone) => ({ label: timezone, value: timezone }));

@Component({
  selector: 'app-birth-details-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, SelectComponent],
  templateUrl: './birth-details-form.component.html',
  styleUrl: './birth-details-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BirthDetailsFormComponent {
  formId = input('birth-details-form');
  initialDetails = input<BirthDetails | null>(null);
  submitted = output<BirthDetails>();

  protected form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: Validators.required }),
    dob: new FormControl('', { nonNullable: true, validators: Validators.required }),
    tob: new FormControl('', { nonNullable: true, validators: Validators.required }),
    cityLabel: new FormControl('', { nonNullable: true, validators: Validators.required }),
    timezone: new FormControl('', { nonNullable: true, validators: Validators.required }),
    lat: new FormControl('', { nonNullable: true, validators: Validators.required }),
    lng: new FormControl('', { nonNullable: true, validators: Validators.required }),
    ayanamsa: new FormControl<Ayanamsa>('lahiri', { nonNullable: true }),
  });

  protected cityOptionsId = computed(() => `${this.formId()}-city-options`);
  protected cityOptions = CITY_LABELS;
  protected timezoneOptions = TIMEZONE_OPTIONS;
  protected ayanamsaOptions = AYANAMSA_OPTIONS;

  private nameEvents = toSignal(this.form.controls.name.events);
  private dobEvents = toSignal(this.form.controls.dob.events);
  private tobEvents = toSignal(this.form.controls.tob.events);
  private cityLabelEvents = toSignal(this.form.controls.cityLabel.events);
  private timezoneEvents = toSignal(this.form.controls.timezone.events);
  private latEvents = toSignal(this.form.controls.lat.events);
  private lngEvents = toSignal(this.form.controls.lng.events);

  protected nameError = computed(() => {
    this.nameEvents();
    const control = this.form.controls.name;
    return control.touched && control.hasError('required') ? 'Name is required' : undefined;
  });

  protected dobError = computed(() => {
    this.dobEvents();
    const control = this.form.controls.dob;
    return control.touched && control.hasError('required') ? 'Date of birth is required' : undefined;
  });

  protected tobError = computed(() => {
    this.tobEvents();
    const control = this.form.controls.tob;
    return control.touched && control.hasError('required') ? 'Time of birth is required' : undefined;
  });

  protected cityLabelError = computed(() => {
    this.cityLabelEvents();
    const control = this.form.controls.cityLabel;
    return control.touched && control.hasError('required') ? 'Place of birth is required' : undefined;
  });

  protected timezoneError = computed(() => {
    this.timezoneEvents();
    const control = this.form.controls.timezone;
    return control.touched && control.hasError('required') ? 'Timezone is required' : undefined;
  });

  protected latError = computed(() => {
    this.latEvents();
    const control = this.form.controls.lat;
    return control.touched && control.hasError('required') ? 'Latitude is required' : undefined;
  });

  protected lngError = computed(() => {
    this.lngEvents();
    const control = this.form.controls.lng;
    return control.touched && control.hasError('required') ? 'Longitude is required' : undefined;
  });

  constructor() {
    effect(() => {
      const details = this.initialDetails();
      if (!details) {
        return;
      }

      this.form.setValue({ ...details, lat: String(details.lat), lng: String(details.lng) });
    });
  }

  readValidDetails(): BirthDetails | null {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return null;
    }

    const { name, dob, tob, cityLabel, timezone, lat, lng, ayanamsa } = this.form.getRawValue();

    return {
      name,
      dob,
      tob,
      cityLabel,
      lat: Number(lat),
      lng: Number(lng),
      timezone,
      ayanamsa,
    };
  }

  protected onCityLabelSelect(event: Event): void {
    const inputVal = (event.target as HTMLInputElement).value;
    const city = findCityByLabel(inputVal);

    if (city) {
      this.form.patchValue({
        timezone: city.timezone,
        lat: String(city.lat),
        lng: String(city.lng),
      });
    }
  }

  protected onSubmit(): void {
    const details = this.readValidDetails();
    if (details) {
      this.submitted.emit(details);
    }
  }
}
