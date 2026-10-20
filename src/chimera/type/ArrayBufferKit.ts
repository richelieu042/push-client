const decoder = new TextDecoder('utf-8');

export class ArrayBufferKit {
    static toString(ab: ArrayBuffer): string {
        return decoder.decode(ab);
    }

    // ArrayBuffer => Uint8Array
    static toUint8Array(ab: ArrayBuffer): Uint8Array {
        return new Uint8Array(ab);
    }

    static toDataView(ab: ArrayBuffer):DataView{
        return new DataView(ab);
    }

}
