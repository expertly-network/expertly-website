'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

const VIEWPORT = 256; // px, square crop window
const OUTPUT = 512; // px, exported square edge

interface Size {
  w: number;
  h: number;
}

// Fixed 1:1 crop tool: drag to reposition, slider to zoom. Emits a square PNG File.
// What's being cropped, for the dialog's copy — the crop itself is the same square either way.
const SUBJECT_COPY = {
  logo: { title: 'Crop logo', hint: 'Logos are shown as squares (1:1).', confirm: 'Use cropped logo' },
  photo: { title: 'Crop profile photo', hint: 'Your photo is shown as a square (1:1).', confirm: 'Use this photo' },
} as const;

export function ImageCropper({
  file,
  onCancel,
  onConfirm,
  subject = 'logo',
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
  subject?: keyof typeof SUBJECT_COPY;
}) {
  const copy = SUBJECT_COPY[subject];
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const base = natural ? Math.max(VIEWPORT / natural.w, VIEWPORT / natural.h) : 1;
  const scale = base * zoom;
  const dispW = natural ? natural.w * scale : VIEWPORT;
  const dispH = natural ? natural.h * scale : VIEWPORT;

  function clamp(x: number, y: number, w: number, h: number) {
    return {
      x: Math.min(0, Math.max(VIEWPORT - w, x)),
      y: Math.min(0, Math.max(VIEWPORT - h, y)),
    };
  }

  function handleLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const n = { w: img.naturalWidth, h: img.naturalHeight };
    setNatural(n);
    const b = Math.max(VIEWPORT / n.w, VIEWPORT / n.h);
    setOffset({ x: (VIEWPORT - n.w * b) / 2, y: (VIEWPORT - n.h * b) / 2 });
  }

  function handleZoom(next: number) {
    if (!natural) return;
    const nextScale = base * next;
    const w = natural.w * nextScale;
    const h = natural.h * nextScale;
    // Zoom around the centre of the viewport.
    const cx = (VIEWPORT / 2 - offset.x) / scale;
    const cy = (VIEWPORT / 2 - offset.y) / scale;
    setZoom(next);
    setOffset(clamp(VIEWPORT / 2 - cx * nextScale, VIEWPORT / 2 - cy * nextScale, w, h));
  }

  function handleConfirm() {
    const img = imgRef.current;
    if (!img || !natural) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setFailed(true);
      return;
    }
    const sx = -offset.x / scale;
    const sy = -offset.y / scale;
    const side = VIEWPORT / scale;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT, OUTPUT);
    canvas.toBlob((blob) => {
      if (!blob) {
        setFailed(true);
        return;
      }
      const name = file.name.replace(/\.[^.]+$/, '') || subject;
      onConfirm(new File([blob], `${name}.png`, { type: 'image/png' }));
    }, 'image/png');
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-sm rounded-xl bg-bg-card p-5">
        <h3 className="text-base font-medium text-ink">{copy.title}</h3>
        <p className="mt-1 text-xs text-ink-3">
          {copy.hint} Drag to reposition and use the slider to zoom.
        </p>
        <div
          className="mx-auto mt-4 touch-none select-none overflow-hidden rounded-input border border-line-2 bg-bg-alt"
          style={{ width: VIEWPORT, height: VIEWPORT, maxWidth: '100%' }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            setOffset(clamp(d.ox + e.clientX - d.px, d.oy + e.clientY - d.py, dispW, dispH));
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={src}
              alt={`${copy.title} preview`}
              draggable={false}
              onLoad={handleLoad}
              onError={() => setFailed(true)}
              className="max-w-none"
              style={{
                width: dispW,
                height: dispH,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
        </div>
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(e) => handleZoom(Number(e.target.value))}
          aria-label="Zoom"
          className="mt-4 w-full"
        />
        {failed && (
          <p role="alert" className="mt-2 text-xs text-error">
            Could not process this image. Try a different file.
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" size="sm" fullWidth onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" fullWidth onClick={handleConfirm} disabled={!natural || failed}>
            {copy.confirm}
          </Button>
        </div>
      </div>
    </div>
  );
}
