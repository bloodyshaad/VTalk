// Generates NSIS installer graphics (24-bit BMP, bottom-up) with zero dependencies.
// Produces premium monochrome VTalk branding in light + dark variants:
//   header-light.bmp / header-dark.bmp        150 x 57   (top banner)
//   sidebar-light.bmp / sidebar-dark.bmp      164 x 314  (welcome/finish side)
// The NSIS script picks light or dark at runtime based on the Windows theme.

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = dirname(fileURLToPath(import.meta.url));
mkdirSync(OUT, { recursive: true });

// ---------- tiny canvas ----------
class Canvas {
  constructor(w, h, bg) {
    this.w = w;
    this.h = h;
    this.buf = new Uint8ClampedArray(w * h * 3);
    if (bg) this.fill(() => bg);
  }
  idx(x, y) {
    return (y * this.w + x) * 3;
  }
  set(x, y, [r, g, b], a = 1) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = this.idx(x, y);
    if (a >= 1) {
      this.buf[i] = r;
      this.buf[i + 1] = g;
      this.buf[i + 2] = b;
    } else {
      this.buf[i] = this.buf[i] * (1 - a) + r * a;
      this.buf[i + 1] = this.buf[i + 1] * (1 - a) + g * a;
      this.buf[i + 2] = this.buf[i + 2] * (1 - a) + b * a;
    }
  }
  fill(fn) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) this.set(x, y, fn(x, y));
  }
  rect(x0, y0, x1, y1, color) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.set(x, y, color);
  }
  // filled rounded rectangle with anti-aliased corners
  roundRect(x0, y0, x1, y1, r, color, a = 1) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const cov = this._roundCoverage(x, y, x0, y0, x1, y1, r);
        if (cov > 0) this.set(x, y, color, a * cov);
      }
    }
  }
  _roundCoverage(x, y, x0, y0, x1, y1, r) {
    // sample 4x supersample for smooth corners
    const cx = x + 0.5,
      cy = y + 0.5;
    let corners = [
      [x0 + r, y0 + r],
      [x1 - r, y0 + r],
      [x0 + r, y1 - r],
      [x1 - r, y1 - r],
    ];
    let inCornerRegion = false;
    let cc = null;
    if (cx < x0 + r && cy < y0 + r) (inCornerRegion = true), (cc = corners[0]);
    else if (cx > x1 - r && cy < y0 + r) (inCornerRegion = true), (cc = corners[1]);
    else if (cx < x0 + r && cy > y1 - r) (inCornerRegion = true), (cc = corners[2]);
    else if (cx > x1 - r && cy > y1 - r) (inCornerRegion = true), (cc = corners[3]);
    if (!inCornerRegion) return 1;
    let hit = 0;
    for (let sy = 0; sy < 4; sy++)
      for (let sx = 0; sx < 4; sx++) {
        const px = x + (sx + 0.5) / 4;
        const py = y + (sy + 0.5) / 4;
        const dx = px - cc[0];
        const dy = py - cc[1];
        if (dx * dx + dy * dy <= r * r) hit++;
      }
    return hit / 16;
  }
  // anti-aliased disc
  disc(cx, cy, r, color, a = 1) {
    const x0 = Math.floor(cx - r - 1),
      x1 = Math.ceil(cx + r + 1),
      y0 = Math.floor(cy - r - 1),
      y1 = Math.ceil(cy + r + 1);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        let hit = 0;
        for (let sy = 0; sy < 4; sy++)
          for (let sx = 0; sx < 4; sx++) {
            const dx = x + (sx + 0.5) / 4 - cx;
            const dy = y + (sy + 0.5) / 4 - cy;
            if (dx * dx + dy * dy <= r * r) hit++;
          }
        if (hit) this.set(x, y, color, (a * hit) / 16);
      }
  }
}

