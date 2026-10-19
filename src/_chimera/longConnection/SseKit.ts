export class SseKit {
    /*
     * @return false: 不通过
     */
    static checkUrl(url: string): boolean {
        if (typeof url !== "string" || (!url.startsWith("http://") && !url.startsWith("https://"))) {
            return false;
        }
        try {
            const parsed = new URL(url);
            return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname.length > 0;
        } catch {
            return false;
        }
    }

}
