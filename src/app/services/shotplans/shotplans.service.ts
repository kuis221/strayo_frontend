import { Injectable } from '@angular/core';
import * as ol from 'openlayers';

import { AnnotationListener, AnnotationManager, AnnotationsService } from '../annotations/annotations.service';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Map } from 'immutable';
import { Shotplan, IShotplan } from '../../models/shotplan.model';
import { Map3dService } from '../map-3d.service';
import { IAnnotation, Annotation } from '../../models/annotation.model';


class ShtoplanAnnotationListener implements AnnotationListener {
  constructor(private shotplansService: ShotplansService) {}
  shouldHandle(annotation: Annotation): boolean {
    return Shotplan.ANNOTATION_TYPE === annotation.type();
  }
  onAnnotationFound(annotationId: number, datasetId: number) {
    const manager = new ShotplanAnnotationManager({
      map3d_service: this.shotplansService.map3dService
    });
    const shotplanManagers = this.shotplansService.shotplansForDatasetSource.getValue();
    const forDataset = shotplanManagers.get(datasetId) || Map();
    this.shotplansService.shotplansForDatasetSource.next(
      shotplanManagers.set(datasetId, forDataset.set(annotationId, manager))
    );
    return manager;
  }
}

interface IShotplanAnnotationManager {
  map3d_service: Map3dService;
  [k: string]: any;
}

class ShotplanAnnotationManager extends AnnotationManager {
  constructor(props: IShotplanAnnotationManager) {
    super(props);
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

  public shotplan(): Shotplan;
  public shotplan(shotplan: Shotplan): this;
  public shotplan(shotplan?: Shotplan): Shotplan | this {
    if (shotplan !== undefined) {
      this.set('shotplan', shotplan);
      return this;
    }
    return this.get('shotplan');
  }

  public init() {
    const iShotplan: IShotplan = {
      ...this.annotation().getProperties(),
      terrain_provider: this.map3dService().getProviderForDataset(this.dataset())
    } as any;
    const shotplan = new Shotplan(iShotplan);
    shotplan.updateFromInterface();
    this.shotplan(shotplan);
    AnnotationManager.prototype.init.call(this);
  }
}

@Injectable()
export class ShotplansService {
  shotplansForDatasetSource = new BehaviorSubject<Map<number, Map<number, ShotplanAnnotationManager>>>(Map());
  shotplansForDataset$ = this.shotplansForDatasetSource.asObservable();
  constructor(private annotationService: AnnotationsService, public map3dService: Map3dService) {
    this.annotationService.registerListener(new ShtoplanAnnotationListener(this));
  }

}
