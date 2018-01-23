import { Component, OnInit, OnDestroy, Input, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { filter, map } from 'rxjs/operators';

import { Dataset } from '../../../../models/dataset.model';
import { listenOn } from '../../../../util/listenOn';
import { Annotation } from '../../../../models/annotation.model';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { TerrainProvider } from '../../../../models/terrainProvider.model';
import { TerrainProviderService } from '../../../../services/terrainprovider/terrain-provider.service';
import { Map } from 'immutable';
import { Map3dService } from '../../../../services/map-3d.service';
import { subscribeOn } from '../../../../util/subscribeOn';
import { MeasurementsService, MeasurementAnnotationManager } from '../../../../services/measurements/measurements.service';

interface IAnnotationOption {
  ready: boolean;
  checked?: boolean;
  manager?: MeasurementAnnotationManager;
  onChecked?: (boolean) => void;
}

@Component({
  selector: 'app-dataset-annotations',
  templateUrl: './dataset-annotations.component.html',
  styleUrls: ['./dataset-annotations.component.css']
})
export class DatasetAnnotationsComponent implements OnInit, OnDestroy {
  @Input() dataset: Dataset;
  providers: Map<number, TerrainProvider>;

  private optionsSource = new BehaviorSubject<IAnnotationOption[]>([]);
  options$ = this.optionsSource.asObservable();
  off: Function[] = [];
  optionListeners: Function[] = [];
  annotationOff: Function;
  @ViewChild('annotationList', { read: ElementRef }) annotationList: ElementRef;
  constructor(
    private measurementsService: MeasurementsService,
    private map3DService: Map3dService,
    private cd: ChangeDetectorRef) { }

  ngOnInit() {
    const measureListen = this.measurementsService.measurementsForDatasets$.pipe(
      filter((managers) => {
        return !!managers.get(this.dataset.id());
      }),
      map((managers) => managers.get(this.dataset.id()))
    )
    .subscribe((managers) => {
      this.optionListeners.forEach(off => off());
      const options: IAnnotationOption[] = managers.map((manager) => {
        const option: IAnnotationOption = {
          ready: false,
          onChecked: (check) => {
            console.log('checking', check);
            manager.layer().setVisible(check);
            manager.selectionLayer().setVisible(check);
          }
        } as any;
        const setup = () => {
          option.manager = manager,
          option.checked = manager.layer().getVisible(),
          option.ready = true;
          this.optionListeners.push(listenOn(manager.layer(), 'change:visible', () => {
            option.checked = manager.layer().getVisible();
            this.cd.markForCheck();
          }));
        };
        if (manager.isInit()) {
          setup();
        } else {
          const initListener = listenOn(manager, 'init', setup);
          this.optionListeners.push(initListener);
        }
        return option;
      }).toArray();
      console.log('options', options);

      this.optionsSource.next(options);
    });
  }

  ngOnDestroy() {
    this.off.forEach(off => off());
    this.optionListeners.forEach(off => off());
  }

  toggle(show) {
    if (show) {
      $(this.annotationList.nativeElement).slideDown(300);
    } else {
      $(this.annotationList.nativeElement).slideUp(300);
    }
  }
}
