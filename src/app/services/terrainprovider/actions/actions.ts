import { Action } from '@ngrx/store';

import { TerrainProvider } from '../../../models/terrainProvider.model';
import { TerrainProviderState } from '../state';

import { Smdjs } from '../../../models/smdjs.model';
import { Mtljs } from '../../../models/mtljs.model';

export enum TerrainProviderActionsType {
    RESET = '[TerrainProvider] Reset',
    ADD_TERRAIN_PROVIDER = '[TerrainProvider] Add',
    LOAD_TERRAIN = '[TerrainProvider] Load Model',
    LOAD_TERRAIN_SUCCESS = '[TerrainProvider] Load Model Success',
    LOAD_TERRAIN_ERROR = '[TerrainProvider] Load Model Error',
}

export class ResetState implements Action {
    type = TerrainProviderActionsType.RESET;
    constructor(public payload?) {}
}

export class AddTerrainProvider implements Action {
    type = TerrainProviderActionsType.ADD_TERRAIN_PROVIDER;
    constructor(public payload: TerrainProvider) {}
}

export class LoadTerrain implements Action {
    type = TerrainProviderActionsType.LOAD_TERRAIN;
    constructor(public payload: {provider: TerrainProvider, smdjs: Smdjs, mtljs: Mtljs, smdjsURL: string, quality?: number}) {}
}

export class LoadTerrainSuccess implements Action {
    type = TerrainProviderActionsType.LOAD_TERRAIN_SUCCESS;
    constructor(public payload: { provider: TerrainProvider, rootNode: osg.Node, quality: number}) {}
}

export class LoadTerrainError implements Action {
    type = TerrainProviderActionsType.LOAD_TERRAIN_ERROR;
    constructor(public payload: { provider: TerrainProvider, error: Error}) {}
}

export type TerrainProviderActions = ResetState
| AddTerrainProvider
| LoadTerrain
| LoadTerrainSuccess
| LoadTerrainError;
