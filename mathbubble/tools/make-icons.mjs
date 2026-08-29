/**
 * Generates the PWA / home-screen icons as real PNGs.
 *
 * iOS ignores SVG for apple-touch-icon, so the icons have to be raster. Rather
 * than pull in a graphics dependency, this rasterises a handful of primitives
 * (rounded rect, circle, bar) into an RGBA buffer and zlib-deflates it into a
 * PNG. Run with: npm run icons
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const INK = [79, 70, 229]; // indigo, matches --accent
const TOP = [99, 102, 241];
const BOTTOM = [124, 58, 237];

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // no filter
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const S = size / 512; // design grid is 512
  const SS = 3; // supersampling for smooth edges

  const roundedRect = (x, y, w, h, r, px2, py2) => {
    const cx = Math.min(Math.max(px2, x + r), x + w - r);
    const cy = Math.min(Math.max(py2, y + r), y + h - r);
    if (px2 < x || px2 > x + w || py2 < y || py2 > y + h) return false;
    return Math.hypot(px2 - cx, py2 - cy) <= r;
  };
  const circle = (cx, cy, r, px2, py2) => Math.hypot(px2 - cx, py2 - cy) <= r;
  const bar = (x, y, w, h, px2, py2) => px2 >= x && px2 <= x + w && py2 >= y && py2 <= y + h;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = (x + (sx + 0.5) / SS) / S;
          const fy = (y + (sy + 0.5) / SS) / S;
          let col = null;

          if (roundedRect(0, 0, 512, 512, 114, fx, fy)) {
            col = mix(TOP, BOTTOM, fy / 512);
            // Speech bubble: circle plus a tail toward the lower-left.
            const inBubble =
              circle(256, 240, 150, fx, fy) ||
              (fy > 340 && fy < 430 && fx > 150 && fx < 150 + (430 - fy) * 1.5);
            if (inBubble) col = [255, 255, 255];
            // A pi glyph inside the bubble, built from three bars.
            const inPi =
              bar(176, 196, 160, 30, fx, fy) ||
              bar(206, 226, 28, 118, fx, fy) ||
              bar(286, 226, 28, 118, fx, fy);
            if (inBubble && inPi) col = INK;
          }

          if (col) {
            r += col[0]; g += col[1]; b += col[2]; a += 255;
          }
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      const cov = a / n / 255;
      px[i] = cov ? Math.round(r / n / cov) : 0;
      px[i + 1] = cov ? Math.round(g / n / cov) : 0;
      px[i + 2] = cov ? Math.round(b / n / cov) : 0;
      px[i + 3] = Math.round(a / n);
    }
  }
  return png(size, px);
}

mkdirSync(OUT, { recursive: true });
for (const size of [180, 192, 512]) {
  writeFileSync(join(OUT, `icon-${size}.png`), render(size));
  console.log(`wrote icons/icon-${size}.png`);
}
