import * as ol from 'openlayers';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { TerrainProvider } from './terrainProvider.model';
import { Annotation, IAnnotation } from './annotation.model';
import { listenOn } from '../util/listenOn';
import uuid from 'uuid/v4';
import { vectorProjection, scalarProjection, vectorRejection } from '../util/osgjsUtil/index';

export class ShotplanRowFeature extends ol.Feature {
    static SHOTPLAN_TYPE = 'shotplan_row_feature';
    public rowUpdate: Observable<ShotplanRow>;
    private holesUpdateSource = new BehaviorSubject<ShotplanHole[]>(null);
    public holesUpdate = this.holesUpdateSource.asObservable();

    constructor(props) {
        super(props);
        this.setId(this.getId() || uuid());
        this.rowUpdate = this.getRow().update;
        listenOn(this.getGeometry(), 'change:geometries', () => {
            console.log('geometries changed');
            const geometries: Array<ShotplanHole | ShotplanRow> = (this.getGeometry() as ol.geom.GeometryCollection).getGeometries() as any;
            const holeGeometries: ShotplanHole[] = geometries.filter((g) => g.shotplanType() === ShotplanHole.SHOTPLAN_TYPE) as any;
            holeGeometries.sort((a, b) => {
                const [aAlong, aAway] = a.alongAway(this.getRow());
                const [bAlong, bAway] = b.alongAway(this.getRow());
                return aAlong - bAlong;
            });
            this.holesUpdateSource.next(holeGeometries);
        });
    }

    public addHole(hole: ol.Coordinate, toe?: ol.Coordinate) {
        toe = toe || ([...hole] as ol.Coordinate);
        const points = [hole, toe];
        points.forEach((p) => {
            if (!p[2]) {
                const worldPoint = this.terrainProvider().getWorldPoint(p);
                if (!worldPoint[2]) console.warn('point has NaN depth');
                p[2] = worldPoint[2];
            }
        });
        const shotplanHole = new ShotplanHole([hole, toe]);
        shotplanHole.terrainProvider(this.terrainProvider());
        const col = this.getGeometry() as ol.geom.GeometryCollection;
        col.setGeometries([...col.getGeometries(), shotplanHole]);
    }

