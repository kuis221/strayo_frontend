import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import * as ol from 'openlayers';
import { Dataset } from '../../../../models/dataset.model';
import { WebMercator } from '../../../../util/projections/index';
import { Map3dService } from '../../../../services/map-3d.service';
import { listenOn } from '../../../../util/listenOn';
import { Annotation } from '../../../../models/annotation.model';

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

  unsubscribe: Function[] = [];
  constructor(private map3DService: Map3dService) {
  }

  async ngOnInit() {
    const orthophotoAnnotation = await new Promise<Annotation>((resolve) => {
      if (this.dataset.annotations()) {
        return resolve();
      }
      this.dataset.once('change:annotations', () => {
        resolve(this.dataset.annotations().find(a => a.type() === 'orthophoto'));
      });
    });
    if (!orthophotoAnnotation) {
      console.warn('No Orthophoto Annotation Found');
      return;
    }
    const orthophotoResource = orthophotoAnnotation.resources().find(r => r.type() === 'tiles');
    if (!orthophotoResource) {
      console.warn('No Tiles Resource Found');
      return;
    }
    this.orthophotoLayer = new ol.layer.Tile({
      source: new ol.source.XYZ({
        projection: WebMercator,
        url: orthophotoResource.url()
      })
    });
    this.orthophotoLayer.set('title', 'Orthophoto');
    this.orthophotoLayer.set('group', 'visualization');
    this.orthophotoLayer.setVisible(this.orthophotoVisible);
    this.setOrthophotoVisible = (visible) => {
      console.log('setting visble', visible);
      this.orthophotoLayer.setVisible(visible);
    };
    this.unsubscribe.push(
      listenOn(this.orthophotoLayer, 'change:visible', (visible) => {
        console.log('getting visiblity', visible);
        this.orthophotoVisible = this.orthophotoLayer.getVisible();
      })
    );
    
    this.map3DService.registerLayer(this.orthophotoLayer, this.dataset);
    const extent = await new Promise<ol.Extent>((resolve) => {
      if (this.dataset.mapData()) {
        return resolve(this.dataset.calcExtent());
      }
      this.dataset.once('change:map_data', () => {
        resolve(this.dataset.calcExtent());
      });
    });
    console.log('setting extent', extent);
    this.map3DService.setExtent(extent);
  }

  ngOnDestroy() {
    this.unsubscribe.forEach(off => off());
  }

}
