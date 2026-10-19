import {registerHooks} from 'node:module';

const sourceRoot = new URL('../src/', import.meta.url);

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('@/')) {
            const path = /\.[a-z]+$/i.test(specifier) ? specifier.slice(2) : `${specifier.slice(2)}.ts`;
            return nextResolve(new URL(path, sourceRoot).href, context);
        }
        if (specifier.startsWith('.') && context.parentURL?.startsWith(sourceRoot.href)
            && !/\.[a-z]+$/i.test(specifier)) {
            return nextResolve(new URL(`${specifier}.ts`, context.parentURL).href, context);
        }
        return nextResolve(specifier, context);
    },
});
