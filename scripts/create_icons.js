/**
 * アイコン生成スクリプト
 * Node.js で一度だけ実行し、icons/*.png を生成する
 * 使用方法: node scripts/create_icons.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32テーブル生成
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function uint32BE(n) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(n, 0);
  return buf;
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBuf = uint32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBuf = uint32BE(crc32(crcInput));
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

/**
 * シンプルなPNGを生成する
 * @param {number} size - アイコンサイズ（px）
 * @param {boolean} isOff - true のとき OFF状態（グレー）アイコンを生成
 */
function createPng(size, isOff = false) {
  // IHDR チャンク
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);   // width
  ihdr.writeUInt32BE(size, 4);   // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // ピクセルデータを生成（RGB）
  // ON:  背景色 #3B82F6（青）、アイコン色 #FFFFFF（白）
  // OFF: 背景色 #475569（グレー）、アイコン色 #94A3B8（薄いグレー）
  const bgR = isOff ? 0x47 : 0x3B;
  const bgG = isOff ? 0x55 : 0x82;
  const bgB = isOff ? 0x69 : 0xF6;
  const fgR = isOff ? 0x94 : 0xFF;
  const fgG = isOff ? 0xA3 : 0xFF;
  const fgB = isOff ? 0xB8 : 0xFF;

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3); // filter byte + RGB pixels
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const nx = x / size; // 0.0 ~ 1.0
      const ny = y / size; // 0.0 ~ 1.0

      // スピーカー風アイコンを描画
      const cx = 0.5, cy = 0.5;
      const dx = nx - cx, dy = ny - cy;

      let isFg = false;

      if (size >= 16) {
        // スピーカー本体（左側の四角形部分）
        if (nx >= 0.15 && nx <= 0.40 && ny >= 0.35 && ny <= 0.65) {
          isFg = true;
        }
        // スピーカーコーン（三角形）
        const coneLeft = 0.40;
        const coneRight = 0.65;
        if (nx >= coneLeft && nx <= coneRight) {
          const progress = (nx - coneLeft) / (coneRight - coneLeft);
          const halfHeight = 0.15 + progress * 0.20;
          if (Math.abs(ny - cy) <= halfHeight) {
            isFg = true;
          }
        }
        // 音波（外側）
        if (size >= 32) {
          const r = Math.sqrt(dx * dx + dy * dy);
          const arcAngle = Math.atan2(dy, dx);
          if (arcAngle >= -0.7 && arcAngle <= 0.7) {
            if (Math.abs(r - 0.28) < 0.03) isFg = true;
            if (size >= 48 && Math.abs(r - 0.36) < 0.025) isFg = true;
          }
        }
      } else {
        // 16x16: シンプルな「M」文字（Mute の頭文字）
        // 左縦棒
        if (nx >= 0.15 && nx <= 0.28 && ny >= 0.25 && ny <= 0.75) isFg = true;
        // 右縦棒
        if (nx >= 0.72 && nx <= 0.85 && ny >= 0.25 && ny <= 0.75) isFg = true;
        // 中央V字（左）
        if (nx >= 0.28 && nx <= 0.50) {
          const expected_y = 0.25 + ((nx - 0.28) / 0.22) * 0.25;
          if (Math.abs(ny - expected_y) < 0.08) isFg = true;
        }
        // 中央V字（右）
        if (nx >= 0.50 && nx <= 0.72) {
          const expected_y = 0.50 - ((nx - 0.50) / 0.22) * 0.25;
          if (Math.abs(ny - expected_y) < 0.08) isFg = true;
        }
      }

      const offset = 1 + x * 3;
      row[offset]     = isFg ? fgR : bgR;
      row[offset + 1] = isFg ? fgG : bgG;
      row[offset + 2] = isFg ? fgB : bgB;
    }
    rows.push(row);
  }

  const rawData = Buffer.concat(rows);
  const compressed = zlib.deflateSync(rawData);

  // PNG シグネチャ + チャンク
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// icons ディレクトリ作成
const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 各サイズのPNGを生成（ON版・OFF版）
for (const size of [16, 48, 128]) {
  const pngOn = createPng(size, false);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), pngOn);
  console.log(`Generated: icons/icon${size}.png (${pngOn.length} bytes)`);

  const pngOff = createPng(size, true);
  fs.writeFileSync(path.join(iconsDir, `icon${size}_off.png`), pngOff);
  console.log(`Generated: icons/icon${size}_off.png (${pngOff.length} bytes)`);
}

console.log('Done!');
