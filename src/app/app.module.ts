import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { SidebarModule } from 'ng-sidebar';

// Botstrap
import { TabsModule, RatingModule, ModalModule, BsDropdownModule, CollapseModule } from 'ngx-bootstrap';

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
import { AnnotationsLayersComponent } from './components/annotations-layers/annotations-layers.component';
import { LayersControllerComponent } from './controllers/layers-controller/layers-controller.component';
import { DatasetLayerComponent } from './controllers/layers-controller/components/dataset-layer/dataset-layer.component';
import { AnnotationsControllerComponent } from './controllers/annotations-controller/annotations-controller.component';
import { AnnotationToolComponent } from './controllers/annotations-controller/components/annotation-tool/annotation-tool.component';
import { DatasetAnnotationsComponent } from './controllers/annotations-controller/components/dataset-annotations/dataset-annotations.component';
import { DatasetAnnotationComponent } from './controllers/annotations-controller/components/dataset-annotation/dataset-annotation.component';
import { NewAnnotationFormComponent } from './controllers/annotations-controller/components/new-annotation-form/new-annotation-form.component';
import { DatasetAnnotationDetailsComponent } from './controllers/annotations-controller/components/dataset-annotation-details/dataset-annotation-details.component';
import { ShotplanningComponent } from './components/shotplanning/shotplanning.component';
import { ShotplanningControllerComponent } from './controllers/shotplanning-controller/shotplanning-controller.component';
import { DatasetShotplanningComponent } from './controllers/shotplanning-controller/components/dataset-shotplanning/dataset-shotplanning.component';
import { ShotplanningToolComponent } from './controllers/shotplanning-controller/components/shotplanning-tool/shotplanning-tool.component';
import { SigninSignupLayoutComponent } from './components/signin-signup-layout/signin-signup-layout.component';
import { AnnotationsService } from './services/annotations/annotations.service';
import { VisualizationService } from './services/visualization/visualization.service';
import { MeasurementsService } from './services/measurements/measurements.service';
import { ShotplansService } from './services/shotplans/shotplans.service';
import { TimelineComponent } from './components/timeline/timeline.component';

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
    SiteDropdownComponent,
    SubHeaderComponent,
    AnnotationsLayersComponent,
    LayersControllerComponent,
    DatasetLayerComponent,
    AnnotationsControllerComponent,
    AnnotationToolComponent,
    DatasetAnnotationsComponent,
    DatasetAnnotationComponent,
    ShotplanningComponent,
    ShotplanningControllerComponent,
    DatasetShotplanningComponent,
    NewAnnotationFormComponent,
    DatasetAnnotationDetailsComponent,
    ShotplanningToolComponent,
    SigninSignupLayoutComponent,
    TimelineComponent,
  ],
  entryComponents: [
    NewAnnotationFormComponent
  ],
  imports: [
    AppRoutingModule,
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    SidebarModule.forRoot(),
    // Bootstrap
    TabsModule.forRoot(),
    RatingModule.forRoot(),
    ModalModule.forRoot(),
    BsDropdownModule.forRoot(),
    CollapseModule.forRoot(),
    GraphQLModule,
    HttpClientModule,

    // HttpClientInMemoryWebApiModule.forRoot(InMemoryDataService, {
    //   apiBase: 'api/'
    // }),
    StoreModule.forRoot(reducers),
    EffectsModule.forRoot(Effects),
    StoreDevtoolsModule.instrument({
      maxAge: 10
    })
  ],
  providers: [
    AuthGuard,
    SitesService,
    UsersService,
    DatasetsService,
    TerrainProviderService,
    Map3dService,
    AnnotationsService,
    VisualizationService,
    MeasurementsService,
    ShotplansService,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
