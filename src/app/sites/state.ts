import { Record, List } from 'immutable';
import { Site } from '../models/site.model';

const siteRecord = Record({
    sites: List([]),
    mainSite: null,
    pending: false,
    error: null,
});

export class SitesState extends siteRecord {
    sites: List<Site>;
    mainSite: Site;
    pending: boolean;
    error: Error;

    public getSites(): SitesState {
        return this.set('error', null).set('pending', true) as SitesState;
    }

    public getSitesError(error: Error): SitesState {
        return this.set('error', error).set('pending', false) as SitesState;
    }

    public getSitesSuccess(sites: Site[]): SitesState {
        return this.set('error', null).set('pending', true).set('sites', List(sites)) as SitesState;
    }

    public setMainSite(site: Site): SitesState {
        return this.set('mainSite', Site) as SitesState;
    }

    public setSites(sites: Site[]): SitesState {
        return this.set('sites', List(sites)) as SitesState;
    }
}

export function getInitialState() {
    return new SitesState();
}
