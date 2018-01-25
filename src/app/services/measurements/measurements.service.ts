import { Injectable } from '@angular/core';
import { Map } from 'immutable';
import { debounce } from 'lodash';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import * as ol from 'openlayers';
import { distinctUntilChanged } from 'rxjs/operators/distinctUntilChanged';
import { AnnotationManager, AnnotationListener, AnnotationsService } from '../annotations/annotations.service';
import { IAnnotationToolMeta } from '../../models/annotationToolMeta';
import { annotationStyle } from '../../util/layerStyles';
import { listenOn } from '../../util/listenOn';
import { Map3dService } from '../map-3d.service';
import { Annotation } from '../../models/annotation.model';

class MeasurementAnnotationListener implements AnnotationListener {
  constructor(private measurementsService: MeasurementsService) { }
  shouldHandle(annotation: Annotation): boolean {
    return /measurement/.test(annotation.type());
  }
  onAnnotationFound(annotationId: number, datasetId: number) {
    const manager = new MeasurementAnnotationManager({
      map3d_service: this.measurementsService.map3dService
    });
    const measurementsManager = this.measurementsService.measurementsForDatasetSource.getValue();
    const forDataset = measurementsManager.get(datasetId) || Map();
    this.measurementsService.measurementsForDatasetSource.next(
      measurementsManager.set(datasetId, forDataset.set(annotationId, manager))
    );
    return manager;
  }
}

interface IMeasurementAnnotationManager {
  map3d_service: Map3dService;
  [k: string]: any;
}

export class MeasurementAnnotationManager extends AnnotationManager {
  private off: Function[] = [];
  constructor(props: IMeasurementAnnotationManager) {
    super(props);
  }

  public layer(): ol.layer.Vector;
  public layer(layer: ol.layer.Vector): this;
  public layer(layer?: ol.layer.Vector): ol.layer.Vector | this {
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

  public meta(): IAnnotationToolMeta {
    return this.annotation().meta() as IAnnotationToolMeta;
  }

  public selectionLayer(): ol.layer.Vector;
  public selectionLayer(selectionLayer: ol.layer.Vector): this;
  public selectionLayer(selectionLayer?: ol.layer.Vector): ol.layer.Vector | this {
    if (selectionLayer !== undefined) {
      this.set('selection_layer', selectionLayer);
      return this;
    }
    return this.get('selection_layer');
  }

  public selectionPoints(): ol.Collection<ol.Feature>;
  public selectionPoints(selectionPoints: ol.Collection<ol.Feature>): this;
  public selectionPoints(selectionPoints?: ol.Collection<ol.Feature>): ol.Collection<ol.Feature> | this {
    if (selectionPoints !== undefined) {
      this.set('selection_points', selectionPoints);
      return this;
    }
    return this.get('selection_points');
  }

  init() {
    console.log('in init of measurements manager');
    const geometry = this.annotation().data().item(0).getGeometry();
    const makeSelectionPoints = () => {
      const type = geometry.getType();
      let coordinates;
      switch (type) {
        case 'LineString':
          coordinates = (geometry as ol.geom.LineString).getCoordinates();
          break;
        case 'Polygon':
          coordinates = (geometry as ol.geom.Polygon).getLinearRing(0).getCoordinates();
          break;
      }
      const col = this.selectionPoints() || new ol.Collection<ol.Feature>([]);
      col.clear();
      col.extend(coordinates.map((coord, i) => {
        const geom = new ol.geom.Circle(coord, 3);
        // when modified
        geom.on('change', () => {
          let coords;
          switch (geometry.getType()) {
            case 'LineString':
              coords = (geometry as ol.geom.LineString).getCoordinates();
              break;
            case 'Polygon':
              coords = (geometry as ol.geom.Polygon).getLinearRing(0).getCoordinates();
              break;
          }
          coords[i] = geom.getCenter();
          switch (geometry.getType()) {
            case 'LineString':
              (geometry as ol.geom.LineString).setCoordinates(coords);
              break;
            case 'Polygon':
              (geometry as ol.geom.Polygon).getLinearRing(0).setCoordinates(coords);
              break;
          }
        });
        return new ol.Feature({
          index: i,
          geometry: geom
        });
      }));
      this.selectionPoints(col);
    };
    // always update points
    makeSelectionPoints();
    const geometryListen = listenOn(geometry, 'change', () => {
      makeSelectionPoints();
    });
    this.off.push(geometryListen);

    const selectionLayer = new ol.layer.Vector({
      source: new ol.source.Vector({
        features: this.selectionPoints()
      }),
      style: annotationStyle,
    });
    selectionLayer.set('title', `${this.meta().name} selection`);
    this.selectionLayer(selectionLayer);

    const layer = new ol.layer.Vector({
      source: new ol.source.Vector({
        features: this.annotation().data(),
      })
    });
    layer.set('title', `${this.meta().name}`);
    console.log('meta title', this.meta().name);
    this.layer(layer);

    this.map3dService().registerLayer(layer, this.dataset());
    this.map3dService().registerLayer(selectionLayer, this.dataset());
    AnnotationManager.prototype.init.call(this);
  }

  destroy() {
    AnnotationManager.prototype.destroy.call(this);
    this.map3dService().deregisterLayer(this.layer(), this.dataset());
    this.map3dService().deregisterLayer(this.selectionLayer(), this.dataset());
    this.off.forEach(off => off());
    this.off = [];
  }
}

@Injectable()
export class MeasurementsService {
  measurementsForDatasetSource = new BehaviorSubject<Map<number, Map<number, MeasurementAnnotationManager>>>(Map());
  measurementsForDatasets$ = this.measurementsForDatasetSource.asObservable();
  constructor(private annotationService: AnnotationsService, public map3dService: Map3dService) {
    this.annotationService.registerListener(new MeasurementAnnotationListener(this));
  }

}
