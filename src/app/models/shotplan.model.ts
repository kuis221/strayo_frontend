import * as ol from 'openlayers';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import uuid from 'uuid/v4';
import calculateAzimuth from 'azimuth';
import { TerrainProvider } from './terrainProvider.model';
import { Annotation, IAnnotation } from './annotation.model';
import { listenOn } from '../util/listenOn';
import { vectorProjection, scalarProjection, vectorRejection } from '../util/osgjsUtil/index';
import { WebMercator, LonLat } from '../util/projections/index';

export function sortHoles(row: ShotplanRow, holeGeometries: ShotplanHole[]): ShotplanHole[] {
    return holeGeometries.sort((a, b) => {
        const [aAlong, aAway] = a.alongAwayFrom(row);
        const [bAlong, bAway] = b.alongAwayFrom(row);
        // console.log('comparing', [a.id(), aAlong], [b.id(), bAlong]);
        return aAlong - bAlong;
    });
}

export class ShotplanRowFeature extends ol.Feature {
    static SHOTPLAN_TYPE = 'shotplan_row_feature';
    private holesSource = new BehaviorSubject<ShotplanHole[]>([]);
    public holes$ = this.holesSource.asObservable();

    constructor(props) {
        super(props);
        this.setId(this.getId() || uuid());
        listenOn(this.getGeometry(), 'change', (evt) => {
            const geometries: Array<ShotplanHole | ShotplanRow> = (this.getGeometry() as ol.geom.GeometryCollection).getGeometries() as any;
            console.log('geometries changed', evt, geometries);
            if (!geometries) {
                console.warn('no geometries');
                return;
            }
            const holeGeometries = this.getHoles();
            // console.log('should sort', this.getHoles(), sortHoles(this.getRow(), holeGeometries));
            this.holesSource.next(sortHoles(this.getRow(), holeGeometries));
        });
    }

    public rowUpdate$(): Observable<ShotplanRow> {
        return this.getRow().update$;
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
        const shotplanHole = new ShotplanHole([hole, toe])
            .terrainProvider(this.terrainProvider());
        const col = this.getGeometry() as ol.geom.GeometryCollection;
        const holeGeometries = sortHoles(this.getRow(), [...this.getHoles(), shotplanHole]);
        const newCollection = [this.getRow(), ...holeGeometries];
        col.setGeometries(newCollection);
        return shotplanHole;
    }

    public getRow(): ShotplanRow {
        const col = this.getGeometry() as ol.geom.GeometryCollection;
        return col.getGeometries().find((g: ShotplanRow | ShotplanHole) => {
            return g.shotplanType() === ShotplanRow.SHOTPLAN_TYPE;
        }) as ShotplanRow;
    }

    public getHoles(): ShotplanHole[] {
        const holeGeometries: ShotplanHole[] =
            (this.getGeometry() as ol.geom.GeometryCollection)
                .getGeometries().filter((g: ShotplanHole | ShotplanRow) => g.shotplanType() === ShotplanHole.SHOTPLAN_TYPE) as any;
        return holeGeometries;
    }

    public removeHole(hole: ShotplanHole) {
        const holeGeometries = this.getHoles();
        if (holeGeometries.length === 1) {
            console.warn('Attempting to remove last hole in row');
            return;
        }
        const index = holeGeometries.findIndex(h => h.id() === hole.id());
        if (index === -1) {
            console.warn('Cannot remove hole, not in collection', hole);
            return;
        }
        holeGeometries.splice(index, 1);
        const r = this.getRow();
        const newCollection = [r, ...sortHoles(r, holeGeometries)]
        const col = this.getGeometry() as ol.geom.GeometryCollection;
        col.setGeometries(newCollection);
    }

    public terrainProvider(): TerrainProvider;
    public terrainProvider(terrainProvider: TerrainProvider): this;
    public terrainProvider(terrainProvider?: TerrainProvider): TerrainProvider | this {
        if (terrainProvider !== undefined) {
            this.set('terrain_provider', terrainProvider);
            const dataset = terrainProvider.dataset();
            this.set('color', dataset.color());
            console.log('set color', this.get('color'));
            return this;
        }
        return this.get('terrain_provider');
    }
}

export class ShotplanRow extends ol.geom.LineString {
    static SHOTPLAN_TYPE = 'shotplan_row';
    private updateSource = new BehaviorSubject<ShotplanRow>(this);
    public update$ = this.updateSource.asObservable();

    private azimuthSource = new BehaviorSubject<number>(0);
    public azimuth$ = this.azimuthSource.asObservable();

