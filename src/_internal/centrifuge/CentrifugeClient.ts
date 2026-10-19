import isEmpty from "lodash/isEmpty.js";
import type {
    ConnectedContext,
    ConnectingContext,
    DisconnectedContext,
    ErrorContext,
    JoinContext,
    LeaveContext,
    Options,
    PublicationContext,
    SubscribedContext,
    SubscribingContext,
    SubscriptionErrorContext,
    TransportEndpoint,
    TransportName,
    UnsubscribedContext,
} from "centrifuge";
import {Centrifuge} from 'centrifuge';
import type {Centrifuge as ProtobufCentrifuge} from 'centrifuge/build/protobuf';
import {Console} from "@/_internal/utils/Console";
import {WebSocketKit} from "@/_chimera/longConnection/WebSocketKit";
import {SseKit} from "@/_chimera/longConnection/SseKit";
import {Uint8ArrayKit} from "@/_chimera/type/Uint8ArrayKit";
import {StringKit} from "@/_chimera/type/StringKit";
import {LocalStorageUtil} from "@/_internal/utils/LocalStorageUtil";
import {UuidKit} from "@/_chimera/id/UuidKit";
import {CentrifugeKit} from "@/_chimera/longConnection/CentrifugeKit";

export class CentrifugeClient {
    private static client: Centrifuge | ProtobufCentrifuge | null = null;
    private static connectionAttempt = 0;
    private static clientProtocol = "json";
    private static clientChannel = "";
    private static networkEvents = new WeakMap<Centrifuge | ProtobufCentrifuge, AbortController>();

    static debug: boolean = LocalStorageUtil.getCentrifugeDebug();
    static protocol: string = LocalStorageUtil.getCentrifugeProtocol();
    static user: string = LocalStorageUtil.getCentrifugeUser();
    static channel: string = LocalStorageUtil.getCentrifugeChannel();
    static secret: string = LocalStorageUtil.getCentrifugeSecret();
    static rpcMethod: string = LocalStorageUtil.getCentrifugeRpcMethod();
    static rpcData: string = LocalStorageUtil.getCentrifugeRpcData();

