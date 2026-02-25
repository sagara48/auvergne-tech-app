// ═══════════════════════════════════════════════════════════════
// QR CODE SERVICE — Génération QR, étiquettes, impression
// Pure JS — aucune dépendance externe
// ═══════════════════════════════════════════════════════════════

// ═══ MINIMAL QR CODE ENCODER (Version 1-4, Mode Byte, EC-L) ═══
// Basé sur ISO/IEC 18004 — produit une matrice de modules

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

// Init Galois Field GF(256)
(function initGF() {
  let v = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = v; GF_LOG[v] = i;
    v = (v << 1) ^ (v & 128 ? 0x11d : 0);
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGenPoly(n: number): number[] {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const ng = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      ng[j] ^= g[j];
      ng[j + 1] ^= gfMul(g[j], GF_EXP[i]);
    }
    g = ng;
  }
  return g;
}

function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGenPoly(ecLen);
  const msg = [...data, ...new Array(ecLen).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.slice(data.length);
}

// QR Version configs: [version, size, dataCodewords, ecCodewordsPerBlock, numBlocks]
const QR_CONFIGS: [number, number, number, number, number][] = [
  [1, 21, 19, 7, 1],
  [2, 25, 34, 10, 1],
  [3, 29, 55, 15, 1],
  [4, 33, 80, 20, 1],
  [5, 37, 108, 26, 1],
  [6, 41, 136, 18, 2],
];

function chooseVersion(dataLen: number): typeof QR_CONFIGS[0] {
  for (const cfg of QR_CONFIGS) {
    const overhead = 4 + (cfg[0] >= 10 ? 16 : 8); // mode indicator + char count
    const available = cfg[2] * 8 - overhead;
    if (dataLen * 8 <= available) return cfg;
  }
  return QR_CONFIGS[QR_CONFIGS.length - 1];
}

