"""Generate outlined logos from the site's font and existing designer symbol.

Requires: fonttools[woff], uharfbuzz. Run from the repository root.
"""
from pathlib import Path
from io import BytesIO
import xml.etree.ElementTree as ET
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
import uharfbuzz as hb

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'apps/frontend/public'
font = TTFont(PUBLIC / 'fonts/brand/CormorantGaramond.woff2')
font = instantiateVariableFont(font, {'wght': 500})
font.flavor = None
buf = BytesIO()
font.save(buf)
face = hb.Face(buf.getvalue())
shaper = hb.Font(face)
units = font['head'].unitsPerEm
shaper.scale = (units, units)
text = hb.Buffer()
text.add_str('GrowXQ')
text.guess_segment_properties()
hb.shape(shaper, text)
glyphs = font.getGlyphSet()
height = 60.6
size = height * 1.032
scale = size / units
x = 64.4 + height * 0.265
# Match CSS normal line box centring and the existing 0.077em optical lift.
ascent = font['hhea'].ascent * scale
descent = -font['hhea'].descent * scale
baseline = height / 2 + (ascent - descent) / 2 - size * 0.077
paths = []
for info, pos in zip(text.glyph_infos, text.glyph_positions):
    pen = SVGPathPen(glyphs)
    glyphs[font.getGlyphName(info.codepoint)].draw(pen)
    paths.append((info.cluster, x + pos.x_offset * scale, baseline - pos.y_offset * scale, pen.getCommands()))
    x += pos.x_advance * scale - size * 0.02
width = round(x + size * 0.02 + 1, 3)
for surface, ink in [('light', '#0b0b0c'), ('dark', '#ffffff')]:
    symbol = (PUBLIC / f'brand/mark-on-{surface}.svg').read_text()
    # Nest the original SVG so all clip paths and designer artwork are preserved.
    symbol = symbol.replace('width="128.8"', 'x="0" y="0" width="64.4"').replace('height="121.2"', 'height="60.6"')
    outlines = ''.join(f'<path fill="{ink if cluster < 4 else "#00a682"}" transform="translate({px:.5f} {py:.5f}) scale({scale:.7f} {-scale:.7f})" d="{path}"/>' for cluster, px, py, path in paths)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">{symbol}{outlines}</svg>\n'
    ET.fromstring(svg)
    (PUBLIC / f'brand/logo-on-{surface}.svg').write_text(svg)
print(f'Logo aspect ratio: {width} / {height}')
