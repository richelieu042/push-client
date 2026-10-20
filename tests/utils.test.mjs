import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Console} from '../src/internal/utils/Console.ts';
import {LocalStorageKit} from '../src/chimera/browser/LocalStorageKit.ts';
import {LocalStorageUtil} from '../src/internal/utils/LocalStorageUtil.ts';

function setupConsole(t) {
    const output = {value: ''}, errors = [], logs = [];
    Console.initialize(output);
    t.mock.method(console, 'error', (...args) => errors.push(args));
    t.mock.method(console, 'log', (...args) => logs.push(args));
    t.after(() => Console.clear());
    return {output, errors, logs};
}

test('error logging preserves original objects and produces one browser entry', t => {
    const {output, errors, logs} = setupConsole(t);
    const failure = new TypeError('decode failed');
    Console.error('[decode]', failure);
    assert.match(output.value, /\[decode\]: TypeError: decode failed/);
    assert.equal(errors.length, 1);
    assert.equal(errors[0][1], failure);
    assert.equal(logs.length, 0);
});

test('error formatting preserves SDK objects, BigInt, shared references and circular data', t => {
    const {output} = setupConsole(t);
    const shared = {code: 100};
    const failure = {message: 'RPC failed', id: 123n, left: shared, right: shared};
    failure.self = failure;
    Console.error('[rpc]', failure);
    assert.match(output.value, /"id":"123"/);
    assert.match(output.value, /"left":\{"code":100\},"right":\{"code":100\}/);
    assert.match(output.value, /"self":"\[Circular\]"/);
});

test('hostile error values cannot throw from the logger', t => {
    const {output, errors} = setupConsole(t);
    const failures = [
        {toJSON() {throw new Error('serialization failed');}},
        {get message() {throw new Error('getter failed');}},
        Object.assign(new Error('failure'), {toString() {throw new Error('string conversion failed');}}),
    ];
    for (const failure of failures) {
        Console.clear();
        assert.doesNotThrow(() => Console.error('[failure]', failure));
        assert.match(output.value, /Unable to format error/);
        assert.equal(errors.at(-1)[1], failure);
    }
});

test('logging an obsolete connection error leaves current page output unchanged', t => {
    const {output, errors} = setupConsole(t);
    Console.println('new connection');
    const current = output.value;
    Console.error('[old connection]', new Error('late failure'), false);
    assert.equal(output.value, current);
    assert.equal(errors.length, 1);
});

test('browser-only diagnostics do not serialize an obsolete error', t => {
    const {output, errors} = setupConsole(t);
    let serialized = false;
    const error = {toJSON() {serialized = true; throw new Error('should not be serialized');}};
    Console.error('[old connection]', error, false);
    assert.equal(serialized, false);
    assert.equal(output.value, '');
    assert.equal(errors.length, 1);
    assert.equal(errors[0][1], error);
});

function setupFrames(t) {
    const frames = new Map();
    let nextFrame = 0;
    const originals = new Map();
    for (const [key, value] of Object.entries({
        requestAnimationFrame: callback => {frames.set(++nextFrame, callback); return nextFrame;},
        cancelAnimationFrame: frame => frames.delete(frame),
    })) {
        originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, {configurable: true, writable: true, value});
    }
    t.after(() => {
        Console.clear();
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    });
    return {
        frames,
        flush() {
            const callbacks = [...frames.values()];
            frames.clear();
            for (const callback of callbacks) callback();
        },
    };
}

test('bursty browser logs update the output once per animation frame in order', t => {
    const {output, logs} = setupConsole(t);
    const {frames, flush} = setupFrames(t);
    for (let index = 0; index < 1000; index++) Console.println(`message ${index}`);
    assert.equal(output.value, '');
    assert.equal(frames.size, 1);
    flush();
    assert.equal(output.value, logs.map(([line]) => line).join(''));
    assert.equal(frames.size, 0);
    Console.println('next frame');
    assert.equal(frames.size, 1);
});