function encodeData(text: string): { modules: boolean[][]; size: number } {
  const bytes = new TextEncoder().encode(text);
  const cfg = chooseVersion(bytes.length);
  const [version, size, totalDC, ecPerBlock, numBlocks] = cfg;
  
  // Build data codewords (byte mode = 0100)
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  
  pushBits(0b0100, 4); // Byte mode
  pushBits(bytes.length, version >= 10 ? 16 : 8); // Character count
  bytes.forEach(b => pushBits(b, 8));
  pushBits(0, 4); // Terminator (up to 4 bits)
  
  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);
  
  // Pad to fill data codewords
  const dcBytes = totalDC;
  const padPatterns = [0xEC, 0x11];
  let padIdx = 0;
  while (bits.length < dcBytes * 8) {
    pushBits(padPatterns[padIdx % 2], 8);
    padIdx++;
  }
  
  // Convert bits to bytes
  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] || 0);
    dataBytes.push(b);
  }
  
  // Split into blocks and add EC
  const blockSize = Math.floor(dcBytes / numBlocks);
  const allData: number[][] = [];
  const allEC: number[][] = [];
  for (let i = 0; i < numBlocks; i++) {
    const start = i * blockSize;
    const block = dataBytes.slice(start, start + blockSize);
    allData.push(block);
    allEC.push(rsEncode(block, ecPerBlock));
  }
  
  // Interleave
  const interleaved: number[] = [];
  for (let j = 0; j < blockSize; j++) {
    for (let i = 0; i < numBlocks; i++) interleaved.push(allData[i][j]);
  }
  for (let j = 0; j < ecPerBlock; j++) {
    for (let i = 0; i < numBlocks; i++) interleaved.push(allEC[i][j]);
  }
  
  // Convert to bit stream
  const finalBits: number[] = [];
  interleaved.forEach(b => { for (let i = 7; i >= 0; i--) finalBits.push((b >> i) & 1); });
  
  // Create matrix
  const mod: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const setMod = (r: number, c: number, v: boolean) => { if (r >= 0 && r < size && c >= 0 && c < size) mod[r][c] = v; };
  
  // Finder patterns
  const drawFinder = (r: number, c: number) => {
    for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
      const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
      const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
      const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
      setMod(r + dr, c + dc, inOuter ? (onBorder || inInner) : false);
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);
  
  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setMod(6, i, i % 2 === 0);
    setMod(i, 6, i % 2 === 0);
  }
  
  // Alignment patterns (version >= 2)
  if (version >= 2) {
    const positions = getAlignmentPositions(version);
    for (const r of positions) for (const c of positions) {
      // Skip if overlaps with finder
      if ((r < 9 && c < 9) || (r < 9 && c > size - 9) || (r > size - 9 && c < 9)) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        setMod(r + dr, c + dc, Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0));
      }
    }
  }
  
  // Dark module
  setMod(size - 8, 8, true);
  
  // Reserve format info areas
  for (let i = 0; i < 8; i++) {
    if (mod[8][i] === null) setMod(8, i, false); // will be overwritten
    if (mod[i][8] === null) setMod(i, 8, false);
    if (mod[8][size - 1 - i] === null) setMod(8, size - 1 - i, false);
    if (mod[size - 1 - i][8] === null) setMod(size - 1 - i, 8, false);
  }
  setMod(8, 8, false);
  
  // Place data bits
  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col--; // Skip timing column
    const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);
    for (const row of rows) {
      for (const dc of [0, -1]) {
        const c = col + dc;
        if (c < 0 || c >= size) continue;
        if (mod[row][c] !== null) continue;
        mod[row][c] = bitIdx < finalBits.length ? finalBits[bitIdx++] === 1 : false;
      }
    }
    upward = !upward;
  }
  
  // Apply mask (pattern 0: (row + col) % 2 === 0)
  const mask = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (isDataModule(r, c, size, version)) {
      if ((r + c) % 2 === 0) mod[r][c] = !mod[r][c];
    }
  }
  
  // Write format info (EC level L = 01, mask 0 = 000 → format bits = 01000)
  const formatBits = getFormatBits(0b01, mask);
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >> (14 - i)) & 1) === 1;
    // Around top-left finder
    if (i < 6) setMod(8, i, bit);
    else if (i === 6) setMod(8, 7, bit);
    else if (i === 7) setMod(8, 8, bit);
    else if (i === 8) setMod(7, 8, bit);
    else setMod(14 - i, 8, bit);
    // Around other finders
    if (i < 8) setMod(size - 1 - i, 8, bit);
    else setMod(8, size - 8 + (i - 8), bit);
  }
  
  return { modules: mod.map(row => row.map(v => v === true)), size };
}

function getAlignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const positions: number[][] = [
    [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  ];
  return positions[version - 1] || [6, 6 + version * 4];
}

function isDataModule(r: number, c: number, size: number, version: number): boolean {
  // Finder patterns + separators
  if ((r < 9 && c < 9) || (r < 9 && c >= size - 8) || (r >= size - 8 && c < 9)) return false;
  // Timing
  if (r === 6 || c === 6) return false;
  // Dark module
  if (r === size - 8 && c === 8) return false;
  // Alignment
  if (version >= 2) {
    const positions = getAlignmentPositions(version);
    for (const ar of positions) for (const ac of positions) {
      if ((ar < 9 && ac < 9) || (ar < 9 && ac > size - 9) || (ar > size - 9 && ac < 9)) continue;
      if (Math.abs(r - ar) <= 2 && Math.abs(c - ac) <= 2) return false;
    }
  }
  return true;
}

function getFormatBits(ecLevel: number, mask: number): number {
  const data = (ecLevel << 3) | mask;
  let bits = data << 10;
  for (let i = 4; i >= 0; i--) {
    if (bits & (1 << (i + 10))) bits ^= 0b10100110111 << i;
  }
  return ((data << 10) | bits) ^ 0b101010000010010;
}

// ═══ SVG RENDERER ═══

