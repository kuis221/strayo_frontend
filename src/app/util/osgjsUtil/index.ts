import * as ol from 'openlayers';
import { WebMercator } from '../projections/index';


export type GetWorldPoint = (point: ol.Coordinate, proj?: ol.ProjectionLike) => [number, number, number];
export type Point = ol.Coordinate | osg.Vec3;
export type Triangle = [Point, Point, Point];
export type Edge = [Point, Point];
export interface FacesAndEdges {
    points: Triangle[];
    edges: [Point, Point][];
}
export interface CutMesh {
    cut: FacesAndEdges;
    fill: any;
}

export function calcNormal(face): Point {
    const U = osg.Vec3.sub(face[0], face[1], []);
    const V = osg.Vec3.sub(face[2], face[1], []);
    return osg.Vec3.cross(U, V, []);
}

export function clockwise(faces: Triangle[]): Triangle[] {
    return faces.map((face) => {
        if (!isClockwise(face)) return ([...face].reverse() as Triangle);
        return ([...face] as Triangle);
    });
}

export function createColorsArray(size: number): Float32Array {
    const array = new Float32Array(size * 3);
    for (let i = 0; i < size; i++) {
        array[i * 3 + 0] = 1.0;
        array[i * 3 + 1] = 1.0;
        array[i * 3 + 2] = 1.0;
    }
    return array;
}

export function createNormalArray(size: number, x: number, y: number, z: number): Float32Array {
    const array = new Float32Array(size * 3);
    for (let i = 0; i < size; i++) {
        array[i * 3 + 0] = x;
        array[i * 3 + 1] = y;
        array[i * 3 + 2] = z;
    }
    return array;
}

export function cutMesh(mesh: FacesAndEdges, elevation?: number) {
    if (elevation === null || elevation === undefined) {
        return { cut: mesh, fill: null }
    }

    const above: FacesAndEdges = { points: [], edges: [] };
    const below: FacesAndEdges = { points: [], edges: [] };
    const intersected: FacesAndEdges = { points: [], edges: [] };

    const points = mesh.points;

    points.forEach((tri, i) => {
        let aboveCount = 0;
        let belowCount = 0;

        for (let j = 0; j < tri.length; j++) {
            if (Math.abs(tri[j][2]) >= elevation) {
                aboveCount += 1;
            } else {
                belowCount += 1;
            }
        }

        if (aboveCount === 3) {
            above.points.push(tri);
        } else if (belowCount === 3) {
            below.points.push(tri);
        } else {
            // Words from the immortal Alex Snardle Martinowski
            // Things get a little complicated here as the cutting plane splits this triangle in half.
            // Bisecting an arbitrary triangle along a purely horizontal line is fairly trivial, though the code doesn't necessarily bear that out.
            // Four smaller triangles are formed from the current triangle. Essentially it's a sheared Sierpinski triangle.
            // Calculate the points of intersection with the line, and make 4 triangles along those intersections.

            // We also need to ensure the new triangles have the same normal vector as the source triangle


        }
    })
}

export function featureToNode(feature: ol.Feature, getPoint: GetWorldPoint, proj?: ol.ProjectionLike) {
    const type = feature.getGeometry().getType();
    console.log('making geo', feature.getGeometry().getType());
    if (type === 'Circle') {
        const geometry = (feature.getGeometry() as ol.geom.Circle);
        const point = getPoint(geometry.getCenter(), proj);
        const root = new osg.MatrixTransform();
        const subroot = new osg.MatrixTransform();
        const sphere = osg.createTexturedSphere(0.2, 10, 10);
        osg.Matrix.setTrans(subroot.getMatrix(), ...point);
        subroot.addChild(sphere);
        root.addChild(subroot);
        return root;
    } else if (type === 'LineString') {
        const geometry = (feature.getGeometry() as ol.geom.LineString);
        const points = geometry.getCoordinates().map(coord => getPoint(coord, proj));
        const geo = lineFromPoints(points);
        const node = new osg.MatrixTransform();
        node.addChild(geo);
        return null;
    } else {
        throw new Error(`Geometry Type ${feature.getGeometry().getType()} is not supported please do`);
    }
}

