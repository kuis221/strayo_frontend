import { Component, OnInit, Input } from '@angular/core';
import * as ol from 'openlayers';
import { filter, map } from 'rxjs/operators';
import { Dataset } from '../../../../models/dataset.model';
import { Annotation } from '../../../../models/annotation.model';
import { AnnotationToolType, ToolToThumbnail } from '../../../../models/annotationToolType';
import { DomSanitizer } from '@angular/platform-browser';
import { Map3dService } from '../../../../services/map-3d.service';
import { IAnnotationToolMeta } from '../../../../models/annotationToolMeta';
import { annotationStyle } from '../../../../util/layerStyles';
import { listenOn } from '../../../../util/listenOn';
import { MeasurementsService, MeasurementAnnotationManager } from '../../../../services/measurements/measurements.service';
@Component({
  selector: 'app-dataset-annotation',
  templateUrl: './dataset-annotation.component.html',
  styleUrls: ['./dataset-annotation.component.css']
})

export class DatasetAnnotationComponent implements OnInit {
  @Input() manager: MeasurementAnnotationManager;
  meta: IAnnotationToolMeta;
  editMode = false;
  interactionDone: Function;
  interaction: ol.interaction.Translate;
  toolToThumbnail = ToolToThumbnail;
  constructor(private sanitizer: DomSanitizer, private map3DService: Map3dService, private measurementService: MeasurementsService) { }

  ngOnInit() {
    this.meta = this.manager.meta();
  }

  toggleEditMode() {
    if (this.editMode) {
      this.map3DService.removeInteraction(this.interaction);
    } else {
      this.interaction = new ol.interaction.Translate({
        layers: [this.manager.selectionLayer()],
      });
      this.map3DService.addInteraction(this.interaction);
    }
    this.editMode = !this.editMode;
  }

}