    public getRow(): ShotplanRow {
        const col = this.getGeometry() as ol.geom.GeometryCollection;
        return col.getGeometries().find((g: ShotplanRow | ShotplanHole) => {
            return g.shotplanType() === ShotplanRow.SHOTPLAN_TYPE;
        }) as ShotplanRow;
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
}

export class ShotplanRow extends ol.geom.LineString {
    static SHOTPLAN_TYPE = 'shotplan_row';
    private updateSource = new BehaviorSubject<ShotplanRow>(null);
    public update = this.updateSource.asObservable();
    constructor(coordinates: [ol.Coordinate, ol.Coordinate], layout: ol.geom.GeometryLayout = 'XYZ') {
        super(coordinates, layout);
        this.shotplanType(ShotplanRow.SHOTPLAN_TYPE);
        this.id(this.id() || uuid());
        listenOn(this, 'change', () => {
            console.log('changing row', this.id());
            this.updateSource.next(this);
        });
        this.updateSource.next(this);
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

    public shotplanType(): string;
    public shotplanType(shotplanType: string): this;
    public shotplanType(shotplanType?: string): string | this {
        if (shotplanType !== undefined) {
            this.set('shotplan_type', shotplanType);
            return this;
        }
        return this.get('shotplan_type');
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
}

export class ShotplanHole extends ol.geom.MultiPoint {
    static SHOTPLAN_TYPE = 'shotplan_hole';
    private updateSource = new BehaviorSubject<ShotplanHole>(null);
    public update = this.updateSource.asObservable();
    constructor(coordinates: [ol.Coordinate, ol.Coordinate], layout: ol.geom.GeometryLayout = 'XYZ') {
        super(coordinates, layout);
        this.shotplanType(ShotplanHole.SHOTPLAN_TYPE);
        this.id(this.id() || uuid());
        listenOn(this, 'change', () => {
            console.log('changing hole', this.id());
            this.updateSource.next(this);
        });
        this.updateSource.next(this);
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

    public shotplanType(): string;
    public shotplanType(shotplanType: string): this;
    public shotplanType(shotplanType?: string): string | this {
        if (shotplanType !== undefined) {
            this.set('shotplan_type', shotplanType);
            return this;
        }
        return this.get('shotplan_type');
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
    // Actual functions

    public alongAway(row: ShotplanRow): [number, number] {
        const rowVec = osg.Vec2.sub(row.getLastCoordinate(), row.getFirstCoordinate(), []);
        const holeVec = osg.Vec2.sub(this.getHoleCoord(), row.getFirstCoordinate(), []);

        const alongVec = vectorProjection(holeVec, rowVec);
        const awayVec = vectorRejection(holeVec, rowVec);

        const alongGeom = new ol.geom.LineString([
            row.getFirstCoordinate(),
            osg.Vec2.add(row.getFirstCoordinate(), alongVec, []),
        ]);

        const awayGeom = new ol.geom.LineString([
            row.getFirstCoordinate(),
            osg.Vec2.add(row.getFirstCoordinate(), awayVec, []),
        ]);

        return [alongGeom.getLength(), awayGeom.getLength()];
    }

    public getHoleCoord(): ol.Coordinate {
        return this.getFirstCoordinate();
    }

    public getToeCoord(): ol.Coordinate {
        return this.getLastCoordinate();
    }
}

export interface IShotplan extends IAnnotation {
    terrain_provider: TerrainProvider;
}

export class Shotplan extends Annotation {
    static ANNOTATION_TYPE = 'shotplan';
    private rowsSource = new BehaviorSubject<ol.Collection<ShotplanRowFeature>>(null);
    public rows = this.rowsSource.asObservable();

    static fromABLine(terrainProvider: TerrainProvider, points: [ol.Coordinate, ol.Coordinate]): Shotplan {
        const shotplan = new Shotplan({
            created_at: new Date(),
            data: new ol.Collection([]),
            id: 0,
            meta: {},
            resources: [],
            type: Shotplan.ANNOTATION_TYPE,
            updated_at: new Date(),
            terrain_provider: terrainProvider,
        });

        const row = shotplan.addRow(points);
        row.addHole(points[0]);
        return shotplan;
    }

    constructor(props: IShotplan) {
        super(props);
    }

    public data(): ol.Collection<ShotplanRowFeature>;
    public data(data: string | ol.Collection<ol.Feature>): this;
    public data(data?: string | ol.Collection<ol.Feature>): ol.Collection<ShotplanRowFeature> | this {
        if (data !== undefined) {
            if (data === 'string') {
                data = new ol.Collection((new ol.format.GeoJSON()).readFeatures(data as string));
            }
            this.init();
            return this;
        }
        return this.get('data');
    }

    public terrainProvider(): TerrainProvider;
    public terrainProvider(terrainProvider: TerrainProvider): this;
    public terrainProvider(terrainProvider?: TerrainProvider): TerrainProvider | this {
        if (terrainProvider !== undefined) {
            // TODO: Propegate to rows and holes
            this.set('terrain_provider', terrainProvider);
            return this;
        }
        return this.get('terrain_provider');
    }

    private init() {
        const rowFeatures = this.data().getArray().map((feature) => {
            const geometries = feature.getGeometry() as ol.geom.GeometryCollection;
            const transformedGeometries: Array<ShotplanHole | ShotplanRow> = geometries.getGeometries().map((geom) => {
                if (geom.getType() === 'LineString') {
                    const g = geom as ol.geom.LineString;
                    return new ShotplanRow([g.getFirstCoordinate(), g.getLastCoordinate()])
                        .terrainProvider(this.terrainProvider());
                } else if (geom.getType() === 'MultiPoint') {
                    const g = geom as ol.geom.MultiPoint;
                    return new ShotplanHole([g.getFirstCoordinate(), g.getLastCoordinate()])
                        .terrainProvider(this.terrainProvider());
                } else {
                    console.warn('Unexpected geometry in shotplan', geom.getProperties());
                }
            });

            const rowFeature = new ShotplanRowFeature({
                ...feature.getProperties(),
                geometry: new ol.geom.GeometryCollection(transformedGeometries)
            });
            return rowFeature;
        });

        this.set('data', new ol.Collection<ShotplanRowFeature>(rowFeatures));
        this.rowsSource.next(this.data());
    }

    public addRow(points: [ol.Coordinate, ol.Coordinate]): ShotplanRowFeature {
        const terrainProvider = this.terrainProvider();
        points.forEach((p) => {
            if (!p[2]) {
                const worldPoint = terrainProvider.getWorldPoint(p);
                if (!worldPoint[2]) console.warn('point has NaN elevation');
                p[2] = worldPoint[2];
            }
        });
        const rowGeom = new ShotplanRow(points);
        const rowFeature = new ShotplanRowFeature({
            geometry: new ol.geom.GeometryCollection([
                rowGeom
            ])
        });
        rowGeom.terrainProvider(terrainProvider);

        const data = this.data();
        data.push(rowFeature);
        return rowFeature;
    }
}