export function generateQRSvg(text: string, cellSize = 4, quiet = 4): string {
  const { modules, size } = encodeData(text);
  const totalSize = (size + quiet * 2) * cellSize;
  
  let rects = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) {
        rects += `<rect x="${(c + quiet) * cellSize}" y="${(r + quiet) * cellSize}" width="${cellSize}" height="${cellSize}"/>`;
      }
    }
  }
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}">
<rect width="100%" height="100%" fill="white"/>
<g fill="black">${rects}</g>
</svg>`;
}

export function generateQRDataUrl(text: string, cellSize = 4): string {
  const svg = generateQRSvg(text, cellSize);
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

// ═══ DATA ENCODERS ═══

export type QRTarget = 'stock' | 'ascenseur';

export interface QRPayload {
  type: QRTarget;
  id: string;
  ref: string;
  label: string;
  detail?: string;
}

export function encodeStockQR(article: { id: string; reference: string; designation: string }): QRPayload {
  return {
    type: 'stock',
    id: article.id,
    ref: article.reference,
    label: article.designation,
    detail: article.reference,
  };
}

export function encodeAscenseurQR(ascenseur: { code_appareil: string; adresse: string; ville?: string }): QRPayload {
  return {
    type: 'ascenseur',
    id: ascenseur.code_appareil,
    ref: ascenseur.code_appareil,
    label: `${ascenseur.adresse}${ascenseur.ville ? `, ${ascenseur.ville}` : ''}`,
  };
}

export function qrContentString(payload: QRPayload): string {
  return `ATAPP:${payload.type}:${payload.ref}`;
}

export function parseQRContent(data: string): QRPayload | null {
  const match = data.match(/^ATAPP:(stock|ascenseur):(.+)$/);
  if (!match) return null;
  return { type: match[1] as QRTarget, id: match[2], ref: match[2], label: match[2] };
}

// ═══ LABEL GENERATION (HTML → print) ═══

export function generateLabel(payload: QRPayload, size: 'small' | 'medium' | 'large' = 'medium'): string {
  const qrSvg = generateQRSvg(qrContentString(payload), size === 'small' ? 2 : size === 'medium' ? 3 : 4);
  const qrSize = size === 'small' ? 60 : size === 'medium' ? 90 : 120;
  const fontSize = size === 'small' ? 7 : size === 'medium' ? 9 : 11;
  
  return `<div style="display:inline-flex;align-items:center;gap:${size === 'small' ? 4 : 8}px;padding:${size === 'small' ? 4 : 8}px;border:1px solid #ccc;border-radius:4px;font-family:monospace;background:white;page-break-inside:avoid">
  <div style="width:${qrSize}px;height:${qrSize}px;flex-shrink:0">${qrSvg}</div>
  <div style="min-width:0">
    <div style="font-size:${fontSize + 3}px;font-weight:bold;color:#B91C1C">${payload.ref}</div>
    <div style="font-size:${fontSize}px;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px">${payload.label}</div>
    ${payload.detail ? `<div style="font-size:${fontSize - 1}px;color:#888">${payload.detail}</div>` : ''}
    <div style="font-size:${fontSize - 2}px;color:#aaa;margin-top:2px">AuvergneTech</div>
  </div>
</div>`;
}

export function printLabels(payloads: QRPayload[], size: 'small' | 'medium' | 'large' = 'medium') {
  const labels = payloads.map(p => generateLabel(p, size)).join('\n');
  const html = `<!DOCTYPE html>
<html><head><title>Étiquettes QR — AuvergneTech</title>
<style>
  @page { margin: 10mm; }
  body { font-family: sans-serif; }
  .grid { display: flex; flex-wrap: wrap; gap: 8px; }
</style></head>
<body><div class="grid">${labels}</div>
<script>window.onload=()=>window.print();<\/script>
</body></html>`;
  
  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
}

export function downloadQRSvg(payload: QRPayload) {
  const svg = generateQRSvg(qrContentString(payload), 6);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `QR-${payload.type}-${payload.ref}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}
