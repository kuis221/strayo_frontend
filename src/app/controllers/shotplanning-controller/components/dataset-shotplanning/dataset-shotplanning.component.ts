import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ValidatorFn, AbstractControl } from '@angular/forms';

import * as ol from 'openlayers';
import { filter, first } from 'rxjs/operators';

import { Shotplan, IShotplan, ShotplanRow, ShotplanRowFeature } from '../../../../models/shotplan.model';
import { Dataset } from '../../../../models/dataset.model';
import { listenOn } from '../../../../util/listenOn';
import { subscribeOn } from '../../../../util/subscribeOn';
import { TerrainProvider } from '../../../../models/terrainProvider.model';
import { TerrainProviderService } from '../../../../services/terrainprovider/terrain-provider.service';
import { IAnnotation } from '../../../../models/annotation.model';
import { Map3dService } from '../../../../services/map-3d.service';
import { shotplanStyle, annotationInteractionStyle } from '../../../../util/layerStyles';
import { WebMercator } from '../../../../util/projections/index';

interface NewRowForm {
  along: number;
  away: number;
  stagger: boolean;
}

@Component({
  selector: 'app-dataset-shotplanning',
  templateUrl: './dataset-shotplanning.component.html',
  styleUrls: ['./dataset-shotplanning.component.css']
})
export class DatasetShotplanningComponent implements OnInit, OnDestroy {
  @Input() dataset: Dataset;
  provider: TerrainProvider;
  shotplan: Shotplan;
  shotplanLayer: ol.layer.Vector;
  off: Function[] = [];

  selectedRow = -1;
  selectedHole = -1;

  showEndpoints = false;
  endpointOffsetTab: 'offset' | 'endpoint' = 'offset';
  modifyEndpointsInteraction: ol.interaction.Modify;

  newRowForm: FormGroup;
  constructor(private map3dService: Map3dService, private terrainProviderService: TerrainProviderService, private fb: FormBuilder) {}

  ngOnInit() {
    this.createForms();
    const sub = this.terrainProviderService.providers.pipe(
      filter(providers => !!providers.get(this.dataset.id())),
      first()
    ).subscribe(async (providers) => {
      this.provider = providers.get(this.dataset.id());
      const shotplanAnnotation = await this.dataset.waitForAnnotations(Shotplan.ANNOTATION_TYPE);
      console.log('found a shotplan');
      const iShotplan: IShotplan = {
        ...(shotplanAnnotation[0].getProperties() as IAnnotation),
        terrain_provider: this.provider,
      };
      this.shotplan = new Shotplan(iShotplan);
      this.shotplan.updateFromInterface();
      if (this.shotplanLayer) {
        this.map3dService.deregisterLayer(this.shotplanLayer, this.dataset);
      }
      this.shotplanLayer = this.makeLayerFromShotplan(this.shotplan);
      this.map3dService.registerLayer(this.shotplanLayer, this.dataset);
    });

    this.off.push(subscribeOn(sub));
  }

  createForms() {
    this.newRowForm = this.fb.group({
      along: [0, Validators.required],
      away: [0, Validators.required],
      stagger: [true],
    });
  }

  drawNewRow() {
    const draw = this.map3dService.setGlobalDraw(new ol.interaction.Draw({
      type: 'LineString',
      maxPoints: 2
    }));

    draw.once('drawstart', (evt) => {
      const tooltip = $(this.map3dService.toolTip.nativeElement);
      tooltip.html(`<span>Draw two points for the next row</span>`);
    });


    draw.once('drawend', (event) => {
      this.map3dService.removeInteraction(draw);
      const tooltip = $(this.map3dService.toolTip.nativeElement);
      tooltip.html('');
      
      const [p1, p2] = event.feature.getGeometry().getCoordinates();
      const row = this.shotplan.addRow([p1, p2]);
      const hole = row.addHole(p1);
    });

    this.map3dService.addInteraction(draw);
  }

  makeLayerFromShotplan(shotplan: Shotplan) {
    const makeSource = () => {
      return new ol.source.Vector({
        features: shotplan.data(),
      });
    };

    const layer = new ol.layer.Vector({
      source: makeSource(),
      style: shotplanStyle,
    });
    layer.set('title', 'Shotplan');
    this.off.push(listenOn(shotplan, 'change:data', () => {
      layer.setSource(makeSource());
    }));

    console.log('style ', shotplanStyle);

    return layer;
  }

  moveEndpoints(row: ShotplanRowFeature) {
    if (this.modifyEndpointsInteraction) {
      this.map3dService.removeInteraction(this.modifyEndpointsInteraction);
      console.log('stop move endpoints');
      return;
    }
    console.log('start move endpoints');
    const r = row.getRow();
    
    this.modifyEndpointsInteraction = new ol.interaction.Modify({
      // layers: [this.shotplanLayer],
      // features: new ol.Collection([new ol.Feature({
        //   geometry: r,
        // })]),
      source: this.shotplanLayer.getSource(),
      style: annotationInteractionStyle,
      pixelTolerance: 30
    });
    this.map3dService.addInteraction(this.modifyEndpointsInteraction);
  }

  placeRow(row: ShotplanRowFeature) {
    const form: NewRowForm = this.newRowForm.value;
    if (!this.newRowForm.valid) {
      console.warn('form submitted without anything');
      return;
    }
    const r = row.getRow();
    // Use dataset to get stuff in meters.
    // console.log('translating', form);
    // console.log('coords in webmercator', r.getCoordinates());
    const p1 = ol.proj.transform(r.getFirstCoordinate(), WebMercator, this.shotplan.terrainProvider().dataset().projection());
    const p2 = ol.proj.transform(r.getLastCoordinate(), WebMercator, this.shotplan.terrainProvider().dataset().projection());
    // console.log('coordinates in meters', p1, p2);
    const rowVec = osg.Vec2.normalize(osg.Vec2.sub(p2, p1, []), []);
    const clockWisePerp = [-rowVec[1], rowVec[0]];

    const alongVec = osg.Vec2.mult(rowVec, form.along, []);
    const awayVec = osg.Vec2.mult(clockWisePerp, form.away, []);
    const totalVec = osg.Vec2.add(alongVec, awayVec, []);
    // console.log('along/away Vec', alongVec, awayVec, totalVec);

    const newP1 = osg.Vec2.add(p1, totalVec, []);
    const newP2 = osg.Vec2.add(p2, totalVec, []);
    // console.log('new p1 p2 in meters', newP1, newP2);

    const c1 = ol.proj.transform(newP1, this.shotplan.terrainProvider().dataset().projection(), WebMercator);
    const c2 = ol.proj.transform(newP2, this.shotplan.terrainProvider().dataset().projection(), WebMercator);
    
    const newRow = this.shotplan.addRow([c1, c2]);
    const newHole = newRow.addHole(c1);

    if (form.stagger) {
      this.newRowForm.get('along').setValue(-form.along);
    }
    this.selectedRow = this.shotplan.data().getLength() - 1;
    // console.log('made it here');
    // console.log('coords in webmercator', newRow.getRow().getCoordinates());
  }

  selectRow(row: number) {
    if (this.selectedRow === row) {
      this.selectedRow = -1;
    } else {
      this.selectedRow = row;
    }
  }

  selectHole(hole: number) {
    if (this.selectedHole === hole) {
      this.selectedHole = -1;
    } else {
      this.selectedHole = hole;
    }
  }

  selectEndpointOffsetTab(tab) {
    this.endpointOffsetTab = tab;
    console.log('selct tab', tab);
  }

  ngOnDestroy() {
    this.off.forEach(off => {
      off();
    });
  }

}
