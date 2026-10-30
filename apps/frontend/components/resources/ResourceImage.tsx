'use client';
import Image from 'next/image';
import { useState } from 'react';
export function ResourceImage({
  src,
  alt = '',
  className = '',
  width = 640,
  height = 360,
}: {
  src: string | null;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    // unoptimized: admin-entered resource images may live on any https host, not only Storage.
    <Image
      unoptimized
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={() => setFailed(true)}
    />
  ) : (
    <div
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      className={`flex items-center justify-center bg-neon text-accent ${className}`}
    >
      ↗
    </div>
  );
}
