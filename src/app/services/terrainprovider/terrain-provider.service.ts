import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import * as ol from 'openlayers';
import * as toastr from 'toastr';

import PouchDB from 'pouchdb';

import { DatasetsService } from '../../datasets/datasets.service';

import { TerrainProvider } from '../../models/terrainProvider.model';

import { ProgressCallback, Progress } from '../../util/progress';

import * as fromRoot from '../../reducers';
import { Dataset } from '../../models/dataset.model';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Map } from 'immutable';
import { distinctUntilChanged } from 'rxjs/operators/distinctUntilChanged';
import { Smdjs } from '../../models/smdjs.model';
import { Mtljs } from '../../models/mtljs.model';
import { OSGJSScene } from '../../models/osgjs.model';

import { b64toBlob } from '../../util/b64toBlob';
import { AnnotationManager, AnnotationListener, AnnotationsService } from '../annotations/annotations.service';
import { Map3dService } from '../map-3d.service';
import { Annotation } from '../../models/annotation.model';

const modelDB = new PouchDB('models');

interface FetchModel {
  id: string; // concat of datasetid and modelname so 0_00.osgjs
  dataset_id: string; // concat of dataset id and quality level so 0_100
  mesh: string; // name of model _00.osgjs
  texture: string; // name of texture odm_textured_model_material0000_map_Kd.png,
  meshURL: string; // url to get mesh from if not found.
  textureURL: string;
  textureBlob?: Blob; // fetched blob
  meshBlob?: Blob; // fetched blob
}

interface FetchedModel {
  texture: Blob;
  mesh: OSGJSScene;
}

class StereoscopeAnnotationListener implements AnnotationListener {
  constructor(private terrainProviderService: TerrainProviderService) { }
  
  shouldHandle(annotation: Annotation): boolean {
    return /stereoscope/.test(annotation.type());
  }
  
  onAnnotationFound(annotationId: number, datasetId: number) {
    console.log('FOUND STEREOSCOPE ANNOTATION')
    const manager = new TerrainProviderManager({
      terrain_provider_service: this.terrainProviderService,
      map3d_service: this.terrainProviderService.map3dService,
    });
    const managers = this.terrainProviderService.terrainProviderForDatasetSource.getValue()
      .set(datasetId, manager);
    this.terrainProviderService.terrainProviderForDatasetSource.next(managers);
    return manager;
  }
}

interface ITerrainProviderManager {
  terrain_provider_service: TerrainProviderService;
  map3d_service: Map3dService;
  [k: string]: any;
}
class TerrainProviderManager extends AnnotationManager {
  constructor(props: ITerrainProviderManager) {
    super(props);
  }

  public map3dService(): Map3dService;
  public map3dService(map3d_service: Map3dService): this;
  public map3dService(map3d_service?: Map3dService): Map3dService | this {
    if (map3d_service !== undefined) {
      this.set('map3d_service', map3d_service);
      return this;
    }
    return this.get('map3d_service');
  }

  public terrainProvider(): TerrainProvider;
  public terrainProvider(terrainProvider: TerrainProvider): this;
  public terrainProvider(terrainProvider?: TerrainProvider): TerrainProvider | this {
    if (terrainProvider !== undefined) {
      this.set('terrain_provider', terrainProvider);
      return this;
    }
    return this.get('terrain_provider');
  }

  public terrainProviderService(): TerrainProviderService;
  public terrainProviderService(map3d_service: TerrainProviderService): this;
  public terrainProviderService(map3d_service?: TerrainProviderService): TerrainProviderService | this {
    if (map3d_service !== undefined) {
      this.set('terrain_provider_service', map3d_service);
      return this;
    }
    return this.get('terrain_provider_service');
  }

  public async init() {
    const stereoscopeAnno = this.annotation();
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
        fetch(mtljsResource.url()).then((r) => {
          if (!r.ok) throw r;
          return r.json();
        }),
        fetch(smdjsResource.url()).then((r) => {
          if (!r.ok) throw r;
          return r.json();
        }),
      ]);
    } catch (e) {
      console.warn('Could not get mtljs/smdjs', e, e.text());
      toastr.error(`Could not find 3D model for ${this.dataset().name()}`, 'Dataset Error !');
      return;
    }
    const options = {
      smdjs,
      mtljs,
      smdjsURL: smdjsResource.url(),
      quality: 3,
    };
    const progress = this.terrainProviderService().loadStereoscope(this.dataset(), options);
    console.log('attempting to get terrain provider');
    const terrainProvider = await new Promise<TerrainProvider>((resolve) => {
      if (progress.finalValue()) {
        resolve(progress.finalValue());
      } else {
        progress.once('done', () => {
          resolve(progress.finalValue());
        });
      }
    });
    console.log('got terrian provider', terrainProvider);
    this.terrainProvider(terrainProvider);

    AnnotationManager.prototype.init.call(this);
  }
}

