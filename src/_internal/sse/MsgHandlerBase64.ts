import {Console} from "@/_internal/utils/Console";
import {Base64Kit} from "@/_chimera/crypto/Base64Kit";

export class MsgHandlerBase64 {
    static handle(origin: string, id: string, event: string, data: any) {
        let text:string = Base64Kit.decodeStringToString(data);

        Console.println(`onmessage(base64): origin(${origin}), id(${id}), event(${event}), text(${text})`);
    }
}
