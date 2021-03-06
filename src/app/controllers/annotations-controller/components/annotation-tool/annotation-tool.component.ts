import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import * as ol from 'openlayers';
import { debounce } from 'lodash';
import { first } from 'rxjs/operators';
import { BsModalService } from 'ngx-bootstrap/modal';
import { BsModalRef } from 'ngx-bootstrap/modal/bs-modal-ref.service';
import { Map3dService } from '../../../../services/map-3d.service';
import { makeAnnotationInteraction } from '../../../../util/interactions';
import { listenOn } from '../../../../util/listenOn';
import { Dataset } from '../../../../models/dataset.model';
import { DatasetsService } from '../../../../datasets/datasets.service';
import { IAnnotation, Annotation } from '../../../../models/annotation.model';
import { IAnnotationToolMeta } from '../../../../models/annotationToolMeta';
import { AnnotationToolType, ToolToThumbnail, ToolToType } from '../../../../models/annotationToolType';
import { NewAnnotationFormComponent } from '../new-annotation-form/new-annotation-form.component';
import { annotationInteractionStyle, withStyles } from '../../../../util/layerStyles';
import { subscribeOn } from '../../../../util/subscribeOn';
import { List } from 'immutable';

@Component({
  selector: 'app-annotation-tool',
  templateUrl: './annotation-tool.component.html',
  styleUrls: ['./annotation-tool.component.css']
})
export class AnnotationToolComponent implements OnInit, OnDestroy {
  @Input() tool: string;
  datasets: List<Dataset>;
  bsModalRef: BsModalRef; // Reference to new annotation form.
  toolToThumbnail = ToolToThumbnail;
  
  off: Function[] = [];
  constructor(private map3DService: Map3dService, private datasetsService: DatasetsService, private modalService: BsModalService) { }

  ngOnInit() {
    this.datasetsService.datasets.subscribe((datasets) => {
      this.datasets = datasets;
    });
  }

  getInteraction(tool) {
    const draw = this.map3DService.setGlobalDraw(new ol.interaction.Draw({
      type: ToolToType[tool],
      style: annotationInteractionStyle,
    }));
    return draw;
  }

  startTool(tool: AnnotationToolType) {
    const draw = this.getInteraction(tool);
    let off;
    draw.on('drawstart', (evt) => {
      const sketch = evt.feature;
      const tooltip = $(this.map3DService.toolTip.nativeElement);
      tooltip.html(`<span>Double click to stop drawing</span>`);

      if (off) off();

      off = listenOn(sketch.getGeometry(), 'change', (event) => {
        const geom = event.target;

      });
    });
    draw.on('drawend', debounce((event) => {
      if (off) off();
      this.map3DService.removeInteraction(draw);
      const sketch = event.feature;
      this.newAnnotationModal(sketch, tool);
    }, 100));
    this.map3DService.addInteraction(draw);
  }

  newAnnotationModal(feature: ol.Feature, tool: AnnotationToolType) {
    this.bsModalRef = this.modalService.show(NewAnnotationFormComponent);
    const content = this.bsModalRef.content as NewAnnotationFormComponent;
    const off = content.submit.pipe(first()).subscribe(({name, dataset, notes}) => {
      const meta: IAnnotationToolMeta = {
        tool,
        name,
        notes,
      };
      const newIAnnotation: IAnnotation = {
        created_at: new Date(),
        updated_at: new Date(),
        id: -(Math.floor(Math.random() * 1000000)),
        meta,
        data: new ol.Collection([feature]),
        resources: null,
        type: 'measurement'
      };
      const set = this.datasets.find(d => d.id() === +dataset);
      if (!set) {
        console.warn('Could not find dataset', dataset);
      }
      const newAnnotation = new Annotation(newIAnnotation);
      set.annotations([...(set.annotations() || []), newAnnotation]);
    });
    this.off.push(subscribeOn(off));
  }

  ngOnDestroy() {
    this.off.forEach(off => off());
  }
}
