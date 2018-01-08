import * as ol from 'openlayers';
import * as moment from 'moment';

import { Resource, IResource } from './resource.model';

export interface IAnnotation {
    created_at: Date | string;
    data: string;
    id: number;
    is_phantom: string;
    meta: string;
    resources: IResource[];
    type: string;
    updated_at: Date | string;
}

export class Annotation extends ol.Object {
    public createdAt(): Date;
    public createdAt(createdAt: Date | string): this;
    public createdAt(createdAt?: Date | string): Date | this {
        if (createdAt !== undefined) {
            if (typeof createdAt === 'string') {
                createdAt = moment(createdAt).toDate();
            }
            this.set('created_at', createdAt);
            return this;
        }
        return this.get('created_at');
    }

    public data(): ol.Collection<ol.Feature> | ol.Feature;
    public data(data: ol.Collection<ol.Feature> | ol.Feature): this;
    public data(data?: ol.Collection<ol.Feature> | ol.Feature): ol.Collection<ol.Feature> | ol.Feature | this {
        if (data !== undefined) {
            this.set('data', data);
            return this;
        }
        return this.get('data');
    }

    public id(): number;
    public id(id: number): this;
    public id(id?: number): number | this {
        if (id !== undefined) {
            this.set('id', +id);
            return this;
        }
        return this.get('id');
    }

    public isPhantom(): boolean;
    public isPhantom(isPhantom: boolean): this;
    public isPhantom(isPhantom?: boolean): boolean | this {
        if (isPhantom !== undefined) {
            this.set('is_phantom', isPhantom);
            return this;
        }
        return this.get('is_phantom');
    }

    public meta(): {};
    public meta(meta: {}): this;
    public meta(meta?: {}): {} | this {
        if (meta !== undefined) {
            this.set('meta', meta);
            return this;
        }
        return this.get('meta');
    }

    public resources(): Resource[];
    public resources(resources: Resource[]): this;
    public resources(resources?: Resource[]): Resource[] | this {
        if (resources !== undefined) {
            this.set('resources', resources);
            return this;
        }
        return this.get('resources');
    }

    public type(): string;
    public type(type: string): this;
    public type(type?: string): string | this {
        if (type !== undefined) {
            this.set('type', type);
            return this;
        }
        return this.get('type');
    }

    public updatedAt(): Date;
    public updatedAt(updatedAt: Date | string): this;
    public updatedAt(updatedAt?: Date | string): Date | this {
        if (updatedAt !== undefined) {
            if (typeof updatedAt === 'string') {
                updatedAt = moment(updatedAt).toDate();
            }
            this.set('updated_at', updatedAt);
            return this;
        }
        return this.get('updated_at');
    }


}
