import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {afterEach, beforeEach, mock, test} from 'node:test';
import {Centrifuge} from 'centrifuge';
import {Centrifuge as ProtobufCentrifuge} from 'centrifuge/build/protobuf';

globalThis.localStorage = {getItem: () => null};
const {CentrifugeClient} = await import('../src/_internal/centrifuge/CentrifugeClient.ts');
const {CentrifugeKit} = await import('../src/_chimera/longConnection/CentrifugeKit.ts');
const {Console} = await import('../src/_internal/utils/Console.ts');
const {UuidKit} = await import('../src/_chimera/id/UuidKit.ts');

const endpoints = [{transport: 'websocket', endpoint: 'ws://localhost:8000/connection/websocket'}];
let clients;
let errors;
let output;
let alerts;
let debugOutput;

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return {promise, resolve, reject};
}

beforeEach(() => {
    clients = [];
    errors = [];
    output = [];
    alerts = [];
    debugOutput = [];
    globalThis.alert = message => alerts.push(message);
    CentrifugeClient.client = null;
    CentrifugeClient.debug = false;
    CentrifugeClient.protocol = 'json';
    CentrifugeClient.secret = 'test-secret';
    CentrifugeClient.channel = 'test-channel';
    CentrifugeClient.user = 'test-user';
    CentrifugeClient.rpcMethod = 'test-method';
    CentrifugeClient.rpcData = '{"value":1}';
    mock.method(Console, 'println', message => output.push(message));
    mock.method(Console, 'error', (...args) => errors.push(args));
    mock.method(console, 'log', () => {});
    mock.method(console, 'debug', (...args) => debugOutput.push(args));
    mock.method(CentrifugeKit, 'genToken', async () => 'test-token');
    mock.method(CentrifugeKit, 'genSubToken', async () => 'test-sub-token');
    for (const Client of [Centrifuge, ProtobufCentrifuge]) {
        mock.method(Client.prototype, 'newSubscription', function (channel, options) {
            clients.push(this);
            const sub = new EventEmitter();
            sub.subscribe = mock.fn();
            sub.unsubscribe = mock.fn();
            sub.options = options;
            this._subs[channel] = sub;
            return sub;
        });
        mock.method(Client.prototype, 'connect', function () { this.state = 'connected'; });
        mock.method(Client.prototype, 'disconnect', function () {
            this.state = 'disconnected';
            this.emit('disconnected', {code: 0, reason: 'test disconnect'});
        });
        mock.method(Client.prototype, 'rpc', async () => ({data: {ok: true}}));
        mock.method(Client.prototype, 'publish', async () => ({}));
    }
});

afterEach(() => {
    CentrifugeClient.disconnect(false);
    mock.restoreAll();
});

test('matches each transport to its URL scheme and rejects fragments and unsupported transports', () => {
    for (const [url, transport, valid] of [
        ['wss://example.com/connection/websocket', 'websocket', true],
        ['https://example.com/connection/sse', 'sse', true],
        ['http://example.com/connection/http_stream', 'http_stream', true],
        ['https://example.com/sockjs', 'sockjs', true],
        ['https://example.com/webtransport', 'webtransport', true],
        ['HTTPS://example.com/webtransport', 'webtransport', true],
        ['http://example.com/webtransport', 'webtransport', false],
        ['https://example.com/connection/websocket', 'websocket', false],
        ['ws://example.com/connection/sse', 'sse', false],
        ['https://example.com/#fragment', 'sse', false],
        ['ws://example.com', 'unknown', false],
    ]) {
        assert.equal(CentrifugeClient.checkUrl(url, transport), valid, `${transport}: ${url}`);
    }
    assert.equal(CentrifugeClient.checkUrl('wss://example.com'), true);
    assert.equal(CentrifugeClient.checkUrl('https://example.com'), true);
});

