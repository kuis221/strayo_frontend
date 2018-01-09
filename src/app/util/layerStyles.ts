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

