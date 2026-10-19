export class LocalStorageKit {
    static set(key: string, value: string) {
        try {
            localStorage.setItem(key, value);
        } catch {
            // Preferences must not prevent connections when storage is unavailable.
        }
    }

    static get(key: string): string {
        try {
            return localStorage.getItem(key) ?? "";
        } catch {
            return "";
        }
    }

}
