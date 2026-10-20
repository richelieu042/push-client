import assert from 'node:assert/strict';
import {test} from 'node:test';
import {decodeProtectedHeader, jwtVerify} from 'jose';
import {CentrifugeKit} from '../src/chimera/longConnection/CentrifugeKit.ts';

for (const algorithm of ['HS256', 'HS384', 'HS512']) {
    test(`${algorithm} Centrifuge signing preserves frozen input and isolates connection and subscription claims`, async () => {
        const original = Object.freeze({custom: 'kept', sub: 'previous-user'});
        const secret = 'test-secret';
        const key = new TextEncoder().encode(secret);
        const connection = await CentrifugeKit.genToken(original, algorithm, secret, '24h', 'user');
        const subscription = await CentrifugeKit.genSubToken(original, algorithm, secret, '24h', 'user', 'channel');
        const {payload: connectClaims} = await jwtVerify(connection, key, {algorithms: [algorithm]});
        const {payload: subClaims} = await jwtVerify(subscription, key, {algorithms: [algorithm]});
        assert.deepEqual(original, {custom: 'kept', sub: 'previous-user'});
        assert.equal(connectClaims.sub, 'user');
        assert.equal(connectClaims.custom, 'kept');
        assert.equal('channel' in connectClaims, false);
        assert.equal(subClaims.channel, 'channel');
        assert.equal(subClaims.sub, 'user');
        assert.equal(subClaims.exp - subClaims.iat, 24 * 60 * 60);
        assert.deepEqual(decodeProtectedHeader(connection), {alg: algorithm, typ: 'JWT'});
        assert.deepEqual(decodeProtectedHeader(subscription), {alg: algorithm, typ: 'JWT'});
        await assert.rejects(jwtVerify(connection, new TextEncoder().encode('wrong-key')));
    });
}
