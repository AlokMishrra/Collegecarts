/**
 * Generates all favicon sizes from public/favicon-source.png
 * 
 * Usage:
 *   1. Drop your logo as public/favicon-source.png
 *   2. Run: node scripts/generate-favicon.mjs
 * 
 * If favicon-source.png is not found, falls back to downloading
 * the existing Supabase logo.
 */
import sharp from 'sharp';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../public');
const sourcePath = path.join(publicDir, 'favicon-source.png');

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

let buffer;
if (fs.existsSync(sourcePath)) {
  console.log('📁  Using public/favicon-source.png');
  buffer = fs.readFileSync(sourcePath);
} else {
  const FALLBACK_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6885ba54fc40d82179646aca/56f3d15ef_WhatsAppImage2025-12-13at111830AM.jpeg';
  console.log('⬇️  favicon-source.png not found, downloading fallback logo...');
  buffer = await download(FALLBACK_URL);
  fs.writeFileSync(sourcePath, buffer);
  console.log('✅  Downloaded and saved as favicon-source.png');
}

const sizes = [
  { name: 'favicon-16x16.png',    size: 16  },
  { name: 'favicon-32x32.png',    size: 32  },
  { name: 'favicon-48x48.png',    size: 48  },
  { name: 'favicon.png',          size: 64  },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192x192.png',     size: 192 },
  { name: 'icon-512x512.png',     size: 512 },
];

for (const { name, size } of sizes) {
  const dest = path.join(publicDir, name);
  await sharp(buffer)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .png()
    .toFile(dest);
  console.log(`✅  ${name} (${size}x${size})`);
}

// favicon.ico — 32x32 PNG (browsers accept PNG-encoded .ico)
const icoBuffer = await sharp(buffer)
  .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .png()
  .toBuffer();
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
console.log('✅  favicon.ico (32x32)');

console.log('\n🎉  All favicon sizes generated in public/');
