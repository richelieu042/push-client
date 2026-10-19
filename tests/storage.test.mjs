import assert from 'node:assert/strict';
import {test} from 'node:test';
import {LocalStorageKit} from '../src/_chimera/browser/LocalStorageKit.ts';
import {LocalStorageUtil} from '../src/_internal/utils/LocalStorageUtil.ts';

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
