// Renders the SVG sources in icons/ into the PNGs phones and social sites need.
// Run:  node tests/make-icons.js   (needs Playwright + Chromium, and Python Pillow to shrink the files)
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dir = path.resolve(__dirname, '../icons');
const jobs = [
  ['icon.svg', 'icon-192.png', 192, 192],
  ['icon.svg', 'icon-512.png', 512, 512],
  ['icon.svg', 'apple-touch-icon.png', 180, 180],
  ['icon.svg', 'favicon-32.png', 32, 32],
  ['og-image.svg', 'og-image.png', 1200, 630]
];
(async () => {
  const browser = await chromium.launch();
  for (const [src, out, w, h] of jobs) {
    const svg = fs.readFileSync(path.join(dir, src), 'utf8');
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${w}px;height:${h}px}</style>${svg}`);
    await page.screenshot({ path: path.join(dir, out) });
    await page.close();
  }
  await browser.close();
  // Shrink PNGs with a palette (much smaller; looks the same for flat artwork).
  try {
    execFileSync('python3', ['-c', `
import sys
from PIL import Image
for f in sys.argv[1:]:
    im = Image.open(f).convert('RGB')
    im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(f, optimize=True)
`, ...jobs.map((j) => path.join(dir, j[1]))]);
  } catch (e) { console.warn('Pillow not available; PNGs left uncompressed'); }
  console.log('icons written');
})();
