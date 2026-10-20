/*
 * jose: https://www.npmjs.com/package/jose
 * jsonwebtoken库不能用（貌似需要nodejs环境）
 */
import * as jose from 'jose';

export class JwtKit {
    /*
     * 参考: https://github.com/panva/jose/blob/HEAD/docs/classes/jwt_sign.SignJWT.md
     *
     * @param alg e.g."HS256"
     */
    static sign(payload: jose.JWTPayload | null, alg: string, secret: string, expirationTime: string) {
        const secretUA = new TextEncoder().encode(secret)
        return new jose.SignJWT(payload ?? {})
            .setProtectedHeader({
                alg: alg,
                typ: "JWT",
            })
            .setIssuedAt()
            // .setIssuer('urn:example:issuer')
            // .setAudience('urn:example:audience')
            .setExpirationTime(expirationTime)
            .sign(secretUA);
    }

}