test('normalizes a copied endpoint array and never logs credentials', async () => {
    const input = [{transport: 'websocket', endpoint: `  ${endpoints[0].endpoint}  `}];
    await CentrifugeClient.connect(input);
    assert.equal(clients[0]._endpoint[0].endpoint, endpoints[0].endpoint);
    assert.equal(input[0].endpoint.startsWith('  '), true);
    assert.equal(output.some(message => /test-secret|test-token|test-sub-token/.test(message)), false);
});

test('SDK debug logs exclude JWTs while initial authentication stays configured', async () => {
    CentrifugeClient.debug = true;
    await CentrifugeClient.connect(endpoints);
    assert.equal(clients[0]._token, 'test-token');
    assert.equal(clients[0]._subs['test-channel'].options.token, 'test-sub-token');
    assert.equal(debugOutput.some(args => args[0] === 'config'), true);
    assert.equal(/test-secret|test-token|test-sub-token/.test(JSON.stringify(debugOutput)), false);
});

test('invalid settings preserve an active connection and do not invalidate pending replacement', async () => {
    await CentrifugeClient.connect(endpoints);
    const active = clients[0];
    const pendingToken = deferred();
    CentrifugeKit.genToken.mock.mockImplementationOnce(() => pendingToken.promise);
    const pending = CentrifugeClient.connect(endpoints);
    for (const invalid of [null, [], [null], [{endpoint: 'ws://localhost'}], [{transport: 'websocket', endpoint: 42}], [{transport: 'sse', endpoint: 'ws://localhost'}]]) {
        await assert.doesNotReject(CentrifugeClient.connect(invalid));
        assert.equal(CentrifugeClient.client, active);
    }
    for (const [key, value] of [['secret', ''], ['channel', ' '], ['protocol', 'invalid'], ['user', 42]]) {
        const previous = CentrifugeClient[key];
        CentrifugeClient[key] = value;
        await CentrifugeClient.connect(endpoints);
        CentrifugeClient[key] = previous;
        assert.equal(CentrifugeClient.client, active);
    }
    assert.equal(Centrifuge.prototype.disconnect.mock.callCount(), 0);
    pendingToken.resolve('replacement-token');
    await pending;
    assert.equal(clients.length, 2);
    assert.equal(CentrifugeClient.client, clients[1]);
    assert.equal(Centrifuge.prototype.disconnect.mock.callCount(), 1);
});

test('preparation errors are logged and preserve the active connection', async () => {
    await CentrifugeClient.connect(endpoints);
    const active = clients[0];
    const failure = new Error('UUID unavailable');
    CentrifugeClient.user = '';
    mock.method(UuidKit, 'v4', () => { throw failure; });
    await assert.doesNotReject(CentrifugeClient.connect(endpoints));
    assert.equal(errors[0][1], failure);
    assert.equal(CentrifugeClient.client, active);
    CentrifugeClient.user = 'test-user';
    CentrifugeKit.genToken.mock.mockImplementationOnce(async () => { throw failure; });
    await assert.doesNotReject(CentrifugeClient.connect(endpoints));
    assert.equal(errors[1][1], failure);
    assert.equal(CentrifugeClient.client, active);
    Centrifuge.prototype.newSubscription.mock.mockImplementationOnce(() => { throw failure; });
    await assert.doesNotReject(CentrifugeClient.connect(endpoints));
    assert.equal(errors[2][1], failure);
    assert.equal(CentrifugeClient.client, active);
});

test('SDK client and subscription errors retain their structured diagnostics', async () => {
    await CentrifugeClient.connect(endpoints);
    const clientError = {code: 7, message: 'connection failed', temporary: true};
    const subscriptionError = {code: 8, message: 'subscription failed'};
    clients[0].emit('error', {type: 'transport', transport: 'websocket', error: clientError});
    clients[0]._subs['test-channel'].emit('error', {channel: 'test-channel', type: 'subscribe', error: subscriptionError});
    assert.equal(errors[0][1], clientError);
    assert.equal(errors[1][1], subscriptionError);
});

