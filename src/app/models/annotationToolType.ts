export type AnnotationToolType = 'Polygon' | 'LineString' | 'Selection' | 'Height' | string;


export const ToolToType = {
    LineString: 'LineString',
    Polygon: 'Polygon',
};

export const ToolToThumbnail = {
    LineString: 'horizontalLength',
    Polygon: 'polygon',
};