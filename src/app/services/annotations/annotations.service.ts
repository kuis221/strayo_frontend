import { Injectable } from '@angular/core';
import { memoize } from 'lodash';
import uuid from 'uuid/v4';
import { DatasetsService } from '../../datasets/datasets.service';
import { Dataset } from '../../models/dataset.model';
import { Annotation } from '../../models/annotation.model';
import { List } from 'immutable';
import { listenOn } from '../../util/listenOn';

type OnAnnotationFound = (annotationId: number, datasetId: number) => AnnotationManager;

export interface AnnotationListener {
  annotationType: () => string;
  onAnnotationFound: (annotationId: number, datasetId: number) => AnnotationManager;
}

// !NOTE AnnotationManagers are cached. destroy could be called on a manager, and
// init could be called several minutes later.

export class AnnotationManager extends ol.Object {

  constructor(props) {
    super(props);
    this.id(this.id() || uuid());
  }
  public annotation(): Annotation;
  public annotation(annotation: Annotation): this;
  public annotation(annotation?: Annotation): Annotation | this {
    if (annotation !== undefined) {
      this.set('annotation', annotation);
      return this;
    }
    return this.get('annotation');

  }

  public dataset(): Dataset;
  public dataset(dataset: Dataset): this;
  public dataset(dataset?: Dataset): Dataset | this {
    if (dataset !== undefined) {
      this.set('dataset', dataset);
      return this;
    }
    return this.get('dataset');
  }

  public id(): string;
  public id(id: string): this;
  public id(id?: string): string | this {
    if (id !== undefined) {
      this.set('id', id);
      return this;
    }
    return this.get('id');
  }

  public init() {
    this.dispatchEvent({ type: 'init' });
    // called the first time this annotation has to handle a dataset/annotation
    console.log('in init of Manager', this.dataset(), this.annotation());
  }

  public update() {
    this.dispatchEvent({ type: 'update' });
    // called when annotations service has detected a change, and annotation may need to be updated.
    // Run change detection here just incase.
    console.log('in update of Manager', this.dataset(), this.annotation());    
  }

  public destroy() {
    this.dispatchEvent({ type: 'destroy' });
    console.log('in destroy of Manager', this.dataset(), this.annotation());    
  }
}

@Injectable()
export class AnnotationsService {
  managers: { [k: number]: Set<AnnotationManager> } = {};
  listeners: Set<AnnotationListener> = new Set<AnnotationListener>();
  selectedDatasets: List<Dataset> = List([]);
  subscriptionsForDataset: { [k: number]: Function[] } = {};
  memoizedOnAnnotationFound: WeakMap<AnnotationListener, OnAnnotationFound> = new WeakMap();

  constructor(private datasetsService: DatasetsService) {
    this.datasetsService.selectedDatasets.subscribe((datasets) => {
      // maintain list to see if whats in the selected is still there
      datasets.forEach(dataset => {
        // check if dataset is in old selected.
        if (this.selectedDatasets.find(d => d.id() === dataset.id())) {
          // Do Nothing for now. If anyone can think of something that needs to be done here
          // do it.
          console.log('ALREADY FOUND');
        } else {
          // first time this dataset has been scene.
          const subscriptions = this.subscriptionsForDataset[dataset.id()] || (this.subscriptionsForDataset[dataset.id()] = []);
          subscriptions.forEach(off => off());
          // Do the dispatch once. Then again for the listener
          const listenToAnnotations = listenOn(dataset, 'change:annotations', () => {
            const annotations = dataset.annotations();
            console.log('annotations changed');
            // TODO if annotation has an id of -1 save to database.
            
            // Iterate though all the listeners for ones that match the type.
            annotations.forEach((anno) => {
              this.listeners.forEach((listener) => {
                this.dispatchAnnoTo(listener, anno, dataset);
              });
            });
          });
          subscriptions.push(listenToAnnotations);
        }
        // At the end, check if there are annotations for this. If there aren't reload annotations.
        if (!dataset.annotations()) {
          this.datasetsService.loadAnnotations(dataset);
        }
     });
     // At this point iterate through selected managers. Se if they are deselcted. And call dataset deselcted on managers
     console.log('currently selected', datasets.toJS().map(d => d.id()));
     console.log('prev selected', this.selectedDatasets.toJS().map(d => d.id()));
     this.selectedDatasets
      .filter((dataset) => !datasets.find(d => d.id() === dataset.id()))
      .forEach((dataset) => {
        console.log('DELETING', dataset.id())
        const subscriptions = this.subscriptionsForDataset[dataset.id()] || (this.subscriptionsForDataset[dataset.id()] = []);
        subscriptions.forEach(off => off());
        this.deregisterManagersFor(dataset);
      });

      this.selectedDatasets = datasets;
    });
  }

  deregisterManagersFor(dataset) {
    const found = this.managers[dataset.id()];
    if (found) {
      found.forEach(manager => {
        manager.destroy();
        manager.annotation(null);
        manager.dataset(null);
      });
    }
    this.managers[dataset.id()] = new Set<AnnotationManager>();
  }

  deregisterListener(listener: AnnotationListener) {
    this.listeners.delete(listener);
  }

  dispatchAnnoTo(listener: AnnotationListener, annotation: Annotation, dataset: Dataset) {
    if (listener.annotationType() !== annotation.type()) return;
    const manager = this.memoizedOnAnnotationFound.get(listener)(annotation.id(), dataset.id());
    const isNew = !manager.annotation() || !manager.dataset();
    manager.annotation(annotation);
    manager.dataset(dataset);
    if (isNew) {
      // Initialize the manager if it isn't already.
      manager.init();
    } else { // it's an update
      manager.update();
    }
    this.registerManager(dataset, manager);
  }

  registerManager(dataset: Dataset, manager: AnnotationManager) {
    const set = this.managers[dataset.id()] || (this.managers[dataset.id()] = new Set<AnnotationManager>());
    set.add(manager);
  }

  registerListener(listener: AnnotationListener) {
    this.memoizedOnAnnotationFound.set(listener,
      memoize(listener.onAnnotationFound.bind(listener))
    );
    this.listeners.add(listener);
    this.selectedDatasets.forEach((dataset) => {
      dataset.annotations().forEach((anno) => {
        this.dispatchAnnoTo(listener, anno, dataset);
      });
    });
  }
}