export function filterVertices(points: Point[], model: osg.Node): FacesAndEdges {
    const center = osg.Vec3.create();
    model.getBoundingBox().center(center);

    const extent = ol.extent.boundingExtent(points as any);
    const bounds = new osg.BoundingBox();
    bounds._min = osg.Vec3.fromValues(extent[0], extent[1], NaN);
    bounds._max = osg.Vec3.fromValues(extent[2], extent[3], NaN);

    const bounded = { points: [], edges: [] };
    // collects bounded points and edges.
    model.children.forEach((node) => {
        const geometry = node as osg.Geometry;
        const attributes = geometry.getAttributes();
        const vertex = attributes.Vertex;
        const normal = attributes.Normal;

        // TODO: Use appropriate getters here
        const vertices = vertex._elements;
        const normals = normal._elements;
        const primitives = geometry.primitives;

        primitives.forEach((primitive) => {
            if (checkBoundsForPrimitive[primitive.mode]) {
                const result = checkBoundsForPrimitive[primitive.mode](primitive, geometry, bounds, points);
                if (result) {
                    bounded.points = bounded.points.concat(result.points);
                    bounded.edges = bounded.edges.concat(result.edges);
                }
            }
        })
    });

    // Find the point with the lowest y then x
    const backup = [...bounded.edges];
    let edgeI = 0;
    let pointI = 0;
    let selected = bounded.edges[edgeI][pointI];
    for (let i = 0; i < bounded.edges.length; i++) {
        for (let j = 0; j < bounded.edges[i].length; j++) {
            const current = bounded.edges[i][j];
            if (
                (selected[1] < current[1]) ||
                (selected[1] === selected[1] && selected[0] < current[0])
            ) {
                edgeI = i;
                pointI = j;
                selected = current;
            }
        }
    }
    const neighbor = bounded.edges[edgeI][(pointI + 1) % 2];
    // TODO: Jesus Christ someone optimize and/or simplify this mess.
    const sorted = [[...selected], [...neighbor]];
    delete bounded.edges[edgeI][pointI];
    delete bounded.edges[edgeI][(pointI + 1) % 2];
    let found = false;
    for (let i = 1; sorted.length < (bounded.edges.length * 2); i += 2) {
        found = false;
        const last = sorted[i];
        for (let j = 0; j < bounded.edges.length && !found; j += 1) {
            for (let k = 0; k < bounded.edges[j].length && !found; k++) {
                const current = bounded.edges[j][k];
                if (current === undefined) continue;

                if (last[0] === current[0] && last[1] === current[1]) {
                    sorted.push([...current]);
                    sorted.push([...bounded.edges[j][(k + 1) % 2]]);

                    delete bounded.edges[j][k];
                    delete bounded.edges[j][(k + 1) % 2];

                    found = true;
                }
            }
        }

        if (!found) {
            console.warn('Could not string edges together!');
            bounded.edges = backup;
            break;
        }
    }

    if (sorted.length === (bounded.edges.length * 2)) {
        bounded.edges = [];
        for (let i = 0; i < sorted.length; i += 2) {
            bounded.edges.push([sorted[i], sorted[i + 1]]);
        }
    }

    return bounded;
}

/**
 * Gets the vertices that are in bounds. 
 * 
 * @export
 * @param {Triangle[]} faces 
 * @param {osg.BoundingBox} bounds 
 * @returns {{ bounded: Triangle[], unbounded: Traingle[] }} 
 */
export function getBoundedVertices(faces: Triangle[], bounds: osg.BoundingBox): { bounded: Triangle[], unbounded: Traingle[] } {
    const vertices = [].concat(faces);
    const bounded = vertices.filter((v) => isBounded(v, bounds));
    const unbounded = vertices.filter((v) => !isBounded(v, bounds));
    return {
        bounded, unbounded
    };
}

