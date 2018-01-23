import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import * as ol from 'openlayers';
import { Dataset } from '../../../../models/dataset.model';
import { WebMercator } from '../../../../util/projections/index';
import { Map3dService } from '../../../../services/map-3d.service';
import { listenOn } from '../../../../util/listenOn';
import { Annotation } from '../../../../models/annotation.model';
import { VisualizationService } from '../../../../services/visualization/visualization.service';
import { filter, map } from 'rxjs/operators';

@Component({
  selector: 'app-dataset-layer',
  templateUrl: './dataset-layer.component.html',
  styleUrls: ['./dataset-layer.component.css']
})
export class DatasetLayerComponent implements OnInit, OnDestroy {
  @Input() dataset: Dataset;
  orthophotoLayer: ol.layer.Tile;
  orthophotoVisible = true;
  setOrthophotoVisible: (visible: boolean) => void;

  off: Function[] = [];
  constructor(private map3DService: Map3dService, private vizService: VisualizationService, private cd: ChangeDetectorRef) {
  }

  async ngOnInit() {
    this.vizService.orthophotoForDataset$.pipe(
      filter((managers) => {
        const listener = managers.get(this.dataset.id());
        return !!listener;
      }),
      map((managers) => managers.get(this.dataset.id())),
    )
    .subscribe((manager) => {
      const listenInit = listenOn(manager, 'init', () => {
        this.orthophotoLayer = manager.layer();
        this.setOrthophotoVisible = this.orthophotoLayer.setVisible.bind(this.orthophotoLayer);
        const listenVisible = listenOn(this.orthophotoLayer, 'change:visible', () => {
          this.orthophotoVisible = this.orthophotoLayer.getVisible();
          this.cd.markForCheck();
        });
        this.off.push(listenVisible);
      });
      this.off.push(listenInit);
    });
    const group = this.map3DService.getGroupForDataset(this.dataset);
  }

  ngOnDestroy() {
    this.off.forEach(off => off());
  }

}
