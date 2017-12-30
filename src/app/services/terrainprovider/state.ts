import { Record, Map } from 'immutable';

import { TerrainProvider } from '../../models/terrainProvider.model';

const terrainProviderState = Record({
    providers: Map({}),
    pending: Map({}),
    error: Map({}),
});

export class TerrainProviderState extends terrainProviderState {
    error: Map<number, Error>;
    providers: Map<number, TerrainProvider>;
    pending: Map<number, boolean>;

    addTerrainProvider(provider: TerrainProvider): TerrainProviderState {
        const check: TerrainProvider = this.getIn(['providers', provider.dataset().id()]);
        if (check) {
            const update = Object.assign({}, check.getProperties(), provider.getProperties());
            check.setProperties(update);
            provider = check;
        }
        return this.setIn(['providers', provider.dataset().id()], provider) as TerrainProviderState;
    }

    loadTerrain(params: {provider: TerrainProvider}): TerrainProviderState {
        const { provider } = params;
        return this.setIn(['pending', provider.dataset().id()], true)
            .setIn(['error', provider.dataset().id()], false) as TerrainProviderState;
    }

    loadTerrainSuccess(params: { provider: TerrainProvider, rootNode: osg.Node, quality: number}): TerrainProviderState {
        const { provider, rootNode, quality } = params;
        const exist = this.getIn(['providers', provider.dataset().id()]);
        let newState: TerrainProviderState = this;
        if (!exist) {
            newState = this.addTerrainProvider(provider);
        }
        const found: TerrainProvider = newState.getIn(['providers', provider.dataset().id()]);
        found.rootNode(rootNode);
        found.quality(quality);
        return newState.setIn(['pending', found.dataset().id()], false) as TerrainProviderState;
    }

    loadTerrainError(params: { provider: TerrainProvider, error: Error}): TerrainProviderState {
        const { provider, error } = params;
        return this.setIn(['pending', provider.dataset().id()], false)
            .setIn(['error', provider.dataset().id()], error) as TerrainProviderState;
    }
}

export function getInitialState() {
    return new TerrainProviderState();
}
