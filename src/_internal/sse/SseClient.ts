import {LocalStorageUtil} from "@/_internal/utils/LocalStorageUtil";
import {Console} from "@/_internal/utils/Console";
import {MsgHandlerRaw} from "@/_internal/sse/MsgHandlerRaw";
import {MsgHandlerBase64} from "@/_internal/sse/MsgHandlerBase64";
import {SseKit} from "@/_chimera/longConnection/SseKit";

export class SseClient {
    private static client: EventSource | null = null;

    static connect(url: string, pushType: number) {
        if (!SseKit.checkUrl(url)) {
            alert(`SSE url(${url}) is invalid!`);
            return;
        }
        const messageType = Number(pushType);
        if (messageType !== 0 && messageType !== 1) {
            alert(`SSE pushType(${pushType}) is invalid`);
            return;
        }
        this.disconnect();
        LocalStorageUtil.setSseUrl(url);

        let client: EventSource;
        try {
            client = new EventSource(url);
        } catch (error) {
            console.error(`[SSE] Failed to connect to "${url}"`, error);
            Console.println(`[SSE] connect error: ${String(error)}`);
            return;
        }
        this.client = client;
        const onMessage = (event: MessageEvent) => {
            if (this.client !== client) return;
            try {
                SseClient.handle(messageType, event.origin, event.lastEventId, event.type, event.data);
            } catch (error) {
                console.error(`[SSE] Failed to handle message from "${url}" (type: ${event.type}, id: ${event.lastEventId})`, error);
                Console.println(`[SSE] message error: ${String(error)}`);
            }
        };
        client.addEventListener('test', onMessage, false);
        client.onmessage = onMessage;
        // 如果发生通信错误（比如连接中断），就会触发error事件
        client.onerror = (event) => {
            if (this.client !== client) return;
            Console.println("onerror");
            console.error(event);
        };
    }

    static disconnect() {
        if (this.client == null) {
            return;
        }

        const client = this.client;
        this.client = null;
        client.onmessage = null;
        client.onerror = null;
        client.close();
    }

    private static handle(pushType: number, origin: string, id: string, event: string, data: any) {
        switch (pushType) {
            case 0:
                MsgHandlerRaw.handle(origin, id, event, data);
                break;
            case 1:
                MsgHandlerBase64.handle(origin, id, event, data);
                break;
            default:
                alert(`SSE pushType(${pushType}) is invalid`);
        }
    }
}
