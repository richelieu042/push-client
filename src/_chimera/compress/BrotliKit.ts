import {decompress} from "brotli/decompress";
import {Uint8ArrayKit} from "@/_chimera/type/Uint8ArrayKit";
import {BlobKit} from "@/_chimera/type/BlobKit";
import {ArrayBufferKit} from "@/_chimera/type/ArrayBufferKit";

/*
 * 需要安装第三方库，命令: npm install brotli
 */
export class BrotliKit {
    static async decompress(compressed: Uint8Array | ArrayBuffer | Blob) {
        if (compressed instanceof Blob) {
            let ua = await BlobKit.toUint8Array(compressed);
            return decompress(ua);
        }
        if (compressed instanceof ArrayBuffer) {
            let ua = ArrayBufferKit.toUint8Array(compressed);
            return decompress(ua);
        }
        return decompress(compressed);
    }

    static async decompressToString(compressed: Uint8Array | ArrayBuffer | Blob) {
        let decompressed = await BrotliKit.decompress(compressed);
        return Uint8ArrayKit.toString(decompressed);
    }

}
