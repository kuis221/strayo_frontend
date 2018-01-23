import * as ol from 'openlayers';

/**
 * Listens to an ol object event, returns function that unsubscribes.
 * 
 * @export
 * @param {ol.Object} obj 
 * @param {any} event 
 * @param {Function} listener 
 * @returns 
 */
export function listenOn(obj: ol.Object, event, listener: Function) {
    obj.on(event, listener);
    let called = false;
    return () => {
        if (called) return;
        obj.un(event, listener);
        called = true;
    };
}
