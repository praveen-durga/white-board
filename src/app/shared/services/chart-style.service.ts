import { Injectable, inject, signal } from '@angular/core';
import { ChartStyle } from '../models';
import { STORE_KEYS } from './store.keys';
import { StoreService } from './store.service';

@Injectable({ providedIn: 'root' })
export class ChartStyleService {
  private storage = inject(StoreService);

  #style = signal<ChartStyle>('north');
  style = this.#style.asReadonly();

  constructor() {
    const stored = this.storage.get<ChartStyle>(STORE_KEYS.CHART_STYLE);
    if (stored) {
      this.#style.set(stored);
    }

    this.storage.persistOnUnload<ChartStyle>(STORE_KEYS.CHART_STYLE, () => this.#style());
  }

  setStyle(style: ChartStyle): void {
    this.#style.set(style);
  }
}
