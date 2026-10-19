import {type Ref} from "vue";
import {TimeKit} from "@/_chimera/time/TimeKit";

export class Console {
    static readonly maxOutputLength = 200_000;
    private static outputTextarea: Ref<string> | undefined;

    static initialize(output: Ref<string>) {
        this.outputTextarea = output;
    }

    static println(text: string) {
        let str: string = `${TimeKit.getCurrentTimeString()} ${text}\n`;

        if (this.outputTextarea) {
            this.outputTextarea.value = (this.outputTextarea.value + str).slice(-this.maxOutputLength);
        }
        console.log(str);
    }

    static clear() {
        if (this.outputTextarea) {
            this.outputTextarea.value = "";
        }
    }

}
