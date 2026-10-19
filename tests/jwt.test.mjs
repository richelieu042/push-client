import assert from 'node:assert/strict';
import {test} from 'node:test';
import {decodeProtectedHeader, jwtVerify} from 'jose';
import {CentrifugeKit} from '../src/_chimera/longConnection/CentrifugeKit.ts';

test('Centrifuge token signing preserves frozen input and isolates connection and subscription claims', async () => {
    const original = Object.freeze({custom: 'kept', sub: 'previous-user'});
    const secret = 'test-secret';
    const key = new TextEncoder().encode(secret);
    const connection = await CentrifugeKit.genToken(original, 'HS256', secret, '24h', 'user');
    const subscription = await CentrifugeKit.genSubToken(original, 'HS256', secret, '24h', 'user', 'channel');
    const {payload: connectClaims} = await jwtVerify(connection, key, {algorithms: ['HS256']});
    const {payload: subClaims} = await jwtVerify(subscription, key, {algorithms: ['HS256']});
    assert.deepEqual(original, {custom: 'kept', sub: 'previous-user'});
    assert.equal(connectClaims.sub, 'user');
    assert.equal(connectClaims.custom, 'kept');
    assert.equal('channel' in connectClaims, false);
    assert.equal(subClaims.channel, 'channel');
    assert.equal(subClaims.sub, 'user');
    assert.equal(subClaims.exp - subClaims.iat, 24 * 60 * 60);
    assert.deepEqual(decodeProtectedHeader(connection), {alg: 'HS256', typ: 'JWT'});
    await assert.rejects(jwtVerify(connection, new TextEncoder().encode('wrong-key')));
});
