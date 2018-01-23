import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Site } from '../../models/site.model';
import { Dataset } from '../../models/dataset.model';
import { SitesService } from '../../sites/sites.service';
import { DatasetsService } from '../../datasets/datasets.service';
import { VisualizationService } from '../../services/visualization/visualization.service';
import { MeasurementsService } from '../../services/measurements/measurements.service';
import { List } from 'immutable';

import { listenOn } from '../../util/listenOn';

import { Observable } from 'rxjs/Observable';
import { switchMap, map, share, distinctUntilChanged } from 'rxjs/operators';
import { subscribeOn } from '../../util/subscribeOn';

// The string option is so the typescript compiler doesn't complain.
type Panels = 'annotations' | 'shotplanning' | string;

@Component({
  selector: 'app-dataset-layout',
  templateUrl: './dataset-layout.component.html',
  styleUrls: ['./dataset-layout.component.css']
})
export class DatasetLayoutComponent implements OnInit, OnDestroy {
  site: Site;
  mainDataset: Dataset;
  datasets: List<Dataset>;

  site$: Observable<Site>;
  mainDataset$: Observable<Dataset>;
  datasets$: Observable<List<Dataset>>;

  sidepanel: Panels = 'annotations';
  off: Function[] = [];
  constructor(
    private sitesService: SitesService,
    private datasetsService: DatasetsService,
    private route: ActivatedRoute,

    // Sevices that listen to annotations
    private vizService: VisualizationService,
    private measurementsservice: MeasurementsService
  ) { }

  ngOnInit() {
    initStrayosJquery($);
    // Get the site
    const routeSub = this.route.params.pipe(
      switchMap((params) => {
        const site_id = +params.site_id;
        return this.sitesService.sites.pipe(
          map(sites => sites.find(site => site.id() === site_id)),
        );
      })
    ).subscribe((site) => {
      this.site = site;
      if (!site) return;
      console.log('SITE', site);
      this.sitesService.setMainSite(site);
      this.datasetsService.setDatasets(site.datasets());
    });
    this.off.push(subscribeOn(routeSub));

    // Setting main
    const mainSub = this.route.params.pipe(
      switchMap((params) => {
        const dataset_id = +params.dataset_id;
        return this.datasetsService.datasets.pipe(
          map(datasets => datasets.find(dataset => dataset.id() === dataset_id))
        );
      })
    ).subscribe((dataset) => {
      if (!dataset) {
        return;
      }
      this.datasetsService.setMainDataset(dataset);
    });
    this.off.push(subscribeOn(mainSub));

    // Getting datasets
    const datasetSub = this.datasetsService.datasets.subscribe((datasets) => {
      this.datasets = datasets;
    });
    this.off.push(subscribeOn(datasetSub));

    // Getting main
    const mainDatasetSub = this.datasetsService.mainDataset.subscribe(async (dataset) => {
      this.mainDataset = dataset;
      if (!dataset) return;
      const progress = await this.datasetsService.loadAnnotations(dataset);
      const off = listenOn(progress, 'change:progress', () => {
        off();
      });
    });
    this.off.push(subscribeOn(mainDatasetSub));
  }

  switchPanel(panel: Panels) {
    this.sidepanel = panel;
    initStrayosJquery($);
  }

  ngOnDestroy() {
    this.off.forEach(off => off());
    this.off = [];
  }

}
