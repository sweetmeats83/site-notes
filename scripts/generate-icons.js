#!/usr/bin/env node
/**
 * Generates PNG app icons for the SiteNote PWA using pure Node.js (no native deps).
 * Writes: frontend/public/icons/icon-192.png and icon-512.png
 * Run: node scripts/generate-icons.js
 */
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'frontend', 'public', 'icons');
fs.mkdirSync(OUT_DIR, { recursive: true });

function crc32(buf) {
  let crc = 0xffffffff;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xff];
  return ((crc ^ 0xffffffff) >>> 0);
}

function chunk(type, data) {
  const len  = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc  = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function makePNG(size, bgR, bgG, bgB) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  // Build scanlines: filter byte (0) + RGB per pixel
  // Gradient from brand-blue to slightly darker at bottom
  const rows = [];
  for (let y = 0; y < size; y++) {
    const factor = 1 - (y / size) * 0.15; // slight darkening gradient
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filter None
    for (let x = 0; x < size; x++) {
      const cx = x / size - 0.5;
      const cy = y / size - 0.5;

      // "S" letterform mask using distance fields (simple rounded rectangle approach)
      // Blue background with white "S" drawn as filled paths
      let r = Math.round(bgR * factor);
      let g = Math.round(bgG * factor);
      let b = Math.round(bgB * factor);

      // Draw a simplified white "S" character
      const nx = cx * 2;
      const ny = cy * 2;
      const inS = drawS(nx, ny, size);
      if (inS) { r = 255; g = 255; b = 255; }

      row[1 + x * 3]     = Math.max(0, Math.min(255, r));
      row[2 + x * 3]     = Math.max(0, Math.min(255, g));
      row[3 + x * 3]     = Math.max(0, Math.min(255, b));
    }
    rows.push(row);
  }
  const raw  = Buffer.concat(rows);
  const idat = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawS(nx, ny, size) {
  // Simplified "S" using two arcs via distance-field approximation
  const sw = 0.22;  // stroke width in normalized units

  // Upper arc of S (curves right at top, left in middle)
  const ux = nx - 0.1, uy = ny + 0.35;
  const upperArc = Math.abs(Math.sqrt(ux*ux + uy*uy) - 0.38) < sw;

  const lx = nx + 0.1, ly = ny - 0.35;
  const lowerArc = Math.abs(Math.sqrt(lx*lx + ly*ly) - 0.38) < sw;

  // Only show the "open" portions (mask out hidden halves)
  const upperVisible = upperArc && nx >= -0.02;
  const lowerVisible = lowerArc && nx <= 0.02;

  return (upperVisible || lowerVisible);
}

// Brand blue: #2563EB → 37, 99, 235
const R = 37, G = 99, B = 235;

for (const size of [192, 512]) {
  const buf = makePNG(size, R, G, B);
  const out = path.join(OUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(out, buf);
  console.log(`✓ Generated ${out} (${(buf.length / 1024).toFixed(1)} KB)`);
}
console.log('Icons generated.');
