import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';

import { AppComponent } from './app.component';
import { GraphQLModule } from './graphql/graphql.module';

import { InMemoryDataService } from './mocks/inMemoryData.service';
import { HttpClientInMemoryWebApiModule } from 'angular-in-memory-web-api';

import { StoreModule } from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { EffectsModule } from '@ngrx/effects';
import { reducers } from './reducers/index';
import { Effects } from './effects/effects';

import { SitesEffects } from './sites/effects/sites.effects';
import { SitesService } from './sites/sites.service';
import { SiteslayoutComponent } from './components/siteslayout/siteslayout.component';
import { SitedetailsComponent } from './components/sitedetails/sitedetails.component';
import { SitemapComponent } from './components/sitemap/sitemap.component';
import { SiteLayoutComponent } from './components/sitelayout/sitelayout.component';
import { DatasetsService } from './datasets/datasets.service';
import { DatasetDetailsComponent } from './components/dataset-details/dataset-details.component';
import { DatasetLayoutComponent } from './components/dataset-layout/dataset-layout.component';

@NgModule({
  declarations: [
    AppComponent,
    SiteslayoutComponent,
    SitedetailsComponent,
    SitemapComponent,
    SiteLayoutComponent,
    DatasetDetailsComponent,
    DatasetLayoutComponent
  ],
  imports: [
    AppRoutingModule,
    BrowserModule,
    GraphQLModule,
    HttpClientModule,
    HttpClientInMemoryWebApiModule.forRoot(InMemoryDataService),
    StoreModule.forRoot(reducers),
    EffectsModule.forRoot(Effects),
    StoreDevtoolsModule.instrument({
      maxAge: 10
    })
  ],
  providers: [SitesService, DatasetsService],
  bootstrap: [AppComponent]
})
export class AppModule { }
