import assert from 'node:assert/strict';
import {test} from 'node:test';
import {LocalStorageKit} from '../src/chimera/browser/LocalStorageKit.ts';
import {LocalStorageUtil} from '../src/internal/utils/LocalStorageUtil.ts';

function setupStorage(t) {
    const values = new Map();
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: key => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, value),
        },
    });
    t.after(() => {
        if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
        else delete globalThis.localStorage;
    });
    return values;
}

test('stored numeric options accept only values produced by their setters', t => {
    const values = setupStorage(t);
    const options = [
        ['connection-type', 'setConnectionType', 'getConnectionType', [0, 1, 2]],
        ['ws-push-message-type', 'setWsPushMessageType', 'getWsPushMessageType', [0, 1]],
        ['sse-push-message-type', 'setSsePushMessageType', 'getSsePushMessageType', [0, 1]],
    ];
    for (const [key, setter, getter, allowed] of options) {
        for (const value of allowed) {
            LocalStorageUtil[setter](value);
            assert.equal(values.get(key), String(value));
            assert.equal(LocalStorageUtil[getter](), value);
        }
        for (const value of ['', ' ', '01', '+1', '1.0', '1e0', '0x1', ' 1 ', 'NaN', 'Infinity', '-1', 'null', 'undefined', '3']) {
            values.set(key, value);
            assert.equal(LocalStorageUtil[getter](), 0, `${key}: ${JSON.stringify(value)}`);
        }
        values.delete(key);
        assert.equal(LocalStorageUtil[getter](), 0);
    }
});

test('Centrifuge signing algorithm persists supported values and defaults to HS256', t => {
    const values = setupStorage(t);
    assert.equal(LocalStorageUtil.getCentrifugeAlgorithm(), 'HS256');
    for (const algorithm of ['HS256', 'HS384', 'HS512']) {
        LocalStorageUtil.setCentrifugeAlgorithm(algorithm);
        assert.equal(values.get('Centrifuge-Algorithm'), algorithm);
        assert.equal(LocalStorageUtil.getCentrifugeAlgorithm(), algorithm);
    }
    for (const stored of ['', ' ', 'hs256', ' HS384 ', 'HS999', 'RS256', 'none', 'null']) {
        values.set('Centrifuge-Algorithm', stored);
        assert.equal(LocalStorageUtil.getCentrifugeAlgorithm(), 'HS256', JSON.stringify(stored));
    }
    values.delete('Centrifuge-Algorithm');
    assert.equal(LocalStorageUtil.getCentrifugeAlgorithm(), 'HS256');
});

test('storage preserves exact user data including whitespace and empty strings', t => {
    setupStorage(t);
    const pairs = [
        ['setWsUrl', 'getWsUrl'],
        ['setSseUrl', 'getSseUrl'],
        ['setCentrifugeSecret', 'getCentrifugeSecret'],
        ['setCentrifugeUser', 'getCentrifugeUser'],
        ['setCentrifugeChannel', 'getCentrifugeChannel'],
        ['setCentrifugeRpcMethod', 'getCentrifugeRpcMethod'],
        ['setCentrifugeRpcData', 'getCentrifugeRpcData'],
        ['setCentrifugeAlternative0Url', 'getCentrifugeAlternative0Url'],
        ['setCentrifugeAlternative1Url', 'getCentrifugeAlternative1Url'],
        ['setCentrifugeAlternative2Url', 'getCentrifugeAlternative2Url'],
    ];
    for (const [setter, getter] of pairs) {
        assert.equal(LocalStorageUtil[getter](), '');
        for (const value of ['', '  exact user data 中文 🙂\n', 'null', 'undefined']) {
            LocalStorageUtil[setter](value);
            assert.equal(LocalStorageUtil[getter](), value, getter);
        }
    }
});

test('Centrifuge channel lists preserve rows and channel punctuation exactly', t => {
    const values = setupStorage(t);
    const channels = ['  channel:one  ', '', 'channel,two', '频道🙂', 'channel\nthree'];
    LocalStorageUtil.setCentrifugeChannels(channels);
    assert.equal(values.get('Centrifuge-Channels'), JSON.stringify(channels));
    assert.deepEqual(LocalStorageUtil.getCentrifugeChannels(), channels);
    const loaded = LocalStorageUtil.getCentrifugeChannels();
    loaded.push('only in memory');
    assert.deepEqual(LocalStorageUtil.getCentrifugeChannels(), channels);
});

test('Centrifuge channel lists fall back to the legacy channel and prefer the new setting', t => {
    const values = setupStorage(t);
    assert.deepEqual(LocalStorageUtil.getCentrifugeChannels(), ['']);
    LocalStorageUtil.setCentrifugeChannel('  legacy-channel  ');
    assert.deepEqual(LocalStorageUtil.getCentrifugeChannels(), ['  legacy-channel  ']);
    LocalStorageUtil.setCentrifugeChannels(['first-channel', 'second-channel']);
    assert.deepEqual(LocalStorageUtil.getCentrifugeChannels(), ['first-channel', 'second-channel']);
    assert.equal(LocalStorageUtil.getCentrifugeChannel(), '  legacy-channel  ');
    LocalStorageUtil.setCentrifugeChannels(['']);
    assert.deepEqual(LocalStorageUtil.getCentrifugeChannels(), ['']);

    for (const stored of ['', 'not json', 'null', '{}', '[]', '"channel"', '["valid",42]', '[null]']) {
        values.set('Centrifuge-Channels', stored);
        assert.deepEqual(LocalStorageUtil.getCentrifugeChannels(), ['  legacy-channel  '], stored);
    }
    values.delete('Centrifuge-Channel');
    assert.deepEqual(LocalStorageUtil.getCentrifugeChannels(), ['']);
});

test('a throwing localStorage getter cannot prevent loading or saving preferences', t => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const failure = new Error('access denied');
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get() {throw failure;},
    });
    t.after(() => {
        if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
        else delete globalThis.localStorage;
    });
    const errors = t.mock.method(console, 'error', () => {});
    assert.equal(LocalStorageUtil.getConnectionType(), 0);
    assert.equal(LocalStorageUtil.getCentrifugeSecret(), '');
    assert.doesNotThrow(() => LocalStorageKit.set('preference', 'value'));
    assert.equal(errors.mock.callCount(), 3);
    assert.ok(errors.mock.calls.every(call => call.arguments[1] === failure));
});
