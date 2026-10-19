import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WebSocketClient} from '../src/_internal/ws/WebSocketClient.ts';
import {SseClient} from '../src/_internal/sse/SseClient.ts';
import {MsgHandler0} from '../src/_internal/ws/MsgHandler0.ts';
import {MsgHandlerRaw} from '../src/_internal/sse/MsgHandlerRaw.ts';
import {Console} from '../src/_internal/utils/Console.ts';
import {LocalStorageUtil} from '../src/_internal/utils/LocalStorageUtil.ts';

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
    return {promise, resolve, reject};
}

function setup(t) {
    const sockets = [], sources = [], messages = [], errors = [], alerts = [], saved = [];
    class Socket {
        static OPEN = 1;
        readyState = Socket.OPEN;
        bufferedAmount = 0;
        constructor(url) {this.url = url; sockets.push(this);}
        send(message) {this.sent = message;}
        close() {this.readyState = 3;}
    }
    class Source {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSED = 2;
        readyState = Source.OPEN;
        listeners = new Map();
        constructor(url) {this.url = url; sources.push(this);}
        addEventListener(type, handler) {this.listeners.set(type, handler);}
        removeEventListener(type, handler) {
            if (this.listeners.get(type) === handler) this.listeners.delete(type);
        }
        close() {this.closed = true; this.readyState = Source.CLOSED;}
    }
    const originals = new Map();
    for (const [key, value] of Object.entries({WebSocket: Socket, EventSource: Source, alert: message => alerts.push(message)})) {
        originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, {configurable: true, writable: true, value});
    }
    t.mock.method(Console, 'println', message => messages.push(message));
    t.mock.method(Console, 'error', (context, error, showInOutput = true) => errors.push({context, error, showInOutput}));
    t.mock.method(LocalStorageUtil, 'setWsUrl', url => saved.push(url));
    t.mock.method(LocalStorageUtil, 'setSseUrl', url => saved.push(url));
    t.after(() => {
        WebSocketClient.disconnect(true);
        SseClient.disconnect();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    });
    return {sockets, sources, messages, errors, alerts, saved};
}

test('WebSocket and SSE normalize and save URLs before connecting', t => {
    const {sockets, sources, saved} = setup(t);
    WebSocketClient.connect(' \tws://example.test/socket\n', 0);
    SseClient.connect(' \thttps://example.test/events\n', 0);
    assert.equal(sockets[0].url, 'ws://example.test/socket');
    assert.equal(sources[0].url, 'https://example.test/events');
    assert.deepEqual(saved, ['ws://example.test/socket', 'https://example.test/events']);
});

test('invalid connection settings leave the existing clients intact', t => {
    const {sockets, sources, alerts} = setup(t);
    WebSocketClient.connect('ws://example.test/socket', 0);
    SseClient.connect('https://example.test/events', 0);
    WebSocketClient.connect('https://example.test/socket', 0);
    SseClient.connect('ws://example.test/events', 0);
    WebSocketClient.connect('ws://example.test/socket', 2);
    SseClient.connect('https://example.test/events', 2);
    assert.equal(sockets.length, 1);
    assert.equal(sources.length, 1);
    assert.equal(sockets[0].readyState, 1);
    assert.equal(sources[0].closed, undefined);
    assert.equal(alerts.length, 4);
});

test('WebSocket messages stay ordered and finish before remote close output', async t => {
    const {sockets, messages} = setup(t);
    const first = deferred();
    t.mock.method(MsgHandler0, 'decode', data => data === 'first' ? first.promise : Promise.resolve(data));
    WebSocketClient.connect('ws://example.test/socket', 0);
    const socket = sockets[0];
    socket.onmessage({data: 'first'});
    socket.onmessage({data: 'second'});
    const closing = socket.onclose({code: 1000, reason: 'done', wasClean: true});
    await Promise.resolve();
    assert.deepEqual(messages, []);
    first.resolve('first decoded');
    await closing;
    assert.deepEqual(messages, ['first decoded', 'second', 'onclose: code(1000), reason(done), wasClean(true)']);
});

test('a decoding failure is logged and does not stop subsequent WebSocket messages', async t => {
    const {sockets, messages, errors} = setup(t);
    const failure = new Error('bad compressed message');
    t.mock.method(MsgHandler0, 'decode', async data => {
        if (data === 'bad') throw failure;
        return 'next message';
    });
    WebSocketClient.connect('ws://example.test/socket', 0);
    sockets[0].onmessage({data: 'bad'});
    await sockets[0].onmessage({data: 'good'});
    assert.deepEqual(messages, ['next message']);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].error, failure);
    assert.equal(errors[0].showInOutput, true);
});

