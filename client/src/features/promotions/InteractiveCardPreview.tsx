
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
    const startPinchDist = useRef<number | null>(null);
    const startScale = useRef<number>(1);

    // Helper: calculate distance between two touches
    const getTouchDist = (touches: React.TouchList) => {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    // Reset defaults if no image
    useEffect(() => {
        if (!data.backgroundImageUrl) {
            // Optional: reset scale/pos if image is removed
        }
    }, [data.backgroundImageUrl]);

    // --- Mouse Handlers ---
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!data.backgroundImageUrl) return;
        isDragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || !data.backgroundImageUrl) return;
        const deltaX = e.clientX - lastPos.current.x;
        const deltaY = e.clientY - lastPos.current.y;

        // Pan Sensitivity (lower = more precise)
        const sensitivity = 0.2;
        const newX = Math.min(100, Math.max(0, (data.backgroundPositionX || 50) - (deltaX * sensitivity)));
        const newY = Math.min(100, Math.max(0, (data.backgroundPositionY || 50) - (deltaY * sensitivity)));

        onUpdatePosition(newX, newY);
        lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => { isDragging.current = false; };

    // --- Touch Handlers (Facebook style) ---
    const handleTouchStart = (e: React.TouchEvent) => {
        if (!data.backgroundImageUrl) return;

        if (e.touches.length === 1) {
            isDragging.current = true;
            lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            startPinchDist.current = null;
        } else if (e.touches.length === 2) {
            isDragging.current = false; // Disable pan while pinching
            startPinchDist.current = getTouchDist(e.touches);
            startScale.current = data.backgroundScale || 1;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!data.backgroundImageUrl) return;

        if (e.touches.length === 1 && isDragging.current) {
            const deltaX = e.touches[0].clientX - lastPos.current.x;
            const deltaY = e.touches[0].clientY - lastPos.current.y;

            const sensitivity = 0.2;
            const newX = Math.min(100, Math.max(0, (data.backgroundPositionX || 50) - (deltaX * sensitivity)));
            const newY = Math.min(100, Math.max(0, (data.backgroundPositionY || 50) - (deltaY * sensitivity)));

            onUpdatePosition(newX, newY);
            lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2 && startPinchDist.current) {
            const currentDist = getTouchDist(e.touches);
            const ratio = currentDist / startPinchDist.current;
            const newScale = Math.min(3, Math.max(0.5, startScale.current * ratio));
            onUpdateScale(newScale);
        }
    };

    const handleTouchEnd = () => {
        isDragging.current = false;
        startPinchDist.current = null;
    };

    // Handle Wheel for Zoom
    const handleWheel = (e: React.WheelEvent) => {
        if (!data.backgroundImageUrl) return;
        const delta = -Math.sign(e.deltaY) * 0.1;
        const newScale = Math.min(3, Math.max(0.5, (data.backgroundScale || 1) + delta));
        onUpdateScale(newScale);
    };

    return (
        <div className="flex flex-col items-center gap-4">
            <div
                ref={containerRef}
                className="relative cursor-move touch-none overflow-hidden rounded-2xl"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onWheel={handleWheel}
                title={data.backgroundImageUrl ? "Drag to move background, Pinch or Scroll to zoom" : "Preview"}
            >
                <PromotionCard
                    data={data}
                    size="md"
                    className="pointer-events-none select-none"
                />
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