// ---------- 5x7 pixel font (uppercase + a few lowercase we need) ----------
const FONT = {
  V: ["10001", "10001", "10001", "10001", "01010", "01010", "00100"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
  l: ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
  k: ["10000", "10000", "10010", "10100", "11000", "10100", "10010"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
};

function drawText(cv, text, x, y, scale, color, a = 1) {
  let cx = x;
  for (const ch of text) {
    const glyph = FONT[ch] || FONT[" "];
    for (let gy = 0; gy < 7; gy++)
      for (let gx = 0; gx < 5; gx++)
        if (glyph[gy][gx] === "1")
          cv.rect(
            cx + gx * scale,
            y + gy * scale,
            cx + gx * scale + scale,
            y + gy * scale + scale,
            color,
            a,
          );
    cx += (5 + 1) * scale;
  }
  return cx;
}

function textWidth(text, scale) {
  return text.length * 6 * scale - scale;
}

// ---------- speech-bubble VTalk mark (rounded square + bubble + dots) ----------
function drawMark(cv, cx, cy, size, fg, bgAccent) {
  const half = size / 2;
  // rounded container
  cv.roundRect(cx - half, cy - half, cx + half, cy + half, size * 0.28, fg, 1);
  // inner speech bubble carved in accent
  const bw = size * 0.62;
  const bh = size * 0.44;
  const bx0 = cx - bw / 2;
  const by0 = cy - bh / 2 - size * 0.04;
  cv.roundRect(bx0, by0, bx0 + bw, by0 + bh, size * 0.14, bgAccent, 1);
  // tail
  for (let i = 0; i < size * 0.16; i++) {
    const w = size * 0.16 - i;
    cv.rect(cx - size * 0.06, by0 + bh - 1 + i, cx - size * 0.06 + w, by0 + bh + i, bgAccent, 1);
  }
  // three dots
  const dotR = size * 0.045;
  const dy = by0 + bh / 2;
  cv.disc(cx - bw * 0.26, dy, dotR, fg);
  cv.disc(cx, dy, dotR, fg);
  cv.disc(cx + bw * 0.26, dy, dotR, fg);
}

// ---------- BMP encoder (24-bit, bottom-up) ----------
function encodeBMP(cv) {
  const rowSize = Math.floor((24 * cv.w + 31) / 32) * 4;
  const pixArraySize = rowSize * cv.h;
  const fileSize = 54 + pixArraySize;
  const b = Buffer.alloc(fileSize);
  b.write("BM", 0);
  b.writeUInt32LE(fileSize, 2);
  b.writeUInt32LE(54, 10);
  b.writeUInt32LE(40, 14);
  b.writeInt32LE(cv.w, 18);
  b.writeInt32LE(cv.h, 22);
  b.writeUInt16LE(1, 26);
  b.writeUInt16LE(24, 28);
  b.writeUInt32LE(0, 30);
  b.writeUInt32LE(pixArraySize, 34);
  b.writeInt32LE(2835, 38);
  b.writeInt32LE(2835, 42);
  let off = 54;
  for (let y = cv.h - 1; y >= 0; y--) {
    let rp = off;
    for (let x = 0; x < cv.w; x++) {
      const i = cv.idx(x, y);
      b[rp++] = cv.buf[i + 2]; // B
      b[rp++] = cv.buf[i + 1]; // G
      b[rp++] = cv.buf[i]; // R
    }
    off += rowSize;
  }
  return b;
}

// ---------- palettes ----------
// Premium monochrome dark palette (used for ALL installer art).
const T = {
  fg: [250, 250, 250],
  sub: [150, 150, 155],
  faint: [95, 95, 100],
  markBg: [8, 8, 10],
};

function lerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// deep, layered dark background with diagonal light + soft vignette
function paintBackground(cv) {
  const cx = cv.w * 0.5;
  const cy = cv.h * 0.34;
  const maxD = Math.sqrt(cv.w * cv.w + cv.h * cv.h);
  for (let y = 0; y < cv.h; y++) {
    for (let x = 0; x < cv.w; x++) {
      // base vertical gradient: near-black top -> pure black bottom
      const vt = y / cv.h;
      let v = 20 - vt * 20; // 20 -> 0
      // diagonal sheen band
      const d = (x + (cv.h - y)) / (cv.w + cv.h);
      v += Math.pow(Math.max(0, Math.sin(d * Math.PI)), 2) * 10;
      // radial glow toward the logo center
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      v += Math.max(0, 1 - dist / (maxD * 0.55)) * 16;
      // corner vignette
      const vig = Math.max(0, dist / maxD - 0.45) * 40;
      v -= vig;
      const c = Math.max(0, Math.min(28, v));
      cv.set(x, y, [c, c, c + 1]);
    }
  }
}

// soft glowing ring + filled logo mark
function drawGlowMark(cv, cx, cy, size) {
  // outer glow halo
  for (let r = size * 1.15; r > size * 0.5; r -= 1) {
    const a = (1 - (r - size * 0.5) / (size * 0.65)) * 0.05;
    cv.disc(cx, cy, r, [255, 255, 255], a);
  }
  // thin ring
  cv.disc(cx, cy, size * 0.62, T.faint, 0.35);
  cv.disc(cx, cy, size * 0.60, T.markBg, 1);
  // the mark itself
  drawMark(cv, cx, cy, size, T.fg, T.markBg);
}

// ---------- header 150x57 ----------
function makeHeader() {
  const cv = new Canvas(150, 57);
  paintBackground(cv);
  drawMark(cv, 27, 28, 30, T.fg, T.markBg);
  drawText(cv, "VTalk", 52, 21, 3, T.fg);
  // bottom hairline
  cv.rect(0, 56, 150, 57, T.fg, 0.22);
  return encodeBMP(cv);
}

// ---------- sidebar 164x314 ----------
function makeSidebar() {
  const cv = new Canvas(164, 314);
  paintBackground(cv);
  drawGlowMark(cv, 82, 104, 74);
  const w = textWidth("VTalk", 4);
  drawText(cv, "VTalk", Math.round((164 - w) / 2), 168, 4, T.fg);
  // tagline
  const tag = "SOCIAL. ELEVATED.";
  const tw = textWidth(tag, 1);
  drawText(cv, tag, Math.round((164 - tw) / 2), 204, 1, T.sub);
  // divider
  cv.rect(46, 240, 118, 241, T.fg, 0.18);
  // footer version
  const ver = "VERSION 0.1.0";
  const vw = textWidth(ver, 1);
  drawText(cv, ver, Math.round((164 - vw) / 2), 292, 1, T.faint);
  return encodeBMP(cv);
}

// Single premium dark set. Kept the *-dark names so the runtime swap (if any)
// and older config keep working; light aliases point to the same art.
const header = makeHeader();
const sidebar = makeSidebar();
writeFileSync(join(OUT, "header-dark.bmp"), header);
writeFileSync(join(OUT, "sidebar-dark.bmp"), sidebar);
writeFileSync(join(OUT, "header-light.bmp"), header);
writeFileSync(join(OUT, "sidebar-light.bmp"), sidebar);
console.log("Premium dark installer graphics written to", OUT);
