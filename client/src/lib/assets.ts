import { Capacitor } from "@capacitor/core";
import { API_BASE_URL } from "../const";

/**
 * Resolves an asset URL (images, files, etc.) correctly based on the platform.
 * Prepends the production API URL for native platforms to avoid localhost resolution errors.
 */
export const getAssetUrl = (path: string | null | undefined): string => {
    if (!path) return "";

    // If it's already an absolute URL (http/https/data), return as is
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
        return path;
    }

    // If we are on a native platform, prepend the production base URL
    if (Capacitor.isNativePlatform() && path.startsWith("/")) {
        return `${API_BASE_URL}${path}`;
    }

    return path;
};
