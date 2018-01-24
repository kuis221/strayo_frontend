import * as sites from '../sites/reducers/reducer';
import { SitesState } from '../sites/state';

import * as datasets from '../datasets/reducers/reducer';
import { DatasetsState } from '../datasets/state';

import * as users from '../users/reducers/reducer';
import { UsersState } from '../users/state';

export const reducers = {
  sites: sites.reducer,
  datasets: datasets.reducer,
  users: users.reducer,
};

export interface State {
  sites: SitesState;
  datasets: DatasetsState;
  users: UsersState;
}

export const getSitesState = (state: State) => {
  return state.sites;
};

export const getDatasetsState = (state: State) => {
  return state.datasets;
};

export const getUsersState = (state: State) => {
  return state.users;
};
