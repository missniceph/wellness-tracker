// Renders icons/icon.svg into the PNG sizes phones need (iPhone requires a PNG home-screen icon).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const svg = fs.readFileSync(path.resolve(__dirname, '../icons/icon.svg'), 'utf8');
  for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.screenshot({ path: path.resolve(__dirname, '../icons', name) });
    await page.close();
  }
  await browser.close();
  console.log('icons written');
})();
