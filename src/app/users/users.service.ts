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

import { getFullUrl } from '../util/getApiUrl';

import { User } from '../models/user.model';
import { Dataset } from '../models/dataset.model';

import { UsersState } from '../users/state';
import * as usersActions from './actions/actions';
import { GetUsers, SetCurrentUser, SignIn, SignUp } from './actions/actions';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { distinctUntilChanged } from 'rxjs/operators/distinctUntilChanged';
import { getUsersState } from '../reducers';

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
export class UsersService {
  private usersSource = new BehaviorSubject<List<User>>(List([]));
  users = this.usersSource.asObservable().pipe(distinctUntilChanged());

  private currentUserSource = new BehaviorSubject<User>(null);
  currentUser = this.currentUserSource.asObservable().pipe(distinctUntilChanged());

  constructor (private store: Store<fromRoot.State>, private apollo: Apollo, private http: HttpClient) {
    this.getState$().subscribe((state) => {
      if (!state) {
        return;
      }

      this.usersSource.next(state.users);
      this.currentUserSource.next(state.currentUser);
    });
  }

  public getState$() {
    return this.store.select<UsersState>(getUsersState);
  }

  public loadUsers() {
    this.store.dispatch(new GetUsers());
  }

  public setCurrentUser(user: User) {
    this.store.dispatch(new SetCurrentUser(user));
  }

  public getUsers(): Observable<User[]> {
    return this.apollo.watchQuery<{ users: User[] }>({
      query: allSitesQuery,
    })
    .valueChanges
    .pipe(
      map(({ data }) => {
        return data.users.map((datum) => {
          const user = datum;
          return user;
        });
      }),
    );
  }

  public makeSignIn(credentials) {
    this.store.dispatch(new SignIn(credentials));
  }

  public signIn(credentials) {
    this.http.post(getFullUrl('v1/sessions'), credentials).subscribe(
      res => console.log(res),
      err => console.log('Error occured', err),
    );
  }

  public makeSignUp(userData) {
    this.store.dispatch(new SignUp(userData));
  }

  public signUp(userData) {
    this.http.post(getFullUrl('v1/users'), userData).subscribe(
      res => console.log(res),
      err => console.log('Error occured', err),
    );
  }
}
