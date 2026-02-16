import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { uiTokens } from '@/ui';
import { cn } from '@/lib/utils';
import { Eraser, Check } from 'lucide-react';

interface SignaturePadProps {
    onSave: (signature: string) => void;
    onCancel?: () => void;
    className?: string;
}

export function SignaturePad({ onSave, onCancel, className }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Resize canvas to its display size
        const resizeCanvas = () => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    const startDrawing = (e: React.PointerEvent) => {
        setIsDrawing(true);
        setHasStarted(true);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) {
            const rect = canvas.getBoundingClientRect();
            ctx.beginPath();
            ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
        }
    };

    const draw = (e: React.PointerEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) {
            const rect = canvas.getBoundingClientRect();
            ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
            ctx.stroke();
        }
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && canvas) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHasStarted(false);
        }
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (canvas && hasStarted) {
            onSave(canvas.toDataURL('image/png'));
        }
    };

    return (
        <div className={cn("flex flex-col gap-4", className)}>
            <div className="relative aspect-[3/2] w-full bg-slate-900 border border-white/10 rounded-2xl overflow-hidden touch-none">
                <canvas
                    ref={canvasRef}
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onPointerLeave={stopDrawing}
                    className="w-full h-full cursor-crosshair"
                />
                {!hasStarted && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                        <p className="text-sm font-medium">Sign here with your finger</p>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3">
                <Button
                    variant="outline"
                    onClick={clear}
                    className="flex-1 border-white/10"
                >
                    <Eraser className="w-4 h-4 mr-2" />
                    Clear
                </Button>
                <Button
                    disabled={!hasStarted}
                    onClick={handleSave}
                    className="flex-1 shadow-lg shadow-primary/20"
                >
                    <Check className="w-4 h-4 mr-2" />
                    Save Signature
                </Button>
            </div>
            {onCancel && (
                <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
                    Cancel
                </Button>
            )}
        </div>
    );
}
