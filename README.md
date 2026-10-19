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
connection. Output is refreshed at most once per animation frame and keeps the most recent 200,000
characters. Pending output is also bounded while background tabs suspend animation frames.
Clear also discards logs waiting to be displayed.

URLs are trimmed before connecting. Centrifuge endpoints are validated against the selected transport,
and the normalized URLs are saved for the next session. Connection attempts and pending RPC responses
are isolated so a previous connection cannot overwrite the current output.

WebSocket receive backlog is limited to 1,000 messages or 8 MiB, including a message being decoded.
Exceeding either limit reports an error, discards pending messages, and closes the connection.
Sending is refused when the message would take the browser's outgoing buffer above 8 MiB;
retry after the connection catches up. Normal remote closure finishes displaying already received messages.

Centrifuge connection and subscription JWTs renew automatically when the server requests a refresh.
Renewal uses the settings from the active connection. Invalid configuration or token preparation failure
preserves the current connection. Replaced clients release their global network listeners.
URL fields also accept Enter to connect, and URL schemes are case insensitive.

Regression tests cover connection cleanup and failures, concurrent connections, JSON/Protobuf RPC,
message ordering and backpressure, token refresh, UTF-8 and compression decoding, batched error logging,
URL validation, and unavailable browser storage.
They use local mocks and do not require a running push server.
