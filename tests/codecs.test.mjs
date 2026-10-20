import assert from 'node:assert/strict';
import {test} from 'node:test';
import {brotliCompressSync, gzipSync} from 'node:zlib';
import {Base64Kit} from '../src/chimera/crypto/Base64Kit.ts';
import {GzipKit} from '../src/chimera/compress/GzipKit.ts';
import {BrotliKit} from '../src/chimera/compress/BrotliKit.ts';
import {ArrayBufferKit} from '../src/chimera/type/ArrayBufferKit.ts';
import {Uint8ArrayKit} from '../src/chimera/type/Uint8ArrayKit.ts';
import {MsgHandler0} from '../src/internal/ws/MsgHandler0.ts';
import {MsgHandler1} from '../src/internal/ws/MsgHandler1.ts';
import {MsgHandlerBase64} from '../src/internal/sse/MsgHandlerBase64.ts';
import {Console} from '../src/internal/utils/Console.ts';

const text = '你好，push client! 🙂\n';
const encode = value => new TextEncoder().encode(value);
const toBuffer = bytes => bytes.slice().buffer;
const paddedView = bytes => {
    const padded = new Uint8Array(bytes.length + 6);
    padded.fill(255);
    padded.set(bytes, 3);
    return padded.subarray(3, 3 + bytes.length);
};

test('Base64 round trips Unicode and preserves standard and URL-safe alphabets', () => {
    for (const value of ['', 'a', 'ab', 'abc', text]) {
        const encoded = Base64Kit.encodeStringToString(value);
        assert.equal(encoded, Buffer.from(value).toString('base64'));
        assert.equal(Base64Kit.decodeStringToString(encoded), value);
    }
    assert.deepEqual(Base64Kit.decodeString('+/8='), new Uint8Array([251, 255]));
    assert.deepEqual(Base64Kit.decodeString('-_8='), new Uint8Array([251, 255]));
});

test('Base64 rejects corrupt characters and malformed padding instead of returning silent garbage', () => {
    for (const value of ['!!!!', 'bad!', 'YQ?=', 'YWJj====', 'a=bc', '====', 'YQ=', 'YQ', 'YQ==AAAA', 'Y Q=', 'YWJ\n']) {
        assert.throws(() => Base64Kit.decodeString(value), /Invalid Base64 input/);
    }
    for (const value of [null, undefined, {}, 123, new Uint8Array()]) {
        assert.throws(() => Base64Kit.decodeString(value), /Base64 input must be a string/);
    }
});

test('SSE Base64 handler propagates decode failures without logging a successful message', t => {
    const println = t.mock.method(Console, 'println', () => {});
    assert.throws(() => MsgHandlerBase64.handle('origin', 'id', 'event', '!!!!'), /Invalid Base64 input/);
    assert.equal(println.mock.callCount(), 0);
    MsgHandlerBase64.handle('origin', 'id', 'event', Base64Kit.encodeStringToString(text));
    assert.equal(println.mock.calls[0].arguments[0], `onmessage(base64): origin(origin), id(id), event(event), text(${text})`);
});

test('binary text and DataView conversions respect Uint8Array offsets', () => {
    const bytes = encode(text);
    const view = paddedView(bytes);
    assert.equal(Uint8ArrayKit.toString(view), text);
    assert.equal(ArrayBufferKit.toString(toBuffer(bytes)), text);
    const dataView = Uint8ArrayKit.toDataView(view);
    assert.equal(dataView.byteOffset, view.byteOffset);
    assert.equal(dataView.byteLength, view.byteLength);
    assert.deepEqual(new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength), bytes);
});

test('gzip detection respects views and accepts short uncompressed inputs', async () => {
    const compressed = Uint8Array.from(gzipSync(text));
    for (const input of [compressed, paddedView(compressed), toBuffer(compressed), new Blob([compressed])]) {
        assert.equal(await GzipKit.isGzipCompressed(input), true);
    }
    for (const bytes of [new Uint8Array(), new Uint8Array([31]), new Uint8Array([1, 2]), encode(text)]) {
        for (const input of [bytes, paddedView(bytes), toBuffer(bytes), new Blob([bytes])]) {
            assert.equal(await GzipKit.isGzipCompressed(input), false);
        }
    }
});

test('gzip decoding preserves Unicode for byte views, ArrayBuffers and Blobs', async () => {
    const compressed = Uint8Array.from(gzipSync(text));
    for (const input of [compressed, paddedView(compressed), toBuffer(compressed), new Blob([compressed])]) {
        assert.equal(await GzipKit.decompressToString(input), text);
        assert.equal(Uint8ArrayKit.toString(await GzipKit.decompress(input)), text);
    }
});

test('Brotli decoding preserves Unicode for byte views, ArrayBuffers and Blobs', async () => {
    const compressed = Uint8Array.from(brotliCompressSync(text));
    for (const input of [compressed, paddedView(compressed), toBuffer(compressed), new Blob([compressed])]) {
        assert.equal(await BrotliKit.decompressToString(input), text);
        assert.equal(Uint8ArrayKit.toString(await BrotliKit.decompress(input)), text);
    }
});

test('WebSocket handlers decode plain text, raw UTF-8, gzip and Brotli', async () => {
    assert.equal(await MsgHandler0.decode(text), `on message(text): ${text}`);
    assert.equal(await MsgHandler1.decode(text), `on message(text): ${text}`);
    const raw = encode(text);
    const gzip = Uint8Array.from(gzipSync(text));
    const brotli = Uint8Array.from(brotliCompressSync(text));
    assert.equal(await MsgHandler0.decode(toBuffer(raw)), `on message(binary ArrayBuffer, no compress): ${text}`);
    assert.equal(await MsgHandler0.decode(new Blob([raw])), `on message(binary Blob, no compress): ${text}`);
    assert.equal(await MsgHandler0.decode(toBuffer(gzip)), `on message(binary ArrayBuffer, gzip): ${text}`);
    assert.equal(await MsgHandler0.decode(new Blob([gzip])), `on message(binary Blob, gzip): ${text}`);
    assert.equal(await MsgHandler1.decode(toBuffer(brotli)), `on message(binary ArrayBuffer, brotli): ${text}`);
    assert.equal(await MsgHandler1.decode(new Blob([brotli])), `on message(binary Blob, brotli): ${text}`);
});

test('corrupt compressed WebSocket messages reject so the client can report the error', async () => {
    for (const input of [new Uint8Array([31, 139]).buffer, new Blob([new Uint8Array([31, 139])])]) {
        await assert.rejects(MsgHandler0.decode(input));
    }
    for (const input of [new ArrayBuffer(0), new Blob([]), new Uint8Array([1, 2, 3]).buffer]) {
        await assert.rejects(MsgHandler1.decode(input));
    }
});
