import isEmpty from "lodash/isEmpty.js";
import {Console} from "@/_internal/utils/Console";
import {LocalStorageUtil} from "@/_internal/utils/LocalStorageUtil";
import {MsgHandler0} from "@/_internal/ws/MsgHandler0";
import {MsgHandler1} from "@/_internal/ws/MsgHandler1";
import {WebSocketKit} from "@/_chimera/longConnection/WebSocketKit";

export class WebSocketClient {
    private static client: WebSocket | null = null;

    static connect(url: string, pushType: number) {
        if (!WebSocketKit.checkUrl(url)) {
            alert(`WebSocket url(${url}) is invalid!`);
            return;
        }
        const messageType = Number(pushType);
        if (messageType !== 0 && messageType !== 1) {
            alert(`Unknown ws push type(${pushType})!`);
            return;
        }
        this.disconnect(true);
        LocalStorageUtil.setWsUrl(url);

        let client: WebSocket;
        try {
            client = new WebSocket(url);
        } catch (error) {
            Console.println(`[WebSocket] connect error: ${String(error)}`);
            return;
        }
        this.client = client;
        client.binaryType = "blob";
        let messages = Promise.resolve();
        client.onopen = () => {
            if (this.client === client) Console.println("onopen");
        };
        client.onmessage = (event) => {
            messages = messages.then(async () => {
                if (this.client !== client) return;
                const message = await (messageType === 0
                    ? MsgHandler0.decode(event.data)
                    : MsgHandler1.decode(event.data));
                if (this.client === client) Console.println(message);
            }).catch(error => {
                if (this.client === client) {
                    Console.println(`[WebSocket] message error: ${String(error)}`);
                }
            });
            return messages;
        };
        client.onerror = (event) => {
            if (this.client !== client) return;
            Console.println("onerror");
            console.error(event);
        };
        client.onclose = (event) => {
            // Finish decoding already received messages before reporting a remote close.
            messages = messages.then(() => {
                if (this.client !== client) return;
                Console.println(`onclose: code(${event.code}), reason(${event.reason}), wasClean(${event.wasClean})`);
                this.client = null;
            });
            return messages;
        };
    }

    static send(messageText: string) {
        if (isEmpty(messageText)) {
            alert("Message is empty!");
            return
        }
        if (!this.client || this.client.readyState != WebSocket.OPEN) {
            alert("WebSocket isn't ready!");
            return
        }

        this.client.send(messageText);
        Console.println(`send a message: ${messageText}`)
    }

    static disconnect(silent: boolean = false) {
        if (this.client == null) {
            return;
        }

        const client = this.client;
        this.client = null;
        client.onopen = null;
        client.onmessage = null;
        client.onerror = null;
        client.onclose = silent ? null : event => {
            if (this.client === null) {
                Console.println(`onclose: code(${event.code}), reason(${event.reason}), wasClean(${event.wasClean})`);
            }
        };
        client.close();
    }

}
