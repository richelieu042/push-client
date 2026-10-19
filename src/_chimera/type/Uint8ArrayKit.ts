const decoder = new TextDecoder();

export class Uint8ArrayKit {
    static toString(ua: Uint8Array): string {
        return decoder.decode(ua);
    }

    static toDataView(ua: Uint8Array): DataView {
        return new DataView(ua.buffer, ua.byteOffset, ua.byteLength);
    }

}
