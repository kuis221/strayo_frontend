// Small library for handling progress in our app.
import * as ol from 'openlayers';

export type ProgressCallback = (index: number, size: number) => void;

export interface IProgress {
    stage?: string;
    details?: string;
    index: number;
    length: number;
}
export class Progress<T = {}> extends ol.Object {

    constructor(props?: IProgress) {
        super(props);
        const index = this.get('index') || 0;
        const length = this.get('length') || 1;
        this.set('length', length);
    }

    public details(): string;
    public details(details: string): this;
    public details(details?: string): string | this {
        if (details !== undefined) {
            this.set('details', details);
            return this;
        }
        return this.get('details');
    }

    public error(): Error;
    public error(error: Error): this;
    public error(error?: Error): Error | this {
        if (error !== undefined) {
            this.set('error', error);
            return this;
        }
        return this.get('error');
    }

    public finalValue(): T;
    public finalValue(finalValue: T): this;
    public finalValue(finalValue?: T): T | this {
        if (finalValue !== undefined) {
            this.set('final_value', finalValue);
            return this;
        }
        return this.get('final_value');
    }

    public progress(): number;
    public progress(index: number, length?: number | { length: number}): this;
    public progress(index?: number, length?: number | { length: number}): number | this {
        if (index !== undefined) {
            length = length || this.get('length');
            const newLength = (length as any).length || length;
            const oldValue = this.progress();
            this.set('index', index);
            this.set('length', newLength);
            // this.dispatchEvent('change:progress');
            this.dispatchEvent({ type: 'change:progress', key: 'progress', oldValue });
            return this;
        }
        return this.get('index') / this.get('length');
    }

    public stage(): string;
    public stage(stage: string): this;
    public stage(stage?: string): string | this {
        if (stage !== undefined) {
            this.set('stage', stage);
            return this;
        }
        return this.get('stage');
    }
    // Actual methods
    public isDone(): boolean {
        return this.progress() >= 1;
    }

    public done(obj: T) {
        console.log('in done', obj);
        const length = this.get('length');
        this.finalValue(obj);
        this.progress(length, length);
        this.dispatchEvent({ type: 'done', value: obj });
    }
}
