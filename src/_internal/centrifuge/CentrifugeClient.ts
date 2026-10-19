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

    static debug: boolean = LocalStorageUtil.getCentrifugeDebug();
    static protocol: string = LocalStorageUtil.getCentrifugeProtocol();
    static user: string = LocalStorageUtil.getCentrifugeUser();
    static channel: string = LocalStorageUtil.getCentrifugeChannel();
    static secret: string = LocalStorageUtil.getCentrifugeSecret();
    static rpcMethod: string = LocalStorageUtil.getCentrifugeRpcMethod();
    static rpcData: string = LocalStorageUtil.getCentrifugeRpcData();

    static async connect(endpoints: Array<TransportEndpoint>) {
        this.disconnect(false);
        const attempt = this.connectionAttempt;
        const {debug, protocol, secret, channel} = this;
        const transportEndpoints = endpoints.map(endpoint => ({...endpoint, endpoint: endpoint.endpoint.trim()}));

        if (isEmpty(transportEndpoints)) {
            alert(`You need at least one valid TransportEndpoint!`);
            return;
        }
        if (transportEndpoints.some(endpoint => !this.checkUrl(endpoint.endpoint, endpoint.transport))) {
            alert("Invalid URL or transport in TransportEndpoints!");
            return;
        }
        if (isEmpty(secret)) {
            alert("secret is empty!");
            return;
        }
        if (isEmpty(channel)) {
            alert("channel is empty!");
            return;
        }
        let user: string = this.user;
        if (isEmpty(user)) {
            user = UuidKit.v4();
        }

        let connectToken: string;
        let subToken: string;
        let Client: typeof Centrifuge | typeof ProtobufCentrifuge = Centrifuge;
        try {
            connectToken = await CentrifugeKit.genToken({}, "HS256", secret, "24h", user);
            if (attempt !== this.connectionAttempt) {
                return;
            }
            subToken = await CentrifugeKit.genSubToken({}, "HS256", secret, "24h", user, channel);
            if (attempt !== this.connectionAttempt) {
                return;
            }
            if (protocol === "protobuf") {
                Client = (await import('centrifuge/build/protobuf')).Centrifuge;
                if (attempt !== this.connectionAttempt) {
                    return;
                }
            }
        } catch (error) {
            Console.error(`[client-error] Failed to prepare Centrifuge connection (attempt: ${attempt})`, error, attempt === this.connectionAttempt);
            return;
        }
        Console.println(`user: [${user}]`);
        Console.println(`channel: [${channel}]`);
        let emulationEndpoint = this.getEmulationEndpoint(transportEndpoints);
        Console.println(`emulation endpoint: "${emulationEndpoint}"`);

        let opts: Partial<Options> = {
            debug: debug,
            token: connectToken,
            data: null,
            emulationEndpoint: emulationEndpoint,
            // websocket: WebSocket,
            /*
             * 客户端的timeout
             * timeout for operations in milliseconds
             * 默认: 约5s（自测）
             * 单位: ms
             *
             * !!!:
             * (1) Richelieu: 建议采纳 timeout == centrifugo
             * (2) 如果 timeout <= centrifugo 的 proxy_rpc_timeout 配置项，前端的超时报错: {"code":1,"message":"timeout"}
             * (3) 如果 timeout > centrifugo 的 proxy_rpc_timeout 配置项，前端的超时报错: {"code":100,"message":"internal server error","temporary":true}
             */
            timeout: 1000 * 30,
        };

        let createdClient: Centrifuge | ProtobufCentrifuge | null = null;
        try {
            const client = new Client(transportEndpoints, opts);
            createdClient = client;
            this.client = client;
            this.clientProtocol = protocol;
            this.clientChannel = channel;
            // this.client.setToken("<token>");
            this.client.on('connecting', function (ctx: ConnectingContext) {
                if (CentrifugeClient.client !== client) {
                    return;
                }
                console.log("ConnectingContext", ctx);
                Console.println(`[client-connecting] code: ${ctx.code}, reason: ${ctx.reason}`);
            });
            this.client.on('connected', function (ctx: ConnectedContext) {
                if (CentrifugeClient.client !== client) {
                    return;
                }
                console.log("ConnectedContext", ctx);
                Console.println(`+++ [client-connected] client: ${ctx.client}, transport: ${ctx.transport}`);
            });
            this.client.on('disconnected', function (ctx: DisconnectedContext) {
                if (CentrifugeClient.client !== client) {
                    return;
                }
                console.log("DisconnectedContext", ctx);
                Console.println(`--- [client-disconnected] code: ${ctx.code}, reason: ${ctx.reason}`);

                // 长连接彻底结束
                CentrifugeClient.client = null;
            });
            this.client.on('error', function (ctx: ErrorContext) {
                if (CentrifugeClient.client !== client) {
                    return;
                }
                console.log("ErrorContext", ctx);
                Console.println(`[ERROR] type: ${ctx.type}, transport: ${ctx.transport}, error.code: ${ctx.error.code}, error.message: ${ctx.error.message}`);
            });

            let sub = this.client.newSubscription(channel, {
                token: subToken,
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
                console.log("SubscriptionErrorContext", ctx);

                Console.println(`--- [sub-error] channel: ${ctx.channel}, type: ${ctx.type}, error.code: ${ctx.error.code}, error.message: ${ctx.error.message}`);
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

            sub.subscribe();
            client.connect();
        } catch (error) {
            Console.error(`[client-error] Failed to start Centrifuge connection (attempt: ${attempt})`, error, attempt === this.connectionAttempt);
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
                return url.startsWith("https://") && SseKit.checkUrl(url);
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

            let data = rpcResult.data;
            let response: any;
            if (data instanceof Uint8Array) {
                // protocol: Protobuf binary
                let json = Uint8ArrayKit.toString(data);
                response = JSON.parse(json);
            } else {
                // protocol: JSON
                response = data;
            }
            Console.println(`[rpc] response: ${JSON.stringify(response)}`);
        } catch (err) {
            Console.error(`[rpc] Method "${method}" failed`, err, this.client === client);
        }

        /* 获取返回值的方法2 */
        // this.client.rpc(method, finalData).then(function (rpcResult) {
        //     let data = rpcResult.data;
        //     let response: any;
        //
        //     if (data instanceof Uint8Array) {
        //         // protocol: Protobuf binary
        //         let json = Uint8ArrayKit.toString(data);
        //         response = JSON.parse(json);
        //     } else {
        //         // protocol: JSON
        //         response = data;
        //     }
        //     console.log('[rpc] result data:', data);
        //     Console.println(`[rpc] response: ${JSON.stringify(response)}`);
        // }, function (err) {
        //     console.log('[rpc] error:', err);
        //     Console.println(`[rpc] error: ${JSON.stringify(err)}`)
        // });
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
