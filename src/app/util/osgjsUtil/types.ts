export type GetWorldPoint = (point: ol.Coordinate, proj?: ol.ProjectionLike) => [number, number, number];
export type Point = ol.Coordinate;
export type Triangle = [Point, Point, Point];
export type Edge = [Point, Point];