export function getCrossingNumber(point: Point, shape: Point[]): number {
    let cn = 0;

    const P = { x: point[0], y: point[1] };
    const V = [];
    shape.forEach((edge) => V.push({ x: edge[0], y: edge[1] }));

    for (let i = 0; i < shape.length - 1; i += 1) {
        if (
            ((V[i].y <= P.y) && (V[i + 1].y > P.y)) ||
            ((V[i].y > P.y) && (V[i + 1].y <= P.y))
        ) {
            const vt = (P.y - V[i].y) / (V[i + 1].y - V[i].y);
            if (P.x < V[i].x + vt * (V[i + 1].x - V[i].x)) {
                cn += 1;
            }
        }
    }
    return (cn % 2);
}

export const checkBoundsForTriangle = checkBoundsForTriVariant(2, 3);
export const checkBoundsForTriStrips = checkBoundsForTriVariant(2, 1);
export const checkBoundsForPrimitive = [
    null, 						// osg.PrimitiveSet.POINTS
    null, 						// osg.PrimitiveSet.LINES
    null, 						// osg.PrimitiveSet.LINE_LOOP
    null, 						// osg.PrimitiveSet.LINE_STRIP
    checkBoundsForTriangle,	// osg.PrimitiveSet.TRIANGLES
    checkBoundsForTriStrips,	// osg.PrimitiveSet.TRIANGLE_STRIP
    null, 						//osg.PrimitiveSet.TRIANGLE_FAN
];

export type BoundsChecker = (primitive: osg.DrawElements, geometry: osg.Geometry, bounds: osg.BoundingBox, shape: Point[]) => FacesAndEdges;

export function checkBoundsForTriVariant(start: number, increment: number): BoundsChecker {
    return (primitive, geometry: osg.Geometry, bounds: osg.BoundingBox, shape: Point[]) => {
        const toReturn = {
            points: [],
            edges: [],
        };

        const indices = primitive.indices._elements;
        const vertices = geometry.getAttributes().Vertex._elements;

        for (let i = start; i < indices.length; i += increment) {
            const faceIndices = [indices[i], indices[i - 1], indices[i - 2]];
            const face: Triangle = faceIndices.map((j) => [vertices[j], vertices[j + 1], vertices[j + 2]]) as any;
            const { bounded, unbounded } = getBoundedVertices([face], bounds)

            if (bounded.length > 0) {
                const truncated = truncateToShape(face, shape);
                if (truncated) {
                    toReturn.points = toReturn.points.concat(truncated.points);
                    toReturn.edges = toReturn.edges.concat(truncated.edges);
                }
            }
        }
        return toReturn;
    }
}

export function lineFromPoints(points, fill?): osg.Geometry {
    const vertices = new Float32Array(2 * points.length * 3);
    for (let i = 0; i < points.length; i++) {
        vertices[3 * i] = points[i][0];
        vertices[3 * i + 1] = points[i][1];
        vertices[3 * i + 2] = points[i][2];
    }

    const geom = new osg.Geometry();
    console.log('geom', geom, points);

    const normals = createNormalArray(points.length, 0, -1, 0);
    const colors = createColorsArray(points.length);

    geom.setVertexAttribArray('Vertex', new osg.BufferArray(osg.BufferArray.ARRAY_BUFFER, vertices, 3));
    geom.setVertexAttribArray('Normal', new osg.BufferArray(osg.BufferArray.ARRAY_BUFFER, normals, 3));
    geom.setVertexAttribArray('Color', new osg.BufferArray(osg.BufferArray.ARRAY_BUFFER, colors, 3));

    geom.getPrimitiveSetList()
        .push(new osg.DrawArrays(osg.PrimitiveSet.LINE_STRIP, 0, points.length));
    return geom;
}

/**
 * Creates a prism geometry from the points (shooting strait up)
 * 
 * Assumes points are in xyz where y represense the height rather
 * than osgjs usual z.
 * 
 * Previously named Create selection model
 * 
 * @export
 * @param {ol.Coordinate[]} points 
 * @param {number} top 
 * @param {number} bottom 
 * @returns {osg.MatrixTransform} 
 */
