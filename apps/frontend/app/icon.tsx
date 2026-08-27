import { ImageResponse } from 'next/og';

// Next.js file-convention icon — auto-wired into <head> as the favicon, no explicit
// metadata.icons entry needed. Matches the sidebar wordmark's own "E" mark (Logo.tsx,
// `sidebar` variant) — dark ink background, white letter, teal accent dot, same brand
// treatment reduced to a single glyph for the tiny favicon size.
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0b0c',
          borderRadius: 7,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            color: '#ffffff',
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: -0.4,
            lineHeight: 1,
          }}
        >
          E
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: '#00c99e',
              marginLeft: 1,
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