    constructor(coordinates: [ol.Coordinate, ol.Coordinate], layout: ol.geom.GeometryLayout = 'XYZ') {
        super(coordinates, layout);
        this.shotplanType(ShotplanRow.SHOTPLAN_TYPE);
        this.id(this.id() || uuid());
        this.recalculate();
        listenOn(this, 'change', (event) => {
            console.log('changing row', this.id());
            this.updateSource.next(this);
            this.recalculate();
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
    /**
     * Required by openlayers https://github.com/openlayers/openlayers/blob/v4.6.4/src/ol/geom/multipoint.js
     * 
     * @returns {ShotplanRow} 
     * @memberof ShotplanRow
     */
    public clone(): ShotplanRow {
        const layout = this.getLayout();
        const coords = this.getCoordinates();        
        const clone = new ShotplanRow([coords[0], coords[coords.length - 1]], layout)
            .id(this.id())
            .terrainProvider(this.terrainProvider());
        return clone;
    }
    /**
     * Translates the point along the along away vectors
     * Ex: p [5, 5]
     * returns [5 * along, 5 * away];
     * 
     * @param {ol.Coordinate} p 
     * @returns {ol.Coordinate} 
     * @memberof ShotplanRow
     */
    public alongAway(p: ol.Coordinate): ol.Coordinate;
    /**
     * Gets the normalized 2D along and away vectors. Assumes vector is from last to first coordinate
     * 
     * @returns {[ol.Coordinate, ol.Coordinate]} 
     * @memberof ShotplanRow
     */
    public alongAway(): [ol.Coordinate, ol.Coordinate];
    public alongAway(p?: ol.Coordinate): ol.Coordinate | [ol.Coordinate, ol.Coordinate] {
        const [p1, p2] = this.getWorldCoordinates();
        const rowVec = osg.Vec2.normalize(osg.Vec2.sub(p2, p1, []), []);
        const clockWisePerp: [number, number] = [-rowVec[1], rowVec[0]];
        if (p === undefined) {
            return [rowVec, clockWisePerp];
        }
        const alongVec = osg.Vec2.mult(rowVec, p[0], []);
        const awayVec = osg.Vec2.mult(clockWisePerp, p[1], []);
        const totalVec = osg.Vec2.add(alongVec, awayVec, []);
        return totalVec;
    }

    public getWorldCoordinates(): [ol.Coordinate, ol.Coordinate] {
        const p1 = ol.proj.transform(this.getFirstCoordinate(), WebMercator, this.terrainProvider().dataset().projection());
        const p2 = ol.proj.transform(this.getLastCoordinate(), WebMercator, this.terrainProvider().dataset().projection());
        return [p1, p2];
    }

    public recalculate() {
        // Calculate azimuth;
        const points = this.getCoordinates().map((c) => {
            const longLat = ol.proj.transform(c, WebMercator, LonLat);
            const toReturn = [longLat[0], longLat[1], c[2]];
            // console.log('toReturn', toReturn);
            return toReturn;
        });
        // Sort by easterm most point
        points.sort((a, b) => {
            return a[0] - b[0];
        });
        const newAzimuth = calculateAzimuth.azimuth(
            {
                lng: points[0][0],
                lat: points[0][1],
                elv: points[0][2],
            },
            {
                lng: points[1][0],
                lat: points[1][1],
                elv: points[1][2],
            }
        );
        // console.log('new Azimuth', newAzimuth);
        this.azimuthSource.next(newAzimuth.azimuth);
    }

    public setCoordinates(coordinates: ol.Coordinate[], opt_layout: ol.geom.GeometryLayout) {
        opt_layout = opt_layout || this.getLayout();
        const terrainProvider = this.terrainProvider();
        if (terrainProvider) {
            [coordinates[0], coordinates[coordinates.length - 1]].forEach((p) => {
                const worldPoint = terrainProvider.getWorldPoint(p);
                p[2] = worldPoint[2];
            });
        } else {
        }
        ol.geom.LineString.prototype.setCoordinates.bind(this)([coordinates[0], coordinates[coordinates.length - 1]], opt_layout);
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
            console.log('changing hole', this.id(), this.getCoordinates());
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
    /**
     * Calculates the along and away in meters from point
     * 
     * @param {ShotplanRow} row 
     * @returns {[number, number]} 
     * @memberof ShotplanHole
     */
    public alongAwayFrom(row: ShotplanRow): [number, number] {
        const [rowPoint] = row.getWorldCoordinates();
        const [holePoint] = this.getWorldCoordinates();
        const holeVec = osg.Vec2.sub(holePoint, rowPoint, []);
        const rowVec = row.alongAway();
        
        const along = scalarProjection(holeVec, rowVec[0]);
        const away = scalarProjection(holeVec, rowVec[1]);
        return [along, away];
    }

    public getWorldCoordinates(): [ol.Coordinate, ol.Coordinate] {
        const p1 = ol.proj.transform(this.getFirstCoordinate(), WebMercator, this.terrainProvider().dataset().projection());
        const p2 = ol.proj.transform(this.getLastCoordinate(), WebMercator, this.terrainProvider().dataset().projection());
        return [p1, p2];
    }

    public clone() {
        const coords = this.getCoordinates();
        const clone = new ShotplanHole([coords[0], coords[coords.length - 1]], this.getLayout())
            .id(this.id())
            .terrainProvider(this.terrainProvider());
        return clone;
    }

    public getHoleCoord(): ol.Coordinate {
        console.log('holeCoord', this.getFirstCoordinate());
        return this.getFirstCoordinate();
    }

    public getToeCoord(): ol.Coordinate {
        console.log('toeCoord', this.getLastCoordinate());
        return this.getLastCoordinate();
    }

    public setCoordinates(coordinates: ol.Coordinate[], opt_layout: ol.geom.GeometryLayout) {
        opt_layout = opt_layout || this.getLayout();
        const terrainProvider = this.terrainProvider();
        if (terrainProvider) {
            //TODO: recalculate the toe from toeplane.
            [coordinates[0], coordinates[coordinates.length - 1]].forEach((p) => {
                const worldPoint = terrainProvider.getWorldPoint(p);
                p[2] = worldPoint[2];
            });
        } else {
        }
        ol.geom.MultiPoint.prototype.setCoordinates.bind(this)([coordinates[0], coordinates[coordinates.length - 1]], opt_layout);
    }
}

export interface IShotplan extends IAnnotation {
    terrain_provider: TerrainProvider;
}

export class Shotplan extends Annotation {
    static ANNOTATION_TYPE = 'shotplan';
    private rowsSource = new BehaviorSubject<ShotplanRowFeature[]>(null);
    public rows$ = this.rowsSource.asObservable();

    private offData: Function;
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
        // Convert geojson to shotplan specific versions
        const terrainProvider = this.terrainProvider();
        const rowFeatures = this.data().getArray().map((feature) => {
            const geometries = feature.getGeometry() as ol.geom.GeometryCollection;
            const transformedGeometries: Array<ShotplanHole | ShotplanRow> =
                geometries.getGeometries().map((geom: ShotplanHole | ShotplanRow) => {
                    const [p1, p2] = geom.getCoordinates().map((p) => {
                        if (!p[2]) {
                            const worldPoint = terrainProvider.getWorldPoint(p);
                            if (!worldPoint[2]) console.warn('point has NaN elevation');
                            p[2] = worldPoint[2];
                        }
                        return p;
                    });
                    if (geom.getType() === 'LineString') {
                        return new ShotplanRow([p1, p2])
                            .terrainProvider(this.terrainProvider());
                    } else if (geom.getType() === 'MultiPoint') {
                        console.log('points', [p1, p2])
                        return new ShotplanHole([p1, p2])
                            .terrainProvider(this.terrainProvider());
                    } else {
                        console.warn('Unexpected geometry in shotplan', geom.getProperties());
                    }
                });

            const rowFeature = new ShotplanRowFeature({
                ...feature.getProperties(),
                geometry: new ol.geom.GeometryCollection([])
            }).terrainProvider(this.terrainProvider());
            // Do this here to invoke event listenr
            console.log('transformed', transformedGeometries);
            (rowFeature.getGeometry() as ol.geom.GeometryCollection).setGeometries(transformedGeometries);
            return rowFeature;
        });

        this.set('data', new ol.Collection<ShotplanRowFeature>(rowFeatures));
        console.log('Setting rows', rowFeatures);
        this.rowsSource.next(this.data().getArray());
        // Listen for the rest
        if (this.offData) this.offData();
        this.offData = listenOn(this.data(), 'change:length', () => {
            this.rowsSource.next(this.data().getArray());
        });
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
        console.log('points', points);
        const rowGeom = new ShotplanRow(points).terrainProvider(terrainProvider);
        const rowFeature = new ShotplanRowFeature({
            geometry: new ol.geom.GeometryCollection([
                rowGeom
            ])
        })
            .terrainProvider(terrainProvider);

        const data = this.data();
        data.push(rowFeature);
        return rowFeature;
    }

    public removeRow(row: ShotplanRowFeature) {
        const index = this.data().getArray().findIndex(r => r.getId() === row.getId());
        if (index === -1) {
            console.warn('could not find row in shotplan', row);
            return;
        }
        if (index === 0) {
            console.warn('attempting to remove ab line!', row);
            return;
        }
        this.data().removeAt(index);
    }
}