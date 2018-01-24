import { Injectable } from '@angular/core';
import { Map } from 'immutable';
import * as ol from 'openlayers';
import { AnnotationListener, AnnotationManager, AnnotationsService } from '../annotations/annotations.service';
import { Map3dService } from '../map-3d.service';
import { WebMercator } from '../../util/projections/index';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { distinctUntilChanged } from 'rxjs/operators/distinctUntilChanged';

class OrthophotoAnnotationListener implements AnnotationListener {
  constructor(private visualizationService: VisualizationService) { }

  annotationType() {
    return 'orthophoto';
  }
  onAnnotationFound(annotationId: number, datasetId: number) {
    const manager = new OrthophotoAnnotationManager({
      viz_service: this.visualizationService,
      map3d_service: this.visualizationService.map3dService,
    });
    const orthoManagers = this.visualizationService.orthophotoForDatasetSource.getValue()
      .set(datasetId, manager);
    this.visualizationService.orthophotoForDatasetSource.next(orthoManagers);
    return manager;
  }
}

interface IOrthophotoAnnotationManager {
  viz_service: VisualizationService;
  map3d_service: Map3dService;
  [k: string]: any;
}

class OrthophotoAnnotationManager extends AnnotationManager {
  constructor(props: IOrthophotoAnnotationManager) {
    super(props);
  }

  public layer(): ol.layer.Tile;
  public layer(layer: ol.layer.Tile): this;
  public layer(layer?: ol.layer.Tile): ol.layer.Tile | this {
    if (layer !== undefined) {
      this.set('layer', layer);
      return this;
    }
    return this.get('layer');
  }

  public map3dService(): Map3dService;
  public map3dService(map3d_service: Map3dService): this;
  public map3dService(map3d_service?: Map3dService): Map3dService | this {
    if (map3d_service !== undefined) {
      this.set('map3d_service', map3d_service);
      return this;
    }
    return this.get('map3d_service');
  }

  public vizService(): VisualizationService;
  public vizService(viz_service: VisualizationService): this;
  public vizService(viz_service?: VisualizationService): VisualizationService | this {
    if (viz_service !== undefined) {
      this.set('viz_service', viz_service);
      return this;
    }
    return this.get('viz_service');
  }


  public init() {
    console.log('in orthophoto annotation listener');
    const orthophotoAnnotation = this.annotation();
    const orthophotoResource = orthophotoAnnotation.resources().find(r => r.type() === 'tiles');
    if (!orthophotoResource) {
      console.warn('No Tiles Resource Found');
      return;
    }
    const orthophotoLayer = new ol.layer.Tile({
      source: new ol.source.XYZ({
        projection: WebMercator,
        url: orthophotoResource.url()
      })
    });
    orthophotoLayer.set('title', 'Orthophoto');
    orthophotoLayer.set('group', 'visualization');
    orthophotoLayer.setVisible(true);
    this.layer(orthophotoLayer);
    this.map3dService().registerLayer(orthophotoLayer, this.dataset());
    AnnotationManager.prototype.init.call(this);
  }

  public destroy() {
    AnnotationManager.prototype.destroy.call(this);
    this.map3dService().deregisterLayer(this.layer(), this.dataset());
    this.layer(null);
  }
}

@Injectable()
export class VisualizationService {
  orthophotoForDatasetSource = new BehaviorSubject<Map<number, OrthophotoAnnotationManager>>(Map());
  orthophotoForDataset$ = this.orthophotoForDatasetSource.asObservable().pipe(distinctUntilChanged());
  constructor(public annotationService: AnnotationsService, public map3dService: Map3dService) {
    this.annotationService.registerListener(new OrthophotoAnnotationListener(this));
  }

}
