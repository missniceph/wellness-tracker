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
    assert.equal(await page.locator('svg.chart').count(), 3, 'weight, weekly scores, strength');
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

  // Screenshots + layout checks at small phone, phone, tablet & laptop sizes in both themes.
  for (const [vw, vh, label] of [[360, 740, 'phone360'], [390, 844, 'phone'], [768, 1024, 'tablet'], [1280, 860, 'laptop']]) {
    for (const theme of ['light', 'dark']) {
      await step(`layout ${label} / ${theme}: all tabs render without sideways scroll`, async () => {
        await page.setViewportSize({ width: vw, height: vh });
        await page.evaluate((t) => { localStorage.setItem('ptracker.theme', t); document.documentElement.setAttribute('data-theme', t); }, theme);
        for (const t of ['today', 'dashboard', 'weekly', 'measurements', 'settings']) {
          await tab(t);
          await page.waitForTimeout(80);
          await noHScroll(`${label} ${theme} ${t}`);
          const clipped = await page.evaluate(() => [...document.querySelectorAll('.tabbar span, button, select, .tile .k')]
            .filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim().slice(0, 30)));
          assert.deepEqual(clipped, [], `${label} ${theme} ${t}: text cut off`);
          const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
          assert.equal(bg, theme === 'dark' ? 'rgb(11, 23, 25)' : 'rgb(245, 242, 237)');
          if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${label}-${theme}-${t}.png`), fullPage: label.startsWith('phone') });
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
    await page.waitForFunction(() => /Last backup:/.test(document.body.textContent));
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

  await step('keyboard: every focusable control on Today shows a focus ring', async () => {
    await tab('today');
    await page.reload();
    await page.waitForSelector('.daynav');
    const seen = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        const ring = (x) => { const cs = getComputedStyle(x); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2; };
        const target = el.closest('.daypick') || el; // the date picker shows its ring on the wrapper
        return { tag: el.tagName, text: (el.getAttribute('aria-label') || el.textContent || el.id || '').trim().slice(0, 25), ok: ring(target) };
      });
      seen.push(info);
      assert.ok(info.ok, `no visible focus ring on ${info.tag} "${info.text}"`);
    }
    assert.equal(seen[0].text, 'Skip to content');
  });

  await step('switching tabs moves focus to the page heading', async () => {
    await tab('weekly');
    assert.equal(await page.evaluate(() => document.activeElement.tagName + ':' + document.activeElement.textContent), 'H1:Weekly review');
    assert.match(await page.textContent('main'), /Week 6 starts/);
  });

  await step('a weight of 0 is not saved', async () => {
    await tab('today');
    await page.fill('#f-weight', '0');
    await page.waitForTimeout(500);
    const s = await getState();
    const today = await page.inputValue('#datePick');
    assert.equal((s.days[today] || {}).weight, undefined);
  });

  await step('removing a habit then typing a new one starts fresh history', async () => {
    await tab('settings');
    const oldId = await page.getAttribute('[name="habitName"] >> nth=3', 'data-hid');
    await page.click('[data-act="rmhabit"] >> nth=3');
    await page.fill('[name="habitName"] >> nth=3', 'Swim');
    await page.click('#settingsForm button[type="submit"]');
    const hb = (await getState()).settings.habits;
    assert.equal(hb[3].name, 'Swim');
    assert.notEqual(hb[3].id, oldId);
    assert.equal(hb.length, 4);
  });

  await step('switching kg → lbs converts goals and logged weights', async () => {
    const before = await getState();
    const someDay = Object.keys(before.days).find((d) => typeof before.days[d].weight === 'number');
    await page.click('[data-unit="lbs"]');
    assert.equal(await page.inputValue('#s-startWeight'), String(Math.round(72 * 2.2046226218 * 10) / 10));
    await page.click('#settingsForm button[type="submit"]');
    const after = await getState();
    assert.equal(after.settings.unit, 'lbs');
    assert.equal(after.settings.targetGoal, Math.round(66 * 2.2046226218 * 10) / 10);
    assert.equal(after.days[someDay].weight, Math.round(before.days[someDay].weight * 2.2046226218 * 10) / 10);
    await page.click('[data-unit="kg"]');
    await page.click('#settingsForm button[type="submit"]');
    assert.equal((await getState()).settings.unit, 'kg');
  });

  await step('import ignores broken entries inside an otherwise valid backup', async () => {
    const junk = path.join(path.dirname(backupPath), 'junk.json');
    const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    data.days['not-a-date'] = { weight: 1 };
    data.days['2026-02-30'] = { weight: 1 };
    data.days[before.settings.startDate] = 'oops';
    data.measurements['99'] = { chest: 1 };
    fs.writeFileSync(junk, JSON.stringify(data));
    await page.setInputFiles('#importFile', junk);
    await page.waitForFunction(() => document.getElementById('toast').textContent.includes('restored'));
    const s = await getState();
    assert.equal(s.days['not-a-date'], undefined);
    assert.equal(s.days['2026-02-30'], undefined);
    assert.equal(s.days[before.settings.startDate], undefined);
    assert.equal(s.measurements['99'], undefined);
    for (const t of ['today', 'dashboard', 'weekly', 'measurements']) await tab(t);
  });

  await step('workout log: add an exercise by name, log sets, auto-mark "worked out"', async () => {
    await page.evaluate(() => { localStorage.setItem('ptracker.v1', JSON.stringify(window.__tracker.sampleData())); });
    await page.reload();
    await tab('settings');
    await tab('today');
    await page.click('[data-act="prev"]'); // yesterday has no workout in the sample → use a clean day
    const date = await page.inputValue('#datePick');
    const s0 = await getState();
    if (s0.days[date] && s0.days[date].exercises) {
      await page.evaluate((d) => { const s = JSON.parse(localStorage.getItem('ptracker.v1')); delete s.days[d]; localStorage.setItem('ptracker.v1', JSON.stringify(s)); }, date);
      await page.reload(); await page.waitForSelector('.daynav');
      await page.click('[data-act="prev"]');
    }
    await page.fill('#newEx', 'Hip thrust');
    await page.press('#newEx', 'Enter');
    await page.waitForSelector('[data-set="0:0:w"]');
    assert.equal(await page.locator('[data-set$=":w"]').count(), 3, 'new exercise starts with 3 sets');
    assert.match(await page.textContent('#workoutCard'), /First time logging this/);
    await page.fill('[data-set="0:0:w"]', '30');
    await page.fill('[data-set="0:0:r"]', '10');
    await page.waitForTimeout(500);
    const s = await getState();
    const e = s.days[date];
    const ex = s.exercises.find((x) => x.name === 'Hip thrust');
    assert.ok(ex, 'exercise saved to my list');
    assert.deepEqual(e.exercises[0].sets[0], { w: 30, r: 10 });
    assert.equal(e.workout, true, 'logging reps marks the day as a workout');
    assert.equal(await page.getAttribute('[data-yn="workout"][data-val="true"]', 'aria-pressed'), 'true');
  });

  await step('workout log: + Add set copies the weight; ✕ removes a set; empty sets are not counted', async () => {
    await page.click('[data-act="addset"]');
    assert.equal(await page.inputValue('[data-set="0:3:w"]'), '');
    await page.fill('[data-set="0:1:w"]', '30'); await page.fill('[data-set="0:1:r"]', '12');
    await page.click('[data-act="rmset"][data-si="3"]');
    await page.click('[data-act="rmset"][data-si="2"]');
    await page.click('[data-act="addset"]');
    assert.equal(await page.inputValue('[data-set="0:2:w"]'), '30');
    await page.fill('[data-set="0:2:r"]', '12');
    await page.waitForTimeout(500);
    const date = await page.inputValue('#datePick');
    const sets = (await getState()).days[date].exercises[0].sets;
    assert.deepEqual(sets, [{ w: 30, r: 10 }, { w: 30, r: 12 }, { w: 30, r: 12 }]);
  });

  await step('workout log: next session shows last time and a progressive-overload target', async () => {
    await page.click('[data-act="next"]'); // today
    await page.fill('#newEx', 'hip THRUST'); // matches the existing exercise, any capitals
    await page.click('[data-act="addex"]');
    const card = await page.textContent('#workoutCard');
    assert.match(card, /Last time \(.+\): 30 kg × 10, 12, 12/);
    assert.match(card, /Stay at 30 kg and aim for 11 reps per set/);
    assert.equal(await page.getAttribute('[data-set="0:0:w"]', 'value'), '30', 'weight pre-filled from the target');
    assert.equal(await page.getAttribute('[data-set="0:0:r"]', 'placeholder'), '11');
    for (let i = 0; i < 3; i++) await page.fill(`[data-set="0:${i}:r"]`, '12');
    assert.equal(await page.textContent('#best-0'), '', 'matching your best set is not a new best');
    await page.fill('[data-set="0:0:r"]', '13');
    assert.match(await page.textContent('#best-0'), /New best/);
    assert.equal((await getState()).exercises.filter((x) => /hip thrust/i.test(x.name)).length, 1, 'no duplicate exercise');
  });

  await step('workout log: removing an exercise with sets asks first', async () => {
    page.removeAllListeners('dialog');
    page.once('dialog', (d) => d.dismiss());
    await page.click('[data-act="rmex"][data-xi="0"]');
    assert.equal(await page.locator('[data-set="0:0:r"]').count(), 1, 'kept after cancelling');
    page.on('dialog', (d) => d.accept());
  });

  await step('dashboard: strength progress card switches exercises', async () => {
    await tab('dashboard');
    await page.waitForSelector('#strengthEx');
    const first = await page.inputValue('#strengthEx');
    const ids = await page.$$eval('#strengthEx option', (o) => o.map((x) => x.value));
    assert.ok(ids.length >= 5);
    await page.selectOption('#strengthEx', ids[ids.length - 1]);
    assert.notEqual(await page.inputValue('#strengthEx'), first);
    assert.match(await page.textContent('#strength'), /Sessions/);
  });

  await step('weekly: lifting volume and new bests are shown', async () => {
    await tab('weekly');
    const txt = await page.textContent('article.card >> nth=0');
    assert.match(txt, /Sets lifted/);
    assert.match(txt, /Lifting volume/);
  });

  await step('settings: rename keeps history; delete removes the exercise and its sets', async () => {
    await tab('settings');
    const names = await page.$$eval('[name="exName"]', (els) => els.map((e) => e.value));
    const idx = names.indexOf('Lat pulldown');
    await page.fill(`[name="exName"] >> nth=${idx}`, 'Cable lat pulldown');
    const delIdx = names.indexOf('Hip thrust');
    await page.click(`.ex-edit >> nth=${delIdx} >> [data-act="rmexdef"]`);
    await page.click('#settingsForm button[type="submit"]');
    const s = await getState();
    const lat = s.exercises.find((x) => x.name === 'Cable lat pulldown');
    assert.ok(lat);
    assert.ok(Object.values(s.days).some((e) => (e.exercises || []).some((x) => x.id === lat.id)), 'history kept');
    assert.ok(!s.exercises.some((x) => x.name === 'Hip thrust'));
    assert.ok(!Object.values(s.days).some((e) => (e.exercises || []).some((x) => !s.exercises.find((y) => y.id === x.id))), 'sets removed too');
  });

  await step('settings: switching to lbs converts lifted weights and the weight step', async () => {
    const before = await getState();
    const d = Object.keys(before.days).find((k) => (before.days[k].exercises || []).some((x) => x.sets[0].w));
    const w0 = before.days[d].exercises.find((x) => x.sets[0].w).sets[0].w;
    await page.click('[data-unit="lbs"]');
    assert.equal(await page.inputValue('#s-liftIncrement'), '5');
    await page.click('#settingsForm button[type="submit"]');
    const after = await getState();
    assert.equal(after.days[d].exercises.find((x) => x.sets[0].w).sets[0].w, Math.round(w0 * 2.2046226218 * 10) / 10);
    assert.equal(after.settings.liftIncrement, 5);
    await page.click('[data-unit="kg"]');
    await page.click('#settingsForm button[type="submit"]');
  });

  await step('share preview tags and favicon are set', async () => {
    const og = await page.getAttribute('meta[property="og:image"]', 'content');
    assert.match(og, /icons\/og-image\.png$/);
    assert.equal((await page.request.get(URL + 'icons/og-image.png')).status(), 200);
    assert.equal((await page.request.get(URL + 'icons/favicon-32.png')).status(), 200);
    assert.ok(await page.getAttribute('meta[name="description"]', 'content'));
    assert.equal(await page.title(), '100-Day Progress Tracker');
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