export function makePrismSlice(points: ol.Coordinate[], top: number, bottom: number): osg.MatrixTransform {
    const root = new osg.MatrixTransform();
    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const nextPoint = points[(i + 1) % points.length];
        // Create a rectangular face for every side
        const bottomLeft = [point[0], point[1], bottom];
        const widthVec = [nextPoint[0] - point[0], nextPoint[1] - point[1], 0];
        const heightVec = [0, 0, (top - bottom)];
        const args = [
            ...bottomLeft,
            ...widthVec,
            ...heightVec,
        ];
        const quad = (osg as any).createTexturedQuadGeometry(...args);
        root.addChild(quad);
    }
    const material = new osg.Material();
    material.setDiffuse([0.0, 0.0, 1.0, 0.5]);
    material.setAmbient([1.0, 1.0, 1.0, 1.0]);
    material.setSpecular([1.0, 1.0, 1.0, 0.0]);
    material.setEmission([0.0, 0.0, 0.0, 0.5]);

    root.getOrCreateStateSet().setRenderingHint('TRANSPARENT_BIN');
    root.getOrCreateStateSet().setAttributeAndModes(new osg.BlendFunc('SRC_ALPHA', 'ONE_MINUS_SRC_ALPHA'));
    root.getOrCreateStateSet().setAttributeAndModes(new osg.CullFace('DISABLE'));
    root.getOrCreateStateSet().setAttributeAndModes(material);
    return root;
}

export function makeSurface(points: Point[] | number[]) {
    const root = new osg.MatrixTransform();
    let vertices: number[] = (points as number[]);
    // Check if 2D array or not.
    if (Array.isArray(vertices[0])) {
        // Flatten
        vertices = [].concat(...vertices);
    }
    const MAX_SIZE = 2 ** 16 - 1;
    const TRIANGLE_COUNT = vertices.length / 3;
    for (let triangleIndex = 0; triangleIndex < TRIANGLE_COUNT; triangleIndex += MAX_SIZE) {
        const node = new osg.MatrixTransform();

        const cap = Math.min(MAX_SIZE, TRIANGLE_COUNT - triangleIndex);
        const vertexBuffer = new Float32Array(cap * 3);
        const indexBuffer = new Uint16Array(cap);

        for (let i = 0; i <= cap; i++) {
            indexBuffer[i] = i;
            // Set vertex buffer.
            vertexBuffer[(i * 3) + 0] = vertices[((triangleIndex + i) * 3) + 0];
            vertexBuffer[(i * 3) + 1] = vertices[((triangleIndex + i) * 3) + 1];
            vertexBuffer[(i * 3) + 2] = vertices[((triangleIndex + i) * 3) + 2];
        }
        console.log('vertexBufer', vertexBuffer);
        const g = new osg.Geometry();
        g.getAttributes().Vertex = new osg.BufferArray(osg.BufferArray.ARRAY_BUFFER, vertexBuffer, 3);
        g.getPrimitives()
            .push(
            new osg.DrawElements(osg.PrimitiveSet.TRIANGLES,
                new osg.BufferArray(osg.BufferArray.ELEMENT_ARRAY_BUFFER, indexBuffer, 1)));

        node.addChild(g);
        root.addChild(node);
    }
    return root;
}

export function makeTri(p1: Point, p2: Point, p3: Point) {
    const points = [
        p1, p2, p3
    ];
    return makeSurface(points);
}

/**
 * Checks if point is withing xy bounds. Does not check z.
 * 
 * @export
 * @param {Point} point 
 * @param {osg.BoundingBox} bounds 
 * @returns {boolean} 
 */
export function isBounded(point: Point, bounds: osg.BoundingBox, checkZ?: boolean): boolean {
    const min = bounds.getMin();
    const max = bounds.getMax();
    if ((Math.max(min[0], Math.min(max[0], point[0])) == point[0])
        && Math.max(min[1], Math.min(max[1], point[1])) == point[1])) {
        if (checkZ) {
            if (Math.max(min[2], Math.min(max[2], point[2])) == point[2]) {
                return true;
            }
            return false;
        }
        return true;
    }
    return false;
}

export function isClockwise(face: Triangle) {
    return calcNormal(face)[2] >= 0;
}

export function isParallel(face: Triangle) {
    return osg.Vec3.length2(calcNormal(face)) === 0;
}