interface IStereoscopeLoader {
  smdjs: Smdjs;
  mtljs: Mtljs;
  smdjsURL: string;
  quality: number;
}

@Injectable()
export class TerrainProviderService {
  terrainProviderForDatasetSource = new BehaviorSubject<Map<number, TerrainProviderManager>>(Map());
  terrainProviderForDataset$ = this.terrainProviderForDatasetSource.asObservable();

  // monitors loaders currently in flight;
  loaders: Map<number, Progress<TerrainProvider>> = Map();
  constructor(private annotationService: AnnotationsService, public map3dService: Map3dService, private store: Store<fromRoot.State>) {
    this.annotationService.registerListener(new StereoscopeAnnotationListener(this));
  }

  public async loadOSGJSTerrainProvider(
    dataset: Dataset, progress: Progress<TerrainProvider>, options: IStereoscopeLoader): Promise<TerrainProvider> {
    const { smdjs, mtljs, smdjsURL, quality } = options;
    console.log('in load osg provider')
    const baseURL = smdjsURL.split('100/_smdjs')[0];
    // Get data for fetching
    const sceneImagePairs: FetchModel[] = smdjs.Meshes.map((mesh) => {
      const texture = mtljs[mesh.split('.osgjs')[0]].map_Kd;
      return {
        id: `${dataset.id()}${mesh}`,
        dataset_id: `${dataset.id()}_100`, // assume quality level of 100 for now.
        mesh,
        texture,
        meshURL: `${baseURL}100/${mesh}`,
        textureURL: `${baseURL}${quality}/${texture}`,
      };
    });

    const models = await this.fetchModel(sceneImagePairs, progress);
    if (!models) {
      throw new Error('Cannot find models');
    }
    // Clear out the texture path so osgjs doesn't attempt to fetch them.
    models.forEach((model) => {
      const jdata = model.mesh;
      // literally why is this the code
      // tslint:disable-next-line:max-line-length
      if (jdata['osg.Node'].Children[0]['osg.Node'].Children[0]['osg.Node'].Children[0]['osg.Geometry'].StateSet['osg.StateSet'].TextureAttributeList !== undefined) {
        // tslint:disable-next-line:max-line-length
        const texture = model.texture;
        const url = URL.createObjectURL(texture);
        // tslint:disable-next-line:max-line-length
        jdata['osg.Node'].Children[0]['osg.Node'].Children[0]['osg.Node'].Children[0]['osg.Geometry'].StateSet['osg.StateSet'].TextureAttributeList[0][0]['osg.Texture'].File = url;
        // delete jdata['osg.Node'].Children[0]['osg.Node'].Children[0]['osg.Node'].Children[0]['osg.Geometry'].StateSet['osg.StateSet'].TextureAttributeList;
      }

      // tslint:disable-next-line:max-line-length
      if (jdata['osg.Node'].Children[0]['osg.Node'].Children[0]['osg.Node'].Children[0]['osg.Geometry'].StateSet['osg.StateSet'].RenderingHint !== undefined) {
        delete jdata['osg.Node'].Children[0]['osg.Node'].Children[0]['osg.Node'].Children[0]['osg.Geometry'].StateSet['osg.StateSet'].RenderingHint;
      }
    });
    const scenes = [];
    if (progress) {
      progress.details('Assembling model');
      progress.progress(0, models.length);
    }
    try {
      for (let i = 0; i < models.length; i++) {
        const model = models[i];
        if (progress) progress.progress(i);
        scenes.push(await osgDB.parseSceneGraph(model.mesh).then(node => Promise.resolve(node)));
      }
    } catch (e) {
      console.warn('failed to parse output');
      throw e;
    }
    const modelNode = new osg.MatrixTransform();
    osg.Matrix.makeRotate(1.5 * Math.PI, 1.0, 0.0, 0.0, modelNode.getMatrix());
    const mtrans = new osg.MatrixTransform();
    const mnode = new osg.Node();
    modelNode.addChild(mnode);

    // Add all minishes together
    scenes.forEach((scene) => {
      mnode.addChild(scene);
    });

    mtrans.addChild(mnode);
    // TODO: Figure out the parameters per acre of model
    // Creates a KdTree for faster intersections.
    const treeBuilder = new osg.KdTreeBuilder({
      _numVerticesProcessed: 0,
      _targetNumTrianglesPerLeaf: 50,
      _maxNumLevels: 20,
    });
    treeBuilder.apply(modelNode);

    const bbox = mnode.getBoundingBox();
    const center = osg.Vec3.create();
    bbox.center(center);
    osg.Matrix.setTrans(mtrans.getMatrix(), -center[0], -center[1], -center[2]);
    const provider = this.map3dService.getProviderForDataset(dataset);
    provider.dataset(dataset);
    provider.modelNode(modelNode);
    provider.quality(3);
    progress.done(provider);
    return provider;
  }

