import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { SidebarModule } from 'ng-sidebar';

import { AppRoutingModule } from './app-routing.module';

import { AppComponent } from './app.component';
import { GraphQLModule } from './graphql/graphql.module';

// import { InMemoryDataService } from './mocks/inMemoryData.service';
import { HttpClientInMemoryWebApiModule } from 'angular-in-memory-web-api';

import { StoreModule, ActionReducer, MetaReducer } from '@ngrx/store';
import { localStorageSync } from 'ngrx-store-localstorage';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { EffectsModule } from '@ngrx/effects';
import { reducers } from './reducers/index';
import { Effects } from './effects/effects';

import { SiteslayoutComponent } from './components/siteslayout/siteslayout.component';
import { SitedetailsComponent } from './components/sitedetails/sitedetails.component';
import { SitemapComponent } from './components/sitemap/sitemap.component';
import { SiteLayoutComponent } from './components/sitelayout/sitelayout.component';
import { DatasetDetailsComponent } from './components/dataset-details/dataset-details.component';
import { DatasetLayoutComponent } from './components/dataset-layout/dataset-layout.component';
import { Map3dComponent } from './components/map-3d/map-3d.component';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';

import { LoginLayoutComponent } from './users/containers/login-layout/login-layout.component';
import { SignUpLayoutComponent } from './users/containers/signup-layout/signup-layout.component';

import { AuthGuard } from './users/auth-guard.service';
import { SitesEffects } from './sites/effects/sites.effects';
import { SitesService } from './sites/sites.service';
import { UsersService } from './users/users.service';
import { DatasetsService } from './datasets/datasets.service';
import { TerrainProviderService } from './services/terrainprovider/terrain-provider.service';
import { Map3dService } from './services/map-3d.service';
import { UsersState } from './users/state';
import { User } from './models/user.model';
import { SiteDropdownComponent } from './components/site-dropdown/site-dropdown.component';
import { SubHeaderComponent } from './components/sub-header/sub-header.component';

export const localStorageSyncReducer = (reducer: ActionReducer<any>): ActionReducer<any> =>
  localStorageSync({
    keys: [{ users: {
      serialize: state => {
        return {currentUser: state.currentUser && state.currentUser.getProperties(), loggedIn: state.loggedIn}
      },
      deserialize: (update) => new UsersState({currentUser: new User(update.currentUser) || null, loggedIn: update.loggedIn})} }],
    rehydrate: true,
  })(reducer);
const metaReducers: Array<MetaReducer<any, any>> = [localStorageSyncReducer];

@NgModule({
  declarations: [
    AppComponent,
    SiteslayoutComponent,
    SitedetailsComponent,
    SitemapComponent,
    SiteLayoutComponent,
    DatasetDetailsComponent,
    DatasetLayoutComponent,
    Map3dComponent,
    HeaderComponent,
    FooterComponent,
    LoginLayoutComponent,
    SignUpLayoutComponent,
    SiteDropdownComponent,
    SubHeaderComponent,
  ],
  imports: [
    AppRoutingModule,
    BrowserModule,
    FormsModule,
    SidebarModule.forRoot(),
    GraphQLModule,
    HttpClientModule,
    // HttpClientInMemoryWebApiModule.forRoot(InMemoryDataService, {
    //   apiBase: 'api/'
    // }),
    StoreModule.forRoot(reducers, { metaReducers }),
    EffectsModule.forRoot(Effects),
    StoreDevtoolsModule.instrument({
      maxAge: 10
    })
  ],
  providers: [AuthGuard, SitesService, UsersService, DatasetsService, TerrainProviderService, Map3dService],
  bootstrap: [AppComponent]
})
export class AppModule { }
