export class SseKit {
    /*
     * @return false: 不通过
     */
    static checkUrl(url: string): boolean {
        if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
            return false;
        }
        try {
            const parsed = new URL(url);
            return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname.length > 0;
        } catch (error) {
            console.error(`[SSE] Failed to parse URL "${url}"`, error);
            return false;
        }
    }

}
