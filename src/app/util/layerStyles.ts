import * as ol from 'openlayers';

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
        return toReturn;
    };

    function styleReducer(acc: ol.style.Style, current: ol.style.Style) {
        if (acc.getFill() && current.getFill()) {
            acc.setFill(current.getFill());
        }
        if (acc.getStroke() && current.getStroke()) {
            const p = acc.getStroke();
            const c = current.getStroke();
            acc.setStroke(new ol.style.Stroke({
                color: c.getColor() || p.getColor(),
                width: c.getWidth() || p.getWidth(),
                lineCap: c.getLineCap() || p.getLineCap(),
                lineDash: c.getLineDash() || p.getLineDash(),
                lineJoin: c.getLineJoin() || p.getLineJoin(),
                miterLimit: c.getMiterLimit() || p.getMiterLimit(),
            }));
            acc.setStroke(current.getStroke());
        }
        if (acc.getText() && current.getText()) {
            acc.setText(current.getText());
        }
        if (acc.getImage() && current.getImage()) {
            acc.setImage(current.getImage());
        }
        return acc;
    }
}