import { Injectable, ElementRef } from '@angular/core';

import * as ol from 'openlayers';

import { DatasetsService } from '../datasets/datasets.service';
import { memoize, uniqBy } from 'lodash';

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
import { LonLat, WebMercator } from '../util/projections/index';
import { withStyles } from '../util/layerStyles';
import { featureToNode, transformMat4 } from '../util/osgjsUtil';
import { featureToOSGJS } from '../util/osgjsUtil/olToOSGJS';
import { waitForMap } from '@angular/router/src/utils/collection';

// using numbers now
// Use weakmap so we don't run into garbabe collection issues.
// memoize.Cache = (WeakMap as any);

// Map3d Service handles syncing of 2D and 3D views

let GlobalDraw: ol.interaction.Draw;
let currentElementInGetOSGJS; // Probably the worse hack i've ever done but it will work as long 
// as this never gets put into a webworker.

@Injectable()
export class Map3dService {

  map3DViewer: osgViewer.Viewer;
  sceneRoot: osg.Node;
  map2DViewer: ol.Map;

  sateliteLayer: ol.layer.Tile;
  osmLayer: ol.layer.Tile;
  emptyLayer: ol.layer.Tile;
  baseLayers: ol.layer.Group;

  mainSite: Site;
  mainDataset: Dataset;
  datasets: List<Dataset>;

  toolTip: ElementRef;

  private _groupForDataset: (id: number) => ol.layer.Group;
  private _osgjsForDataset: (id: number) => osgViewer.Viewer;
  private _providerForDataset: (id: number) => TerrainProvider;
  private allLayers = new ol.Collection<ol.layer.Group | ol.layer.Layer>();
  private allInteractions = new ol.Collection<ol.interaction.Interaction>([]);
  private view = new ol.View({ center: ol.proj.fromLonLat([37.41, 8.82]), zoom: 4 });

  constructor(private sitesService: SitesService,
    private datasetsService: DatasetsService) {
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
    this.sateliteLayer.set('group', 'base');

    this.osmLayer = new ol.layer.Tile({
      visible: true,
      source: new ol.source.OSM(),
    });

    this.osmLayer.set('title', 'Street View');
    this.osmLayer.set('group', 'base');

    this.emptyLayer = new ol.layer.Tile({
      source: null,
    });

    this.emptyLayer.set('title', 'No Base Map');
    this.emptyLayer.set('group', 'base');

    this.baseLayers = new ol.layer.Group({
      layers: [
        this.osmLayer,
      ]
    }
    );
    this.baseLayers.set('title', 'Base Layers');

    this.addLayer(this.baseLayers);

    // Get sites
    this.sitesService.mainSite.subscribe((mainSite) => {
      this.mainSite = mainSite;
    });
    // Get datasets
    this.datasetsService.selectedDatasets.subscribe((datasets) => {
      this.datasets = datasets;
      this.datasets.forEach((dataset) => {
        const group = this.getGroupForDataset(dataset.id());
        group.set('title', dataset.name());
        this.addLayer(group);

        // const provider = this.getProviderForDataset(dataset.id());
        // this.sceneRoot.addChild(provider.rootNode());
      });
    });

    // Get selected datasets
    this.datasetsService.selectedDatasets.subscribe(async (datasets) => {
      if (datasets.count() === 0) return;

      await Promise.all(datasets.map(dataset => dataset.waitForMapData()).toArray());
      const boundingExtent = datasets.reduce<ol.Extent>((acc, dataset) => {
        const extent = dataset.calcExtent();
        return ol.extent.boundingExtent([
          ol.extent.getBottomLeft(acc),
          ol.extent.getTopRight(acc),
          ol.extent.getBottomLeft(extent),
          ol.extent.getTopRight(extent),
        ]);
      }, datasets.get(0).calcExtent());
      this.setExtent(boundingExtent);
    });

    // Get main dataset
    this.datasetsService.mainDataset.subscribe((dataset) => {
      if (!dataset) return;
      const provider = this.getProviderForDataset(dataset);
      this.sceneRoot.removeChildren();
      this.sceneRoot.addChild(provider.rootNode());
    });
  }

  addInteraction(interaction: ol.interaction.Interaction) {
    const exist = this.allInteractions.getArray().includes(interaction);
    if (exist) {
      console.warn('attempting to add the same interaction twice');
      return;
    }
    this.allInteractions.push(interaction);
    this.map2DViewer.addInteraction(interaction);
  }

