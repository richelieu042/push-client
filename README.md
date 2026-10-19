# push-client

- JavaScript Client for WebSocket, SSE and Centrifugo.
- Node.js: 22.22.2+ (22.x), 24.15.0+ (24.x, recommended), or 26+; npm 10+.

TypeScript uses 6.0 because Vue's type-checking tools still require its compiler API.
See [TypeScript and Embedded Languages](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#typescript-and-embedded-languages).

## Recommended IDE Setup
[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and
disable Vetur).

## Type Support for `.vue` Imports in TS
TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for
type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the
TypeScript language service aware of `.vue` types.

## Customize configuration
See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup
```sh
npm ci
```

### Compile and Hot-Reload for Development
```sh
npm run dev
```

### Type-Check, Compile and Minify for Production
```sh
npm run build
```