test('connection and subscription refresh tokens use the active connection settings snapshot', async () => {
    await CentrifugeClient.connect(endpoints);
    const client = clients[0];
    CentrifugeClient.secret = 'edited-secret';
    CentrifugeClient.user = 'edited-user';
    CentrifugeClient.channel = 'edited-channel';
    assert.equal(await client._config.getToken({}), 'test-token');
    assert.equal(await client._subs['test-channel'].options.getToken({channel: 'test-channel'}), 'test-sub-token');
    assert.deepEqual(CentrifugeKit.genToken.mock.calls.at(-1).arguments, [{}, 'HS256', 'test-secret', '24h', 'test-user']);
    assert.deepEqual(CentrifugeKit.genSubToken.mock.calls.at(-1).arguments, [{}, 'HS256', 'test-secret', '24h', 'test-user', 'test-channel']);
    CentrifugeClient.disconnect(false);
    assert.equal(await client._config.getToken({}), '');
    assert.equal(await client._subs['test-channel'].options.getToken({channel: 'test-channel'}), '');
    assert.equal(CentrifugeKit.genToken.mock.callCount(), 2);
    assert.equal(CentrifugeKit.genSubToken.mock.callCount(), 2);
});

test('refresh errors preserve the original error and stale successful tokens are discarded', async () => {
    await CentrifugeClient.connect(endpoints);
    const client = clients[0];
    const failure = new Error('signing failed');
    CentrifugeKit.genToken.mock.mockImplementationOnce(async () => { throw failure; });
    await assert.rejects(client._config.getToken({}), failure);
    assert.equal(errors[0][1], failure);
    const renewal = deferred();
    CentrifugeKit.genSubToken.mock.mockImplementationOnce(() => renewal.promise);
    const refreshing = client._subs['test-channel'].options.getToken({channel: 'test-channel'});
    CentrifugeClient.disconnect(false);
    renewal.resolve('stale-sub-token');
    assert.equal(await refreshing, '');
});

test('network forwarding releases global listeners on replacement and terminal disconnect', async () => {
    const events = new EventTarget();
    const registrations = [];
    const originalAddEventListener = globalThis.addEventListener;
    globalThis.addEventListener = (type, listener, options) => {
        registrations.push({type, signal: options.signal});
        events.addEventListener(type, listener, options);
    };
    try {
        await CentrifugeClient.connect(endpoints);
        const oldTarget = clients[0]._config.networkEventTarget;
        let forwarded = 0;
        oldTarget.addEventListener('offline', () => { forwarded++; });
        events.dispatchEvent(new Event('offline'));
        assert.equal(forwarded, 1);
        await CentrifugeClient.connect(endpoints);
        assert.equal(registrations.length, 4);
        assert.equal(registrations.slice(0, 2).every(({signal}) => signal.aborted), true);
        events.dispatchEvent(new Event('offline'));
        assert.equal(forwarded, 1);
        clients[1].emit('disconnected', {code: 3500, reason: 'server stopped'});
        assert.equal(registrations.every(({signal}) => signal.aborted), true);
        assert.equal(CentrifugeClient.getState(), 'null');
    } finally {
        if (originalAddEventListener) {
            globalThis.addEventListener = originalAddEventListener;
        } else {
            delete globalThis.addEventListener;
        }
    }
});

test('rejects mismatched transport before generating tokens or allocating a client', async () => {
    await CentrifugeClient.connect([{transport: 'sse', endpoint: 'ws://localhost/connection/sse'}]);
    assert.equal(CentrifugeKit.genToken.mock.callCount(), 0);
    assert.equal(clients.length, 0);
    assert.equal(alerts.length, 1);
});

