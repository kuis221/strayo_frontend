import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SitesService } from '../../sites/sites.service';
import { Observable } from 'rxjs/Observable';
import { List } from 'immutable';
import { Site } from '../../models/site.model';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

import { switchMap, map, tap, share, filter } from 'rxjs/operators';
import { Dataset } from '../../models/dataset.model';
import { DatasetsService } from '../../datasets/datasets.service';


@Component({
  selector: 'app-site-dropdown',
  templateUrl: './site-dropdown.component.html',
  styleUrls: ['./site-dropdown.component.css']
})
export class SiteDropdownComponent implements OnInit {
  sites$: Observable<List<Site>>;
  datasets$: Observable<List<Dataset>>;
  selectedSite$: Observable<Site>;
  selectedDataset$: Observable<Dataset>;
  
  searchedSites$: Observable<List<Site>>;
  searchedDatasets$: Observable<List<Dataset>>;

  searchDatasetValue$ = new BehaviorSubject<string>('');
  searchSiteValue$ = new BehaviorSubject<string>('');
  
  constructor(private sitesService: SitesService, private datasetsService: DatasetsService, private route: ActivatedRoute) { }

  ngOnInit() {
    // initStrayosJquery($);
    this.sites$ = this.sitesService.sites;
    this.selectedSite$ = this.route.params.pipe(
      switchMap((params) => {
        const id = +params.site_id;
        return this.sitesService.sites.pipe(
          map((sites) => sites.find(site => site.id() === id))
        );
      }),
    );
    this.datasets$ = this.datasetsService.datasets;
    this.selectedDataset$ = this.route.params.pipe(
      switchMap((params) => {
        const id = +params.dataset_id;
        return this.datasetsService.datasets.pipe(
          map((datasets) => datasets.find(dataset => dataset.id() === id))
        );
      })
    );

    this.searchedSites$ = this.sites$.switchMap((sites) => {
      return this.searchSiteValue$.map((value) => {
        if (!value) return sites;
        return sites.filter(site => site.name().toLowerCase().includes(value.toLowerCase())).toList();
      });
    });
    this.searchedDatasets$ = this.datasets$.switchMap((datasets) => {
      return this.searchDatasetValue$.map((value) => {
        datasets = datasets.filter(d => !d.isPhantom()).toList();
        if (!value) return datasets;
        return datasets.filter(dataset => !dataset.isPhantom() && dataset.name().toLowerCase().includes(value.toLowerCase())).toList();
      });
    });
  }

  onSearchSite(value: string) {
    this.searchSiteValue$.next(value);
  }

  onSearchDataset(value: string) {
    this.searchDatasetValue$.next(value);
  }

}
