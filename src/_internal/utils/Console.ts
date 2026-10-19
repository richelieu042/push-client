import {type Ref} from "vue";
import {TimeKit} from "@/_chimera/time/TimeKit";

export class Console {
    static readonly maxOutputLength = 200_000;
    private static outputTextarea: Ref<string> | undefined;

    static initialize(output: Ref<string>) {
        this.outputTextarea = output;
    }

    static println(text: string) {
        const str = `${TimeKit.getCurrentTimeString()} ${text}\n`;
        this.appendOutput(str);
        console.log(str);
    }

    static error(context: string, error: unknown, showInOutput: boolean = true) {
        const str = `${TimeKit.getCurrentTimeString()} ${context}: ${this.formatError(error)}\n`;
        if (showInOutput) {
            this.appendOutput(str);
        }
        console.error(str, error);
    }

    private static appendOutput(text: string) {
        if (this.outputTextarea) {
            this.outputTextarea.value = (this.outputTextarea.value + text).slice(-this.maxOutputLength);
        }
    }

    private static formatError(error: unknown): string {
        try {
            if (error instanceof Error || typeof error === "string") {
                return String(error);
            }
            const ancestors: object[] = [];
            return JSON.stringify(error, function (this: unknown, _key, value: unknown) {
                if (typeof value === "bigint") {
                    return value.toString();
                }
                if (typeof value === "object" && value !== null) {
                    while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
                        ancestors.pop();
                    }
                    if (ancestors.includes(value)) {
                        return "[Circular]";
                    }
                    ancestors.push(value);
                }
                return value;
            }) ?? String(error);
        } catch (formatError) {
            console.error("[Console] Failed to format error", formatError);
            return "Unable to format error; see browser console for details.";
        }
    }

    static clear() {
        if (this.outputTextarea) {
            this.outputTextarea.value = "";
        }
    }

}
