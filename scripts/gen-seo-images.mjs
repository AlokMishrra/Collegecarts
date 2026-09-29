import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pub = join(__dirname, '..', 'public');

const GREEN = '#0c831f';
const DARK = '#064e12';

const brandSvg = (w, h) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#12a02a"/>
      <stop offset="100%" stop-color="${DARK}"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="60%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#shine)"/>
  <circle cx="${w * 0.86}" cy="${h * 0.2}" r="${h * 0.34}" fill="#ffffff" opacity="0.07"/>
  <circle cx="${w * 0.12}" cy="${h * 0.88}" r="${h * 0.3}" fill="#ffffff" opacity="0.07"/>

  <g transform="translate(${w * 0.5}, ${h * 0.34})">
    <rect x="-70" y="-70" width="140" height="140" rx="34" fill="#ffffff"/>
    <text x="0" y="16" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="96" font-weight="800" fill="${GREEN}">C</text>
  </g>

  <text x="${w * 0.5}" y="${h * 0.62}" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="${h * 0.115}"
        font-weight="800" fill="#ffffff" letter-spacing="-1">CollegeCart</text>

  <text x="${w * 0.5}" y="${h * 0.72}" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="${h * 0.056}"
        font-weight="600" fill="#d9efe0">Groceries &amp; essentials in 10 minutes</text>

  <g transform="translate(${w * 0.5}, ${h * 0.845})">
    <rect x="-184" y="-26" width="368" height="52" rx="26" fill="#ffffff" opacity="0.14"/>
    <text x="0" y="8" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="${h * 0.045}" font-weight="700" fill="#ffffff">
      Delivery to your hostel room
    </text>
  </g>
</svg>`;

const heroSvg = (w, h) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="hbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f3fbf4"/>
      <stop offset="100%" stop-color="#e3f5e7"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#hbg)"/>
  <rect x="${w * 0.60}" y="0" width="${w * 0.40}" height="${h}" fill="${GREEN}" opacity="0.10"/>

  <text x="${w * 0.055}" y="${h * 0.34}" font-family="Arial, Helvetica, sans-serif"
        font-size="${h * 0.14}" font-weight="800" fill="#0f172a">Shop groceries</text>
  <text x="${w * 0.055}" y="${h * 0.50}" font-family="Arial, Helvetica, sans-serif"
        font-size="${h * 0.14}" font-weight="800" fill="${GREEN}">in 10 minutes</text>
  <text x="${w * 0.055}" y="${h * 0.65}" font-family="Arial, Helvetica, sans-serif"
        font-size="${h * 0.062}" font-weight="500" fill="#475569">
    Fresh fruit, dairy, snacks &amp; daily essentials delivered to your hostel room.
  </text>

  <g transform="translate(${w * 0.79}, ${h * 0.50})">
    <rect x="-96" y="-96" width="192" height="192" rx="46" fill="${GREEN}"/>
    <text x="0" y="30" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="132" font-weight="800" fill="#ffffff">C</text>
  </g>
  <g transform="translate(${w * 0.79}, ${h * 0.80})">
    <rect x="-118" y="-30" width="236" height="60" rx="30" fill="#ffffff"/>
    <text x="0" y="10" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="30" font-weight="700" fill="${GREEN}">CollegeCart</text>
  </g>
</svg>`;

const logoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${GREEN}"/>
  <text x="256" y="356" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="330" font-weight="800" fill="#ffffff">C</text>
</svg>`;

await sharp(Buffer.from(brandSvg(1200, 630)))
  .jpeg({ quality: 86, mozjpeg: true })
  .toFile(join(pub, 'og-image.jpg'));

await sharp(Buffer.from(heroSvg(1440, 640)))
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(join(pub, 'hero-shop.jpg'));

await sharp(Buffer.from(logoSvg)).png().toFile(join(pub, 'logo.png'));

console.log('og-image.jpg, hero-shop.jpg, logo.png written');
