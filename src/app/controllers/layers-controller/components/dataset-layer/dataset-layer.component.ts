import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import * as ol from 'openlayers';
import { Dataset } from '../../../../models/dataset.model';
import { WebMercator } from '../../../../util/projections/index';
import { Map3dService } from '../../../../services/map-3d.service';
import { listenOn } from '../../../../util/listenOn';
import { Annotation } from '../../../../models/annotation.model';
import { VisualizationService } from '../../../../services/visualization/visualization.service';
import { filter, map } from 'rxjs/operators';
import { subscribeOn } from '../../../../util/subscribeOn';
import { TerrainProvider } from '../../../../models/terrainProvider.model';
import { TerrainProviderService } from '../../../../services/terrainprovider/terrain-provider.service';

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


  provider: TerrainProvider;
  providerVisible = true;
  off: Function[] = [];
  constructor(
    private map3DService: Map3dService,
    private vizService: VisualizationService,
    private terrainProviderService: TerrainProviderService,
    private cd: ChangeDetectorRef) {
  }

  async ngOnInit() {
    const vizListen = this.vizService.orthophotoForDataset$.pipe(
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

    const providerListen = this.terrainProviderService.terrainProviderForDataset$.pipe(
      filter((managers) => {
        return !!managers.get(this.dataset.id());
      }),
      map((managers) => managers.get(this.dataset.id()))
    )
    .subscribe((manager) => {
      const listenInit = listenOn(manager, 'init', () => {
        this.provider = manager.terrainProvider();
      })
      this.off.push(listenInit);
    })
    this.off.push(subscribeOn(providerListen));
    this.off.push(subscribeOn(vizListen));
  }

  setProviderVisible(visible: boolean) {
    if (visible == this.providerVisible) return;
    if (visible) {
      console.log('adding provider')
      this.map3DService.sceneRoot.addChild(this.provider.rootNode());
    } else {
      console.log('removing provider')
      
      this.map3DService.sceneRoot.removeChild(this.provider.rootNode());
    }
    this.providerVisible = visible;
  }

  ngOnDestroy() {
    this.off.forEach(off => off());
  }

}
