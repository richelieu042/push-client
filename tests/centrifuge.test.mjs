import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {afterEach, beforeEach, mock, test} from 'node:test';
import {Centrifuge} from 'centrifuge';
import {Centrifuge as ProtobufCentrifuge} from 'centrifuge/build/protobuf';
import {decodeJwt, jwtVerify} from 'jose';

globalThis.localStorage = {getItem: () => null};
const {CentrifugeClient} = await import('../src/internal/centrifuge/CentrifugeClient.ts');
const {CentrifugeKit} = await import('../src/chimera/longConnection/CentrifugeKit.ts');
const {Console} = await import('../src/internal/utils/Console.ts');
const {UuidKit} = await import('../src/chimera/id/UuidKit.ts');
const signToken = CentrifugeKit.genToken.bind(CentrifugeKit);
const signSubToken = CentrifugeKit.genSubToken.bind(CentrifugeKit);

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

function newSubscription(channel, options) {
    if (!clients.includes(this)) {
        clients.push(this);
    }
    const sub = new EventEmitter();
    sub.subscribe = mock.fn();
    sub.unsubscribe = mock.fn();
    sub.options = options;
    this._subs[channel] = sub;
    return sub;
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
    CentrifugeClient.algorithm = 'HS256';
    CentrifugeClient.secret = 'test-secret';
    CentrifugeClient.channels = ['test-channel'];
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
        mock.method(Client.prototype, 'newSubscription', newSubscription);
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

for (const [protocol, Client] of [['json', Centrifuge], ['protobuf', ProtobufCentrifuge]]) {
    test(`${protocol} uses one connection for distinct normalized channels and receives every subscription`, async () => {
        CentrifugeClient.protocol = protocol;
        const configuredChannels = [' first-channel ', '', 'second-channel', 'first-channel', '  '];
        CentrifugeClient.channels = configuredChannels;
        CentrifugeKit.genSubToken.mock.mockImplementation(signSubToken);
        await CentrifugeClient.connect(endpoints);

        assert.deepEqual(configuredChannels, [' first-channel ', '', 'second-channel', 'first-channel', '  ']);
        assert.equal(clients.length, 1);
        const client = clients[0];
        assert.ok(client instanceof Client);
        assert.equal(Client.prototype.connect.mock.callCount(), 1);
        assert.equal(CentrifugeKit.genToken.mock.callCount(), 1);
        assert.equal(CentrifugeKit.genSubToken.mock.callCount(), 2);
        assert.deepEqual(Object.keys(client._subs), ['first-channel', 'second-channel']);

        const tokens = [];
        for (const [channel, sub] of Object.entries(client._subs)) {
            assert.equal(sub.subscribe.mock.callCount(), 1);
            const token = sub.options.token;
            tokens.push(token);
            assert.equal(decodeJwt(token).channel, channel);
            assert.equal(decodeJwt(token).sub, 'test-user');
            const data = protocol === 'protobuf' ? new TextEncoder().encode(`message from ${channel}`) : {channel};
            sub.emit('publication', {channel, data});
            assert.match(output.at(-1), new RegExp(`channel: ${channel}, content`));
            assert.equal(output.at(-1).includes(protocol === 'protobuf' ? `message from ${channel}` : JSON.stringify(data)), true);
        }
        assert.notEqual(tokens[0], tokens[1]);
        assert.equal(output.some(message => message.includes('test-secret') || tokens.some(token => message.includes(token))), false);

        CentrifugeClient.disconnect(false);
        assert.equal(Client.prototype.disconnect.mock.callCount(), 1);
        for (const sub of Object.values(client._subs)) {
            assert.equal(sub.unsubscribe.mock.callCount(), 1);
        }
        const logged = output.length;
        for (const [channel, sub] of Object.entries(client._subs)) {
            sub.emit('publication', {channel, data: 'late publication'});
        }
        assert.equal(output.length, logged);
    });

    for (const algorithm of ['HS256', 'HS384', 'HS512']) {
        test(`${protocol} signs initial and refreshed tokens with the selected ${algorithm} settings snapshot`, async () => {
            CentrifugeClient.protocol = protocol;
            CentrifugeClient.algorithm = algorithm;
            const configuredChannels = ['test-channel', 'second-channel'];
            CentrifugeClient.channels = configuredChannels;
            CentrifugeKit.genToken.mock.mockImplementation(signToken);
            CentrifugeKit.genSubToken.mock.mockImplementation(signSubToken);
            const pendingToken = deferred();
            CentrifugeKit.genToken.mock.mockImplementationOnce(async (...args) => {
                await pendingToken.promise;
                return signToken(...args);
            });
            const connecting = CentrifugeClient.connect(endpoints);
            CentrifugeClient.algorithm = algorithm === 'HS512' ? 'HS256' : 'HS512';
            pendingToken.resolve();
            await connecting;
            const client = clients[0];
            configuredChannels.splice(0, configuredChannels.length, 'edited-channel');
            CentrifugeClient.secret = 'edited-secret';
            CentrifugeClient.user = 'edited-user';

            const key = new TextEncoder().encode('test-secret');
            for (const token of [client._token, await client._config.getToken({})]) {
                const {payload, protectedHeader} = await jwtVerify(token, key, {algorithms: [algorithm]});
                assert.equal(protectedHeader.alg, algorithm);
                assert.equal(payload.sub, 'test-user');
                assert.equal('channel' in payload, false);
            }
            assert.deepEqual(CentrifugeKit.genToken.mock.calls.map(call => call.arguments), [
                [{}, algorithm, 'test-secret', '24h', 'test-user'],
                [{}, algorithm, 'test-secret', '24h', 'test-user'],
            ]);
            for (const [channel, sub] of Object.entries(client._subs)) {
                for (const token of [sub.options.token, await sub.options.getToken({channel: 'ignored-context-channel'})]) {
                    const {payload, protectedHeader} = await jwtVerify(token, key, {algorithms: [algorithm]});
                    assert.equal(protectedHeader.alg, algorithm);
                    assert.equal(payload.channel, channel);
                    assert.equal(payload.sub, 'test-user');
                }
                assert.deepEqual(CentrifugeKit.genSubToken.mock.calls.at(-1).arguments, [{}, algorithm, 'test-secret', '24h', 'test-user', channel]);
            }
            assert.equal(CentrifugeKit.genSubToken.mock.callCount(), 4);

            CentrifugeClient.disconnect(false);
            for (const sub of Object.values(client._subs)) {
                assert.equal(await sub.options.getToken({}), '');
            }
            assert.equal(CentrifugeKit.genSubToken.mock.callCount(), 4);
        });
    }
}

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
    for (const [key, value] of [
        ['secret', ''], ['channels', null], ['channels', 'channel'], ['channels', []],
        ['channels', [' ', '']], ['channels', ['valid', 42]], ['protocol', 'invalid'], ['user', 42],
        ['algorithm', ''], ['algorithm', 'HS999'], ['algorithm', 'RS256'], ['algorithm', 'none'],
        ['algorithm', null], ['algorithm', 256],
    ]) {
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
    CentrifugeClient.channels = ['edited-channel'];
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

test('disconnect cancels preparation while a later subscription token is pending', async () => {
    CentrifugeClient.channels = ['first-channel', 'second-channel', 'third-channel'];
    const token = deferred();
    const started = deferred();
    CentrifugeKit.genSubToken.mock.mockImplementation(async (...args) => {
        if (args.at(-1) === 'second-channel') {
            started.resolve();
            return token.promise;
        }
        return 'first-sub-token';
    });
    const connecting = CentrifugeClient.connect(endpoints);
    await started.promise;
    CentrifugeClient.disconnect(false);
    token.resolve('second-sub-token');
    await connecting;
    assert.deepEqual(CentrifugeKit.genSubToken.mock.calls.map(call => call.arguments.at(-1)), ['first-channel', 'second-channel']);
    assert.equal(clients.length, 0);
    assert.equal(CentrifugeClient.getState(), 'null');
});

for (const phase of ['subscription token', 'subscription creation']) {
    test(`a later ${phase} failure cleans up the replacement and preserves the active connection`, async () => {
        await CentrifugeClient.connect(endpoints);
        const active = clients[0];
        CentrifugeClient.channels = ['first-channel', 'second-channel', 'third-channel'];
        const failure = new Error(`second ${phase} failed`);
        if (phase === 'subscription token') {
            CentrifugeKit.genSubToken.mock.mockImplementation(async (...args) => {
                if (args.at(-1) === 'second-channel') throw failure;
                return 'sub-token';
            });
        } else {
            Centrifuge.prototype.newSubscription.mock.mockImplementation(function (channel, options) {
                if (channel === 'second-channel') throw failure;
                return newSubscription.call(this, channel, options);
            });
        }

        await assert.doesNotReject(CentrifugeClient.connect(endpoints));
        assert.equal(CentrifugeClient.client, active);
        assert.equal(active.state, 'connected');
        assert.equal(active._subs['test-channel'].unsubscribe.mock.callCount(), 0);
        assert.equal(Centrifuge.prototype.connect.mock.callCount(), 1);
        assert.equal(errors[0][1], failure);
        if (phase === 'subscription token') {
            assert.equal(clients.length, 1);
            assert.equal(Centrifuge.prototype.disconnect.mock.callCount(), 0);
        } else {
            assert.equal(clients.length, 2);
            assert.deepEqual(Object.keys(clients[1]._subs), ['first-channel']);
            assert.equal(clients[1]._subs['first-channel'].unsubscribe.mock.callCount(), 1);
            assert.equal(clients[1].state, 'disconnected');
            assert.equal(Centrifuge.prototype.disconnect.mock.callCount(), 1);
        }
    });
}

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
    CentrifugeClient.channels = ['test-channel', 'second-channel'];
    await CentrifugeClient.connect(endpoints);
    const client = clients[0];
    const failure = new Error('unsubscribe failed');
    client._subs['test-channel'].unsubscribe.mock.mockImplementation(() => { throw failure; });
    const second = client._subs['second-channel'];
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

test('publish catches asynchronous failures and uses the first channel of the active connection', async () => {
    CentrifugeClient.channels = ['test-channel', 'second-channel'];
    await CentrifugeClient.connect(endpoints);
    const failure = new Error('publish rejected');
    Centrifuge.prototype.publish.mock.mockImplementation(async () => { throw failure; });
    CentrifugeClient.channels = ['edited-channel'];
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
