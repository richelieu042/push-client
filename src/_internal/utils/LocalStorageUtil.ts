import {LocalStorageKit} from "@/_chimera/browser/LocalStorageKit";
import {Key} from "@/_internal/consts/key";

export class LocalStorageUtil {
    static setConnectionType(value: number) {
        LocalStorageKit.set(Key.ConnectionType, value.toString());
    }

    // 默认返回0
    static getConnectionType(): number {
        return this.getOption(Key.ConnectionType, [0, 1, 2]);
    }

    /*
     * WebSocket
     */
    static setWsUrl(value: string) {
        LocalStorageKit.set(Key.WsUrl, value);
    }

    /*
     * WebSocket
     */
    static getWsUrl(): string {
        return LocalStorageKit.get(Key.WsUrl);
    }

    /*
     * WebSocket
     */
    static setWsPushMessageType(value: number) {
        LocalStorageKit.set(Key.WsPushMessageType, value.toString());
    }

    /*
     * WebSocket 默认返回0
     */
    static getWsPushMessageType(): number {
        return this.getOption(Key.WsPushMessageType, [0, 1]);
    }

    /*
     * SSE
     */
    static setSseUrl(value: string) {
        LocalStorageKit.set(Key.SseUrl, value);
    }

    /*
     * SSE
     */
    static getSseUrl(): string {
        return LocalStorageKit.get(Key.SseUrl);
    }

    /*
    * SSE
    */
    static setSsePushMessageType(value: number) {
        LocalStorageKit.set(Key.SsePushMessageType, value.toString());
    }

    /*
     * SSE 默认返回0
     */
    static getSsePushMessageType(): number {
        return this.getOption(Key.SsePushMessageType, [0, 1]);
    }

    private static getOption(key: string, allowed: number[]): number {
        const value = Number(LocalStorageKit.get(key));
        return allowed.includes(value) ? value : 0;
    }

    /*
     * Centrifuge-Debug
     */
    static getCentrifugeDebug(): boolean {
        return LocalStorageKit.get("Centrifuge-Debug") === "true";
    }

    /*
     * Centrifuge-Debug
     */
    static setCentrifugeDebug(flag: boolean) {
        LocalStorageKit.set("Centrifuge-Debug", "" + flag);
    }

    /*
     * Centrifuge-Protocol
     */
    static getCentrifugeProtocol(): string {
        return LocalStorageKit.get("Centrifuge-Protocol") === "protobuf" ? "protobuf" : "json";
    }

    /*
     * Centrifuge-Protocol
     */
    static setCentrifugeProtocol(value: string) {
        LocalStorageKit.set("Centrifuge-Protocol", value);
    }

    /*
     * Centrifuge-Secret
     */
    static getCentrifugeSecret(): string {
        return LocalStorageKit.get("Centrifuge-Secret") || "";
    }

    /*
     * Centrifuge-Secret
     */
    static setCentrifugeSecret(value: string) {
        LocalStorageKit.set("Centrifuge-Secret", value);
    }

    /*
     * Centrifuge-User
     */
    static getCentrifugeUser(): string {
        return LocalStorageKit.get("Centrifuge-User") || "";
    }

    /*
     * Centrifuge-User
     */
    static setCentrifugeUser(value: string) {
        LocalStorageKit.set("Centrifuge-User", value);
    }

    /*
     * Centrifuge-Channel
     */
    static getCentrifugeChannel(): string {
        return LocalStorageKit.get("Centrifuge-Channel") || "";
    }

    /*
     * Centrifuge-Channel
     */
    static setCentrifugeChannel(value: string) {
        LocalStorageKit.set("Centrifuge-Channel", value);
    }

    /*
     * Centrifuge-Alternative0-Type
     */
    static getCentrifugeAlternative0Type(): string {
        return this.getCentrifugeTransport("Centrifuge-Alternative0-Type");
    }

    /*
     * Centrifuge-Alternative0-Type
     */
    static setCentrifugeAlternative0Type(value: string) {
        LocalStorageKit.set("Centrifuge-Alternative0-Type", value);
    }

    /*
     * Centrifuge-Alternative0-Url
     */
    static getCentrifugeAlternative0Url(): string {
        return LocalStorageKit.get("Centrifuge-Alternative0-Url") || "";
    }

    /*
     * Centrifuge-Alternative0-Url
     */
    static setCentrifugeAlternative0Url(value: string) {
        LocalStorageKit.set("Centrifuge-Alternative0-Url", value);
    }

    /*
     * Centrifuge-Alternative1-Type
     */
    static getCentrifugeAlternative1Type(): string {
        return this.getCentrifugeTransport("Centrifuge-Alternative1-Type");
    }

    /*
     * Centrifuge-Alternative1-Type
     */
    static setCentrifugeAlternative1Type(value: string) {
        LocalStorageKit.set("Centrifuge-Alternative1-Type", value);
    }

    /*
     * Centrifuge-Alternative1-Url
     */
    static getCentrifugeAlternative1Url(): string {
        return LocalStorageKit.get("Centrifuge-Alternative1-Url") || "";
    }

    /*
     * Centrifuge-Alternative1-Url
     */
    static setCentrifugeAlternative1Url(value: string) {
        LocalStorageKit.set("Centrifuge-Alternative1-Url", value);
    }

    /*
     * Centrifuge-Alternative2-Type
     */
    static getCentrifugeAlternative2Type(): string {
        return this.getCentrifugeTransport("Centrifuge-Alternative2-Type");
    }

    private static getCentrifugeTransport(key: string): string {
        const value = LocalStorageKit.get(key);
        return ["websocket", "sse", "http_stream"].includes(value) ? value : "";
    }

    /*
     * Centrifuge-Alternative2-Type
     */
    static setCentrifugeAlternative2Type(value: string) {
        LocalStorageKit.set("Centrifuge-Alternative2-Type", value);
    }

    /*
     * Centrifuge-Alternative2-Url
     */
    static getCentrifugeAlternative2Url(): string {
        return LocalStorageKit.get("Centrifuge-Alternative2-Url") || "";
    }

    /*
     * Centrifuge-Alternative2-Url
     */
    static setCentrifugeAlternative2Url(value: string) {
        LocalStorageKit.set("Centrifuge-Alternative2-Url", value);
    }

    /*
     * Centrifuge-Rpc-Method
     */
    static getCentrifugeRpcMethod(): string {
        return LocalStorageKit.get("Centrifuge-Rpc-Method") || "";
    }

    /*
     * Centrifuge-Rpc-Method
     */
    static setCentrifugeRpcMethod(value: string) {
        LocalStorageKit.set("Centrifuge-Rpc-Method", value);
    }

    /*
     * Centrifuge-Rpc-Data
     */
    static getCentrifugeRpcData(): string {
        return LocalStorageKit.get("Centrifuge-Rpc-Data") || "";
    }

    /*
     * Centrifuge-Rpc-Data
     */
    static setCentrifugeRpcData(value: string) {
        LocalStorageKit.set("Centrifuge-Rpc-Data", value);
    }

}
