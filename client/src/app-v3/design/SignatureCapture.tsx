import { useEffect, useRef, useState } from "react";
import { Action } from "./primitives";
type Point = { x: number; y: number };
/** Normalized strokes survive rotation and resizing instead of losing the signature. */
export function SignatureCapture({
  disabled,
  onSave,
}: {
  disabled?: boolean;
  onSave: (png: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef<number | null>(null);
  const [ink, setInk] = useState(false);
  const paint = () => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const rect = element.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    element.width = Math.round(rect.width * ratio);
    element.height = Math.round(rect.height * ratio);
    context.scale(ratio, ratio);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, rect.width, rect.height);
    context.strokeStyle = "#20211e";
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of strokes.current) {
      context.beginPath();
      stroke.forEach((point, index) => {
        if (!index) context.moveTo(point.x * rect.width, point.y * rect.height);
        else context.lineTo(point.x * rect.width, point.y * rect.height);
      });
      context.stroke();
    }
  };
  useEffect(() => {
    const observer = new ResizeObserver(paint);
    if (canvas.current) observer.observe(canvas.current);
    paint();
    return () => observer.disconnect();
  }, []);
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  };
  return (
    <div className="v3-stack">
      <p className="v3-muted">
        Draw your signature with your finger, pen or mouse.
      </p>
      <canvas
        ref={canvas}
        aria-label="Draw your signature"
        className="v3-signature-canvas"
        onPointerDown={event => {
          if (disabled || drawing.current !== null) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drawing.current = event.pointerId;
          strokes.current.push([point(event)]);
        }}
        onPointerMove={event => {
          if (disabled || drawing.current !== event.pointerId) return;
          strokes.current[strokes.current.length - 1].push(point(event));
          setInk(true);
          paint();
        }}
        onPointerUp={() => {
          drawing.current = null;
        }}
        onPointerCancel={() => {
          drawing.current = null;
        }}
      />
      <div className="v3-inline">
        <Action
          tone="secondary"
          disabled={disabled || !ink}
          onClick={() => {
            strokes.current = [];
            setInk(false);
            paint();
          }}
        >
          Clear signature
        </Action>
        <Action
          disabled={disabled || !ink}
          onClick={() => {
            if (canvas.current) onSave(canvas.current.toDataURL("image/png"));
          }}
        >
          Sign this form
        </Action>
      </div>
    </div>
  );
}
