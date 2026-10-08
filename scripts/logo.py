"""Draws the parlaplay logo (platform spec 8.4, D23) and writes src/core/ui/logo.svg
(speech bubble and wordmark) and src/core/ui/logo-mark.svg (the bubble alone, for the
game's top bar on phones).

The wordmark is drawn from round-capped strokes, not set in a font, so it looks the
same everywhere and needs no font licence. "parlaplay" uses only p, a, r, l and y.
Colours are Tailwind's rose-600 (bubble), stone-900 ("parla") and rose-700 ("play").

Run from the repo root:  python3 scripts/logo.py
"""
import os

# Centerlines: x-height band y 22.5..37.5, ascender 6, descender 52.5.
R = 7.5; T, B, M = 22.5, 37.5, 30.0
def a(x):  return f"M{x+2*R},{M}a{R},{R} 0 1 0 0,0.01M{x+2*R},{T}V{B}", 2*R
def p(x):  return f"M{x+2*R},{M}a{R},{R} 0 1 0 0,0.01M{x},{T}V52", 2*R
def r(x):  return f"M{x},{B}V{M}a{R},{R} 0 0 1 {R},-{R}", R
def l(x):  return f"M{x},6V{B}", 0
def y(x):  return (f"M{x},{T}V{M}a{R},{R} 0 0 0 {2*R},0M{x+2*R},{T}V45"
                   f"a{R},{R} 0 0 1 -{2*R},0"), 2*R
G = dict(a=a, p=p, r=r, l=l, y=y)
GAP = 9.5   # centerline gap between glyphs (stroke 5 -> 4.5 visible space)
def word(s, x):
    d = []
    for ch in s:
        path, w = G[ch](x); d.append(path); x += w + GAP
    return "".join(d), x - GAP
# Mark: speech bubble 44 by 42 with its tail, play triangle inside.
mark = ('<path fill="#e11d48" d="M8,4h28a8,8 0 0 1 8,8v18a8,8 0 0 1-8,8H18l-9,8v-8H8a8,8 0 0 1-8-8V12a8,8 0 0 1 8-8z"/>'
        '<path fill="#fff" d="M17,13.5v15a1.5,1.5 0 0 0 2.3,1.3l12-7.5a1.5,1.5 0 0 0 0-2.6l-12-7.5A1.5,1.5 0 0 0 17,13.5z"/>')
d1, x = word("parla", 58)
d2, x = word("play", x + GAP)
W = x + 3
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:g} 56" role="img" aria-label="parlaplay">'
       f'{mark}<g fill="none" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">'
       f'<path stroke="#1c1917" d="{d1}"/><path stroke="#be123c" d="{d2}"/></g></svg>\n')
mark_svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 4 44 42" role="img" '
            f'aria-label="parlaplay">{mark}</svg>\n')
ui = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "core", "ui")
for name, text in (("logo.svg", svg), ("logo-mark.svg", mark_svg)):
    with open(os.path.join(ui, name), "w") as f:
        f.write(text)
    print(f"wrote src/core/ui/{name} ({len(text)} bytes)")
