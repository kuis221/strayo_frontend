import * as ol from 'openlayers';


const nullFill = new ol.style.Fill();
const nullStroke = new ol.style.Stroke();
const nullText = new ol.style.Text();

export const siteMarkerStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: 'rgba(200,200,200,0.5)',
        width: 3
    }),
    fill: new ol.style.Fill({
        color: 'aquamarine'
    })
});

export const stateStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: '#AEC0CB',
        width: 0.2
    }),
});

export const countryStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: '#AEC0CB',
        width: 1
    }),
    fill: new ol.style.Fill({
        color: 'white',
    }),
    text: new ol.style.Text({
        font: '12px san_fancisco_textregular, Arial',
        fill: new ol.style.Fill({
            color: '#000'
        })
    })
});

export const annotationInteractionStyle = new ol.style.Style({
    fill: new ol.style.Fill({
        color: 'rgba(255, 255, 255, 0.2)'
    }),
    stroke: new ol.style.Stroke({
        color: 'rgba(0, 0, 0, 0.5)',
        lineDash: [10, 10],
        width: 2
    }),
    image: new ol.style.Circle({
        radius: 5,
        stroke: new ol.style.Stroke({
            color: 'rgba(0, 0, 0, 0.7)'
        }),
        fill: new ol.style.Fill({
            color: 'rgba(255, 255, 255, 0.2)'
        })
    })
});

export function annotationStyle(feature: ol.Feature, resolution: number) {
    const geom = feature.getGeometry();
    switch (geom.getType()) {
        case 'LineString':
            return new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: 'aquamarine',
                    width: 3
                })
            });
        default:
            return new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: 'white',
                    width: 3
                }),
                fill: new ol.style.Fill({
                    color: 'aquamarine'
                })
            });
    }
}

export function shotplanStyle(feature: ol.Feature, resolution: number) {
    const geometry = feature.getGeometry();
    return [
        new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: 'aquamarine',
            }),
            geometry: function (feature) {
                return (geometry as ol.geom.GeometryCollection).getGeometries().find(g => g.getType() === 'LineString');
            }
        }),
        new ol.style.Style({
            image: new ol.style.Circle({
                radius: 5,
                fill: new ol.style.Fill({
                    color: 'white',
                }),
                stroke: new ol.style.Stroke({
                    color: 'aquamarine'
                })
            }),
            geometry: function(feature) {
                const coordinates = [
                    ...(geometry as ol.geom.GeometryCollection).getGeometries()
                        .filter(g => g.getType() === 'MultiPoint')
                        .map((g: ol.geom.MultiPoint) => g.getFirstCoordinate())
                ];
                return new ol.geom.MultiPoint(coordinates);
            }
        })]
    
    // if (geometry.getType() === 'GeometryCollection') {
    //     console.log('here in geometry collection');
    //     return withStyles(...(geometry as ol.geom.GeometryCollection).getGeometries().map((geom) => shotplanStyle(new ol.Feature({ geometry: geom }), resolution)))(feature, resolution);

    // } else if (geometry.getType() === 'LineString') {
    //     console.log('got this geometry');
    //     return new ol.style.Style({
    //         stroke: new ol.style.Stroke({
    //             color: 'aquamarine',
    //             width: 3
    //         }),
    //         fill: new ol.style.Fill({
    //             color: 'aquamarine'
    //         })
    //     });
    // }else {

    //     return new ol.style.Style({
    //         stroke: new ol.style.Stroke({
    //             color: 'white',
    //             width: 3
    //         }),
    //         fill: new ol.style.Fill({
    //             color: 'aquamarine'
    //         })
    //     });
    // }
}

export function withStyles(...styles: Array<ol.style.Style | ol.style.Style[] | ol.StyleFunction>): ol.StyleFunction {
    return (feature: ol.Feature, resolution: number) => {
        const toReturn = [];
        styles.forEach((style) => {
            if ((typeof style !== 'function')) {
                if (!Array.isArray(style)) {
                    toReturn.push(style);
                } else {
                    toReturn.push(...style);
                }
                return;
            }
            const newStyle = style(feature, resolution);
            if (!Array.isArray(style)) {
                toReturn.push(newStyle);
            } else {
                toReturn.push(...style);
            }
        });
        console.log('toReturn', toReturn);
        return toReturn;
        // return toReturn.reduce(styleReducer, new ol.style.Style({}));
    };
    // Please fill in as you go along
    // function styleReducer(acc: ol.style.Style, current: ol.style.Style) {
    //     console.log('reducing', acc, current)
    //     if (current.getFill()) {
    //         const p = acc.getFill() || nullFill;
    //         const c = current.getFill();
    //         acc.setFill(new ol.style.Fill({
    //             color: c.getColor() || p.getColor(),
    //         }))
    //     }
    //     if (current.getStroke()) {
    //         const p = acc.getStroke() || nullStroke;
    //         const c = current.getStroke();
    //         acc.setStroke(new ol.style.Stroke({
    //             color: c.getColor() || p.getColor(),
    //             width: c.getWidth() || p.getWidth(),
    //             lineCap: c.getLineCap() || p.getLineCap(),
    //             lineDash: c.getLineDash() || p.getLineDash(),
    //             lineJoin: c.getLineJoin() || p.getLineJoin(),
    //             miterLimit: c.getMiterLimit() || p.getMiterLimit(),
    //         }))
    //     }
    //     return acc;
    // }
}