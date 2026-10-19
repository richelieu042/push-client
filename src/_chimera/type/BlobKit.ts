import {ArrayBufferKit} from "@/_chimera/type/ArrayBufferKit";

export class BlobKit {
    static toString(blob: Blob): Promise<string> {
        return blob.text();
    }

    // Blob => ArrayBuffer
    static toArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
        return blob.arrayBuffer();
    }

    static async toUint8Array(blob: Blob) {
        let ab = await BlobKit.toArrayBuffer(blob);
        return ArrayBufferKit.toUint8Array(ab);
    }

    static async toDataView(blob: Blob) {
        let ab = await BlobKit.toArrayBuffer(blob);
        return new DataView(ab);
    }

}
