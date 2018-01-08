import * as ol from 'openlayers';
import * as moment from 'moment';
import { Annotation } from './annotation.model';

export interface IDataset {
    created_at: Date | string;
    id: number;
    is_phantom: boolean;
    lat: number;
    long: number;
    name: string;
    status: string;
    updated_at: string;
}

export class Dataset extends ol.Object {
    public annotations(): Annotation[];
    public annotations(annotations: Annotation[]): this;
    public annotations(annotations?: Annotation[]): Annotation[] | this {
        if (annotations !== undefined) {
            this.set('annotations', annotations);
            return this;
        }
        return this.get('annotations');
    }

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
    
    public color(): string;
    public color(color: string): this;
    public color(color?: string): string | this {
        if (color !== undefined) {
            this.set('color', color);
            return this;
        }
        return this.get('color');
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

    public lat(): number;
    public lat(lat: number): this;
    public lat(lat?: number): number | this {
        if (lat !== undefined) {
            this.set('lat', +lat);
            return this;
        }
        return this.get('lat');
    }

    public long(): number;
    public long(long: number): this;
    public long(long?: number): number | this {
        if (long !== undefined) {
            this.set('long', +long);
            return this;
        }
        return this.get('long');
    }


    public name(): string;
    public name(name: string): this;
    public name(name?: string): string | this {
        if (name !== undefined) {
            this.set('name', name);
            return this;
        }
        return this.get('name');
    }

    public status(): string;
    public status(status: string): this;
    public status(status?: string): string | this {
        if (status !== undefined) {
            this.set('status', status);
            return this;
        }
        return this.get('status');
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

    // Actual methods
}