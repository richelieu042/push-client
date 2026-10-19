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

### Run Regression Tests
```sh
npm test
```

Connection views and compression libraries load on demand. Switching views closes the previous
connection, and the output keeps the most recent 200,000 characters to keep long-running sessions responsive.

URLs are trimmed before connecting. Centrifuge endpoints are validated against the selected transport,
and the normalized URLs are saved for the next session. Connection attempts and pending RPC responses
are isolated so a previous connection cannot overwrite the current output.

Regression tests cover connection cleanup and failures, concurrent connections, JSON/Protobuf RPC,
message ordering, UTF-8 and compression decoding, error logging, and unavailable browser storage.
They use local mocks and do not require a running push server.
