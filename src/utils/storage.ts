// Unified storage utility that works in both Electron and browser
// In Electron portable mode, uses file-based storage via IPC
// In browser/dev mode, uses localStorage

declare global {
    interface Window {
        electronAPI?: {
            storeGet: (key: string) => Promise<any>;
            storeSet: (key: string, value: any) => Promise<boolean>;
            storeRemove: (key: string) => Promise<boolean>;
            [key: string]: any;
        };
    }
}

// Cache for async storage values (to provide sync-like API)
const cache: Record<string, any> = {};

// Initialize cache from persistent storage
export async function initStorage(): Promise<void> {
    if (window.electronAPI?.storeGet) {
        // Load all known keys from persistent storage
        const keys = ['nvr_users', 'nvr_auth', 'nvr_auth_expiry', 'nvr_current_user', 'nvr_cameras_config'];
        for (const key of keys) {
            const value = await window.electronAPI.storeGet(key);
            if (value !== null) {
                cache[key] = value;
            }
        }
    }
}

export function getItem(key: string): string | null {
    // In Electron, check cache first (populated by initStorage)
    if (window.electronAPI?.storeGet) {
        const cached = cache[key];
        return cached !== undefined ? (typeof cached === 'string' ? cached : JSON.stringify(cached)) : null;
    }
    // Fallback to localStorage
    return localStorage.getItem(key);
}

export function setItem(key: string, value: string): void {
    // Update cache immediately for sync access
    cache[key] = value;

    if (window.electronAPI?.storeSet) {
        // Also persist to file asynchronously
        // Try to parse JSON to store as object
        try {
            const parsed = JSON.parse(value);
            window.electronAPI.storeSet(key, parsed);
        } catch {
            window.electronAPI.storeSet(key, value);
        }
    } else {
        // Fallback to localStorage
        localStorage.setItem(key, value);
    }
}

export function removeItem(key: string): void {
    delete cache[key];

    if (window.electronAPI?.storeRemove) {
        window.electronAPI.storeRemove(key);
    } else {
        localStorage.removeItem(key);
    }
}

// Export as default storage object for easy replacement of localStorage
const storage = {
    getItem,
    setItem,
    removeItem,
    initStorage,
};

export default storage;
