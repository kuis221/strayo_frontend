import { Component, OnInit, ViewChild, ElementRef, Input, NgZone, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatasetsService } from '../../datasets/datasets.service';
import { TerrainProviderService } from '../../services/terrainprovider/terrain-provider.service';
import { Dataset } from '../../models/dataset.model';
import { Annotation } from '../../models/annotation.model';

import { switchMap, map } from 'rxjs/operators';
import { Map } from 'immutable';
import { TerrainProvider } from '../../models/terrainProvider.model';
import { Map3dService } from '../../services/map-3d.service';

@Component({
  selector: 'app-map-3d',
  templateUrl: './map-3d.component.html',
  styleUrls: ['./map-3d.component.css']
})
export class Map3dComponent implements OnInit, OnDestroy {
  @ViewChild('openlayers', { read: ElementRef }) map2D: ElementRef;
  @ViewChild('osgjs', { read: ElementRef }) map3D: ElementRef;
  @Input() show = 'map2D';

  constructor(private http: HttpClient, private map3DService: Map3dService) { }

  ngOnInit() {
    this.map3DService.init(this.map2D.nativeElement, this.map3D.nativeElement);
  }

  ngOnDestroy() {
    this.map3DService.destroy();
  }
}
