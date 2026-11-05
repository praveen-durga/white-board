import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StoreService {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return null;
      }
      localStorage.removeItem(key);
      return JSON.parse(raw) as T;
    } catch (error) {
      console.error(`StoreService.get failed for key "${key}"`, error);
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`StoreService.set failed for key "${key}"`, error);
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`StoreService.remove failed for key "${key}"`, error);
    }
  }

  persistOnUnload<T>(key: string, getValue: () => T | null): void {
    window.addEventListener('pagehide', () => {
      const value = getValue();
      if (value !== null) {
        this.set(key, value);
      }
    });
  }
}
