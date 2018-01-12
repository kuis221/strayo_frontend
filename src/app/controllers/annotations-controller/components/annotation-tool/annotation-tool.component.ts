import { Component, OnInit, Input } from '@angular/core';
import * as ol from 'openlayers';
import generateName from 'sillyname';
import { Map3dService } from '../../../../services/map-3d.service';
import { makeAnnotationInteraction } from '../../../../util/interactions';
import { listenOn } from '../../../../util/listenOn';
import { Dataset } from '../../../../models/dataset.model';
import { DatasetsService } from '../../../../datasets/datasets.service';
import { IAnnotation, Annotation } from '../../../../models/annotation.model';
import { IAnnotationToolMeta } from '../../../../models/annotationToolMeta';
import { AnnotationToolType } from '../../../../models/annotationToolType';
@Component({
  selector: 'app-annotation-tool',
  templateUrl: './annotation-tool.component.html',
  styleUrls: ['./annotation-tool.component.css']
})
export class AnnotationToolComponent implements OnInit {
  @Input() tool: string;
  mainDataset: Dataset;
  constructor(private map3DService: Map3dService, private datasetsService: DatasetsService) { }

  ngOnInit() {
    this.datasetsService.mainDataset.subscribe((dataset) => {
      this.mainDataset = dataset;
    });
  }

  startTool(tool: AnnotationToolType) {
    const draw = makeAnnotationInteraction({
      type: 'LineString',
    });
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
    draw.on('drawend', (event) => {
      if (off) off();
      const sketch = event.feature;
      const annotations = (this.mainDataset.annotations() || []).filter(a => a.type() === 'annotation');
      const name = `${this.mainDataset.name()}: Sample Annotation ${annotations.length + 1}`;
      
      const meta: IAnnotationToolMeta = {
        tool,
        name,
      };
      const newIAnnotation: IAnnotation = {
        created_at: new Date(),
        updated_at: new Date(),
        id: 0,
        meta,
        data: new ol.Collection([sketch]),
        resources: null,
        type: 'annotation'
      };
      const tooltip = $(this.map3DService.toolTip.nativeElement);
      tooltip.html('');
    
      const newAnnotation = new Annotation(newIAnnotation);
      this.mainDataset.annotations([...(this.mainDataset.annotations() || []), newAnnotation]);
      this.map3DService.removeInteraction(draw);
    });
    this.map3DService.addInteraction(draw);
  }

}
