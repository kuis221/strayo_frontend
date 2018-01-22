import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ValidatorFn, AbstractControl } from '@angular/forms';

import * as ol from 'openlayers';
import { filter, first, switchMap } from 'rxjs/operators';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/merge';

import { Shotplan, IShotplan, ShotplanRow, ShotplanRowFeature, ShotplanHole } from '../../../../models/shotplan.model';
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

interface NewHoleForm {
  count: number;
  spacing: number;
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

  showHoleForm = false;
  showEndpoints = false;
  endpointOffsetTab: 'offset' | 'endpoint' = 'offset';
  modifyEndpointsInteraction: ol.interaction.Modify;

  newRowForm: FormGroup;
  newHoleForm: FormGroup;
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
      this.shotplan.rows$.pipe(
        switchMap((rows) => {
          const holes$ = rows.map(r => r.holes$);
          return Observable.merge(...holes$);
        })
      ).subscribe((holes) => {
        console.log('hole update', holes.map(h => h.id()))
      });
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

    this.newHoleForm = this.fb.group({
      count: [1, Validators.required],
      spacing: [1, Validators.required],
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
    // TODO change move feature to show a plan of where things will move
    if (this.modifyEndpointsInteraction) {
      this.map3dService.removeInteraction(this.modifyEndpointsInteraction);
      this.modifyEndpointsInteraction = null;
      // this.shotplan.autoUpdate(true);
      console.log('stop move endpoints');
      return;
    }

    console.log('start move endpoints');
    // this.shotplan.autoUpdate(false);
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

  placeHole(row: ShotplanRowFeature, hole: ShotplanHole, direction: number) {
    const form: NewHoleForm = this.newHoleForm.value;
    if (!this.newHoleForm.valid) {
      console.warn('form submitted without validation');
      return;
    }
    
    direction = Math.sign(direction);
    // Copy the rows along
    const r = row.getRow();
    const [x, y] = hole.alongAwayFrom(r);
    const along = (direction * form.spacing) + x;
    const away = y;
    console.log('hole', hole.id());
    console.log('spacing', [direction, form.spacing], [x, y], [along, away], totalVec);
    const [p, _] = r.getWorldCoordinates();
    const newP = r.alongAway(p, [along, away]);
    const prevHoles = row.getHoles().map(h => [h.id(), h.alongAwayFrom(r)]);
    const c = ol.proj.transform(newP, hole.terrainProvider().dataset().projection(), WebMercator);
    const newHole = row.addHole(c);
    const currentHoles = row.getHoles().map(h => [h.id(), h.alongAwayFrom(r)]);
    console.log('current preve holes', currentHoles, prevHoles);
    this.selectedHole = row.getHoles().findIndex(h => h.id() === newHole.id());
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
    const [p1, p2] = r.getWorldCoordinates();
    // console.log('coordinates in meters', p1, p2);
    // console.log('along/away Vec', alongVec, awayVec, totalVec);

    const newP1 = r.alongAway(p1, [form.along, form.away]);
    const newP2 = r.alongAway(p2, [form.along, form.away]);
    
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
