import {v4} from 'uuid';

export class UuidKit {
    static v4(): string {
        return v4();
    }

    /*
     * 返回值中无 "-"
     */
    static simpleV4(): string {
        return v4().replace(/-/g, '');
    }

}
