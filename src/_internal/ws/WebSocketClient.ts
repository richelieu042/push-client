import isEmpty from "lodash/isEmpty.js";
import {Console} from "@/_internal/utils/Console";
import {LocalStorageUtil} from "@/_internal/utils/LocalStorageUtil";
import {MsgHandler0} from "@/_internal/ws/MsgHandler0";
import {MsgHandler1} from "@/_internal/ws/MsgHandler1";
import {WebSocketKit} from "@/_chimera/longConnection/WebSocketKit";

export class WebSocketClient {
    static readonly maxPendingMessageCount = 1_000;
    static readonly maxPendingMessageBytes = 8 * 1024 * 1024;
    static readonly maxBufferedSendBytes = 8 * 1024 * 1024;

    private static client: WebSocket | null = null;
    private static connectionAttempt = 0;
    private static stopMessages: (() => void) | null = null;

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
        const queue: {data: string | ArrayBuffer | Blob; bytes: number}[] = [];
        let pendingBytes = 0;
        let decoding = false;
        let stopped = false;
        let accepting = true;
        let messages: Promise<void> | null = null;
        const stopMessages = () => {
            stopped = true;
            accepting = false;
            queue.length = 0;
            pendingBytes = 0;
            if (this.stopMessages === stopMessages) this.stopMessages = null;
        };
        this.stopMessages = stopMessages;
        client.onopen = () => {
            if (this.client === client) Console.println("onopen");
        };
        client.onmessage = (event) => {
            if (this.client !== client || !accepting) return;
            const data: string | ArrayBuffer | Blob = event.data;
            // Strings occupy UTF-16 memory; binary payloads expose their retained byte size.
            const bytes = typeof data === "string" ? data.length * 2
                : data instanceof Blob ? data.size : data.byteLength;
            const count = queue.length + (decoding ? 1 : 0);
            if (count >= this.maxPendingMessageCount || bytes > this.maxPendingMessageBytes - pendingBytes) {
                Console.error(`[WebSocket] Receive backlog exceeded at "${url}"; connection closed`,
                    new Error(`Pending: ${count} messages, ${pendingBytes} bytes; incoming: ${bytes} bytes; limits: ${this.maxPendingMessageCount} messages, ${this.maxPendingMessageBytes} bytes. Pending messages were discarded.`));
                this.disconnect(true);
                return messages;
            }
            queue.push({data, bytes});
            pendingBytes += bytes;
            if (!messages) {
                messages = Promise.resolve().then(async () => {
                    try {
                        while (!stopped && queue.length > 0) {
                            const next = queue.shift()!;
                            decoding = true;
                            try {
                                const message = await (messageType === 0
                                    ? MsgHandler0.decode(next.data)
                                    : MsgHandler1.decode(next.data));
                                if (this.client === client) Console.println(message);
                            } catch (error) {
                                Console.error(`[WebSocket] Failed to decode message from "${url}"`, error, this.client === client);
                            } finally {
                                decoding = false;
                                pendingBytes = Math.max(0, pendingBytes - next.bytes);
                            }
                        }
                    } finally {
                        messages = null;
                    }
                });
            }
            return messages;
        };
        client.onerror = (event) => {
            if (this.client !== client) return;
            Console.error(`[WebSocket] Connection error at "${url}"`, event);
        };
        client.onclose = (event) => {
            // Finish decoding already received messages before reporting a remote close.
            accepting = false;
            return (messages ?? Promise.resolve()).then(() => {
                if (this.client !== client) return;
                Console.println(`onclose: code(${event.code}), reason(${event.reason}), wasClean(${event.wasClean})`);
                this.client = null;
                stopMessages();
                client.onopen = null;
                client.onmessage = null;
                client.onerror = null;
                client.onclose = null;
            });
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
            const bytes = new Blob([messageText]).size;
            if (bytes > this.maxBufferedSendBytes - client.bufferedAmount) {
                Console.error(`[WebSocket] Send buffer limit exceeded at "${client.url}"; message was not sent`,
                    new Error(`Buffered: ${client.bufferedAmount} bytes; message: ${bytes} bytes; limit: ${this.maxBufferedSendBytes} bytes. Retry after the connection catches up.`));
                return;
            }
            client.send(messageText);
            Console.println(`send a message: ${messageText}`);
        } catch (error) {
            Console.error(`[WebSocket] Failed to send message to "${client.url}"`, error, this.client === client);
        }
    }

    static disconnect(silent: boolean = false) {
        const attempt = ++this.connectionAttempt;
        this.stopMessages?.();
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
