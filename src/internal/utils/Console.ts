import {type Ref} from "vue";
import {TimeKit} from "@/chimera/time/TimeKit";

export class Console {
    static readonly maxOutputLength = 200_000;
    private static outputTextarea: Ref<string> | undefined;
    private static pendingOutput = "";
    private static outputFrame: number | undefined;

    static initialize(output: Ref<string>) {
        this.cancelPendingOutput();
        this.outputTextarea = output;
        return () => {
            if (this.outputTextarea === output) {
                this.cancelPendingOutput();
                this.outputTextarea = undefined;
            }
        };
    }

    static println(text: string) {
        const str = `${TimeKit.getCurrentTimeString()} ${text}\n`;
        this.appendOutput(str);
        console.log(str);
    }

    static error(context: string, error: unknown, showInOutput: boolean = true) {
        if (!showInOutput) {
            console.error(`${TimeKit.getCurrentTimeString()} ${context}`, error);
            return;
        }
        const str = `${TimeKit.getCurrentTimeString()} ${context}: ${this.formatError(error)}\n`;
        this.appendOutput(str);
        console.error(str, error);
    }

    private static appendOutput(text: string) {
        if (!this.outputTextarea) {
            return;
        }
        this.pendingOutput = this.appendBounded(this.pendingOutput, text);
        if (typeof requestAnimationFrame !== "function") {
            this.flushOutput();
        } else if (this.outputFrame === undefined) {
            this.outputFrame = requestAnimationFrame(() => {
                this.outputFrame = undefined;
                this.flushOutput();
            });
        }
    }

    private static appendBounded(previous: string, text: string): string {
        return text.length >= this.maxOutputLength
            ? text.slice(-this.maxOutputLength)
            : previous.slice(-(this.maxOutputLength - text.length)) + text;
    }

    private static flushOutput() {
        if (this.outputTextarea && this.pendingOutput) {
            this.outputTextarea.value = this.appendBounded(this.outputTextarea.value, this.pendingOutput);
        }
        this.pendingOutput = "";
    }

    private static cancelPendingOutput() {
        if (this.outputFrame !== undefined) {
            cancelAnimationFrame(this.outputFrame);
            this.outputFrame = undefined;
        }
        this.pendingOutput = "";
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
        this.cancelPendingOutput();
        if (this.outputTextarea) {
            this.outputTextarea.value = "";
        }
    }

}
