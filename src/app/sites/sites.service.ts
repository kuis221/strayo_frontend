import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Store } from '@ngrx/store';

import { Observable } from 'rxjs/Observable';
import { tap, map } from 'rxjs/operators';

import { List } from 'immutable';

import * as moment from 'moment';

import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';

import * as fromRoot from '../reducers';

import { ISite, Site } from '../models/site.model';
import { Dataset } from '../models/dataset.model';

import { SitesState } from '../sites/state';
import * as sitesActions from './actions/actions';
import { GetSites } from './actions/actions';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { distinctUntilChanged } from 'rxjs/operators/distinctUntilChanged';
import { getSitesState } from '../reducers';

const allSitesQuery = gql`{
  sites {
    id,
    name,
    status,
    created_at,
    location,
    datasets {
      created_at,
      id,
      is_phantom,
      lat,
      long,
      name,
      status,
      updated_at,
    }
  }
}`;

@Injectable()
export class SitesService {
  private sitesSource = new BehaviorSubject<List<Site>>(List([]));
  sites = this.sitesSource.asObservable().pipe(distinctUntilChanged());

  constructor(private store: Store<fromRoot.State>, private apollo: Apollo, private http: HttpClient) {
    this.getState$().subscribe((state) => {
      if (!state) return;
      console.log('got state', state);
      this.sitesSource.next(state.sites);
    });
  }

  public getState$() {
    return this.store.select<SitesState>(getSitesState);
  }

  public loadSites() {
    this.store.dispatch(new GetSites());
  }

  // Called by effect
  public getSites(): Observable<Site[]> {
    return this.apollo.watchQuery<{ sites: ISite[] }>({
      query: allSitesQuery,
    })
    .valueChanges
    .pipe(
      map(({ data }) => {
        return data.sites.map((datum) => {
          const site = new Site(datum);
          // Update fields from string
          site.createdAt(site.createdAt());
          // change datasets
          const datasets: any[] = site.datasets();
          site.datasets(datasets.map(dataset => {
            const d = new Dataset(dataset);
            // Update fields from string
            d.createdAt(d.createdAt());
            d.updatedAt(d.updatedAt());
            return d;
          }));

          return site;
        });
      }),
    );
  }
}