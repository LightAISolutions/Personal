#!/usr/bin/env python3
"""Convert the four Bitstream Charter Type 1 fonts (xfonts-scalable) to TrueType-flavoured WOFF2 with fontTools
(cubic outlines converted to quadratic, max error 1 unit; hints dropped; AFM kerning kept as a GPOS kern feature).
Usage: t1toweb.py OUTDIR    (needs: pip install fonttools brotli)"""
import sys, os
from fontTools.t1Lib import T1Font
from fontTools.afmLib import AFM
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.agl import toUnicode
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString

SRC = '/usr/share/fonts/X11/Type1'
FACES = [('c0648bt_', 'Regular', 400, False), ('c0649bt_', 'Italic', 400, True),
         ('c0632bt_', 'Bold', 700, False), ('c0633bt_', 'Bold Italic', 700, True)]

def convert(stem, style, weight, italic, outdir):
    t1 = T1Font(os.path.join(SRC, stem + '.pfb'))
    afm = AFM(os.path.join(SRC, stem + '.afm'))
    gs = t1.getGlyphSet()
    names = [n for n in gs.keys() if n != '.notdef']
    order = ['.notdef'] + sorted(names)
    charstrings, widths, cmap, bounds = {}, {}, {}, {}
    for n in order:
        g = gs[n]
        bp = BoundsPen(gs); g.draw(bp); bounds[n] = bp.bounds
        widths[n] = int(getattr(g, 'width', 0) or 0)
        tp = TTGlyphPen(gs)
        g.draw(Cu2QuPen(tp, max_err=1.0, reverse_direction=True))
        charstrings[n] = tp.glyph()
        u = toUnicode(n)
        if n != '.notdef' and len(u) == 1 and ord(u) not in cmap: cmap[ord(u)] = n
    fi = t1.font['FontInfo']
    upem = 1000
    fb = FontBuilder(upem, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(charstrings)
    metrics = {n: (widths[n], (bounds[n][0] if bounds[n] else 0)) for n in order}
    fb.setupHorizontalMetrics(metrics)
    asc, desc = int(afm.Ascender) if hasattr(afm, 'Ascender') else 750, int(afm.Descender) if hasattr(afm, 'Descender') else -200
    fb.setupHorizontalHeader(ascent=asc, descent=desc, lineGap=0)
    fb.setupNameTable({'familyName': 'Charter', 'styleName': style, 'fullName': 'Charter ' + style, 'psName': 'Charter-' + style.replace(' ', ''),
                       'version': 'Version 1.0; converted from Bitstream Charter Type 1 (xfonts-scalable) with fontTools',
                       'copyright': fi.get('Notice', ''), 'trademark': 'BITSTREAM CHARTER is a registered trademark of Bitstream Inc.'})
    fb.setupOS2(sTypoAscender=asc, sTypoDescender=desc, sTypoLineGap=0, usWinAscent=max(asc, 900), usWinDescent=max(-desc, 300),
                usWeightClass=weight, fsSelection=(0x80 | (0x20 if weight >= 700 else 0) | (0x01 if italic else 0) | (0x40 if weight < 700 and not italic else 0)),
                fsType=0, sxHeight=int(afm.XHeight) if hasattr(afm, 'XHeight') else 480, sCapHeight=int(afm.CapHeight) if hasattr(afm, 'CapHeight') else 680,
                achVendID='BITS')
    fb.setupPost(italicAngle=fi.get('ItalicAngle', 0))
    fb.setupMaxp()
    fb.font['head'].macStyle = (1 if weight >= 700 else 0) | (2 if italic else 0)
    pairs = [(a, b, v) for (a, b), v in afm._kerning.items() if a in charstrings and b in charstrings and v]
    if pairs:
        fea = 'languagesystem DFLT dflt;\nlanguagesystem latn dflt;\nfeature kern {\n' + ''.join('  pos %s %s %d;\n' % p for p in pairs) + '} kern;\n'
        addOpenTypeFeaturesFromString(fb.font, fea)
    fb.font.flavor = 'woff2'
    out = os.path.join(outdir, 'Charter-' + style.replace(' ', '') + '.woff2')
    fb.font.save(out)
    print(out, os.path.getsize(out), 'bytes', len(order), 'glyphs', len(pairs), 'kern pairs')

if __name__ == '__main__':
    os.makedirs(sys.argv[1], exist_ok=True)
    for f in FACES: convert(*f, sys.argv[1])

# Developed by: LightAISolutions
