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

import { stopViewer } from '../util/getosgjsworking';
import { LonLat } from '../util/projections/index';

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
      this.setView();
    });
    // Get terrain providers
    let unsubProviders = [];
    this.terrainProviderService.providers.subscribe((providers) => {
      this.providers = providers;
      if (!providers) return;
      unsubProviders.forEach(off => off());
      unsubProviders = [];
      this.providers.forEach((provider) => {
        this.sceneRoot.addChild(provider.rootNode());
        unsubProviders.push(listenOn(provider, 'change:model_node', (thing1, thing2, thing3) => {
          this.sceneRoot.addChild(provider.rootNode());
          const bb = provider.modelNode().getBoundingBox();
          const center = ol.proj.transform(provider.dataset().mapData().Center, provider.dataset().mapData().Projection, LonLat);
          const isZeroZero = ol.proj.transform(center, LonLat, provider.dataset().projection());
          const centerPoint = provider.getWorldPoint(
            provider.dataset().mapData().Center,
            provider.dataset().mapData().Projection,
          );
          console.log('center', centerPoint);
          this.setView();
        }));
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

  private _setView(coord?) {
    if (!coord) {
      if (this.map3DViewer) {
        this.map3DViewer.getManipulator().computeHomePosition();
      }
      return;
    }
    if (this.map2DViewer) {
      this.map2DViewer.getView().setCenter(coord);
    }
    if (this.map3DViewer) {
      this.map3DViewer.getManipulator().computeHomePosition();
    }
  }

  setView(coord?) {
    if (coord) {
      this._setView(coord);
    } else {
      if (this.datasets) {
        const coords = this.datasets
          .filter(d => !d.isPhantom())
          .map(d => ol.proj.fromLonLat([d.long(), d.lat()]))
          .toJS();
        const bounds = ol.extent.boundingExtent(coords);
        this._setView(ol.extent.getCenter(bounds));
      } else {
        this._setView();
      }
    }
  }

  destroyOpenlayers() {
    if (this.map2DViewer) {
      this.map2DViewer.setTarget(null);
      this.map2DViewer = null;
    }
  }
  initOpenlayers(container: HTMLElement) {
    this.destroyOpenlayers();
    this.map2DViewer = new ol.Map({
      target: container,
      loadTilesWhileAnimating: true,
      loadTilesWhileInteracting: true,
      layers: [
        this.osmLayer
      ],
      view: new ol.View({ center: ol.proj.fromLonLat([0, 0]), zoom: 4}),
      controls: ol.control.defaults({ attribution: false })
    });
    this.setView();
  }

  destroyOsgjs() {
    if (this.map3DViewer) {
      stopViewer(this.map3DViewer);
      this.map3DViewer = null;
    }
  }

  initOsgjs(container: HTMLElement) {
    this.destroyOsgjs();
    container.addEventListener('webglcontextlost', (event) => {
      console.log('context lost', event);
    });
    this.map3DViewer = new osgViewer.Viewer(container);
    this.map3DViewer.init();
    this.map3DViewer.setSceneData(this.sceneRoot);
    this.map3DViewer.setupManipulator();
    this.map3DViewer.run();
    this.setView();
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

    this.map2DViewer = new ol.Map({
      target: map2D,
      loadTilesWhileAnimating: true,
      loadTilesWhileInteracting: true,
      layers: [
        this.osmLayer,
        this.sateliteLayer,
        this.emptyLayer
      ],
      view: new ol.View({ center: ol.proj.fromLonLat([0, 0]), zoom: 4 }),
      controls: ol.control.defaults({ attribution: false }),
    });
  }

  destroy() {
    this.destroyOpenlayers();
    this.destroyOsgjs();
  }

  async updateTerrainProviderFromAnnotations(dataset: Dataset, annotations: Annotation[]) {
    const stereoscopeAnno = annotations.find(anno => anno.type() === 'stereoscope');
    if (!stereoscopeAnno) {
      console.warn('No stereoscope annotation found');
      return;
    }
    console.log('stereoscopeAnno', stereoscopeAnno.getProperties());
    const mtljsResource = stereoscopeAnno.resources().find(r => r.type() === 'mtljs');
    const smdjsResource = stereoscopeAnno.resources().find(r => r.type() === 'smdjs');
    if (!(mtljsResource && smdjsResource)) {
      console.warn('No mtljs/smdjs resources found');
      return;
    }
    let mtljs;
    let smdjs;
    try {
      [
        mtljs,
        smdjs
      ] = await Promise.all([
        fetch(mtljsResource.url()).then(r => r.json()),
        fetch(smdjsResource.url()).then(r => r.json()),
      ]);
    } catch (e) {
      console.error(e);
      return;
    }

    const provider = this.providers.get(dataset.id());
    const progress = this.terrainProviderService.loadTerrain(provider, smdjs, mtljs, smdjsResource.url(), 3);
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