test('derives emulation route from path while preserving a reverse proxy prefix', async () => {
    await CentrifugeClient.connect([{transport: 'sse', endpoint: 'https://example.com/proxy/connection/sse?redirect=/connection/other'}]);
    assert.equal(clients[0]._config.emulationEndpoint, 'https://example.com/proxy/emulation');
    CentrifugeClient.disconnect(false);
    await CentrifugeClient.connect([{transport: 'sse', endpoint: 'https://example.com/custom?redirect=/connection/sse'}]);
    assert.equal(clients[1]._config.emulationEndpoint, 'https://example.com/emulation');
});

test('disconnect cancels pending token generation', async () => {
    const token = deferred();
    CentrifugeKit.genToken.mock.mockImplementation(() => token.promise);
    const connecting = CentrifugeClient.connect(endpoints);
    CentrifugeClient.disconnect(false);
    token.resolve('test-token');
    await connecting;
    assert.equal(clients.length, 0);
    assert.equal(CentrifugeKit.genSubToken.mock.callCount(), 0);
    assert.equal(CentrifugeClient.getState(), 'null');
});

test('the most recent connect wins when token preparation overlaps', async () => {
    const firstToken = deferred();
    CentrifugeKit.genToken.mock.mockImplementationOnce(() => firstToken.promise);
    const first = CentrifugeClient.connect(endpoints);
    await CentrifugeClient.connect(endpoints);
    firstToken.resolve('old-token');
    await first;
    assert.equal(clients.length, 1);
    assert.equal(CentrifugeClient.getState(), 'connected');
});

for (const phase of ['constructor', 'newSubscription', 'subscribe', 'connect']) {
    test(`reports ${phase} failure and closes any partially created client`, async () => {
        const failure = new Error(`${phase} failed`);
        let partial;
        if (phase === 'constructor') {
            mock.method(Centrifuge.prototype, '_configure', () => { throw failure; });
        } else if (phase === 'newSubscription') {
            Centrifuge.prototype.newSubscription.mock.mockImplementation(function () {
                partial = this;
                throw failure;
            });
        } else if (phase === 'connect') {
            Centrifuge.prototype.connect.mock.mockImplementation(() => { throw failure; });
        } else {
            Centrifuge.prototype.newSubscription.mock.mockImplementation(function (channel) {
                partial = this;
                const sub = new EventEmitter();
                sub.subscribe = () => { throw failure; };
                sub.unsubscribe = mock.fn();
                this._subs[channel] = sub;
                return sub;
            });
        }
        await assert.doesNotReject(CentrifugeClient.connect(endpoints));
        assert.equal(CentrifugeClient.getState(), 'null');
        assert.equal(errors[0][1], failure);
        if (phase !== 'constructor') {
            assert.equal((partial ?? clients[0]).state, 'disconnected');
            assert.equal(Centrifuge.prototype.disconnect.mock.callCount(), 1);
        }
    });
}

test('continues disconnect cleanup when an unsubscribe throws', async () => {
    await CentrifugeClient.connect(endpoints);
    const client = clients[0];
    const failure = new Error('unsubscribe failed');
    client._subs['test-channel'].unsubscribe.mock.mockImplementation(() => { throw failure; });
    const second = {unsubscribe: mock.fn()};
    client._subs.second = second;
    CentrifugeClient.disconnect(false);
    assert.equal(second.unsubscribe.mock.callCount(), 1);
    assert.equal(Centrifuge.prototype.disconnect.mock.callCount(), 1);
    assert.equal(CentrifugeClient.getState(), 'null');
    assert.equal(errors[0][1], failure);
});

test('disconnect failure is logged without retaining a broken client', async () => {
    await CentrifugeClient.connect(endpoints);
    const failure = new Error('disconnect failed');
    Centrifuge.prototype.disconnect.mock.mockImplementation(() => { throw failure; });
    assert.doesNotThrow(() => CentrifugeClient.disconnect(false));
    assert.equal(CentrifugeClient.getState(), 'null');
    assert.equal(errors[0][1], failure);
});

