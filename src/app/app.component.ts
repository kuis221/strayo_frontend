import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs/Observable';
import { map, tap } from 'rxjs/operators';

import { List } from 'immutable';

import { Site } from './models/site.model';
import { SitesState } from './sites/state';
import { SitesService } from './sites/sites.service';
import { ChangeDetectionStrategy } from '@angular/core';
import { DatasetsService } from './datasets/datasets.service';

import getItWorking from './util/getosgjsworking';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  title = 'app';
  sites$: Observable<List<Site>>;
  constructor(private http: HttpClient, private sitesService: SitesService, private datasetsService: DatasetsService) {
  }
  ngOnInit() {
    getItWorking();
    console.log('P', P, P.defer);
    console.log('osg', OSG);
    OSG.globalify();
    this.sitesService.loadSites();
  }
}
