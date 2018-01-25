import { GetWorldPoint } from './types';
import tinycolor from 'tinycolor2';

export function featureToOSGJS(style: ol.style.Style | ol.style.Style[] | ol.StyleFunction, feature: ol.Feature,
    getWorldPoint: GetWorldPoint, proj?: ol.ProjectionLike): osg.Node {

    const featureNode = new osg.Node();
    const styles = [];
    const pushStyle = (s: ol.style.Style | ol.style.Style[]) => {
        if (Array.isArray(s)) {
            styles.push(...s);
        } else {
            styles.push(s);
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

    function convertFeature(s: ol.style.Style, f: ol.Feature) {
        const geometryFunc = s.getGeometryFunction();
        const geometry = geometryFunc(f) as ol.geom.Geometry;
        return geometryToOSGJS(s, geometry, getWorldPoint, proj);
    }
}

export function geometryToOSGJS(style: ol.style.Style,
    geometry: ol.geom.Geometry, getWorldPoint: GetWorldPoint, proj?: ol.ProjectionLike): osg.Node {
    const type = geometry.getType();
    if (type === 'LineString') {
        return lineStringToOSGJS(style, geometry as ol.geom.LineString, getWorldPoint, proj);
    } else if (type === 'Circle') {
        return circleToOSGJS(style, geometry as ol.geom.Circle, getWorldPoint, proj);
    }
    return new osg.Node();
}

export function circleToOSGJS(style: ol.style.Style,
geometry: ol.geom.Circle, getWorldPoint: GetWorldPoint, proj?: ol.ProjectionLike): osg.Node 
{

    const rootNode = new osg.Node();

    const stroke = style.getStroke();
    const fill = style.getFill();
    // if (!(stroke && fill)) return rootNode;
    if (!stroke && !fill) return rootNode;
    const material = new osg.Material();

    let strokeWidth = 0;
    let strokeColor: [number, number, number, number] = [1, 1, 1, 1];
    let fillColor: [number, number, number, number] = [1, 1, 1, 1];
    if (stroke) {
        strokeWidth = stroke.getWidth();
        // Decrease intensity by 3
        const update = colorToColorArray(stroke.getColor() || 'transparent');
        update[1] = 1;
        strokeColor = update;
    }
    if (fill) {
        fillColor = colorToColorArray(fill.getColor() || 'transparent');
    }
    const brightness = 0.3;
    console.log('style circle', strokeColor, fillColor);
    material.setEmission([brightness, brightness, brightness, brightness]);
    material.setAmbient(strokeColor);
    material.setDiffuse(fillColor);
    material.setSpecular(strokeColor);

    // create geometry
    const coord = geometry.getCenter();
    const point = getWorldPoint(coord, proj);
    const geom = osg.createTexturedSphere(geometry.getRadius() + strokeWidth, 32, 32);
    const subroot = new osg.MatrixTransform();
    osg.Matrix.setTrans(subroot.getMatrix(), point[0], point[1], point[2]);
    subroot.addChild(geom);
    rootNode.addChild(subroot);

    console.log('size', geometry.getRadius() + strokeWidth);

    
    // rootNode.getOrCreateStateSet().setAttributeAndModes(new osg.Depth(osg.Depth.DISABLE));
    // rootNode.getOrCreateStateSet().setAttributeAndModes(new osg.CullFace('DISABLE'));
    rootNode.getOrCreateStateSet().setAttributeAndModes(material);
    return rootNode;
}

export function lineStringToOSGJS(style: ol.style.Style,
    geometry: ol.geom.LineString, getWorldPoint: GetWorldPoint, proj?: ol.ProjectionLike): osg.Node {
    const rootNode = new osg.Node();
    const coords = geometry.getCoordinates();
    const points = coords.map(coord => getWorldPoint(coord, proj));
    const geom = lineFromPoints(points);
    // const colorAttribArray = geom.getVertexAttributeList().Color;
    // const colorArray = colorAttribArray.getElements();

    const stroke = (style.getStroke() && style.getStroke().getColor()) || 'transparent';
    const color = colorToColorArray(stroke);
    // for (let i = 0; i < (colorArray.length / 3); i += 3) {
    //     colorArray[i] = color[0];
    //     colorArray[i + 1] = color[1];
    //     colorArray[i + 2] = color[2];
    // }
    console.log('setting color', color);
    const material = new osg.Material();
    // material.setAmbient(color);
    material.setEmission(color);
    // material.setSpecular(color);
    material.setDiffuse(color);
    // material.setEmission(color);
    rootNode.getOrCreateStateSet().setAttributeAndModes(new osg.Depth(osg.Depth.DISABLE));
    rootNode.getOrCreateStateSet().setAttributeAndModes(new osg.CullFace('DISABLE'));
    rootNode.getOrCreateStateSet().setAttributeAndModes(material);

    // colorAttribArray.setElements(colorArray);
    // geom.setVertexAttribArray('Color', colorAttribArray);
    rootNode.addChild(geom);
    return rootNode;
}

export function colorToColorArray(color, lightness?: number): [number, number, number, number] {
    const org = tinycolor(color);
    const rgb = tinycolor(org).toRgb();
    return [rgb.r / 255, rgb.g / 255, rgb.b / 255, org.getAlpha()] as [number, number, number, number];
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
