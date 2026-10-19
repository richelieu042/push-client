import {Console} from "@/_internal/utils/Console";
import {BrotliKit} from "@/_chimera/compress/BrotliKit";

/*
 * 后端推送消息的类型: binary(brotli)
 */
export class MsgHandler1 {
    static async handle(data: ArrayBuffer | Blob | string) {
        Console.println(await this.decode(data));
    }

    static async decode(data: ArrayBuffer | Blob | string): Promise<string> {
        if (typeof data === "string") {
            return `on message(text): ${data}`;
        }

        if (data instanceof ArrayBuffer) {
            let msg = await BrotliKit.decompressToString(data);
            return `on message(binary ArrayBuffer, brotli): ${msg}`;
        }
        let msg = await BrotliKit.decompressToString(data);
        return `on message(binary Blob, brotli): ${msg}`;
    }

}
