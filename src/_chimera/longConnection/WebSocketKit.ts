export class WebSocketKit {
    /*
     * @return false: 不通过
     */
    static checkUrl(url: string): boolean {
        if (typeof url !== "string" || (!url.startsWith("ws://") && !url.startsWith("wss://"))) {
            return false;
        }
        try {
            const parsed = new URL(url);
            return (parsed.protocol === "ws:" || parsed.protocol === "wss:")
                && parsed.hostname.length > 0 && !url.includes('#');
        } catch (error) {
            console.error(`[WebSocket] Failed to parse URL "${url}"`, error);
            return false;
        }
    }

}
