const encoder = new TextEncoder();

export class StringKit {
    /*
     * string => Uint8Array
     */
    static toUint8Array(str: string): Uint8Array {
        return encoder.encode(str);
    }

}
