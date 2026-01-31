
import { useRef, useEffect } from "react";
import { PromotionCard, PromotionCardData } from "./PromotionCard";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface InteractiveCardPreviewProps {
    data: PromotionCardData;
    onUpdatePosition: (x: number, y: number) => void;
    onUpdateScale: (scale: number) => void;
}

export function InteractiveCardPreview({
    data,
    onUpdatePosition,
    onUpdateScale,
}: InteractiveCardPreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });

    // Reset defaults if no image
    useEffect(() => {
        if (!data.backgroundImageUrl) {
            // Optional: reset scale/pos if image is removed
        }
    }, [data.backgroundImageUrl]);

    // Handle Drag for Pan
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!data.backgroundImageUrl) return;
        isDragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || !data.backgroundImageUrl) return;

        const deltaX = e.clientX - lastPos.current.x;
        const deltaY = e.clientY - lastPos.current.y;

        // Convert pixels to percentage estimate
        // Assuming card width ~300px for calculation
        const sensitivity = 0.2;

        // Update X (0-100)
        const currentX = data.backgroundPositionX || 50;
        const newX = Math.min(100, Math.max(0, currentX - (deltaX * sensitivity)));

        // Update Y (0-100)
        const currentY = data.backgroundPositionY || 50;
        const newY = Math.min(100, Math.max(0, currentY - (deltaY * sensitivity)));

        onUpdatePosition(newX, newY);
        lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    const handleMouseLeave = () => {
        isDragging.current = false;
    };

    // Handle Wheel for Zoom
    const handleWheel = (e: React.WheelEvent) => {
        if (!data.backgroundImageUrl) return;

        // Prevent page scroll if hovering card
        // e.preventDefault(); // React synthetic events can't be always prevented this way for passive listeners

        // Determine direction
        const delta = -Math.sign(e.deltaY) * 0.1;
        const currentScale = data.backgroundScale || 1;
        const newScale = Math.min(3, Math.max(0.5, currentScale + delta));

        onUpdateScale(newScale);
    };

    return (
        <div className="flex flex-col items-center gap-4">
            <div
                ref={containerRef}
                className="relative cursor-move touch-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onWheel={handleWheel}
                title={data.backgroundImageUrl ? "Drag to move background, Scroll to zoom" : "Preview"}
            >
                <PromotionCard
                    data={data}
                    size="md"
                    // Disable default card pointer events to let wrapper handle them
                    className="pointer-events-none select-none"
                />

                {/* Overlay to capture events cleanly over the card content */}
                <div className="absolute inset-0 z-50 bg-transparent" />
            </div>

            {/* Manual Zoom Controls (Slider) */}
            {data.backgroundImageUrl && (
                <div className="w-64 flex items-center gap-2">
                    <ZoomOut className="w-4 h-4 text-muted-foreground" />
                    <Slider
                        value={[data.backgroundScale || 1]}
                        min={0.5}
                        max={3}
                        step={0.1}
                        onValueChange={([val]) => onUpdateScale(val)}
                        className="flex-1"
                    />
                    <ZoomIn className="w-4 h-4 text-muted-foreground" />

                    <Button
                        size="icon"
                        variant="ghost"
                        className="w-6 h-6 ml-2 rounded-full"
                        onClick={() => {
                            onUpdateScale(1);
                            onUpdatePosition(50, 50);
                        }}
                        title="Reset position and scale"
                    >
                        <RotateCcw className="w-3 h-3" />
                    </Button>
                </div>
            )}
        </div>
    );
}