export function sampleHeightsAlong(coords: ol.Coordinate[], resolution: number, getPoint: GetWorldPoint,
    projection?: ol.ProjectionLike) {

    const points = coords.map((c) => getPoint(c, projection));
    const samples = [];
    for (let i = 0; i < points.length - 1; i += 1) {
        const start = [points[i][0], points[i][1]];
        const end = [points[i + 1][0], points[i + 1][1]];
        const slope = osg.Vec2.sub(end, start, []);
        const distance = osg.Vec2.length(slope);
        let incr = 0;
        samples.push(points[i]);
        while (incr < distance) {
            const point = getPoint(osg.Vec2.add(start, osg.Vec2.mult(slope, incr / distance, []), []), null);
            samples.push(point);
            incr += resolution;
        }
    }
    return samples;
}


// Todo figure out what this does
export function transformMat4(out: osg.Vec3, a: osg.Vec3, m: osg.Matrix) {
    let x = a[0],
        y = a[1],
        z = a[2],
        w = m[3] * x + m[7] * y + m[11] * z + m[15];

    w = w || 1.0;
    out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return out;
}

/**
 * Return scalar multiplier that will keep a vector from start going to heading
 * on the shape. 2 DIMENSIONAL TRUNCATION
 * 
 * @export
 * @param {Point} start 
 * @param {Point} heading 
 * @param {any} shape 
 * @returns {number} 
 */
export function truncateToEdge(start: Point, heading: Point, shape: Point[]): number {
    const p = start;
    const r = heading;

    for (let i = 1; i < shape.length; i++) {
        const q = shape[i - 1];
        const s = osg.Vec2.sub(shape[i], shape[i - 1], []);

        const tNum = v2Cross(osg.Vec2.sub(q, p, p[]), s);
        const tDen = v2Cross(r, s);

        if (tDen !== 0 && tNum !== 0) {
            const t = tNum / tDen;
            if (t >= 0 && t <= 1) return t;
        }
    }

    return 1;
}

export function truncateToShape(face: Triangle, shape: Point[]): FacesAndEdges {
    const winding = [];
    const crossing = [];
    const sum = [];

    const inside: Point[] = [];
    const outside: Point[] = [];

    // will be returned
    let points;
    let edges;

    const v1 = osg.Vec3.sub(face[0], face[1], []);
    const v2 = osg.Vec3.sub(face[2], face[1], []);
    const cross = osg.Vec3.cross(v1, v2, []);
    if (osg.Vec3.length2(cross) <= 0) return null;

    face.forEach((point) => {
        switch (getCrossingNumber(point, shape)) {
            case 1:
                inside.push(point);
                break;
            case 0:
                outside.push(point);
        }
    });

    if (inside.length === 3) {
        points = clockwise([face]);
        break;
    } else if (inside.length === 2) {
        const w1 = osg.Vec3.sub(outside[0], inside[0], []);
        const w2 = osg.Vec3.sub(outside[0], inside[1], []);

        const t1 = truncateToEdge(inside[0], w1, shape);
        const t2 = truncateToEdge(inside[1], w2, shape);

        const v1 = osg.Vec3.add(osg.Vec3.mult(w1, t1, []), inside[0], []);
        const v2 = osg.Vec3.add(osg.Vec3.mult(w2, t2, []), inside[1], []);

        points = clockwise([
            [inside[0], inside[1], v2],
            [inside[0], v1, v2],
        ]);
        edges = [[...v1], [...v2]];
    } else if (inside.length === 3) {
        const w1 = osg.Vec3.sub(outside[0], inside[0], []);
        const w2 = osg.Vec3.sub(outside[1], inside[1], []);

        const t1 = truncateToEdge(inside[0], w1, shape);
        const t2 = truncateToEdge(inside[0], w2, shape);

        const v1 = osg.Vec3.add(osg.Vec3.mult(w1, t1, []), inside[0], []);
        const v2 = osg.Vec3.add(osg.Vec3.mult(w2, t2, []), inside[0], []);

        points = clockwise([
            [inside[0], v1, v2]
        ]);
        edges = [[...v1], [...v2]];
    }
    return {
        points,
        edges
    };
}

export function v2Cross(v1: Point, v2: Point) {
    return (v1[0] * v2[1]) - (v1[1] * v2[0]);
}
