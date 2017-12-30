import { Injectable } from '@angular/core';
import { Actions, Effect } from '@ngrx/effects';

import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/fromPromise';
import 'rxjs/add/observable/of';

import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';

import { TerrainProviderService } from '../terrain-provider.service';
import { TerrainProviderActionsType, LoadTerrain, LoadTerrainSuccess, LoadTerrainError } from '../actions/actions';

@Injectable()
export class TerrainProviderEffects {
    constructor(private actions$: Actions, private terrainService: TerrainProviderService) {}

    @Effect() loadTerrain$ = this.actions$.ofType(TerrainProviderActionsType.LOAD_TERRAIN)
        .map((action: LoadTerrain) => action.payload)
        .mergeMap(payload => {
            const { provider, smdjs, mtljs, smdjsURL, quality } = payload;
            return Observable.fromPromise(this.terrainService.loadTerrainAsync(provider, smdjs, mtljs, smdjsURL, quality))
                .map(result => new LoadTerrainSuccess(result))
                .catch((error) => Observable.of(new LoadTerrainError({provider, error})))
        });
}