test('reconnecting while WebSocket decoding fails keeps the new output isolated', async t => {
    const {sockets, messages, errors} = setup(t);
    const decoding = deferred();
    t.mock.method(MsgHandler0, 'decode', () => decoding.promise);
    WebSocketClient.connect('ws://example.test/old', 0);
    const receiving = sockets[0].onmessage({data: 'old message'});
    await Promise.resolve();
    WebSocketClient.connect('ws://example.test/new', 0);
    decoding.reject(new Error('old decode failed'));
    await receiving;
    assert.deepEqual(messages, []);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].showInOutput, false);
    assert.equal(sockets[1].readyState, 1);
});

test('a delayed manual close cannot print after a later connection was disconnected', t => {
    const {sockets, messages} = setup(t);
    WebSocketClient.connect('ws://example.test/old', 0);
    WebSocketClient.disconnect();
    const delayedClose = sockets[0].onclose;
    WebSocketClient.connect('ws://example.test/new', 0);
    WebSocketClient.disconnect(true);
    delayedClose({code: 1000, reason: 'old close', wasClean: true});
    assert.deepEqual(messages, []);
});

test('WebSocket send failures report the original error and allow subsequent sends', t => {
    const {sockets, messages, errors} = setup(t);
    WebSocketClient.connect('ws://example.test/socket', 0);
    const failure = new Error('socket stopped accepting messages');
    t.mock.method(sockets[0], 'send', () => {throw failure;});
    assert.doesNotThrow(() => WebSocketClient.send('first'));
    assert.equal(errors[0].error, failure);
    assert.deepEqual(messages, []);
    sockets[0].send.mock.restore();
    WebSocketClient.send('second');
    assert.equal(sockets[0].sent, 'second');
});

test('close failures are reported and do not prevent reconnecting', t => {
    const {sockets, sources, errors} = setup(t);
    WebSocketClient.connect('ws://example.test/socket', 0);
    SseClient.connect('https://example.test/events', 0);
    t.mock.method(sockets[0], 'close', () => {throw new Error('socket close failed');});
    t.mock.method(sources[0], 'close', () => {throw new Error('source close failed');});
    assert.doesNotThrow(() => WebSocketClient.connect('ws://example.test/new', 0));
    assert.doesNotThrow(() => SseClient.connect('https://example.test/new', 0));
    assert.equal(errors.length, 2);
    assert.equal(sockets[1].readyState, 1);
    assert.equal(sources[1].closed, undefined);
});

test('SSE handles message and named events and suppresses old callbacks after reconnect', t => {
    const {sources, errors} = setup(t);
    const handled = [];
    t.mock.method(MsgHandlerRaw, 'handle', (...args) => {
        if (args[3] === 'bad') throw new Error('invalid event');
        handled.push(args);
    });
    SseClient.connect('https://example.test/events', 0);
    const onMessage = sources[0].onmessage;
    const event = {origin: 'https://example.test', lastEventId: '1', type: 'message', data: 'good'};
    onMessage({...event, data: 'bad'});
    onMessage(event);
    sources[0].listeners.get('test')({...event, type: 'test'});
    assert.equal(errors.length, 1);
    assert.equal(handled.length, 2);
    SseClient.connect('https://example.test/new', 0);
    onMessage(event);
    assert.equal(sources[0].closed, true);
    assert.equal(handled.length, 2);
});

test('WebSocket bounds pending message count including the active decode and reports overflow', async t => {
    const {sockets, messages, errors} = setup(t);
    const first = deferred();
    const decoded = [];
    t.mock.method(MsgHandler0, 'decode', data => {
        decoded.push(data);
        return first.promise;
    });
    WebSocketClient.connect('ws://example.test/socket', 0);
    const socket = sockets[0];
    const receive = socket.onmessage;
    const receiving = receive({data: 'first'});
    await Promise.resolve();
    for (let i = 1; i < WebSocketClient.maxPendingMessageCount; i++) receive({data: 'queued'});
    assert.equal(socket.readyState, 1);
    receive({data: 'overflow'});
    assert.equal(socket.readyState, 3);
    assert.equal(socket.onmessage, null);
    assert.equal(errors.length, 1);
    assert.match(errors[0].context, /Receive backlog exceeded.*connection closed/);
    assert.match(errors[0].error.message, /Pending messages were discarded/);
    first.resolve('old message');
    await receiving;
    assert.deepEqual(decoded, ['first']);
    assert.deepEqual(messages, []);
});

test('WebSocket bounds retained binary bytes including the active decode without allocating large payloads', async t => {
    const {sockets, errors} = setup(t);
    const first = deferred();
    t.mock.method(MsgHandler0, 'decode', () => first.promise);
    class SizedBlob extends Blob {
        constructor(size) {super(); this.payloadSize = size;}
        get size() {return this.payloadSize;}
    }
    WebSocketClient.connect('ws://example.test/socket', 0);
    const socket = sockets[0];
    const receiving = socket.onmessage({data: new SizedBlob(WebSocketClient.maxPendingMessageBytes)});
    await Promise.resolve();
    assert.equal(socket.readyState, 1);
    socket.onmessage({data: new SizedBlob(1)});
    assert.equal(socket.readyState, 3);
    assert.equal(errors.length, 1);
    assert.match(errors[0].error.message, /incoming: 1 bytes/);
    first.resolve('old message');
    await receiving;
});