    static async connect(endpoints: Array<TransportEndpoint>) {
        let attempt: number | undefined;
        let createdClient: Centrifuge | ProtobufCentrifuge | null = null;
        try {
            const {debug, protocol, secret, channel} = this;
            if (!Array.isArray(endpoints) || endpoints.length === 0) {
                alert("You need at least one valid TransportEndpoint!");
                return;
            }
            if (endpoints.some(endpoint => !endpoint || typeof endpoint.endpoint !== "string" || typeof endpoint.transport !== "string")) {
                alert("Invalid URL or transport in TransportEndpoints!");
                return;
            }
            const transportEndpoints = endpoints.map(endpoint => ({...endpoint, endpoint: endpoint.endpoint.trim()}));
            if (transportEndpoints.some(endpoint => !this.checkUrl(endpoint.endpoint, endpoint.transport))) {
                alert("Invalid URL or transport in TransportEndpoints!");
                return;
            }
            if (typeof secret !== "string" || isEmpty(secret)) {
                alert("secret is empty!");
                return;
            }
            if (typeof channel !== "string" || channel.trim() === "") {
                alert("channel is empty!");
                return;
            }
            if (protocol !== "json" && protocol !== "protobuf") {
                alert("Invalid Centrifuge protocol!");
                return;
            }
            if (typeof this.user !== "string") {
                alert("Invalid Centrifuge user!");
                return;
            }
            const user = isEmpty(this.user) ? UuidKit.v4() : this.user;
            const emulationEndpoint = this.getEmulationEndpoint(transportEndpoints);
            attempt = ++this.connectionAttempt;
            const connectToken = await CentrifugeKit.genToken({}, "HS256", secret, "24h", user);
            if (attempt !== this.connectionAttempt) {
                return;
            }
            const subToken = await CentrifugeKit.genSubToken({}, "HS256", secret, "24h", user, channel);
            if (attempt !== this.connectionAttempt) {
                return;
            }
            let Client: typeof Centrifuge | typeof ProtobufCentrifuge = Centrifuge;
            if (protocol === "protobuf") {
                Client = (await import('centrifuge/build/protobuf')).Centrifuge;
                if (attempt !== this.connectionAttempt) {
                    return;
                }
            }
            const renewToken = async (subscription: boolean) => {
                if (!createdClient || this.client !== createdClient) {
                    return "";
                }
                try {
                    const token = subscription
                        ? await CentrifugeKit.genSubToken({}, "HS256", secret, "24h", user, channel)
                        : await CentrifugeKit.genToken({}, "HS256", secret, "24h", user);
                    return this.client === createdClient ? token : "";
                } catch (error) {
                    Console.error(`[client-error] Failed to refresh ${subscription ? "subscription" : "connection"} token`, error, this.client === createdClient);
                    throw error;
                }
            };
            const networkEventTarget = new EventTarget();
            const opts: Partial<Options> = {
                debug: debug,
                // Set the initial JWT after construction: SDK debug logs its complete config.
                getToken: () => renewToken(false),
                data: null,
                emulationEndpoint: emulationEndpoint,
                networkEventTarget,
                /*
                 * Client timeout in milliseconds. Keep it above proxy_rpc_timeout
                 * to receive a server error rather than a local timeout.
                 */
                timeout: 1000 * 30,
            };
            const client = new Client(transportEndpoints, opts);
            createdClient = client;
            client.setToken(connectToken);
            client.on('connecting', function (ctx: ConnectingContext) {
                if (CentrifugeClient.client !== client) {
                    return;
                }
                console.log("ConnectingContext", ctx);
                Console.println(`[client-connecting] code: ${ctx.code}, reason: ${ctx.reason}`);
            });
            client.on('connected', function (ctx: ConnectedContext) {
                if (CentrifugeClient.client !== client) {
                    return;
                }
                console.log("ConnectedContext", ctx);
                Console.println(`+++ [client-connected] client: ${ctx.client}, transport: ${ctx.transport}`);
            });
            client.on('disconnected', function (ctx: DisconnectedContext) {
                if (CentrifugeClient.client !== client) {
                    return;
                }
                console.log("DisconnectedContext", ctx);
                Console.println(`--- [client-disconnected] code: ${ctx.code}, reason: ${ctx.reason}`);

                // 长连接彻底结束
                CentrifugeClient.client = null;
                CentrifugeClient.closeClient(client);
            });
            client.on('error', function (ctx: ErrorContext) {
                if (CentrifugeClient.client !== client) {
                    return;
                }
                Console.error(`[client-error] type: ${ctx.type}, transport: ${ctx.transport}`, ctx.error);
            });

            const sub = client.newSubscription(channel, {
                token: subToken,
                getToken: () => renewToken(true),
            });
            sub.on("subscribing", function (ctx: SubscribingContext) {
                if (CentrifugeClient.client !== client) {
                    return;
                }
                console.log("SubscribingContext", ctx);

                Console.println(`[订阅ing] code: ${ctx.code}, reason: ${ctx.reason}`);
            });
            sub.on("subscribed", function (ctx: SubscribedContext) {
                if (CentrifugeClient.client !== client) {
                    return;
                }
                console.log("SubscribedContext", ctx);

                Console.println(`[订阅成功] channel: ${ctx.channel}`);
            });
            sub.on("unsubscribed", function (ctx: UnsubscribedContext) {
                if (CentrifugeClient.client !== client) {
                    return;
                }
                console.log("UnsubscribedContext", ctx);

                Console.println(`--- [sub-unsubscribed] channel: ${ctx.channel}, code: ${ctx.code}, reason: ${ctx.reason}`);
            });
            sub.on("error", function (ctx: SubscriptionErrorContext) {
                if (CentrifugeClient.client !== client) {
                    return;
                }
                Console.error(`[sub-error] channel: ${ctx.channel}, type: ${ctx.type}`, ctx.error);
            });
            sub.on("publication", function (ctx: PublicationContext) {
                if (CentrifugeClient.client !== client) {
                    return;
                }
                console.log("PublicationContext", ctx);

                if (typeof ctx.data === "string") {
                    Console.println(`[sub-publication] channel: ${ctx.channel}, content(string): ${ctx.data}`);
                    return
                } else if (ctx.data instanceof Uint8Array) {
                    let text = Uint8ArrayKit.toString(ctx.data);
                    Console.println(`[sub-publication] channel: ${ctx.channel}, content(Uint8Array): ${text}`);
                    return
                }
                Console.println(`[sub-publication] channel: ${ctx.channel}, content(object): ${JSON.stringify(ctx.data)}`);
            });
            sub.on("join", function (ctx: JoinContext) {
                if (CentrifugeClient.client !== client) {
                    return;
                }
                console.log("JoinContext", ctx);

                Console.println(`[sub-join] channel: ${ctx.channel}, info.user: ${ctx.info.user}, info.client: ${ctx.info.client}`);
            });
            sub.on("leave", function (ctx: LeaveContext) {
                if (CentrifugeClient.client !== client) {
                    return;
                }
                console.log("LeaveContext", ctx);

                Console.println(`[sub-leave] channel: ${ctx.channel}, info.user: ${ctx.info.user}, info.client: ${ctx.info.client}`);
            });

            // Keep the current connection until the replacement is fully prepared.
            const previousClient = this.client;
            this.client = client;
            this.clientProtocol = protocol;
            this.clientChannel = channel;
            if (previousClient) {
                this.closeClient(previousClient);
            }
            this.forwardNetworkEvents(client, networkEventTarget);
            Console.println(`user: [${user}]`);
            Console.println(`channel: [${channel}]`);
            Console.println(`emulation endpoint: "${emulationEndpoint}"`);
            sub.subscribe();
            client.connect();
        } catch (error) {
            Console.error(`[client-error] Failed to prepare or start Centrifuge connection (attempt: ${attempt ?? "validation"})`, error, attempt === undefined || attempt === this.connectionAttempt);
            if (createdClient) {
                if (this.client === createdClient) {
                    this.client = null;
                }
                this.closeClient(createdClient);
            }
        }
    }