test('manual disconnect reports the request and ignores subsequent events from the old client', async () => {
    await CentrifugeClient.connect(endpoints);
    const client = clients[0];
    CentrifugeClient.disconnect();
    assert.equal(output.at(-1), '[client-disconnect] Disconnect requested');
    const count = output.length;
    client.emit('connected', {client: 'old', transport: 'websocket'});
    client.emit('disconnected', {code: 0, reason: 'late disconnect'});
    assert.equal(output.length, count);
    assert.equal(CentrifugeClient.getState(), 'null');
});

test('publish catches asynchronous failures and uses the channel of the active connection', async () => {
    await CentrifugeClient.connect(endpoints);
    const failure = new Error('publish rejected');
    Centrifuge.prototype.publish.mock.mockImplementation(async () => { throw failure; });
    CentrifugeClient.channel = 'edited-channel';
    await assert.doesNotReject(CentrifugeClient.publish(false));
    assert.deepEqual(Centrifuge.prototype.publish.mock.calls[0].arguments, ['test-channel', false]);
    assert.equal(errors[0][1], failure);
    assert.equal(errors[0][2], true);
});

test('RPC keeps JSON encoding tied to the connection when the next protocol selection changes', async () => {
    await CentrifugeClient.connect(endpoints);
    CentrifugeClient.protocol = 'protobuf';
    await CentrifugeClient.rpc();
    assert.deepEqual(Centrifuge.prototype.rpc.mock.calls[0].arguments, ['test-method', {value: 1}]);
    assert.equal(output.at(-1), '[rpc] response: {"ok":true}');
});

test('RPC preserves Protobuf request encoding and response decoding', async () => {
    CentrifugeClient.protocol = 'protobuf';
    await CentrifugeClient.connect(endpoints);
    CentrifugeClient.protocol = 'json';
    ProtobufCentrifuge.prototype.rpc.mock.mockImplementation(async () => ({data: new TextEncoder().encode('{"ok":true}')}));
    await CentrifugeClient.rpc();
    const [method, data] = ProtobufCentrifuge.prototype.rpc.mock.calls[0].arguments;
    assert.equal(method, 'test-method');
    assert.equal(new TextDecoder().decode(data), '{"value":1}');
    assert.equal(output.at(-1), '[rpc] response: {"ok":true}');
});

test('RPC accepts non-JSON and empty Protobuf responses as successful data', async () => {
    CentrifugeClient.protocol = 'protobuf';
    await CentrifugeClient.connect(endpoints);
    for (const text of ['plain text response', '']) {
        ProtobufCentrifuge.prototype.rpc.mock.mockImplementationOnce(async () => ({data: new TextEncoder().encode(text)}));
        await CentrifugeClient.rpc();
        assert.equal(output.at(-1), `[rpc] response: ${text}`);
    }
    assert.equal(errors.length, 0);
});

test('RPC ignores successful responses from a replaced connection', async () => {
    await CentrifugeClient.connect(endpoints);
    const result = deferred();
    Centrifuge.prototype.rpc.mock.mockImplementationOnce(() => result.promise);
    const rpc = CentrifugeClient.rpc();
    await CentrifugeClient.connect(endpoints);
    result.resolve({data: 'old response'});
    await rpc;
    assert.equal(output.some(message => message.includes('old response')), false);
});

test('failed operations from a replaced connection retain browser diagnostics without changing current output', async () => {
    await CentrifugeClient.connect(endpoints);
    const rpcResult = deferred();
    const publishResult = deferred();
    Centrifuge.prototype.rpc.mock.mockImplementationOnce(() => rpcResult.promise);
    Centrifuge.prototype.publish.mock.mockImplementationOnce(() => publishResult.promise);
    const rpc = CentrifugeClient.rpc();
    const publish = CentrifugeClient.publish({value: 1});
    await CentrifugeClient.connect(endpoints);
    rpcResult.reject(new Error('old RPC failed'));
    publishResult.reject(new Error('old publish failed'));
    await Promise.all([rpc, publish]);
    assert.equal(errors.length, 2);
    assert.equal(errors.every(args => args[2] === false), true);
});
