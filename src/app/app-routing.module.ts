import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SiteslayoutComponent } from './components/siteslayout/siteslayout.component';
import { SiteLayoutComponent } from './components/sitelayout/sitelayout.component';
import { DatasetLayoutComponent } from './components/dataset-layout/dataset-layout.component';
import { LoginLayoutComponent } from './components/login-layout/login-layout.component';
import { SignUpLayoutComponent } from './components/signup-layout/signup-layout.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'sites',
    pathMatch: 'full',
  },
  {
    path: 'sites',
    component: SiteslayoutComponent,
    data: { title: 'Sites' },
  },
  {
    path: 'sites/:id',
    component: SiteLayoutComponent,
    data: { title: 'Site' },
  },
  {
    path: 'sites/:site_id/datasets/:dataset_id',
    component: DatasetLayoutComponent,
    data: { title: 'Dataset' },
  },
  {
    path: 'sign-in',
    component: LoginLayoutComponent,
    data: { title: 'Login' },
  },
  {
    path: 'sign-up',
    component: SignUpLayoutComponent,
    data: { title: 'Sign Up' },
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