    static async publish(data: any) {
        if (data === undefined || data === null) {
            return;
        }
        const client = this.client;
        const channel = this.clientChannel;
        if (client == null || client.state !== "connected") {
            return;
        }

        try {
            await client.publish(channel, data);
        } catch (error) {
            Console.error(`[publish] Channel "${channel}" failed`, error, this.client === client);
        }
    }

    static disconnect(alertFlag: boolean = true) {
        this.connectionAttempt++;
        const client = this.client;
        if (client == null) {
            if (alertFlag) {
                alert("No connection now!");
            }
            return;
        }

        this.client = null;
        if (alertFlag) {
            Console.println("[client-disconnect] Disconnect requested");
        }
        this.closeClient(client);
    }

    private static closeClient(client: Centrifuge | ProtobufCentrifuge) {
        this.networkEvents.get(client)?.abort();
        this.networkEvents.delete(client);
        try {
            for (const sub of Object.values(client.subscriptions())) {
                try {
                    sub.unsubscribe();
                } catch (error) {
                    Console.error("[client-disconnect] Failed to unsubscribe", error);
                }
            }
        } catch (error) {
            Console.error("[client-disconnect] Failed to read subscriptions", error);
        }
        try {
            client.disconnect();
        } catch (error) {
            Console.error("[client-disconnect] Failed to close connection", error);
        }
    }

    private static forwardNetworkEvents(client: Centrifuge | ProtobufCentrifuge, target: EventTarget) {
        if (typeof globalThis.addEventListener !== "function") {
            return;
        }
        // The SDK retains its network listeners after disconnect. Forward them through
        // a private target so replacing a client can release the global listeners.
        const controller = new AbortController();
        this.networkEvents.set(client, controller);
        for (const type of ["online", "offline"]) {
            globalThis.addEventListener(type, () => target.dispatchEvent(new Event(type)), {signal: controller.signal});
        }
    }

    static checkUrl(url: string, transport?: TransportName): boolean {
        if (typeof url !== "string" || url.includes('#')) {
            return false;
        }
        switch (transport) {
            case "websocket":
                return WebSocketKit.checkUrl(url);
            case "sse":
            case "http_stream":
            case "sockjs":
                return SseKit.checkUrl(url);
            case "webtransport":
                return /^https:\/\//i.test(url) && SseKit.checkUrl(url);
            case undefined:
                return WebSocketKit.checkUrl(url) || SseKit.checkUrl(url);
            default:
                return false;
        }
    }

    static async rpc() {
        const client = this.client;
        const protocol = this.clientProtocol;
        if (client == null) {
            alert("No connection now!");
            return;
        }

        let method: string = this.rpcMethod,
            data: any;

        /* 取值 */
        if (isEmpty(this.rpcMethod)) {
            alert("rpc method is empty!");
            return;
        }
        if (isEmpty(this.rpcData)) {
            alert("rpc data is empty!");
            return;
        }
        try {
            data = JSON.parse(this.rpcData)
        } catch (error) {
            Console.error(`[rpc] Invalid JSON data for method "${method}"`, error);
            alert("rpc data is a json string!");
            return;
        }
        Console.println(`[rpc] method: ${method}, data: ${JSON.stringify(data)}`);

        let finalData: any;
        if (protocol === "protobuf") {
            // Make sure data is properly encoded when calling methods of Centrifuge Protobuf-based instance.
            // 使用 protobuf 协议，需要额外编码为Uint8Array实例
            finalData = StringKit.toUint8Array(JSON.stringify(data));
        } else {
            finalData = data;
        }

        /* 获取返回值的方法1 */
        try {
            let rpcResult = await client.rpc(method, finalData);
            if (this.client !== client) {
                return;
            }
            console.log('[rpc] result:', rpcResult);

            const data = rpcResult.data;
            // Protobuf carries arbitrary bytes; a successful response need not contain JSON.
            const response = data instanceof Uint8Array ? Uint8ArrayKit.toString(data) : JSON.stringify(data);
            Console.println(`[rpc] response: ${response}`);
        } catch (err) {
            Console.error(`[rpc] Method "${method}" failed`, err, this.client === client);
        }

    }

    /*
     * @return 可能为""
     */
    private static getEmulationEndpoint(endpoints: Array<TransportEndpoint>): string {
        for (let te of endpoints) {
            switch (te.transport) {
                case "http_stream":
                case "sse":
                    const endpoint = new URL(te.endpoint);
                    const connectionPath = endpoint.pathname.search(/\/connection(?:\/|$)/);
                    // Keep reverse-proxy prefixes, and never derive the route from a query parameter.
                    endpoint.pathname = (connectionPath === -1 ? "" : endpoint.pathname.slice(0, connectionPath)) + "/emulation";
                    endpoint.search = "";
                    return endpoint.toString();
                default:
                // do nothing
            }
        }
        return "";
    }

    /*
     * 返回长连接客户端的状态.
     */
    static getState(): string {
        if (this.client == null) {
            return "null";
        }

        // "disconnected" || "connecting" || "connected"
        return this.client.state;
    }

}
