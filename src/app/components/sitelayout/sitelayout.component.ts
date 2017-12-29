import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { List } from 'immutable';

import { Observable } from 'rxjs/Observable';
import { switchMap, map, tap, share } from 'rxjs/operators';

import { SitesService } from '../../sites/sites.service';
import { DatasetsService } from '../../datasets/datasets.service';

import { Site } from '../../models/site.model';
import { Dataset } from '../../models/dataset.model';

@Component({
  selector: 'app-sitelayout',
  templateUrl: './sitelayout.component.html',
  styleUrls: ['./sitelayout.component.css'],
})
export class SiteLayoutComponent implements OnInit {
  site: Site;
  datasets: Dataset[];
  constructor(private sitesService: SitesService, private datasetsService: DatasetsService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.params.pipe(
      switchMap((params) => {
        const id = +params.id;
        return this.sitesService.sites.pipe(
          map((sites) => sites.find(site => site.id() === id))
        );
      })
    ).subscribe((site) => {
      this.site = site;
      this.datasets = site.datasets();
      if (!site) return;
      this.datasetsService.setDatasets(site.datasets() || []);
    });
  }
}