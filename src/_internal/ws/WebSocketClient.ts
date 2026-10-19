import isEmpty from "lodash/isEmpty.js";
import {Console} from "@/_internal/utils/Console";
import {LocalStorageUtil} from "@/_internal/utils/LocalStorageUtil";
import {MsgHandler0} from "@/_internal/ws/MsgHandler0";
import {MsgHandler1} from "@/_internal/ws/MsgHandler1";
import {WebSocketKit} from "@/_chimera/longConnection/WebSocketKit";

export class WebSocketClient {
    private static client: WebSocket | null = null;
    private static connectionAttempt = 0;

    static connect(url: string, pushType: number) {
        url = url.trim();
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
            Console.error(`[WebSocket] Failed to connect to "${url}"`, error);
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
                Console.error(`[WebSocket] Failed to decode message from "${url}"`, error, this.client === client);
            });
            return messages;
        };
        client.onerror = (event) => {
            if (this.client !== client) return;
            Console.error(`[WebSocket] Connection error at "${url}"`, event);
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
        const client = this.client;
        if (!client || client.readyState !== WebSocket.OPEN) {
            alert("WebSocket isn't ready!");
            return
        }

        try {
            client.send(messageText);
            Console.println(`send a message: ${messageText}`);
        } catch (error) {
            Console.error(`[WebSocket] Failed to send message to "${client.url}"`, error, this.client === client);
        }
    }

    static disconnect(silent: boolean = false) {
        const attempt = ++this.connectionAttempt;
        if (this.client == null) {
            return;
        }

        const client = this.client;
        this.client = null;
        client.onopen = null;
        client.onmessage = null;
        client.onerror = null;
        client.onclose = silent ? null : event => {
            if (this.connectionAttempt === attempt && this.client === null) {
                Console.println(`onclose: code(${event.code}), reason(${event.reason}), wasClean(${event.wasClean})`);
            }
        };
        try {
            client.close();
        } catch (error) {
            Console.error(`[WebSocket] Failed to close connection to "${client.url}"`, error, !silent);
        }
    }

}
