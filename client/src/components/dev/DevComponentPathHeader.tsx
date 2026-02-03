import React, { useEffect, useState } from 'react';

/**
 * DevComponentPathHeader
 * 
 * Displays the file path of the React component currently being hovered over.
 * Only enabled in development mode.
 */
export function DevComponentPathHeader() {
    const [hoveredPath, setHoveredPath] = useState<string | null>(null);

    useEffect(() => {
        // Only run in dev
        if (!import.meta.env.DEV) return;

        const handleMouseMove = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target) return;

            // Find the React Fiber node
            const fiberKey = Object.keys(target).find(key => key.startsWith('__reactFiber$'));

            if (fiberKey) {
                // @ts-ignore
                let fiber = target[fiberKey];

                // Traverse up to find a node with source info
                while (fiber) {
                    if (fiber._debugSource) {
                        const { fileName, lineNumber } = fiber._debugSource;
                        // Clean up path - remove project root if possible (optional)
                        // Typically fileName is absolute path in dev
                        setHoveredPath(`${fileName}:${lineNumber}`);
                        return;
                    }
                    fiber = fiber.return; // Go to parent
                }
            }
            setHoveredPath(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    if (!hoveredPath) return null;

    return (
        <div className="fixed top-0 left-0 w-full z-[9999] bg-black/80 text-green-400 text-xs font-mono p-1 px-2 pointer-events-none border-b border-green-500/30 truncate">
            <span className="opacity-70">Component Path:</span> {hoveredPath}
        </div>
    );
}
