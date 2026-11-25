// Gera os ícones e as telas de abertura do Android a partir de assets/icon.svg.
// Uso: node scripts/icons.mjs   (requer o Chromium do Playwright)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const res = path.join(root, 'android/app/src/main/res');
const font = path.join(root, 'node_modules/@fontsource/cormorant-garamond/files');
const svg = fs.readFileSync(path.join(root, 'assets/icon.svg'), 'utf8');
const fontCss = `
@font-face{font-family:'Cormorant Garamond';font-weight:600;font-style:normal;src:url('file://${font}/cormorant-garamond-latin-600-normal.woff2')}
@font-face{font-family:'Cormorant Garamond';font-weight:500;font-style:italic;src:url('file://${font}/cormorant-garamond-latin-500-italic.woff2')}`;

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(file, size, { shape = 'square', transparentBg = false, scale = 1, canvas } = {}) {
  const w = canvas?.[0] ?? size;
  const h = canvas?.[1] ?? size;
  const inner = transparentBg ? svg.replace('<rect width="432" height="432" fill="#F4EFE6"/>', '') : svg;
  const radius = shape === 'round' ? '50%' : shape === 'rounded' ? '22%' : '0';
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(
    `<html><head><style>${fontCss} html,body{margin:0;background:${canvas ? '#F4EFE6' : 'transparent'}}
     .c{width:${w}px;height:${h}px;display:grid;place-items:center}
     .i{width:${size * scale}px;height:${size * scale}px;border-radius:${radius};overflow:hidden}
     .i svg{width:100%;height:100%}</style></head>
     <body><div class="c"><div class="i">${inner}</div></div></body></html>`,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(80);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: !canvas });
}

const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  await render(`${res}/mipmap-${d}/ic_launcher.png`, 48 * k, { shape: 'rounded' });
  await render(`${res}/mipmap-${d}/ic_launcher_round.png`, 48 * k, { shape: 'round' });
  // Ícone adaptativo: 108dp, conteúdo dentro da zona segura central.
  await render(`${res}/mipmap-${d}/ic_launcher_foreground.png`, 108 * k, { transparentBg: true, scale: 0.86 });
}
// Telas de abertura (versões antigas do Android): papel com o ícone ao centro.
for (const dir of fs.readdirSync(res).filter((x) => x.startsWith('drawable'))) {
  const f = path.join(res, dir, 'splash.png');
  if (!fs.existsSync(f)) continue;
  const buf = fs.readFileSync(f);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  await render(f, Math.round(Math.min(w, h) * 0.28), { shape: 'rounded', canvas: [w, h] });
}
await render(path.join(root, 'assets/icon-512.png'), 512, { shape: 'rounded' });
await browser.close();
console.log('ícones gerados');
