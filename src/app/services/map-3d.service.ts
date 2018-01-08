import { Injectable } from '@angular/core';

import * as ol from 'openlayers';

import { DatasetsService } from '../datasets/datasets.service';
import { TerrainProviderService } from './terrainprovider/terrain-provider.service';
import { memoize } from 'lodash';

import { environment } from '../../environments/environment';
import { Dataset } from '../models/dataset.model';
import { Site } from '../models/site.model';
import { SitesService } from '../sites/sites.service';
import { isNumeric } from 'rxjs/util/isNumeric';
import { List, Map } from 'immutable';

import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/first';
import 'rxjs/add/operator/filter';
import { TerrainProvider } from '../models/terrainProvider.model';
import { Annotation } from '../models/annotation.model';
import { listenOn } from '../util/listenOn';

// using numbers now
// Use weakmap so we don't run into garbabe collection issues.
// memoize.Cache = (WeakMap as any);

// Map3d Service handles syncing of 2D and 3D views
@Injectable()
export class Map3dService {

  map3DViewer: osgViewer.Viewer;
  sceneRoot: osg.Node;
  map2DViewer: ol.Map;

  sateliteLayer: ol.layer.Tile;
  osmLayer: ol.layer.Tile;
  emptyLayer: ol.layer.Tile;
  phantomGroup: ol.layer.Group;

  mainSite: Site;
  mainDataset: Dataset;
  datasets: List<Dataset>;
  providers: Map<number, TerrainProvider>;

  private _groupForDataset: (id: number) => ol.layer.Group;
  constructor(private sitesService: SitesService,
    private datasetsService: DatasetsService, private terrainProviderService: TerrainProviderService) {
    
    this.sceneRoot = new osg.Node();
    
    // tslint:disable-next-line:max-line-length
    const mapboxEndpoint = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/{z}/{x}/{y}?access_token=${environment.mapbox_key}'`;
    this.sateliteLayer = new ol.layer.Tile({
      visible: true,
      source: new ol.source.XYZ({
        url: mapboxEndpoint,
      })
    });

    this.sateliteLayer.set('title', 'Satelite View');
    this.sateliteLayer.set('type', 'base');

    this.osmLayer = new ol.layer.Tile({
      visible: true,
      source: new ol.source.OSM(),
    });

    this.osmLayer.set('title', 'Street View');
    this.osmLayer.set('type', 'base');

    this.emptyLayer = new ol.layer.Tile({
      source: null,
    });

    this.emptyLayer.set('title', 'No Base Map');
    this.emptyLayer.set('type', 'base');

    // Bind stuff.
    this.phantomGroup = this.getGroupForDataset(0);
    
    // Get sites
    this.sitesService.mainSite.subscribe((mainSite) => {
      this.mainSite = mainSite;
    });
    // Get datasets
    this.datasetsService.datasets.subscribe((datasets) => {
      this.datasets = datasets;
      this.datasets.forEach((dataset) => {
        const group = this.getGroupForDataset(dataset.id());
        group.set('title', dataset.name());
      });
    });
    // Get terrain providers
    this.terrainProviderService.providers.subscribe((providers) => {
      this.providers = providers;
      if (!providers) return;
      this.providers.forEach((provider) => {
        this.sceneRoot.addChild(provider.rootNode());
        const off = listenOn(provider, 'change:model_node', (thing1, thing2, thing3) => {
          console.log('args', thing1, thing2, thing3);
          this.sceneRoot.addChild(provider.rootNode());
          (this.map3DViewer as any).getManipulator().computeHomePosition();
          off();
        });
      });
    });

    // Get main Dataset
    this.datasetsService.mainDataset.subscribe(async (mainDataset) => {
      this.mainDataset = mainDataset;
      if (!mainDataset) return;
      this.terrainProviderService.makeProvidersForDatasets([mainDataset]);

      const fetchAnnotationsForMainDataset = () => {
        this.updateTerrainProviderFromAnnotations(this.mainDataset, this.mainDataset.annotations());
      };

      if (mainDataset.annotations()) {
        fetchAnnotationsForMainDataset();
      } else {
        const progress = await this.datasetsService.loadAnnotations(mainDataset);
        if (progress.isDone()) {
          console.log('already done');
        } else {
          const off = listenOn(progress, 'change:progress', () => {
            if (progress.isDone()) {
              fetchAnnotationsForMainDataset();
              off();
            }
          });
        }
      }
    });
  }

  // Called by components
  init(map2D: HTMLElement, map3D: HTMLElement) {
    // Initialize 3D stuff
    this.map3DViewer = new osgViewer.Viewer(map3D);
    this.map3DViewer.init();
    this.map3DViewer.setSceneData(this.sceneRoot);
    this.map3DViewer.setupManipulator();
    this.map3DViewer.run();

    // Add Providers

    // this.map2DViewer = new ol.Map({
    //   target: map2D,
    //   loadTilesWhileAnimating: true,
    //   loadTilesWhileInteracting: true,
    //   layers: [
    //     this.osmLayer,
    //     // this.sateliteLayer,
    //     // this.emptyLayer
    //   ],
    //   view: new ol.View({ center: ol.proj.fromLonLat([0, 0]) }),
    //   controls: ol.control.defaults({ attribution: false }),
    // });
  }

  destroy() {
    this.sceneRoot.removeChildren();
    this.map3DViewer.contextLost();
    this.sceneRoot = new osg.Node();
  }

  async updateTerrainProviderFromAnnotations(dataset: Dataset, annotations: Annotation[]) {
    const stereoscopeAnno = annotations.find(anno => anno.type() === 'stereoscope');
    if (!stereoscopeAnno) {
      console.warn('No stereoscope annotation found');
      return;
    }
    const mtljsResource = stereoscopeAnno.resources().find(r => r.type() === 'mtljs');
    const smdjsResource = stereoscopeAnno.resources().find(r => r.type() === 'smdjs');
    if (!(mtljsResource && smdjsResource)) {
      console.warn('No mtljs/smdjs resources found');
      return;
    }

    let mtljs;
    let smdjs;
    try {
      mtljs = await fetch(mtljsResource.url()).then(r => r.json());
      smdjs = await fetch(smdjsResource.url()).then(r => r.json());
    } catch (e) {
      console.error(e);
      return;
    }

    const provider = this.providers.get(dataset.id());
    const progress = this.terrainProviderService.loadTerrain(provider, smdjs, mtljs, smdjsResource.url(), 3);
    progress.on('change:progress', () => {
      console.log('ON PROGRESS', progress.getProperties());
    });
  }

  private getGroupForDataset(dataset: Dataset | number): ol.layer.Group {
    if (!this._groupForDataset) {
      this._groupForDataset = memoize((id: number) => {
        return new ol.layer.Group({
          layers: new ol.Collection([]),
        });
      });
    }
    if (isNumeric(dataset)) {
      return this._groupForDataset(dataset);
    }
    return this._groupForDataset(dataset.id());
  }
}
