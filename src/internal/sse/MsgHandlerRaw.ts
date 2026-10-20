import {Console} from "@/internal/utils/Console";

export class MsgHandlerRaw {
    static handle(origin: string, id: string, event: string, data: any) {
        let text:string = data;

        Console.println(`onmessage(raw): origin(${origin}), id(${id}), event(${event}), text(${text})`);
    }

}