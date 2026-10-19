export class LocalStorageKit {
    static set(key: string, value: string) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            console.error(`[LocalStorage] Failed to write key "${key}"`, error);
            // Preferences must not prevent connections when storage is unavailable.
        }
    }

    static get(key: string): string {
        try {
            return localStorage.getItem(key) ?? "";
        } catch (error) {
            console.error(`[LocalStorage] Failed to read key "${key}"`, error);
            return "";
        }
    }

}
