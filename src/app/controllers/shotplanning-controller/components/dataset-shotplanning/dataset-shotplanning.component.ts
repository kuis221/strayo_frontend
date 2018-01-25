import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ValidatorFn, AbstractControl } from '@angular/forms';

import * as ol from 'openlayers';
import { filter, first, switchMap, map, tap } from 'rxjs/operators';
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
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { debounce } from 'rxjs/operators/debounce';
import { debounceTime } from 'rxjs/operators/debounceTime';
import { distinctUntilChanged } from 'rxjs/operators/distinctUntilChanged';
import { ShotplansService } from '../../../../services/shotplans/shotplans.service';

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
  shotplan: Shotplan;
  shotplanLayer: ol.layer.Vector;
  off: Function[] = [];

  selectedRow = -1;
  selectedRowNumberSource = new BehaviorSubject<number>(this.selectedRow);
  selectedRowNumber$ = this.selectedRowNumberSource.asObservable();
  selectedShotplanRow$: Observable<ShotplanRowFeature>;

  selectedHole = -1;
  selectedHoleNumberSource = new BehaviorSubject<number>(this.selectedHole);
  selectedHoleNumber$ = this.selectedHoleNumberSource.asObservable();
  selectedShotplanHole$: Observable<[ShotplanRowFeature, ShotplanHole]>;

  showHoleForm = false; // show the forms related to holes
  showAngle = false; // show the angle form
  showEndpoints = false; // show the endpoints form
  endpointOffsetTab: 'offset' | 'endpoint' = 'offset';
  modifyEndpointsInteraction: ol.interaction.Modify;

  newRowForm: FormGroup;
  newHoleForm: FormGroup;
  holePositionForm: FormGroup;
  holeAngleForm: FormGroup;

  formsSub: Function[] = [];
  constructor(private map3dService: Map3dService, private shotplansService: ShotplansService, private fb: FormBuilder) {}

  ngOnInit() {
    
    const sub = this.shotplansService.shotplansForDataset$.pipe(
      filter(managers => !!managers.get(this.dataset.id())),
      map(managers => managers.get(this.dataset.id())),
      filter(manager => !manager.isEmpty()),
      map(manager => manager.get(manager.keySeq().first())) 
    ).subscribe(async (manager) => {
      if (manager.shotplan()) {
        this.shotplan = manager.shotplan();
        this.setupShotplan();
      } else {
        manager.on('init', () => {
          this.shotplan = manager.shotplan();
          this.setupShotplan();
        });
      }
    });

    this.off.push(subscribeOn(sub));
  }

  alongAwayDistance(along: number, away: number) {
    return Math.sqrt((along**2) + (away**2)); //for template
  }

  boundsCheck(point: ol.Coordinate) {
    const bounds = this.shotplan.terrainProvider().getWorldBounds();
    if (
      (point[0] < bounds._min[0]) ||
      (point[0] > bounds._max[0]) || 
      (point[1] < bounds._min[1]) ||
      (point[1] > bounds._max[1])
    ) {
      return false;
    }
    return true;
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
  
    this.holePositionForm = this.fb.group({
      lineStartAlong: [0, Validators.required],
      lineStartAway: [0, Validators.required],
      lineEndAlong: [0, Validators.required],
      lineEndAway: [0, Validators.required]
    })

    this.holeAngleForm = this.fb.group({
      bearing: [0, Validators.required],
      inclination: [0, Validators.required]
    })

    this.formsSub.forEach((sub) => sub());
    this.formsSub = [];

    // main update for hole
    const holeupdate = this.selectedShotplanHole$.subscribe(([row, hole]) => {
      console.log("in selectedShotplanHole subscription")
      const [bearing, inclination] = row.getBearingAndInclination(hole);
      const r = row.getRow();
      const [lineStartAlong, lineStartAway] = hole.alongAwayFrom(r);
      // get end away
      const rowLength = r.getLength();
      const lineEndAlong = lineStartAlong - rowLength;

      this.holeAngleForm.reset({
        bearing,
        inclination
      });

      this.holePositionForm.reset({
        lineStartAlong,
        lineStartAway,
        lineEndAlong,
        lineEndAway: lineStartAway,
      });
    });
    this.selectedShotplanHole$.pipe(
      switchMap(([row, hole]) => 
      this.holePositionForm.get('lineStartAlong').valueChanges.pipe(
        distinctUntilChanged(),
        debounceTime(500),
        map((newAlong: number) => ({row, hole, newAlong}))
      ))
    )
    .subscribe(({row, hole, newAlong}) => {
      if (this.holePositionForm.pristine) return;
      if (isNaN(newAlong) || !isFinite(newAlong)) return;
      if (this.selectedRow === -1 || this.selectedHole === -1) return;
      if (!row || !hole) {
        throw new Error('Unexpected error. row and hole do not exist');
      }
      const prevCoords = hole.getFirstCoordinate();
      console.log('prevCoords', prevCoords);
      const r = row.getRow();
      const [oldAlong, away] = hole.alongAwayFrom(r);
      console.log('prevAlongAway', [oldAlong, away]);
      const [p] = hole.getWorldCoordinates();
      const newPoint = r.alongAway(p, [newAlong, away]);
      console.log('newPoint', newPoint)
      const oldPoint = r.alongAway(p, [oldAlong, away]);
      console.log('oldPoint', oldPoint);
      // Check bounds
      if (!this.boundsCheck(newPoint)) {
        console.warn('points outside of bounds', newPoint, this.shotplan.terrainProvider().getWorldBounds());
        return;
      }
      this.holePositionForm.markAsPristine();
      const newCoord = ol.proj.transform(newPoint, this.shotplan.terrainProvider().dataset().projection(), WebMercator);
      console.log('newCoord', newCoord);
      const [bearing, inclination] = row.getBearingAndInclination(hole);
      hole.setCoordinates([newCoord, hole.getToeCoord()], hole.getLayout());
      console.log('currentCoord', hole.getFirstCoordinate());
      hole.forceUpdate();
      row.updateToe(hole, bearing, inclination);
      this.holePositionForm.markAsPristine();
      this.map3dService.map2DViewer.renderSync();
    });

    this.formsSub.push(subscribeOn(holeupdate));
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
    console.log('spacing', [direction, form.spacing], [x, y], [along, away]);
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
    this.selectedRowNumberSource.next(this.selectedRow);
  }

  selectHole(hole: number) {
    if (this.selectedHole === hole) {
      this.selectedHole = -1;
    } else {
      this.selectedHole = hole;
    }
    this.selectedHoleNumberSource.next(this.selectedHole);
  }

  selectEndpointOffsetTab(tab) {
    this.endpointOffsetTab = tab;
    setTimeout(() => {
      $('.tabCont').slideDown(300);
    }, 200);

    console.log('selct tab', tab);
  }

  setShowEndpoints(showEndpoints: boolean) {
    this.showEndpoints = showEndpoints;
    this.selectEndpointOffsetTab(this.endpointOffsetTab);
  }

  setupShotplan() {
    console.log('shotplan', this.shotplan, this.shotplan.data());
    // Add subscription
    this.selectedShotplanRow$ = this.shotplan.rows$.pipe(
      switchMap((rows) => {
        return this.selectedRowNumber$.map((selectedRow) => {
          return rows && rows[selectedRow]
        })
      })
    );
    // Nested observables are fun
    this.selectedShotplanHole$ = this.shotplan.rows$.pipe(
      switchMap((rows) => {
        return this.selectedRowNumber$.pipe(
          map((selectedRow) => rows && rows[selectedRow]),
          filter((row) => !!row),
          switchMap((row) => {
            return row.holes$.pipe(
              switchMap((holes) => {
                return this.selectedHoleNumber$.pipe(
                  map((selectedHole) => holes && holes[selectedHole]),
                  filter((hole) => !!hole),
                  switchMap((hole) => {
                    return hole.update.pipe(
                      tap((update) => {
                        console.log('row hole', row, update);
                        console.log('data', this.shotplan.data());
                      }),
                      map((update) => ([row, update] as [ShotplanRowFeature, ShotplanHole]))
                    )
                  })
                )
              })
            )
          })
        )
      })
    ) ;
    // Testing hole subscription
    this.selectedShotplanHole$.subscribe((hole) => {
      console.log('GETTING SELECTED HOLE', hole);
    });
    // create the forms
    this.createForms();

    // Create the layers
    if (this.shotplanLayer) {
      this.map3dService.deregisterLayer(this.shotplanLayer, this.dataset);
    }
    this.shotplanLayer = this.makeLayerFromShotplan(this.shotplan);
    this.map3dService.registerLayer(this.shotplanLayer, this.dataset);

    // For debugging
    this.shotplan.rows$.pipe(
      switchMap((rows) => {
        const holes$ = rows.map(r => r.holes$);
        return Observable.merge(...holes$);
      })
    ).subscribe((holes) => {
      console.log('hole update', holes.map(h => h.id()))
    });
  }

  ngOnDestroy() {
    this.off.forEach(off => {
      off();
    });
  }

}
