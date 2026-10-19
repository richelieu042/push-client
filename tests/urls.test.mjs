import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SseKit} from '../src/_chimera/longConnection/SseKit.ts';
import {WebSocketKit} from '../src/_chimera/longConnection/WebSocketKit.ts';

test('URL validation accepts case insensitive schemes and browser supported host forms', () => {
    for (const [check, schemes] of [[SseKit.checkUrl, ['http', 'https', 'HTTP', 'HtTpS']], [WebSocketKit.checkUrl, ['ws', 'wss', 'WS', 'WsS']]]) {
        for (const scheme of schemes) {
            for (const target of ['Example.COM/events?token=a%2Bb', 'localhost:8080/events', '[::1]:8080/events', '例子.测试/消息', 'user:password@example.com/path', 'example.com/path%23encoded']) {
                assert.equal(check(`${scheme}://${target}`), true, `${scheme}://${target}`);
            }
        }
    }
});

test('URL validation rejects missing schemes, malformed hosts and invalid ports', t => {
    const errors = t.mock.method(console, 'error', () => {});
    for (const [check, scheme] of [[SseKit.checkUrl, 'https'], [WebSocketKit.checkUrl, 'wss']]) {
        for (const value of [null, undefined, {}, 123, '', '/events', '//example.com/events', `${scheme}:example.com`, `${scheme}:/example.com`, ` ${scheme}://example.com`, 'file:///events', 'javascript:alert(1)', `${scheme}://`, `${scheme}://example com/events`, `${scheme}://[::1`, `${scheme}://example.com:65536`, `${scheme}://example.com:invalid`]) {
            assert.equal(check(value), false, String(value));
        }
    }
    assert.ok(errors.mock.callCount() > 0);
    assert.ok(errors.mock.calls.every(call => call.arguments[1] instanceof Error));
});

test('WebSocket rejects fragments including an empty hash while SSE permits them', () => {
    for (const suffix of ['#', '#fragment']) {
        assert.equal(WebSocketKit.checkUrl(`wss://example.com/events${suffix}`), false);
        assert.equal(SseKit.checkUrl(`https://example.com/events${suffix}`), true);
    }
    assert.equal(WebSocketKit.checkUrl('https://example.com/events'), false);
    assert.equal(SseKit.checkUrl('wss://example.com/events'), false);
});
