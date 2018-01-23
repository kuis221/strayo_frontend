import * as ol from 'openlayers';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { memoize } from 'lodash';
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

    private holesSource = new BehaviorSubject<ShotplanHole[]>(null);
    public holes$ = this.holesSource.asObservable();

    private rowSource = new BehaviorSubject<ShotplanRow>(null);
    public row$ = this.rowSource.asObservable();

    private _getBearingAndInclinationBehaviorSubject: (id) => BehaviorSubject<[number, number]>;

    constructor(props) {
        super(props);
        this._getBearingAndInclinationBehaviorSubject = memoize((id) => {
            return new BehaviorSubject<[number, number]>([0, 0]);
        });
        this.setId(this.getId() || uuid());
        listenOn(this.getGeometry(), 'change', (evt) => {
            const r = this.getRow();

            this.holesSource.next(sortHoles(r, this.getHoles()));
            this.rowSource.next(r);
        });
    }

    public autoUpdate(): boolean;
    public autoUpdate(autoUpdate: boolean): this;
    public autoUpdate(autoUpdate?: boolean): boolean | this {
        if (autoUpdate !== undefined) {
            this.set('auto_update', autoUpdate);
            this.getGeometry().getGeometries().forEach((g: ShotplanRow | ShotplanHole) => g.autoUpdate(autoUpdate));            
            return this;
        }
        return this.get('auto_update');
    }

    public toeHeight(): number;
    public toeHeight(toeHeight: number): this;
    public toeHeight(toeHeight?: number): number | this {
        if (toeHeight !== undefined) {
            this.set('toe_height', toeHeight);

            return this;
        }
        return this.get('toe_height');
    }

    public terrainProvider(): TerrainProvider;
    public terrainProvider(terrainProvider: TerrainProvider): this;
    public terrainProvider(terrainProvider?: TerrainProvider): TerrainProvider | this {
        if (terrainProvider !== undefined) {
            this.set('terrain_provider', terrainProvider);
            const dataset = terrainProvider.dataset();
            this.set('color', dataset.color());
            this.getGeometry().getGeometries().forEach((g: ShotplanRow | ShotplanHole) => g.terrainProvider(terrainProvider));
            
            const r = this.getRow();
            if (r) r.terrainProvider(terrainProvider);
            this.getHoles().forEach(h => h.terrainProvider(terrainProvider));
            return this;
        }
        return this.get('terrain_provider');
    }

    public addHole(hole: ol.Coordinate, toe?: ol.Coordinate) {
        // TODO, if toe is passed, calculate toeHeight from toe.
        toe = toe || ([...hole] as ol.Coordinate);
        const shotplanHole = new ShotplanHole([hole, toe])
            .autoUpdate(this.autoUpdate())
            .terrainProvider(this.terrainProvider());
        this.updateToe(shotplanHole, 0, 0);
        const col = this.getGeometry() as ol.geom.GeometryCollection;
        const holeGeometries = sortHoles(this.getRow(), [...this.getHoles(), shotplanHole]);
        const newCollection = [this.getRow(), ...holeGeometries];
        col.setGeometries(newCollection);
        return shotplanHole;
    }

    public getGeometry(): ol.geom.GeometryCollection {
        return ol.Feature.prototype.getGeometry.call(this) as ol.geom.GeometryCollection;
    }

    public getBearingAndInclination(hole: ShotplanHole): [number, number] {
        const row = this.getRow();
        const [p1, p2] = hole.getWorldCoordinates();
        const [alongHole, awayHole] = hole.alongAwayFrom(row);
        const [alongToe, awayToe] = hole.alongAwayFrom(row, true);

        // Calculate bearing.
        const rel = osg.Vec2.sub(p2, p1, []);
        const bearing = Math.atan2(rel[1], rel[0]);
        console.log('geting bearing', [p1, p2], rel, bearing);

        // Calculate the inclination
        const hypothenuse = osg.Vec3.distance(p1, p2);
        const opposite = osg.Vec2.distance(p1, p2);
        const inclination = Math.asin(opposite / hypothenuse) * 180 / Math.PI;
        this._getBearingAndInclinationBehaviorSubject(hole.id()).next([bearing, inclination]);
        return [bearing, inclination];
    }

    public getBearingAndInclination$(hole: ShotplanHole): Observable<[number, number]> {
        return this._getBearingAndInclinationBehaviorSubject(hole.id()).asObservable();
    }

    public updateToe(hole: ShotplanHole, bearing: number, inclination: number) {
        let firstPoint = hole.getFirstCoordinate();
        if (!firstPoint[2]) {
            hole.forceUpdate();
            firstPoint = hole.getFirstCoordinate();
            if (!firstPoint[2]) throw new Error('Unexpected error, hole has NaN elevation');
        }
        console.log('updating toe');
        const row = this.getRow();
        const firstPointAlongAway = hole.alongAwayFrom(row);

        // calculate inclination.
        let currentAlongAway = [firstPointAlongAway[0], firstPointAlongAway[1]];
        if (inclination !== 0) {
            // Right triangle where adjacent is depth and opposite is distance frome hole
            const depth = Math.abs(this.toeHeight() - firstPoint[2]);
            const hypothenuse = depth / (Math.cos(inclination * Math.PI / 180));
            // Inclination is always positive
            const along = hypothenuse * Math.sin(inclination * Math.PI / 180);
            const inclinationUpdate = [along, 0];
            currentAlongAway = osg.Vec2.add(currentAlongAway, inclinationUpdate, []);

            if (bearing !== 0) {
                // Rotate along and away vector. Need to translate to origin.
                const translatedToOrigin = [currentAlongAway[0] - firstPointAlongAway[0], currentAlongAway[1] - firstPointAlongAway[1]];
                const cos = Math.cos(bearing * Math.PI / 180);
                const sin = Math.sin(bearing * Math.PI / 180);
                const bearingUpdate = [
                    (translatedToOrigin[0] * cos) - (translatedToOrigin[1] * sin),
                    (translatedToOrigin[0] * sin) - (translatedToOrigin[1] * cos)
                ];
                currentAlongAway = osg.Vec2.add(currentAlongAway, bearingUpdate, []);
            }
        }
        // translate point
        const [holePoint] = hole.getWorldCoordinates();
        const toePoint = ol.proj.transform(
            row.alongAway(holePoint, currentAlongAway as [number, number]),
            this.terrainProvider().dataset().projection(),
            WebMercator
        );
        toePoint[2] = this.toeHeight();
        const prevAutoUpdate = hole.autoUpdate();
        hole.autoUpdate(false);
        hole.setCoordinates([firstPoint, toePoint], hole.getLayout());
        hole.autoUpdate(prevAutoUpdate);
        const bi = this.getBearingAndInclination(hole);
        console.log('start, end bearing & inclination', [bearing, inclination], bi);
    }

    public forceUpdate() {
        this.getGeometry().getGeometries().forEach((g : ShotplanHole | ShotplanRow) => {
            g.forceUpdate();
        });  
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
        this.autoUpdate(true);
        this.recalculate();
        listenOn(this, 'change', (event) => {
            console.log('changing row', this.id());
            this.updateSource.next(this);
            this.recalculate();
        });
        this.updateSource.next(this);
    }

    public autoUpdate(): boolean;
    public autoUpdate(autoUpdate: boolean): this;
    public autoUpdate(autoUpdate?: boolean): boolean | this {
        if (autoUpdate !== undefined) {
            // console.log('autoupdate row', autoUpdate, this.id());
            this.set('auto_update', autoUpdate);
            return this;
        }
        return this.get('auto_update');
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
            .autoUpdate(this.autoUpdate())
            .terrainProvider(this.terrainProvider());
        return clone;
    }
    /**
     * Translates the point along the along away vectors
     * Ex: p [5, 5], [along, away]
     * returns [5, 5] + [alongVec * along, awayVec * away];
     * 
     * @param {ol.Coordinate} p 
     * @returns {ol.Coordinate} 
     * @memberof ShotplanRow
     */
    public alongAway(p: ol.Coordinate, a: ol.Coordinate): ol.Coordinate;
    /**
     * Gets the normalized 2D along and away vectors. Assumes vector is from last to first coordinate
     * 
     * @returns {[ol.Coordinate, ol.Coordinate]} 
     * @memberof ShotplanRow
     */
    public alongAway(): [ol.Coordinate, ol.Coordinate];
    public alongAway(p?: ol.Coordinate, a?: ol.Coordinate): ol.Coordinate | [ol.Coordinate, ol.Coordinate] {
        const [p1, p2] = this.getWorldCoordinates();
        const rowVec = osg.Vec2.normalize(osg.Vec2.sub(p2, p1, []), []);
        const clockWisePerp: [number, number] = [-rowVec[1], rowVec[0]];
        if (p === undefined) {
            return [rowVec, clockWisePerp];
        }
        const alongVec = osg.Vec2.mult(rowVec, a[0], []);
        const awayVec = osg.Vec2.mult(clockWisePerp, a[1], []);
        const totalVec = osg.Vec2.add(alongVec, awayVec, []);
        return osg.Vec2.add(p, totalVec, []);
    }

    public forceUpdate() {
        const prevAutoUpdate = this.autoUpdate();
        this.autoUpdate(true);
        this.setCoordinates(this.getCoordinates(), this.getLayout());
        this.autoUpdate(prevAutoUpdate);
    }

    public getWorldCoordinates(): [ol.Coordinate, ol.Coordinate] {
        const p1 = ol.proj.transform(this.getFirstCoordinate(), WebMercator, this.terrainProvider().dataset().projection());
        const p2 = ol.proj.transform(this.getLastCoordinate(), WebMercator, this.terrainProvider().dataset().projection());
        p1[2] = this.getFirstCoordinate()[2];
        p2[2] = this.getLastCoordinate()[2];
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
        if (this.autoUpdate() && terrainProvider) {
            const w1 = terrainProvider.getWorldPoint(coordinates[0]);
            coordinates[0][2] = w1[2];
            const w2 = terrainProvider.getWorldPoint(coordinates[coordinates.length - 1]);
            coordinates[1][2] = w1[2];
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
        this.autoUpdate(true);
        listenOn(this, 'change', () => {
            console.log('changing hole', this.id(), this.getCoordinates());
            this.updateSource.next(this);
        });
        this.updateSource.next(this);
    }

    public autoUpdate(): boolean;
    public autoUpdate(autoUpdate: boolean): this;
    public autoUpdate(autoUpdate?: boolean): boolean | this {
        if (autoUpdate !== undefined) {
            this.set('auto_update', autoUpdate);
            // console.log('autoupdate hole', autoUpdate, this.id());

            return this;
        }
        return this.get('auto_update');
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
    public alongAwayFrom(row: ShotplanRow, toe?: boolean): [number, number] {
        const [rowPoint] = row.getWorldCoordinates();
        const [holePoint, toePoint] = this.getWorldCoordinates();
        const point = (toe) ? toePoint : holePoint;
        const holeVec = osg.Vec2.sub(point, rowPoint, []);
        const rowVec = row.alongAway();

        const along = scalarProjection(holeVec, rowVec[0]);
        const away = scalarProjection(holeVec, rowVec[1]);
        return [along, away];
    }

    public getHoleLength(): number {
        const [p1, p2] = this.getWorldCoordinates();
        return osg.Vec3.distance(p1, p2);
    }

    public getToeDepth(): number {
        const [p1, p2] = this.getWorldCoordinates();
        return Math.abs(p2[2] - p1[2]);
    }

    public getToeDisplacement(): number {
        const [p1, p2] = this.getWorldCoordinates();
        return osg.Vec2.distance(p1, p2);
    }

    public getWorldCoordinates(): [ol.Coordinate, ol.Coordinate] {
        const p1 = ol.proj.transform(this.getFirstCoordinate(), WebMercator, this.terrainProvider().dataset().projection());
        const p2 = ol.proj.transform(this.getLastCoordinate(), WebMercator, this.terrainProvider().dataset().projection());
        p1[2] = this.getFirstCoordinate()[2];
        p2[2] = this.getLastCoordinate()[2];
        return [p1, p2];
    }

    
/**
 * @overide
 * 
 * @returns 
 * @memberof ShotplanHole
 */
public clone() {
        // console.log('cloned');
        const clone = new ShotplanHole([this.getFirstCoordinate(), this.getLastCoordinate()], this.getLayout())
            .id(this.id())
            .autoUpdate(this.autoUpdate())
            .terrainProvider(this.terrainProvider());
        return clone;
    }
    public forceUpdate() {
        console.log('pre force', this.getCoordinates());
        const prevAutoUpdate = this.autoUpdate();
        this.autoUpdate(true);
        this.setCoordinates(this.getCoordinates(), this.getLayout());
        this.autoUpdate(prevAutoUpdate);
        console.log('after', this.getCoordinates());
    }

    public getHoleCoord(): ol.Coordinate {
        return this.getFirstCoordinate();
    }

    public getToeCoord(): ol.Coordinate {
        return this.getLastCoordinate();
    }

    public setCoordinates(coordinates: ol.Coordinate[], opt_layout: ol.geom.GeometryLayout) {
        opt_layout = opt_layout || this.getLayout();
        const terrainProvider = this.terrainProvider();
        if (this.autoUpdate() && terrainProvider) {
            const w1 = terrainProvider.getWorldPoint(coordinates[0]);
            coordinates[0][2] = w1[2];
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

    private unsubscribe: Function[] = [];
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
        // TODO: Make auto update false on default.
        this.set('auto_update', true);
        const bounds = this.terrainProvider().getWorldBounds();
        console.log('world bounds', bounds);
        this.set('toe_height', bounds._min[2]);
    }

    public autoUpdate(): boolean;
    public autoUpdate(autoUpdate: boolean): this;
    public autoUpdate(autoUpdate?: boolean): boolean | this {
        if (autoUpdate !== undefined) {
            this.set('auto_update', autoUpdate);
            // have to check if method exist because data may not be initialized
            this.data().forEach(r => r.autoUpdate && r.autoUpdate(autoUpdate));
            return this;
        }
        return this.get('auto_update');
    }

    public data(): ol.Collection<ShotplanRowFeature>;
    public data(data: string | ol.Collection<ol.Feature>): this;
    public data(data?: string | ol.Collection<ol.Feature>): ol.Collection<ShotplanRowFeature> | this {
        if (data !== undefined) {
            Annotation.prototype.data.call(this, data);
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
            this.data().forEach(r => r.terrainProvider(terrainProvider));
            return this;
        }
        return this.get('terrain_provider');
    }

    public toeHeight(): number;
    public toeHeight(toeHeight: number): this;
    public toeHeight(toeHeight?: number): number | this {
        if (toeHeight !== undefined) {
            this.set('toe_height', toeHeight);
            // have to check if method exist because data may not be initialized
            this.data().forEach(r => r.toeHeight && r.toeHeight(toeHeight));
            return this;
        }
        return this.get('toe_height');
    }

    public forceUpdate() {
        this.data().forEach(r => r.forceUpdate && r.forceUpdate());
    }

    private init() {
        // Convert geojson to shotplan specific versions
        const backup = this.data().getArray();
        // Convert to new collection. Add row auto adds to collection.
        this.set('data', new ol.Collection([]));
        const terrainProvider = this.terrainProvider();
        const toeHeight = this.toeHeight();
        const autoUpdate = this.autoUpdate();
        const rowFeatures = backup.map((feature) => {
            const geometries = feature.getGeometry() as ol.geom.GeometryCollection;
            const row = geometries.getGeometries().find(g => g.getType() === 'LineString') as ol.geom.LineString;
            const holes = geometries.getGeometries().filter(g => g.getType() === 'MultiPoint') as ol.geom.MultiPoint[];
            const rowFeature = this.addRow([row.getFirstCoordinate(), row.getLastCoordinate()]);
            console.log('init', rowFeature, rowFeature.getRow(), holes)
            holes.forEach((h) => {
                rowFeature.addHole(h.getFirstCoordinate(), h.getLastCoordinate());
            });
            return rowFeature;
        });

        this.forceUpdate();
        console.log('Setting rows', rowFeatures);
        this.rowsSource.next(this.data().getArray());
        // Listen for the rest
        this.unsubscribeAll();
        const off = listenOn(this.data(), 'change:length', () => {
            this.rowsSource.next(this.data().getArray());
        });
        this.unsubscribe.push(off);
    }

    public addRow(points: [ol.Coordinate, ol.Coordinate]): ShotplanRowFeature {
        const terrainProvider = this.terrainProvider();
        const autoUpdate = this.autoUpdate();
        const toeHeight = this.toeHeight();

        const rowGeom = (new ShotplanRow(points))
            .terrainProvider(terrainProvider)
            .autoUpdate(autoUpdate);

        const rowFeature = new ShotplanRowFeature({
            auto_update: autoUpdate,
            terrain_provider: terrainProvider,
            toe_height: toeHeight,
            geometry: new ol.geom.GeometryCollection([
                rowGeom,
            ]),
        });
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

    public unsubscribeAll() {
        this.unsubscribe.forEach(sub => sub());
        this.unsubscribe = [];
    }
}