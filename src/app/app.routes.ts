import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/pg/pg.component').then((m) => m.PgComponent) },
  { path: '**', redirectTo: '' },
];
