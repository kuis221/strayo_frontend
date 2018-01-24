import { Subscription } from 'rxjs/Subscription';

export function subscribeOn(sub: Subscription) {
    let called = false;
    return () => {
        if (called) return;
        sub.unsubscribe();
        called = true;
    };
}
