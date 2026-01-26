/**
 * Version - Single Source of Truth for app version
 * 
 * This file provides the canonical app version across the entire application.
 * The version is defined at build time by Vite from package.json.
 * 
 * USAGE:
 * import { APP_VERSION } from '@/lib/version';
 * 
 * DO NOT use:
 * - import.meta.env.VITE_APP_VERSION (environment variable, may not be set)
 * - Hardcoded version strings
 * 
 * @version 1.0.125
 */

// __APP_VERSION__ is defined in vite.config.ts from package.json
// This ensures the version is always in sync with package.json
export const APP_VERSION: string = __APP_VERSION__;

/**
 * Get formatted version string with 'v' prefix
 */
export function getVersionString(): string {
    return `v${APP_VERSION}`;
}

/**
 * Compare two version strings
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;
        
        if (numA < numB) return -1;
        if (numA > numB) return 1;
    }
    
    return 0;
}
