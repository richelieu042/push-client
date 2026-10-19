import {fromByteArray, toByteArray} from "base64-js";
import {Uint8ArrayKit} from "@/_chimera/type/Uint8ArrayKit";
import {StringKit} from "@/_chimera/type/StringKit";

export class Base64Kit {
    /*
     * base64 编码
     */
    static encodeStringToString(str: string): string {
        let ua = StringKit.toUint8Array(str);
        return fromByteArray(ua);
    }

    /*
     * base64 解码
     */
    static decodeString(base64Str: string): Uint8Array {
        // base64-js silently converts invalid characters to zero bytes.
        if (typeof base64Str !== "string") {
            throw new TypeError("Base64 input must be a string");
        }
        if (base64Str.length % 4 !== 0 || /[^A-Za-z0-9+/_-]/.test(base64Str.replace(/={1,2}$/, ""))) {
            throw new Error("Invalid Base64 input: check characters, length and padding");
        }
        return toByteArray(base64Str);
    }

    /*
     * base64 解码
     */
    static decodeStringToString(base64Str: string): string {
        let ua = this.decodeString(base64Str);
        return Uint8ArrayKit.toString(ua);
    }

}
