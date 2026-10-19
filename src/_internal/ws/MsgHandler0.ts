import {Console} from "@/_internal/utils/Console";
import {GzipKit} from "@/_chimera/compress/GzipKit";
import {ArrayBufferKit} from "@/_chimera/type/ArrayBufferKit";
import {BlobKit} from "@/_chimera/type/BlobKit";

/*
 * 后端推送消息的类型: text || binary(no compress) || binary(gzip)
 */
export class MsgHandler0 {
    static async handle(data: ArrayBuffer | Blob | string) {
        Console.println(await this.decode(data));
    }

    static async decode(data: ArrayBuffer | Blob | string): Promise<string> {
        if (typeof data === "string") {
            return `on message(text): ${data}`;
        }

        if (data instanceof ArrayBuffer) {
            if (await GzipKit.isGzipCompressed(data)) {
                let msg = await GzipKit.decompressToString(data);
                return `on message(binary ArrayBuffer, gzip): ${msg}`;
            }
            let msg = ArrayBufferKit.toString(data);
            return `on message(binary ArrayBuffer, no compress): ${msg}`;
        } else {
            const buffer = await BlobKit.toArrayBuffer(data);
            if (await GzipKit.isGzipCompressed(buffer)) {
                let msg = await GzipKit.decompressToString(buffer);
                return `on message(binary Blob, gzip): ${msg}`;
            }
            let msg = ArrayBufferKit.toString(buffer);
            return `on message(binary Blob, no compress): ${msg}`;
        }
    }

}
