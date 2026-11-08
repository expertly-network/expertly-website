// Shared by every downloadable PDF (member profile, article). @react-pdf/renderer draws to PDF
// primitives and can't read CSS variables or Tailwind classes, so this palette mirrors the tokens
// in app/globals.css by value. Keep the two in sync if a brand color changes.
export const PDF_COLORS = {
  ink: '#0b0b0c',
  ink2: '#2e3033',
  ink3: '#62695f',
  ink4: '#899085',
  line: '#e0e1d7',
  line2: '#cbd0c2',
  bgAlt: '#efeee7',
  accent: '#00a682',
  accentTint: '#dbf2ed',
  band: '#0b0b0c', // header band, same as the web profile's `.mp-header-band`
  white: '#ffffff',
  seasonedText: '#b45309',
  seasonedBg: '#fef3c7',
};

export const PDF_FONT_FAMILY = 'Geist';
export const PDF_HEADING_FONT_FAMILY = 'Cormorant Garamond';