  addLayer(layer: ol.layer.Group | ol.layer.Layer) {
    const title = layer.get('title');
    if (!title) {
      console.warn('warning layer has no title');
    }
    const layers = uniqBy([...this.allLayers.getArray(), layer], (l) => l.get('title'));
    this.allLayers.clear();
    this.allLayers.extend(layers);
  }

  deregisterLayer(layer: ol.layer.Tile | ol.layer.Vector, dataset: Dataset) {
    const group = this.getGroupForDataset(dataset.id());
    group.getLayers().remove(layer);
  }

  destroy() {
    this.destroyOpenlayers();
    this.destroyOsgjs();
  }

  destroyOsgjs() {
    if (this.map3DViewer) {
      stopViewer(this.map3DViewer);
      this.map3DViewer = null;
    }
  }


  destroyOpenlayers() {
    if (this.map2DViewer) {
      this.map2DViewer.setTarget(null);
      this.map2DViewer = null;
    }
  }

  public getGroupForDataset(dataset: Dataset | number): ol.layer.Group {
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

  public getProviderForDataset(dataset: Dataset | number): TerrainProvider {
    if (!this._providerForDataset) {
      this._providerForDataset = memoize((id: number) => {
        return new TerrainProvider();
      });
    }
    if (isNumeric(dataset)) {
      return this._providerForDataset(dataset);
    }
    return this._providerForDataset(dataset.id());
  }

  public setGlobalDraw(draw: ol.interaction.Draw): ol.interaction.Draw {
    if (GlobalDraw) {
      this.removeInteraction(GlobalDraw);
    }
    GlobalDraw = draw;
    return GlobalDraw;
  }

  initOpenlayers(container: HTMLElement) {
    // this.destroyOpenlayers();
    this.map2DViewer = this.map2DViewer || new ol.Map({
      target: container,
      loadTilesWhileAnimating: true,
      loadTilesWhileInteracting: true,
      layers: this.allLayers,
      view: this.view,
      // controls: [new ol.control.Zoom()],//ol.control.defaults({ attribution: false })
    });
  }

  initOsgjs(container: HTMLElement) {
    if (this.map3DViewer) return;
    container.addEventListener('webglcontextlost', (event) => {
      console.log('context lost', event);
    });
    this.map3DViewer = new osgViewer.Viewer(container);
    this.map3DViewer.init();
    this.map3DViewer.setSceneData(this.sceneRoot);
    this.map3DViewer.setupManipulator();
    this.map3DViewer.setLightingMode(osgViewer.View.LightingMode.HEADLIGHT);
	
    this.map3DViewer.run();
    this.map3DViewer.getManipulator().computeHomePosition();
  }

  registerLayer(layer: (ol.layer.Tile | ol.layer.Vector), dataset: Dataset) {
    const title = layer.get('title');
    if (!title) {
      console.warn('warning layer has no title');
    }
    if (layer instanceof ol.layer.Vector) {
      const style = layer.getStyle();
      const newStyle = withStyles(withStyles(style, dataset.overwriteStyle()));
      layer.setStyle(newStyle);
      const provider = this.getProviderForDataset(dataset);
      const getWorldPoint = provider.getWorldPoint.bind(provider);
      const featureNode = layer.getSource().getFeatures().reduce<osg.Node>((acc, feature) => {
        const featureNode = featureToOSGJS(newStyle, feature, getWorldPoint);
        acc.addChild(featureNode);
        return acc;
      }, new osg.Node);
      console.log('featurenode', featureNode);
      this.registerNode(featureNode, dataset);
    }
    const group = this.getGroupForDataset(dataset.id());
    const exist = group.getLayers().getArray().includes(layer);
    if (exist) {
      console.warn('attempting to add a layer twice');
      return;
    }
    group.getLayers().push(layer);
  }

  registerNode(node: osg.Node | osg.MatrixTransform, dataset: Dataset) {
    const provider = this.getProviderForDataset(dataset);
    provider.rootNode().addChild(node);
    if (this.map3DViewer) this.map3DViewer.getManipulator().computeHomePosition();
  }

  removeInteraction(interaction: ol.interaction.Interaction) {
    this.allInteractions.remove(interaction);
    this.map2DViewer.removeInteraction(interaction);
  }

  setExtent(extent: ol.Extent) {
    if (this.map2DViewer) {
      this.view.fit(extent);
    }
  }
}
