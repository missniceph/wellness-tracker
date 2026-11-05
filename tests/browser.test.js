// End-to-end browser test. Run with:  node tests/browser.test.js [screenshotDir]
// Needs Playwright + Chromium installed. Starts a tiny local web server for the app.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.argv[2] || null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

let passed = 0;
async function step(name, fn) {
  try { await fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.log('  ✗ ' + name); throw e; }
}

(async () => {
  const server = await serve();
  const URL = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  const getState = () => page.evaluate(() => JSON.parse(localStorage.getItem('ptracker.v1') || 'null'));
  const noHScroll = async (label) => {
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(o <= 0, `${label}: page scrolls sideways by ${o}px`);
  };

  const tab = async (name) => {
    await page.click(`a[data-tab="${name}"]`);
    await page.waitForSelector(`a[data-tab="${name}"][aria-current="page"]`);
  };

  console.log('Browser tests');
  await page.goto(URL);

  await step('first run shows setup with pre-filled habits and no nav', async () => {
    await page.waitForSelector('#settingsForm');
    assert.equal(await page.isVisible('#tabbar'), false);
    const habits = await page.$$eval('[name="habitName"]', (els) => els.map((e) => e.value));
    assert.deepEqual(habits, ['Read 10 pages', 'Stretch 10 minutes', 'No screens after 10pm', 'Pickleball', '']);
    assert.equal(await page.inputValue('#s-stepsTarget'), '5000');
    assert.equal(await page.inputValue('#s-workoutsTarget'), '4');
    await noHScroll('setup');
  });

  await step('setup saves and opens Today', async () => {
    await page.fill('#s-why', 'Strong and calm');
    await page.fill('#s-startWeight', '70');
    await page.fill('#s-targetGoal', '64');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.daynav');
    assert.match(await page.textContent('.daypick strong'), /Day 1 of 100 · Week 1/);
    assert.match(await page.textContent('.why'), /Strong and calm/);
    assert.equal(await page.isVisible('#tabbar'), true);
  });

  await step('Today: yes/no taps update Daily habits % live (no protein target → 3 points)', async () => {
    await page.click('[data-yn="water"][data-val="true"]');
    assert.equal(await page.textContent('#dhPct'), '33%');
    await page.click('[data-yn="reviewedWhy"][data-val="true"]');
    assert.equal(await page.textContent('#dhPct'), '67%');
    await page.click('[data-yn="reviewedWhy"][data-val="true"]'); // tap again clears
    assert.equal(await page.textContent('#dhPct'), '33%');
  });

  await step('Today: typing auto-saves', async () => {
    await page.fill('#f-weight', '69.5');
    await page.fill('#f-steps', '6200');
    await page.click('[data-scale="sleep"][data-val="4"]');
    await page.click('[data-yn="habit:' + (await getState()).settings.habits[0].id + '"][data-val="true"]').catch(async () => {
      // state not saved yet; wait and retry
      await page.waitForTimeout(500);
      const s = await getState();
      await page.click(`[data-yn="habit:${s.settings.habits[0].id}"][data-val="true"]`);
    });
    await page.fill('[data-prio="0"]', 'Walk after lunch');
    await page.fill('#f-wins', 'Logged day 1!');
    await page.waitForTimeout(600);
    const s = await getState();
    const e = s.days[s.settings.startDate];
    assert.equal(e.weight, 69.5);
    assert.equal(e.steps, 6200);
    assert.equal(e.sleep, 4);
    assert.equal(e.water, true);
    assert.equal(e.reviewedWhy, undefined);
    assert.deepEqual(e.priorities, ['Walk after lunch', '', '']);
    assert.equal(e.wins, 'Logged day 1!');
    assert.match(await page.textContent('#hint-weight'), /7-day trend: 69.5 kg/);
    assert.match(await page.textContent('#saveStatus'), /Saved/);
  });

  await step('Today: data survives a reload', async () => {
    await page.reload();
    await page.waitForSelector('.daynav');
    assert.equal(await page.inputValue('#f-weight'), '69.5');
    assert.equal(await page.getAttribute('[data-yn="water"][data-val="true"]', 'aria-pressed'), 'true');
  });

  await step('Settings: adding a protein target changes Daily habits % to 4 points', async () => {
    await tab('settings');
    await page.fill('#s-proteinTarget', '100');
    await page.click('button[type="submit"]');
    await tab('today');
    await page.waitForSelector('#dhPct');
    assert.equal(await page.textContent('#dhPct'), '25%');
    await page.fill('#f-protein', '105');
    assert.equal(await page.textContent('#dhPct'), '50%');
  });

  await step('Load sample data (from Settings)', async () => {
    await tab('settings');
    await page.click('[data-act="sample"]');
    await page.waitForSelector('.daynav');
    assert.match(await page.textContent('.daypick strong'), /Day 32 of 100 · Week 5/);
  });

  await step('day arrows and date picker move between days', async () => {
    await page.click('[data-act="prev"]');
    assert.match(await page.textContent('.daypick strong'), /Day 31 of 100/);
    await page.click('[data-act="next"]');
    assert.match(await page.textContent('.daypick strong'), /Day 32 of 100/);
    const s = await getState();
    await page.fill('#datePick', s.settings.startDate);
    await page.dispatchEvent('#datePick', 'change');
    assert.match(await page.textContent('.daypick strong'), /Day 1 of 100 · Week 1/);
    assert.equal(await page.isDisabled('[data-act="prev"]'), true);
    await page.click('[data-act="gotoday"]');
    assert.match(await page.textContent('.daypick strong'), /Day 32 of 100/);
  });

  await step('Dashboard shows 8 tiles, milestones, and both charts', async () => {
    await tab('dashboard');
    assert.equal(await page.locator('.tile').count(), 8);
    assert.equal(await page.locator('.milestones li').count(), 3);
    assert.equal(await page.locator('svg.chart').count(), 2);
    assert.ok(await page.locator('svg.chart .pt').count() > 10, 'weight dots drawn');
    assert.equal(await page.locator('svg.chart .bar').count(), 5, 'five weeks scored');
    const tiles = await page.$$eval('.tile', (els) => els.map((e) => e.textContent));
    assert.match(tiles[0], /Days left\s*68/);
  });

  await step('Weekly shows a card per started week with reflections that save', async () => {
    await tab('weekly');
    assert.equal(await page.locator('article.card').count(), 5);
    assert.match(await page.textContent('article.card >> nth=0'), /Week 5/);
    assert.match(await page.textContent('article.card >> nth=0'), /4 of 7 days so far/);
    await page.fill('#w5-wins', 'Hit my steps 4 days');
    await page.waitForTimeout(500);
    assert.equal((await getState()).weeks['5'].wins, 'Hit my steps 4 days');
  });

  await step('Measurements: change since week 1 and cm/in toggle', async () => {
    await tab('measurements');
    assert.match(await page.textContent('#mc-chest'), /−1.4 cm since wk 1/);
    await page.click('[data-munit="in"]');
    assert.equal(await page.inputValue('#m-chest'), String(Number((90.6 / 2.54).toFixed(1))));
    await page.click('[data-munit="cm"]');
    await page.selectOption('#mWeek', '6');
    await page.fill('#m-waistNavel', '82');
    await page.waitForTimeout(500);
    const s = await getState();
    assert.equal(s.measurements['6'].waistNavel, 82);
    assert.ok(s.measurements['6'].date, 'date auto-filled');
    assert.match(await page.textContent('#mc-waistNavel'), /−4.0 cm since wk 1/);
  });

  // Screenshots + layout checks at phone & laptop sizes in both themes.
  for (const [vw, vh, label] of [[390, 844, 'phone'], [1280, 860, 'laptop']]) {
    for (const theme of ['light', 'dark']) {
      await step(`layout ${label} / ${theme}: all tabs render without sideways scroll`, async () => {
        await page.setViewportSize({ width: vw, height: vh });
        await page.evaluate((t) => { localStorage.setItem('ptracker.theme', t); document.documentElement.setAttribute('data-theme', t); }, theme);
        for (const t of ['today', 'dashboard', 'weekly', 'measurements', 'settings']) {
          await tab(t);
          await page.waitForTimeout(80);
          await noHScroll(`${label} ${theme} ${t}`);
          const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
          assert.equal(bg, theme === 'dark' ? 'rgb(11, 23, 25)' : 'rgb(245, 242, 237)');
          if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${label}-${theme}-${t}.png`), fullPage: label === 'phone' && t !== 'settings' });
        }
      });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { localStorage.removeItem('ptracker.theme'); document.documentElement.removeAttribute('data-theme'); });

  let backupPath;
  let before;
  await step('Export Backup downloads valid JSON', async () => {
    await tab('settings');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="export"]')]);
    assert.match(dl.suggestedFilename(), /^100-day-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/);
    backupPath = await dl.path();
    const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    before = await getState();
    assert.deepEqual(data.days, before.days);
    assert.deepEqual(data.settings, before.settings);
    assert.deepEqual(data.measurements, before.measurements);
    assert.match(await page.textContent('body'), /Last backup:/);
  });

  await step('Export CSV downloads a spreadsheet file', async () => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="csv"]')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    assert.ok(csv.replace(/^﻿/, '').startsWith('date,day,week,weight'));
    assert.equal(csv.trim().split('\r\n').length, 1 + Object.keys(before.days).length);
  });

  await step('Clear all data (confirmed) returns to setup', async () => {
    await page.click('[data-act="clear"]');
    await page.waitForSelector('#settingsForm');
    assert.equal(await getState(), null);
    assert.equal(await page.isVisible('#tabbar'), false);
  });

  await step('Clear all data asks first — cancelling keeps data', async () => {
    await page.click('[data-act="sample"]');
    await page.waitForSelector('.daynav');
    await tab('settings');
    page.removeAllListeners('dialog');
    page.once('dialog', (d) => d.dismiss());
    await page.click('[data-act="clear"]');
    await page.waitForTimeout(200);
    assert.ok(await getState(), 'data still there');
    page.on('dialog', (d) => d.accept());
  });

  await step('Import Backup restores exactly what was exported', async () => {
    await page.setInputFiles('#importFile', backupPath);
    await page.waitForFunction(() => document.getElementById('toast').textContent.includes('restored'));
    const after = await getState();
    assert.deepEqual(after.days, before.days);
    assert.deepEqual(after.weeks, before.weeks);
    assert.deepEqual(after.measurements, before.measurements);
    assert.deepEqual(after.settings, before.settings);
  });

  await step('Import rejects a file that is not a backup', async () => {
    const bad = path.join(path.dirname(backupPath), 'bad.json');
    fs.writeFileSync(bad, '{"hello": 1}');
    await page.setInputFiles('#importFile', bad);
    await page.waitForFunction(() => document.getElementById('toast').textContent.includes('doesn’t look like'));
    assert.deepEqual((await getState()).days, before.days);
  });

  await step('manifest and icons are reachable', async () => {
    const m = await (await page.request.get(URL + 'manifest.webmanifest')).json();
    assert.equal(m.display, 'standalone');
    for (const ic of m.icons) assert.equal((await page.request.get(URL + ic.src)).status(), 200, ic.src);
    assert.equal((await page.request.get(URL + 'icons/apple-touch-icon.png')).status(), 200);
    assert.equal((await page.request.get(URL + 'sw.js')).status(), 200);
  });

  await step('no JavaScript errors', async () => { assert.deepEqual(errors, []); });

  await browser.close();
  server.close();
  console.log(`\n${passed} browser checks passed`);
})().catch((e) => { console.error(e); process.exit(1); });
