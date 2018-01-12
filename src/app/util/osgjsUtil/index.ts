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
        const segment = 50;
        const geometry = (feature.getGeometry() as ol.geom.Circle);
        const geom = osg.createTexturedSphereGeometry(0.2, segment, segment);
        const n = geom.getVertexAttributeList().Vertex.getElements().length / 3;
        const colors = createColorsArray(n);

        geom.setVertexAttribArray('Color', new osg.BufferArray(osg.BufferArray.ARRAY_BUFFER, colors, 3));
        geom.getPrimitiveSetList().length = 0;
        geom.getPrimitiveSetList().push(new osg.DrawArrays(osg.PrimitiveSet.POINTS, 0, segment * segment * 4));
        // const mt = new osg.MatrixTransform();
        // mt.addChild(geom);
        const node = new osg.MatrixTransform();
        osg.Matrix.setTrans(node.getMatrix(), getPoint(geometry.getCenter(), proj));
        node.addChild(geom);
        return node;
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
