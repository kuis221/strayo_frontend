import * as ol from 'openlayers';
import { WebMercator } from '../projections/index';


export type GetWorldPoint = (point: ol.Coordinate, proj?: ol.ProjectionLike) => [number, number, number];

export function createColorsArray(size: number): Float32Array {
    const array = new Float32Array(size * 3);
    for (let i = 0; i < size; i++) {
        array[i * 3 + 0] = 1.0;
        array[i * 3 + 1] = 1.0;
        array[i * 3 + 2] = 1.0;
    }
    return array;
}
/**
 * Creates a prism geometry from the points (shooting strait up)
 * 
 * Assumes points are in xyz where y represense the height rather
 * than osgjs usual z.
 * 
 * @export
 * @param {ol.Coordinate[]} points 
 * @param {number} top 
 * @param {number} bottom 
 * @returns {osg.MatrixTransform} 
 */
export function createPrismSlice(points: ol.Coordinate[], top: number, bottom: number): osg.MatrixTransform {
    const root = new osg.MatrixTransform();
    // console.log('points', points[0]);
    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const nextPoint = points[(i + 1) % points.length];
        // Create a rectangular face for every side
        const bottomLeft = [point[0], point[2], bottom];
        const widthVec = [nextPoint[0] - point[0], nextPoint[2] - point[2], 0];
        const heightVec = [0, 0, (top - bottom)];
        const args = [
            // point[0], bottom, point[1],
            // 0, bottom, 0,
            // nextPoint[0] - point[0], 0, nextPoint[1] - point[1]
            ...bottomLeft,
            ...widthVec,
            ...heightVec,
        ];
        const quad = (osg as any).createTexturedQuadGeometry(...args);
        root.addChild(quad);
        console.log('args', args);
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

export function createNormalArray(size: number, x: number, y: number, z: number): Float32Array {
    const array = new Float32Array(size * 3);
    for (let i = 0; i < size; i++) {
        array[i * 3 + 0] = x;
        array[i * 3 + 1] = y;
        array[i * 3 + 2] = z;
    }
    return array;
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

export function sampleHeightsAlong(coords: ol.Coordinate[], resolution: number, getPoint: GetWorldPoint,
    projection?: ol.ProjectionLike) {

    const points = coords.map((c) => getPoint(c, projection));
    const samples = [];
    for (let i = 0; i < points.length - 1; i += 1) {
        const start = [points[i][0], points[i][2]];
        const end = [points[i + 1][0], points[i + 1][2]];
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