test('disconnect discards queued WebSocket data while an active decode finishes silently', async t => {
    const {sockets, messages} = setup(t);
    const first = deferred();
    const decoded = [];
    t.mock.method(MsgHandler0, 'decode', data => {
        decoded.push(data);
        return data === 'first' ? first.promise : Promise.resolve(data);
    });
    WebSocketClient.connect('ws://example.test/old', 0);
    const receiving = sockets[0].onmessage({data: 'first'});
    await Promise.resolve();
    sockets[0].onmessage({data: 'queued'});
    WebSocketClient.disconnect(true);
    WebSocketClient.connect('ws://example.test/new', 0);
    await sockets[1].onmessage({data: 'new'});
    first.resolve('old');
    await receiving;
    assert.deepEqual(decoded, ['first', 'new']);
    assert.deepEqual(messages, ['new']);
});

test('disconnect before the decoder starts releases the entire queued WebSocket batch', async t => {
    const {sockets, messages} = setup(t);
    const decode = t.mock.method(MsgHandler0, 'decode', async data => data);
    WebSocketClient.connect('ws://example.test/socket', 0);
    const receiving = sockets[0].onmessage({data: 'first'});
    sockets[0].onmessage({data: 'second'});
    WebSocketClient.disconnect(true);
    await receiving;
    assert.equal(decode.mock.callCount(), 0);
    assert.deepEqual(messages, []);
});

test('WebSocket starts a new decoding batch after the previous batch drains', async t => {
    const {sockets, messages} = setup(t);
    t.mock.method(MsgHandler0, 'decode', async data => data);
    WebSocketClient.connect('ws://example.test/socket', 0);
    await sockets[0].onmessage({data: 'first'});
    await sockets[0].onmessage({data: 'second'});
    assert.deepEqual(messages, ['first', 'second']);
});

test('WebSocket send backpressure counts UTF-8 bytes and permits retry after the buffer drains', t => {
    const {sockets, messages, errors} = setup(t);
    WebSocketClient.connect('ws://example.test/socket', 0);
    const socket = sockets[0];
    socket.bufferedAmount = WebSocketClient.maxBufferedSendBytes - 3;
    WebSocketClient.send('🔥');
    assert.equal(socket.sent, undefined);
    assert.equal(errors.length, 1);
    assert.match(errors[0].context, /Send buffer limit exceeded.*message was not sent/);
    assert.match(errors[0].error.message, /message: 4 bytes/);
    assert.deepEqual(messages, []);
    WebSocketClient.send('你');
    assert.equal(socket.sent, '你');
    socket.bufferedAmount = 0;
    WebSocketClient.send('🔥');
    assert.equal(socket.sent, '🔥');
    assert.equal(socket.readyState, 1);
});

test('SSE removes named listeners and callbacks on terminal errors', t => {
    const {sources, errors, messages} = setup(t);
    SseClient.connect('https://example.test/events', 0);
    const source = sources[0];
    const onError = source.onerror;
    const onOpen = source.onopen;
    source.readyState = EventSource.CLOSED;
    const event = {type: 'error'};
    onError(event);
    assert.equal(source.closed, true);
    assert.equal(source.listeners.size, 0);
    assert.equal(source.onmessage, null);
    assert.equal(source.onerror, null);
    assert.equal(source.onopen, null);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].error, event);
    assert.match(errors[0].context, /closed/);
    onError(event);
    onOpen();
    assert.equal(errors.length, 1);
    assert.deepEqual(messages, []);
    SseClient.connect('https://example.test/new', 0);
    assert.equal(sources[1].readyState, EventSource.OPEN);
});

test('SSE keeps automatic reconnect listeners active and reports recovery', t => {
    const {sources, errors, messages} = setup(t);
    const handled = [];
    t.mock.method(MsgHandlerRaw, 'handle', (...args) => handled.push(args));
    SseClient.connect('https://example.test/events', 0);
    const source = sources[0];
    source.readyState = EventSource.CONNECTING;
    source.onerror({type: 'error'});
    assert.equal(source.closed, undefined);
    assert.equal(source.listeners.size, 1);
    assert.match(errors[0].context, /reconnecting/);
    source.readyState = EventSource.OPEN;
    source.onopen();
    source.onmessage({origin: 'https://example.test', lastEventId: '1', type: 'message', data: 'recovered'});
    assert.deepEqual(messages, ['onopen']);
    assert.equal(handled.length, 1);
    SseClient.disconnect();
    assert.equal(source.listeners.size, 0);
    assert.equal(source.closed, true);
});
