# scripts/xp_fidelity_test/create_fixture.py
"""
Create a small 5x3 XP test fixture with known cell values.

Layer 2 pattern:
  Row 0: A(red/black) B(green/black) C(blue/black) D(yellow/black) E(white/black)
  Row 1: ?(cyan/gray) @(mag/white)  #(orange/dk)   $(pink/navy)   %(lime/brown)
  Row 2: full-block(white/transparent) for all 5 cells

Usage:
  python3 create_fixture.py [--output <path>]
"""
import sys, os, struct, gzip

MAGENTA = (255, 0, 255)
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
WIDTH, HEIGHT, LAYERS = 5, 3, 4

LAYER2 = [
    [(65,(255,0,0),BLACK),(66,(0,255,0),BLACK),(67,(0,0,255),BLACK),(68,(255,255,0),BLACK),(69,WHITE,BLACK)],
    [(63,(0,255,255),(128,128,128)),(64,(255,0,255),WHITE),(35,(255,165,0),(40,40,40)),(36,(255,192,203),(0,0,128)),(37,(0,255,0),(139,69,19))],
    [(219,WHITE,MAGENTA)]*5,
]

def build():
    transparent = [(0,WHITE,MAGENTA)]*WIDTH
    l0 = [[(49,WHITE,MAGENTA)]+[(0,WHITE,MAGENTA)]*(WIDTH-1)] + [transparent[:] for _ in range(HEIGHT-1)]
    l1 = [transparent[:] for _ in range(HEIGHT)]
    l3 = [transparent[:] for _ in range(HEIGHT)]
    buf = bytearray()
    buf += struct.pack('<i', -1)
    buf += struct.pack('<i', LAYERS)
    for layer in [l0, l1, LAYER2, l3]:
        buf += struct.pack('<ii', WIDTH, HEIGHT)
        for x in range(WIDTH):
            for y in range(HEIGHT):
                g, fg, bg = layer[y][x]
                buf += struct.pack('<I', g)
                buf += bytes(fg) + bytes(bg)
    return gzip.compress(bytes(buf))

def main():
    out = 'sprites/fidelity-test-5x3.xp'
    if '--output' in sys.argv:
        out = sys.argv[sys.argv.index('--output')+1]
    data = build()
    with open(out, 'wb') as f: f.write(data)
    print(f"Created {out} ({WIDTH}x{HEIGHT}, {LAYERS} layers, {len(data)} bytes)")

if __name__ == '__main__': main()
