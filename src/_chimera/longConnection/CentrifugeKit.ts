import {JwtKit} from "@/_chimera/jwt/JwtKit";
import type {JWTPayload} from "jose";

export class CentrifugeKit {
    /*
     * Generate sample connection JWT for user.
     *
     * @param alg e.g."HS256"
     */
    static genToken(payload: JWTPayload | null, alg: string, secret: string, expirationTime: string, user: string) {
        return JwtKit.sign({...payload, sub: user}, alg, secret, expirationTime);
    }

    /*
     * Generate sample subscription JWT for user.
     *
     * @param alg e.g."HS256"
     */
    static genSubToken(payload: JWTPayload | null, alg: string, secret: string, expirationTime: string, user: string, channel: string) {
        return JwtKit.sign({...payload, sub: user, channel}, alg, secret, expirationTime);
    }

}