test('buffered browser output stays bounded even while animation frames are suspended', t => {
    const {output, logs} = setupConsole(t);
    const {frames, flush} = setupFrames(t);
    for (let index = 0; index < 4; index++) Console.println('x'.repeat(100_000));
    assert.equal(output.value, '');
    assert.equal(frames.size, 1);
    flush();
    assert.equal(output.value.length, Console.maxOutputLength);
    assert.equal(output.value, logs.map(([line]) => line).join('').slice(-Console.maxOutputLength));
});

test('clearing output cancels buffered logs instead of restoring them on the next frame', t => {
    const {output} = setupConsole(t);
    const {frames, flush} = setupFrames(t);
    Console.println('stale output');
    Console.clear();
    assert.equal(frames.size, 0);
    flush();
    assert.equal(output.value, '');
    Console.println('fresh output');
    flush();
    assert.match(output.value, /fresh output/);
    assert.doesNotMatch(output.value, /stale output/);
});

test('disposing an old output sink cannot detach a newer app instance', t => {
    const {output: oldOutput} = setupConsole(t);
    const {frames, flush} = setupFrames(t);
    const disposeOld = Console.initialize(oldOutput);
    Console.println('old output');
    const nextOutput = {value: ''};
    const disposeNext = Console.initialize(nextOutput);
    disposeOld();
    Console.println('new output');
    flush();
    assert.equal(oldOutput.value, '');
    assert.match(nextOutput.value, /new output/);
    Console.println('pending before disposal');
    disposeNext();
    assert.equal(frames.size, 0);
    const previous = nextOutput.value;
    Console.println('after disposal');
    flush();
    assert.equal(nextOutput.value, previous);
});

test('output keeps exactly the newest characters across small and oversized messages', t => {
    const {output, logs} = setupConsole(t);
    Console.println('x'.repeat(Console.maxOutputLength + 100));
    assert.equal(output.value.length, Console.maxOutputLength);
    assert.ok(output.value.endsWith('x\n'));
    const first = output.value;
    Console.println('tail');
    const last = output.value;
    assert.equal(last.length, Console.maxOutputLength);
    assert.ok(last.endsWith('tail\n'));
    const appended = logs.at(-1)[0];
    assert.equal(last, first.slice(appended.length) + appended);
    Console.clear();
    assert.equal(output.value, '');
});

function setupStorage(t, storage) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: storage});
    t.after(() => {
        if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
        else delete globalThis.localStorage;
    });
}

test('unavailable browser storage reports context and preserves safe defaults', t => {
    const failure = new Error('storage denied'), errors = [];
    setupStorage(t, {getItem() {throw failure;}, setItem() {throw failure;}});
    t.mock.method(console, 'error', (...args) => errors.push(args));
    assert.equal(LocalStorageKit.get('setting'), '');
    assert.doesNotThrow(() => LocalStorageKit.set('setting', 'value'));
    assert.equal(errors.length, 2);
    assert.ok(errors.every(args => args[0].includes('setting') && args[1] === failure));
});

test('corrupted protocol and transport preferences fall back to valid select options', t => {
    const storage = new Map([
        ['Centrifuge-Protocol', 'unknown'],
        ['Centrifuge-Alternative0-Type', 'fetch'],
        ['Centrifuge-Alternative1-Type', 'sse'],
        ['Centrifuge-Alternative2-Type', 'http_stream'],
    ]);
    setupStorage(t, {getItem: key => storage.get(key) ?? null});
    assert.equal(LocalStorageUtil.getCentrifugeProtocol(), 'json');
    assert.equal(LocalStorageUtil.getCentrifugeAlternative0Type(), '');
    assert.equal(LocalStorageUtil.getCentrifugeAlternative1Type(), 'sse');
    assert.equal(LocalStorageUtil.getCentrifugeAlternative2Type(), 'http_stream');
    storage.set('Centrifuge-Protocol', 'protobuf');
    assert.equal(LocalStorageUtil.getCentrifugeProtocol(), 'protobuf');
});
