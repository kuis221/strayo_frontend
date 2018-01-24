import { GetWorldPoint } from './types';
import tinycolor from 'tinycolor2';

export function featureToOSGJS(style: ol.style.Style | ol.style.Style[] | ol.StyleFunction, feature: ol.Feature, getWorldPoint: GetWorldPoint, proj?: ol.ProjectionLike): osg.Node {
    const featureNode = new osg.Node();
    const styles = [];
    const pushStyle = (style: ol.style.Style | ol.style.Style[]) => {
        if (Array.isArray(style)) {
            styles.push(...style);
        } else {
            styles.push(style);
        }
    };
    if (typeof style === 'function') {
        const newStyle = style(feature, 1);
        pushStyle(newStyle);
    } else {
        pushStyle(style);
    }

    styles.forEach((s) => {
        const goemNode = convertFeature(s, feature);
        featureNode.addChild(goemNode);
    });

    return featureNode;

    function convertFeature(style: ol.style.Style, feature: ol.Feature) {
        const geometryFunc = style.getGeometryFunction()
        let geometry = geometryFunc(feature) as ol.geom.Geometry;
        return geometryToOSGJS(style, geometry, getWorldPoint, proj);
    }
}

export function geometryToOSGJS(style: ol.style.Style, geometry: ol.geom.Geometry, getWorldPoint: GetWorldPoint, proj?: ol.ProjectionLike): osg.Node {
    const type = geometry.getType();
    if (type === 'LineString') {
        return lineStringToOSGJS(style, geometry as ol.geom.LineString, getWorldPoint, proj);
    }
    return new osg.Node();
}

export function lineStringToOSGJS(style: ol.style.Style, geometry: ol.geom.LineString, getWorldPoint: GetWorldPoint, proj?: ol.ProjectionLike): osg.Node {
    const rootNode = new osg.Node();
    const coords = geometry.getCoordinates();
    const points = coords.map(coord => getWorldPoint(coord, proj));
    const geom = lineFromPoints(points);
    // const colorAttribArray = geom.getVertexAttributeList().Color;
    // const colorArray = colorAttribArray.getElements();
    const stroke = style.getStroke().getColor() || 'white';
    const rgb = tinycolor(stroke).toRgb();
    const color = [rgb.r, rgb.g, rgb.b, 255].map((n) => n / 255) as [number, number, number, number];
    // for (let i = 0; i < (colorArray.length / 3); i += 3) {
    //     colorArray[i] = color[0];
    //     colorArray[i + 1] = color[1];
    //     colorArray[i + 2] = color[2];
    // }
    console.log('setting color', color);
    var material = new osg.Material();
    material.setDiffuse(color);
    rootNode.getOrCreateStateSet().setAttributeAndModes(material);

    // colorAttribArray.setElements(colorArray);
    // geom.setVertexAttribArray('Color', colorAttribArray);
    rootNode.addChild(geom);
    return rootNode;
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

export function lineFromPoints(points): osg.Geometry {
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