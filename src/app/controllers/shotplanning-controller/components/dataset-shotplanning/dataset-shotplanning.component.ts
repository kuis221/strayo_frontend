import { Component, OnInit, OnDestroy, Input } from '@angular/core';

import { filter, first } from 'rxjs/operators';

import { Shotplan, IShotplan } from '../../../../models/shotplan.model';
import { Dataset } from '../../../../models/dataset.model';
import { listenOn } from '../../../../util/listenOn';
import { subscribeOn } from '../../../../util/subscribeOn';
import { TerrainProvider } from '../../../../models/terrainProvider.model';
import { TerrainProviderService } from '../../../../services/terrainprovider/terrain-provider.service';
import { IAnnotation } from '../../../../models/annotation.model';

@Component({
  selector: 'app-dataset-shotplanning',
  templateUrl: './dataset-shotplanning.component.html',
  styleUrls: ['./dataset-shotplanning.component.css']
})
export class DatasetShotplanningComponent implements OnInit, OnDestroy {
  @Input() dataset: Dataset;
  provider: TerrainProvider;
  shotplan: Shotplan;

  off: Function;
  constructor(private terrainProviderService: TerrainProviderService) {}

  ngOnInit() {
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
    });

    this.off = subscribeOn(sub);
  }

  ngOnDestroy() {
    this.off();
  }

}