  public loadStereoscope(dataset: Dataset, loadOptions: IStereoscopeLoader): Progress<TerrainProvider> {
    const exist = this.loaders.get(dataset.id());
    if (exist) {
      console.log('early exit')
      return exist;
    }
    const progress = new Progress<TerrainProvider>({
      stage: `Getting Terrain`,
      details: `Fetching for dataset: ${dataset.name() || dataset.id()}`,
      index: 0,
      length: 1,
    });
    progress.once('done', () => {
      console.log('progress done');
      this.loaders = this.loaders.set(dataset.id(), null);
    });
    this.loaders = this.loaders.set(dataset.id(), progress);
    this.loadOSGJSTerrainProvider(dataset, progress, loadOptions);
    console.log('late exit')
    
    return progress;
  }


  private async fetchModel(modelsToFetch: FetchModel[], progress?: Progress): Promise<FetchedModel[]> {
    // First check pouchdb to determine if model is already in memory
    let found;
    const first = modelsToFetch[0];
    if (progress) {
      progress.details('Checking if model is available offline');
      progress.progress(0, 1);
    }
    try {
      found = await modelDB.get(first.dataset_id, { attachments: true });
      if (progress) {
        progress.details('Model found offline: Loading');
        progress.progress(0, 1);
      }
    } catch (e) {
      if (progress) {
        progress.details('Downloading model');
        progress.progress(0, 1);
      }
    }
    // If not found go through the process of downloading all the images and models.
    if (!found) {
      // Using async for so that 100 request aren't sent at the same time.
      const meshTexturePairs: FetchModel[] = [];
      try {
        for (let i = 0; i < modelsToFetch.length; i++) {
          const toFetch = modelsToFetch[i];
          const [textureBlob, meshBlob] = await Promise.all([
            fetch(toFetch.textureURL).then(r => r.blob()),
            fetch(toFetch.meshURL).then(r => r.blob())
          ]);
          meshTexturePairs.push({ ...toFetch, textureBlob, meshBlob });
          if (progress) {
            progress.progress(i, modelsToFetch.length);
          }
        }
      } catch (e) {
        // console.error(e);
        console.warn('Could not get all models, TODO implement retry');
        return null;
      }
      // Store this stuff in pouchdb for reference.
      // Gen attachments.
      console.log('meshtexturepairs', meshTexturePairs);
      const newAttatchments = meshTexturePairs.reduce((acc, extendedToFetch) => {
        const nameBase = extendedToFetch.mesh.split('.osgjs')[0];
        const textureName = `texture${nameBase}`;
        const meshName = `mesh${extendedToFetch.mesh}`;
        acc[textureName] = {
          content_type: 'image/png',
          data: extendedToFetch.textureBlob,
        };
        acc[meshName] = {
          content_type: 'text/plain',
          data: extendedToFetch.meshBlob,
        };
        return acc;
      }, {});
      // Store
      try {
        await modelDB.put({
          _id: first.dataset_id,
          _attachments: newAttatchments
        });
      } catch (e) {
        console.warn('error in put', e);
        return null;
      }
      try {
        found = await modelDB.get(first.dataset_id, { attachments: true });
      } catch (e) {
        console.warn('error in get', e);
        // Could not store results
        return null;
      }
    }
    // Return array of mesh/texture pairs.
    const attachments = found._attachments;
    const meshNames = Object.keys(attachments).filter(key => /\.osgjs/.test(key));
    // Remove the mesh part of the name. Thats why I slice(5)
    const textureNames = meshNames.map(key => `texture${key.slice(4).split('.osgjs')[0]}`);
    const fetchedModels = meshNames.map((meshName, i) => {
      const textureName = textureNames[i];
      const texture = b64toBlob(attachments[textureName].data, 'image/png');
      const mesh = JSON.parse(atob(attachments[meshName].data));
      return {
        texture,
        mesh
      };
    });
    return fetchedModels;
  }

}
