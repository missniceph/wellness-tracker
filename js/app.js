/* 100-Day Progress Tracker — UI. All data lives in this browser's localStorage. */
(function () {
  'use strict';
  var C = window.Calc;
  var KEY = 'ptracker.v1';
  var THEME_KEY = 'ptracker.theme';
  var LBS_PER_KG = 2.2046226218;
  var CM_PER_IN = 2.54;
  var TABS = ['today', 'dashboard', 'weekly', 'measurements', 'settings'];
  var EXAMPLE_HABITS = [
    { name: 'Read 10 pages', target: 5 },
    { name: 'Stretch 10 minutes', target: 3 },
    { name: 'No screens after 10pm', target: 5 },
    { name: 'Pickleball', target: 2 }
  ];

  var view = document.getElementById('view');
  var tabbar = document.getElementById('tabbar');
  var ui = { tab: 'today', date: null, mWeek: null, strengthEx: null };
  var saveTimer = null;

  // ---------------- storage ----------------
  function emptyState() {
    return { version: 1, settings: null, days: {}, weeks: {}, measurements: {}, exercises: [], measureUnit: 'cm', photoLink: '', lastBackup: null };
  }
  function isObj(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function normalize(s) {
    var base = emptyState();
    if (!isObj(s)) return base;
    base.settings = isObj(s.settings) && C.isValidDate(s.settings.startDate) ? s.settings : null;
    if (base.settings && !Array.isArray(base.settings.habits)) base.settings.habits = [];
    base.days = pickObjects(s.days, C.isValidDate);
    base.weeks = pickObjects(s.weeks, isWeekKey);
    base.measurements = pickObjects(s.measurements, isWeekKey);
    base.measureUnit = s.measureUnit === 'in' ? 'in' : 'cm';
    base.photoLink = typeof s.photoLink === 'string' ? s.photoLink : '';
    base.lastBackup = typeof s.lastBackup === 'string' ? s.lastBackup : null;
    base.exercises = (Array.isArray(s.exercises) ? s.exercises : []).filter(function (x) {
      return isObj(x) && typeof x.id === 'string' && x.id && typeof x.name === 'string' && x.name.trim();
    });
    return base;
  }
  function isWeekKey(k) { return /^\d+$/.test(k) && Number(k) >= 1 && Number(k) <= C.TOTAL_WEEKS; }
  /** Copy only entries whose key passes the test and whose value is an object. */
  function pickObjects(src, keyOk) {
    var out = {};
    if (!isObj(src)) return out;
    Object.keys(src).forEach(function (k) { if (keyOk(k) && isObj(src[k])) out[k] = src[k]; });
    return out;
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? normalize(JSON.parse(raw)) : emptyState();
    } catch (e) {
      return emptyState();
    }
  }
  function checkStorage() {
    try {
      localStorage.setItem('ptracker.test', '1');
      localStorage.removeItem('ptracker.test');
      return true;
    } catch (e) { return false; }
  }
  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      setStatus('Saved ✓');
      return true;
    } catch (e) {
      setStatus('Not saved');
      toast('Couldn’t save. Storage may be full or blocked — export a backup.');
      return false;
    }
  }
  function saveSoon() {
    setStatus('Saving…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 350);
  }
  function flush() { if (saveTimer) saveNow(); }
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });

  var state = load();

  // ---------------- helpers ----------------
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n, dp) {
    if (!C.isNum(n)) return '—';
    return n.toLocaleString('en-US', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 });
  }
  function pct(p) { return C.isNum(p) ? Math.round(p * 100) + '%' : '—'; }
  function unit() { return state.settings ? state.settings.unit : 'kg'; }
  function w(n) { return C.isNum(n) ? fmt(n, 1) + ' ' + unit() : '—'; }
  function signed(n, dp, suffix) {
    if (!C.isNum(n)) return '—';
    var r = Number(n.toFixed(dp));
    var s = r > 0 ? '+' : r < 0 ? '−' : '±';
    return s + fmt(Math.abs(r), dp) + (suffix || '');
  }
  function changeClass(n) {
    if (!C.isNum(n) || Math.abs(n) < 0.05) return '';
    var dir = C.goalDirection(state.settings);
    return (n < 0) === (dir < 0) ? 'down' : 'up';
  }
  function today() { return C.todayStr(); }
  function niceDate(d, opts) {
    var p = d.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-US', opts || { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function ratingClass(r) { return r ? 'r-' + r.split(' ')[0] : ''; }
  function parseNum(v) {
    if (v === null || v === undefined) return null;
    var n = parseFloat(String(v).replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  function uid() { return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function lastDate() { return C.dateForDay(state.settings.startDate, C.TOTAL_DAYS); }
  function clampDate(d) {
    var s = state.settings.startDate;
    if (d < s) return s;
    return d > lastDate() ? lastDate() : d;
  }
  function currentWeek() {
    var d = C.dayNumber(state.settings.startDate, today());
    return Math.max(1, Math.min(C.TOTAL_WEEKS, C.weekOf(Math.max(1, Math.min(d, C.TOTAL_DAYS)))));
  }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function setStatus(msg) {
    var el = document.getElementById('saveStatus');
    if (el) el.textContent = msg;
  }

  /** Saves a file. On phones, opens the share sheet ("Save to Files") when supported. Resolves true if saved/shared. */
  function saveFile(name, text, type) {
    var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.canShare && typeof File === 'function') {
      try {
        var file = new File([text], name, { type: type.split(';')[0] });
        if (navigator.canShare({ files: [file] })) {
          return navigator.share({ files: [file], title: name }).then(function () { return true; }, function (e) {
            if (e && e.name === 'AbortError') return false; // share sheet closed without saving
            download(name, text, type);
            return true;
          });
        }
      } catch (e) { /* fall through to a normal download */ }
    }
    download(name, text, type);
    return Promise.resolve(true);
  }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  // ---------------- components ----------------
  function yn(key, value, label) {
    return '<div class="seg" role="group" aria-label="' + esc(label) + '">' +
      '<button type="button" class="yes" data-yn="' + key + '" data-val="true" aria-pressed="' + (value === true) + '">Yes</button>' +
      '<button type="button" class="no" data-yn="' + key + '" data-val="false" aria-pressed="' + (value === false) + '">No</button></div>';
  }
  function ynRow(key, value, label, sub) {
    return '<div class="yn-row"><div class="name">' + esc(label) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>' +
      yn(key, value, label) + '</div>';
  }
  function scale(key, value, label, lo, hi) {
    var b = '';
    for (var i = 1; i <= 5; i++) {
      b += '<button type="button" data-scale="' + key + '" data-val="' + i + '" aria-pressed="' + (value === i) + '" aria-label="' + esc(label) + ' ' + i + '">' + i + '</button>';
    }
    return '<div class="field"><div class="label" id="lbl-' + key + '">' + esc(label) + '</div>' +
      '<div class="seg scale" role="group" aria-labelledby="lbl-' + key + '">' + b + '</div>' +
      '<div class="scale-labels"><span>1 · ' + esc(lo) + '</span><span>' + esc(hi) + ' · 5</span></div></div>';
  }
  function numField(key, value, label, unitLabel, hintId, opts) {
    opts = opts || {};
    return '<div class="field"><label for="f-' + key + '">' + esc(label) + '</label>' +
      '<div class="input-unit"><input type="number" id="f-' + key + '" data-num="' + key + '" inputmode="' + (opts.int ? 'numeric' : 'decimal') + '"' +
      ' step="' + (opts.int ? '1' : '0.1') + '" min="0" value="' + (C.isNum(value) ? value : '') + '" placeholder="' + esc(opts.placeholder || '') + '" autocomplete="off">' +
      (unitLabel ? '<span>' + esc(unitLabel) + '</span>' : '') + '</div>' +
      (hintId ? '<div class="hint" id="' + hintId + '"></div>' : '') + '</div>';
  }
  function pageHead(title, sub, withStatus) {
    return '<div class="page-head"><div><h1 tabindex="-1">' + esc(title) + '</h1>' + (sub ? '<p class="muted small">' + sub + '</p>' : '') + '</div>' +
      (withStatus ? '<span class="save-status" id="saveStatus"></span>' : '') + '</div>';
  }

  // ---------------- TODAY ----------------
  function entry(date) { return state.days[date] || {}; }
  function setField(date, key, val) {
    var e = state.days[date] ? state.days[date] : {};
    if (key.indexOf('habit:') === 0) {
      var id = key.slice(6);
      e.habits = e.habits || {};
      if (val === null) delete e.habits[id]; else e.habits[id] = val;
      if (!Object.keys(e.habits).length) delete e.habits;
    } else if (val === null || val === '' || val === undefined) {
      delete e[key];
    } else {
      e[key] = val;
    }
    commitDay(date, e);
  }
  /** Store a day, or drop it if nothing is in it. A just-added exercise keeps the day while you fill it in. */
  function commitDay(date, e) {
    if (e.exercises && !e.exercises.length) delete e.exercises;
    if (C.isBlankEntry(e) && !e.exercises) delete state.days[date]; else state.days[date] = e;
    saveSoon();
  }
  function getField(e, key) {
    if (key.indexOf('habit:') === 0) return e.habits ? e.habits[key.slice(6)] : undefined;
    return e[key];
  }

  function renderToday() {
    var s = state.settings;
    var t = today();
    var date = ui.date = clampDate(ui.date || t);
    var day = C.dayNumber(s.startDate, date);
    var e = entry(date);
    var habits = C.activeHabits(s);
    var h = '';
    h += pageHead('Hi, ' + (s.name || 'there'), '100-Day Progress Tracker', true);
    if (s.why) h += '<section class="why"><div class="label">My why</div><p>' + esc(s.why) + '</p></section>';

    h += '<div class="daynav">' +
      '<button type="button" class="arrow" data-act="prev" aria-label="Previous day"' + (date <= s.startDate ? ' disabled' : '') + '>‹</button>' +
      '<label class="daypick"><strong>Day ' + day + ' of 100 · Week ' + C.weekOf(day) + '</strong>' +
      '<span>' + (date === t ? 'Today · ' : '') + esc(niceDate(date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })) + '</span>' +
      '<input type="date" id="datePick" aria-label="Pick a date" value="' + date + '" min="' + s.startDate + '" max="' + lastDate() + '"></label>' +
      '<button type="button" class="arrow" data-act="next" aria-label="Next day"' + (date >= lastDate() ? ' disabled' : '') + '>›</button></div>';
    if (date !== clampDate(t)) h += '<a href="#today" class="today-link" data-act="gotoday">Jump to today</a>';
    if (t < s.startDate) h += '<div class="notice">Your 100 days start on <strong>' + esc(niceDate(s.startDate, { weekday: 'long', month: 'long', day: 'numeric' })) + '</strong>. You can fill in Day 1 ahead of time.</div>';
    if (t > lastDate()) h += '<div class="notice">You finished your 100 days! 🎉 Your entries are still here to look back on.</div>';

    h += '<section class="card"><div class="meter"><div class="track-wrap" style="flex:1"><h2 style="margin-bottom:8px">Daily habits</h2>' +
      '<div class="track"><i id="dhBar"></i></div><div class="hint" id="dhHint"></div></div><div class="big" id="dhPct">0%</div></div></section>';

    h += '<section class="card"><h2><span class="dot"></span>Body</h2>' +
      numField('weight', e.weight, 'Weight', s.unit, 'hint-weight') +
      '<div class="field">' + ynRow('period', e.period, 'Period today?') + '</div>' +
      scale('sleep', e.sleep, 'Sleep quality', 'poor', 'great') + '</section>';

    h += '<section class="card"><h2><span class="dot"></span>Movement</h2>' +
      '<div class="field">' + ynRow('workout', e.workout, 'Worked out?', s.workoutsTarget ? 'Goal: ' + s.workoutsTarget + ' per week' : '') + '</div>' +
      numField('steps', e.steps, 'Steps', '', 'hint-steps', { int: true, placeholder: 'e.g. 5000' }) + '</section>';

    h += '<section class="card" id="workoutCard">' + workoutCard(date) + '</section>';

    h += '<section class="card"><h2><span class="dot"></span>Fuel</h2><div class="row2">' +
      numField('calories', e.calories, 'Calories', 'kcal', 'hint-calories', { int: true }) +
      numField('protein', e.protein, 'Protein', 'g', 'hint-protein', { int: true }) + '</div>' +
      '<div class="field">' + ynRow('water', e.water, 'Hit water goal?') + '</div></section>';

    h += '<section class="card"><h2><span class="dot"></span>How I feel</h2>' +
      scale('stress', e.stress, 'Stress', 'calm', 'very stressed') +
      scale('fatigue', e.fatigue, 'Fatigue', 'energized', 'exhausted') +
      scale('hunger', e.hunger, 'Hunger', 'satisfied', 'very hungry') + '</section>';

    if (habits.length) {
      h += '<section class="card"><h2><span class="dot"></span>My habits</h2>' +
        habits.map(function (hb) {
          return ynRow('habit:' + hb.id, e.habits ? e.habits[hb.id] : undefined, hb.name, hb.target + '× per week');
        }).join('') + '</section>';
    }

    h += '<section class="card"><h2><span class="dot"></span>Mindset</h2>' +
      ynRow('reviewedWhy', e.reviewedWhy, 'Reviewed my why?') +
      ynRow('plannedTomorrow', e.plannedTomorrow, 'Planned tomorrow?') + '</section>';

    var pr = e.priorities || [];
    h += '<section class="card"><h2><span class="dot"></span>Reflection</h2>' +
      '<div class="field"><div class="label">Top 2–3 priorities</div><div class="prio">' +
      [0, 1, 2].map(function (i) {
        return '<input type="text" data-prio="' + i + '" aria-label="Priority ' + (i + 1) + '" placeholder="' + (i + 1) + '." value="' + esc(pr[i] || '') + '" enterkeyhint="next">';
      }).join('') + '</div></div>' +
      '<div class="field"><label for="f-wins">Wins today</label><textarea id="f-wins" data-text="wins" placeholder="Big or small — they all count.">' + esc(e.wins || '') + '</textarea></div>' +
      '<div class="field"><label for="f-notes">Notes</label><textarea id="f-notes" data-text="notes">' + esc(e.notes || '') + '</textarea></div></section>';

    view.innerHTML = h;
    updateTodayLive();
  }

  function updateTodayLive() {
    var s = state.settings, date = ui.date, e = entry(date);
    var p = C.dailyHabitsPct(e, s);
    var bar = document.getElementById('dhBar');
    if (!bar) return;
    bar.style.width = Math.round(p * 100) + '%';
    document.getElementById('dhPct').textContent = pct(p);
    var parts = ['Water', 'Why', 'Plan'];
    if (C.hasProteinTarget(s)) parts.push('Protein');
    var done = [e.water === true, e.reviewedWhy === true, e.plannedTomorrow === true];
    if (C.hasProteinTarget(s)) done.push(C.proteinHit(e, s));
    document.getElementById('dhHint').textContent = parts.map(function (n, i) { return (done[i] ? '✓ ' : '○ ') + n; }).join(' · ');

    var tw = C.trendWeight(state.days, date);
    setHint('hint-weight', tw !== null ? '7-day trend: ' + w(tw) : 'Weigh in to see your 7-day trend', false);
    setHint('hint-steps', s.stepsTarget ? (C.isNum(e.steps) && e.steps >= s.stepsTarget ? '✓ Target hit (' + fmt(s.stepsTarget) + ')' : 'Target: ' + fmt(s.stepsTarget)) : '',
      C.isNum(e.steps) && e.steps >= s.stepsTarget);
    setHint('hint-calories', C.isNum(s.calorieTarget) && s.calorieTarget > 0 ? 'Target: ' + fmt(s.calorieTarget) : '', false);
    setHint('hint-protein', C.hasProteinTarget(s) ? (C.proteinHit(e, s) ? '✓ Target hit (' + s.proteinTarget + ' g)' : 'Target: ' + s.proteinTarget + ' g') : '',
      C.proteinHit(e, s));
  }
  function setHint(id, text, ok) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('ok', !!ok);
  }

  // ---------------- WORKOUT LOG (progressive overload) ----------------
  function exById(id) {
    for (var i = 0; i < state.exercises.length; i++) if (state.exercises[i].id === id) return state.exercises[i];
    return null;
  }
  function wNum(n) { return C.isNum(n) ? String(Number(n.toFixed(2))) : ''; }
  function targetText(tg) {
    var u = unit();
    if (tg.weight === null) return 'Aim for ' + tg.reps + ' reps in your best set';
    if (tg.kind === 'weight') return 'Go up to ' + wNum(tg.weight) + ' ' + u + ' × ' + tg.reps + ' reps';
    return 'Stay at ' + wNum(tg.weight) + ' ' + u + ' and aim for ' + tg.reps + ' reps per set';
  }
  function bestText(date, xi) {
    var x = ((entry(date).exercises) || [])[xi];
    if (!x) return '';
    var sm = C.exerciseHistory(state, x.id).filter(function (h) { return h.date === date; })[0];
    return sm && sm.isBest ? '⭐ New best!' : '';
  }

  function workoutCard(date) {
    var list = entry(date).exercises || [];
    var u = unit();
    var h = '<h2><span class="dot"></span>Workout log</h2>';
    if (!list.length) {
      h += '<p class="muted small" style="margin-top:-4px">Log your sets to track progressive overload. Each exercise shows what you did last time and what to aim for next.</p>';
    }
    list.forEach(function (x, xi) {
      var ex = exById(x.id) || { name: 'Exercise' };
      var last = C.lastSessionBefore(state, x.id, date);
      var tg = last ? C.nextTarget(last.setList, state.settings) : null;
      var phW = tg && tg.weight ? wNum(tg.weight) : '';
      var phR = tg ? String(tg.reps) : '';
      h += '<div class="exercise"><div class="ex-head"><h3>' + esc(ex.name) + '</h3><span class="best" id="best-' + xi + '">' + bestText(date, xi) + '</span>' +
        '<button type="button" class="btn icon" data-act="rmex" data-xi="' + xi + '" aria-label="Remove ' + esc(ex.name) + ' from this day">✕</button></div>';
      if (last) {
        h += '<p class="hint">Last time (' + esc(niceDate(last.date, { month: 'short', day: 'numeric' })) + '): ' + esc(C.setsText(last.setList, u)) + '</p>' +
          (tg ? '<p class="target">' + esc(targetText(tg)) + '</p>' : '');
      } else {
        h += '<p class="hint">First time logging this. Today sets your starting point.</p>';
      }
      h += '<div class="set-grid" role="group" aria-label="' + esc(ex.name) + ' sets"><span class="set-h" aria-hidden="true">Set</span><span class="set-h" aria-hidden="true">' + u + '</span>' +
        '<span aria-hidden="true"></span><span class="set-h" aria-hidden="true">Reps</span><span aria-hidden="true"></span>';
      x.sets.forEach(function (st, si) {
        var lbl = ex.name + ', set ' + (si + 1);
        h += '<span class="set-n" aria-hidden="true">' + (si + 1) + '</span>' +
          '<input type="number" inputmode="decimal" step="any" min="0" data-set="' + xi + ':' + si + ':w" aria-label="' + esc(lbl) + ', weight in ' + u + ' (blank for bodyweight)" placeholder="' + (phW || 'BW') + '" value="' + wNum(st.w) + '">' +
          '<span class="times" aria-hidden="true">×</span>' +
          '<input type="number" inputmode="numeric" step="1" min="0" data-set="' + xi + ':' + si + ':r" aria-label="' + esc(lbl) + ', reps" placeholder="' + phR + '" value="' + (C.isNum(st.r) ? st.r : '') + '">' +
          '<button type="button" class="btn icon" data-act="rmset" data-xi="' + xi + '" data-si="' + si + '" aria-label="Remove ' + esc(lbl) + '">✕</button>';
      });
      h += '</div><button type="button" class="btn add-set" data-act="addset" data-xi="' + xi + '">+ Add set</button></div>';
    });
    var used = list.map(function (x) { return x.id; });
    var recent = C.trainedExercises(state).filter(function (ex) { return used.indexOf(ex.id) < 0; }).slice(0, 8);
    h += '<div class="add-ex"><label for="newEx">Add an exercise</label><div class="add-row">' +
      '<input type="text" id="newEx" list="exList" maxlength="60" placeholder="e.g. Goblet squat" autocomplete="off" enterkeyhint="done">' +
      '<button type="button" class="btn primary" data-act="addex">Add</button></div>' +
      '<datalist id="exList">' + state.exercises.map(function (ex) { return '<option value="' + esc(ex.name) + '">'; }).join('') + '</datalist>';
    if (recent.length) {
      h += '<div class="chips" role="group" aria-label="Your recent exercises">' + recent.map(function (ex) {
        return '<button type="button" class="chip-btn" data-act="addexid" data-id="' + esc(ex.id) + '">+ ' + esc(ex.name) + '</button>';
      }).join('') + '</div>';
    }
    return h + '</div>';
  }
  function refreshWorkout(focusSel) {
    var el = document.getElementById('workoutCard');
    if (!el) return;
    el.innerHTML = workoutCard(ui.date);
    var f = focusSel && el.querySelector(focusSel);
    if (f) f.focus();
  }
  function findOrCreateExercise(name) {
    var key = name.trim().toLowerCase();
    for (var i = 0; i < state.exercises.length; i++) if (state.exercises[i].name.trim().toLowerCase() === key) return state.exercises[i];
    var ex = { id: 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name.trim().slice(0, 60) };
    state.exercises.push(ex);
    return ex;
  }
  function addExerciseToDay(id) {
    var date = ui.date, e = state.days[date] || {};
    e.exercises = e.exercises || [];
    var at = e.exercises.map(function (x) { return x.id; }).indexOf(id);
    if (at < 0) {
      // Pre-fill this session from last time: same number of sets, at the suggested weight.
      var last = C.lastSessionBefore(state, id, date);
      var tg = last ? C.nextTarget(last.setList, state.settings) : null;
      var n = last ? Math.min(Math.max(last.sets, 1), 8) : 3;
      var w = tg && tg.weight ? tg.weight : null;
      var sets = [];
      for (var i = 0; i < n; i++) sets.push({ w: w, r: null });
      e.exercises.push({ id: id, sets: sets });
      at = e.exercises.length - 1;
    }
    commitDay(date, e);
    refreshWorkout('[data-set="' + at + ':0:' + (e.exercises[at].sets[0] && e.exercises[at].sets[0].w ? 'r' : 'w') + '"]');
  }

  // ---------------- DASHBOARD ----------------
  function renderDashboard() {
    var s = state.settings;
    var t = today();
    var d = C.dashboardStats(state, t);
    var weeks = C.allWeekStats(state, t);
    var h = pageHead('Dashboard', esc(d.day < 1 ? 'Starts ' + niceDate(s.startDate) : d.day > 100 ? 'Challenge complete' : 'Day ' + d.day + ' of 100 · Week ' + d.week));

    h += '<div class="tiles">' +
      tile('Days left', fmt(d.daysLeft), '', true) +
      tile('Days logged', fmt(d.daysLogged), ' / 100') +
      tile('Workouts this week', fmt(d.workoutsThisWeek), ' / ' + (s.workoutsTarget || '—')) +
      tile("This week's score", pct(d.weekScore), d.weekRating ? '<br>' + esc(d.weekRating) : '') +
      tile('Starting weight', C.isNum(d.startWeight) ? fmt(d.startWeight, 1) : '—', ' ' + unit()) +
      tile('Current trend weight', C.isNum(d.trendWeight) ? fmt(d.trendWeight, 1) : '—', ' ' + unit() +
        (d.trendAsOf && d.trendAsOf !== t ? '<br>as of ' + esc(niceDate(d.trendAsOf)) : '')) +
      tile('Total change', '<span class="' + changeClass(d.totalChange) + '">' + signed(d.totalChange, 1) + '</span>', ' ' + unit()) +
      tile('Distance to target goal', d.distanceToTarget === 0 ? '✓' : (C.isNum(d.distanceToTarget) ? fmt(d.distanceToTarget, 1) : '—'),
        d.distanceToTarget === 0 ? ' reached' : ' ' + unit()) +
      '</div>';

    // Goal progress
    h += '<div class="two-col"><section class="card"><h2><span class="dot"></span>Goal progress</h2>';
    if (C.isNum(s.startWeight) && C.isNum(s.targetGoal)) {
      h += '<div class="goalbar" role="progressbar" aria-label="Progress to target goal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
        Math.round((d.progress || 0) * 100) + '"><i style="width:' + ((d.progress || 0) * 100).toFixed(1) + '%"></i></div>' +
        '<div class="goal-ends"><span>Start ' + w(s.startWeight) + '</span><strong>' + pct(d.progress || 0) + '</strong><span>Target ' + w(s.targetGoal) + '</span></div>';
    } else {
      h += '<p class="muted small">Add your starting and target weights in Settings to see progress.</p>';
    }
    if (d.milestones.length) {
      h += '<ul class="milestones">' + d.milestones.map(function (m) {
        return '<li class="' + (m.reached ? 'done' : '') + '"><span>' + esc(m.label) + ' · ' + w(m.goal) + '</span><span class="tag">' +
          (m.reached ? 'Reached ✓' : (C.isNum(m.toGo) ? fmt(m.toGo, 1) + ' ' + unit() + ' to go' : '—')) + '</span></li>';
      }).join('') + '</ul>';
    }
    h += '</section>';

    h += '<section class="card"><h2><span class="dot"></span>Last 7 days · averages</h2><div class="avg4">' +
      avgCell('Steps', fmt(d.last7.steps)) + avgCell('Protein', C.isNum(d.last7.protein) ? fmt(d.last7.protein) + ' g' : '—') +
      avgCell('Calories', fmt(d.last7.calories)) + avgCell('Sleep', C.isNum(d.last7.sleep) ? fmt(d.last7.sleep, 1) + '/5' : '—') +
      '</div></section></div>';

    h += '<div class="two-col"><section class="card"><h2><span class="dot"></span>Weight</h2>' + weightChart() +
      '<div class="legend"><span><i style="background:var(--coral)"></i>Daily weigh-in</span><span><i style="background:var(--teal)"></i>7-day trend</span>' +
      (C.isNum(s.targetGoal) ? '<span><i style="background:transparent;border:1.5px dashed var(--coral)"></i>Target</span>' : '') + '</div></section>';

    h += '<section class="card"><h2><span class="dot"></span>Weekly scores</h2>' + scoreChart(weeks, d.week) +
      '<div class="legend"><span class="r-Excellent"><i style="background:var(--r)"></i>90%+ Excellent</span><span class="r-Strong"><i style="background:var(--r)"></i>75%+ Strong</span>' +
      '<span class="r-Building"><i style="background:var(--r)"></i>60%+ Building</span><span class="r-Reset"><i style="background:var(--r)"></i>Reset &amp; refocus</span></div></section></div>';
    h += strengthCard();
    view.innerHTML = h;
  }

  function bestSetOf(sm) {
    var b = null;
    sm.setList.forEach(function (st) {
      var v = sm.bodyweight ? st.r : C.e1rm(st.w, st.r);
      if (v !== null && (b === null || v > b.v)) b = { v: v, st: st };
    });
    return b && b.st;
  }
  function setLabel(st) { return st ? (st.w ? wNum(st.w) + ' ' + unit() + ' × ' + st.r : st.r + ' reps') : '—'; }

  function strengthCard() {
    var trained = C.trainedExercises(state);
    var h = '<section class="card" id="strength"><h2><span class="dot"></span>Strength progress</h2>';
    if (!trained.length) {
      return h + '<p class="empty">Log your sets in the Workout log on the Today screen to see your progressive overload here.</p></section>';
    }
    var id = trained.some(function (ex) { return ex.id === ui.strengthEx; }) ? ui.strengthEx : trained[0].id;
    var sm = C.strengthSummary(state, id);
    var bw = sm.bodyweight;
    var tg = C.nextTarget(sm.latest.setList, state.settings);
    h += '<div class="field"><label for="strengthEx">Exercise</label><select id="strengthEx">' + trained.map(function (ex) {
      return '<option value="' + esc(ex.id) + '"' + (ex.id === id ? ' selected' : '') + '>' + esc(ex.name) + '</option>';
    }).join('') + '</select></div>';
    h += '<div class="avg4 avg3">' +
      avgCell('Sessions', String(sm.sessions)) +
      avgCell('Best set', esc(setLabel(bestSetOf(sm.best)))) +
      avgCell(bw ? 'Best reps vs. first' : 'Est. max vs. first', sm.sessions > 1 && C.isNum(sm.change) ?
        '<span class="' + (sm.change > 0 ? 'down' : sm.change < 0 ? 'up' : '') + '">' + signed(sm.change * 100, 0, '%') + '</span>' : '—') +
      '</div>';
    h += strengthChart(sm);
    h += '<div class="legend"><span><i style="background:var(--teal)"></i>' + (bw ? 'Best set (reps)' : 'Est. 1-rep max') + '</span><span><i style="background:var(--coral)"></i>New best</span></div>';
    if (tg) h += '<p class="target" style="margin-top:12px">Next time: ' + esc(targetText(tg)) + '</p>';
    var recent = sm.history.slice(-5).reverse();
    h += '<div class="table-wrap" tabindex="0" role="region" aria-label="Recent sessions"><table class="hist"><caption class="sr-only">Recent sessions</caption>' +
      '<thead><tr><th>Date</th><th class="wrap">Sets</th>' + (bw ? '' : '<th>Est. max</th>') + '<th><span class="sr-only">New best</span></th></tr></thead><tbody>' +
      recent.map(function (r) {
        return '<tr><td>' + esc(niceDate(r.date, { month: 'short', day: 'numeric' })) + '</td><td class="wrap">' + esc(C.setsText(r.setList, unit())) + '</td>' +
          (bw ? '' : '<td>' + (C.isNum(r.bestE1RM) ? fmt(r.bestE1RM, 1) : '—') + '</td>') + '<td>' + (r.isBest ? '⭐<span class="sr-only">New best</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    if (!bw) h += '<p class="hint">Est. max is an estimated 1-rep max (Epley formula). It lets you compare sets with different reps; you never need to test it.</p>';
    return h + '</section>';
  }

  function strengthChart(sm) {
    var hist = sm.history;
    var pts = hist.map(function (r) { return { r: r, v: sm.bodyweight ? r.maxReps : r.bestE1RM }; }).filter(function (p) { return C.isNum(p.v); });
    if (pts.length < 2) return '<p class="muted small">Log this exercise again to see your progress line.</p>';
    var W = 340, H = 170, L = 34, R = 12, T = 12, B = 22;
    var vs = pts.map(function (p) { return p.v; });
    var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
    var pad = Math.max(sm.bodyweight ? 1 : 0.5, (hi - lo) * 0.15);
    lo = Math.max(0, lo - pad); hi += pad;
    function x(i) { return L + i / (pts.length - 1) * (W - L - R); }
    function y(v) { return T + (hi - v) / (hi - lo) * (H - T - B); }
    var g = '';
    for (var i = 0; i <= 3; i++) {
      var v = lo + (hi - lo) * i / 3;
      g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>' +
        '<text x="' + (L - 5) + '" y="' + (y(v) + 3).toFixed(1) + '" text-anchor="end">' + (sm.bodyweight ? Math.round(v) : v.toFixed(1)) + '</text>';
    }
    g += '<text x="' + L + '" y="' + (H - 6) + '">' + esc(niceDate(pts[0].r.date, { month: 'short', day: 'numeric' })) + '</text>' +
      '<text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(niceDate(pts[pts.length - 1].r.date, { month: 'short', day: 'numeric' })) + '</text>';
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1); }).join(' ');
    var dots = pts.map(function (p, i) {
      return '<circle class="' + (p.r.isBest ? 'pt' : 'pt-plain') + '" r="' + (p.r.isBest ? 4 : 3) + '" cx="' + x(i).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '"><title>' +
        esc(niceDate(p.r.date, { month: 'short', day: 'numeric' })) + ': ' + esc(C.setsText(p.r.setList, unit())) + '</title></circle>';
    }).join('');
    var label = (sm.bodyweight ? 'Best reps' : 'Estimated 1-rep max') + ' over ' + pts.length + ' sessions, from ' +
      (sm.bodyweight ? pts[0].v : pts[0].v.toFixed(1)) + ' to ' + (sm.bodyweight ? pts[pts.length - 1].v : pts[pts.length - 1].v.toFixed(1));
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label) + '">' + g + '<path class="trend" d="' + line + '"/>' + dots + '</svg>';
  }
  function tile(k, v, small, accent) {
    return '<div class="tile' + (accent ? ' accent' : '') + '"><div class="k">' + esc(k) + '</div><div class="v">' + v + '<small>' + (small || '') + '</small></div></div>';
  }
  function avgCell(k, v) { return '<div><div class="v">' + v + '</div><div class="k">' + esc(k) + '</div></div>'; }

  function weightChart() {
    var s = state.settings;
    var ser = C.weightSeries(state);
    if (!ser.length) return '<p class="empty">Log your weight on the Today screen to see your chart.</p>';
    var W = 340, H = 190, L = 34, R = 10, T = 12, B = 22;
    var curDay = Math.max(1, Math.min(C.TOTAL_DAYS, C.dayNumber(s.startDate, today())));
    var maxDay = Math.max(14, curDay, ser[ser.length - 1].day);
    var ys = [];
    ser.forEach(function (p) { ys.push(p.weight); if (C.isNum(p.trend)) ys.push(p.trend); });
    var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
    var showGoal = C.isNum(s.targetGoal) && Math.abs(s.targetGoal - lo) <= Math.max(3, (hi - lo) * 1.5);
    if (showGoal) { lo = Math.min(lo, s.targetGoal); hi = Math.max(hi, s.targetGoal); }
    var pad = Math.max(0.5, (hi - lo) * 0.12);
    lo -= pad; hi += pad;
    function x(day) { return L + (day - 1) / Math.max(1, maxDay - 1) * (W - L - R); }
    function y(v) { return T + (hi - v) / (hi - lo) * (H - T - B); }
    var g = '';
    for (var i = 0; i <= 3; i++) {
      var v = lo + (hi - lo) * i / 3;
      g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>' +
        '<text x="' + (L - 5) + '" y="' + (y(v) + 3).toFixed(1) + '" text-anchor="end">' + v.toFixed(1) + '</text>';
    }
    var ticks = [1];
    for (var td = 10; td <= maxDay; td += (maxDay > 50 ? 20 : 10)) ticks.push(td);
    ticks.forEach(function (td) { g += '<text x="' + x(td).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">D' + td + '</text>'; });
    if (showGoal) {
      g += '<line class="goal" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(s.targetGoal).toFixed(1) + '" y2="' + y(s.targetGoal).toFixed(1) + '"/>' +
        '<text class="goal-label" x="' + (W - R) + '" y="' + (y(s.targetGoal) - 4).toFixed(1) + '" text-anchor="end">Target</text>';
    }
    var line = ser.filter(function (p) { return C.isNum(p.trend); })
      .map(function (p, idx) { return (idx ? 'L' : 'M') + x(p.day).toFixed(1) + ' ' + y(p.trend).toFixed(1); }).join(' ');
    var dots = ser.map(function (p) {
      return '<circle class="pt" r="2.8" cx="' + x(p.day).toFixed(1) + '" cy="' + y(p.weight).toFixed(1) + '"><title>Day ' + p.day + ': ' + p.weight + ' ' + s.unit + '</title></circle>';
    }).join('');
    var last = ser[ser.length - 1];
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Weight chart: ' + ser.length + ' weigh-ins, latest ' +
      last.weight + ' ' + s.unit + ', 7-day trend ' + (C.isNum(last.trend) ? last.trend.toFixed(1) : '—') + '">' +
      g + dots + '<path class="trend" d="' + line + '"/></svg>';
  }

  function scoreChart(weeks, curWeek) {
    var W = 340, H = 170, L = 28, R = 4, T = 16, B = 20;
    var bw = (W - L - R) / 15;
    function y(p) { return T + (1 - p) * (H - T - B); }
    var g = '';
    [0, 0.6, 0.75, 0.9, 1].forEach(function (p) {
      g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(p).toFixed(1) + '" y2="' + y(p).toFixed(1) + '"/>' +
        '<text x="' + (L - 4) + '" y="' + (y(p) + 3).toFixed(1) + '" text-anchor="end">' + Math.round(p * 100) + '</text>';
    });
    weeks.forEach(function (wk, i) {
      var x0 = L + i * bw + 3, bwi = bw - 6, cx = (L + i * bw + bw / 2).toFixed(1);
      g += '<rect class="bar-bg" x="' + x0.toFixed(1) + '" y="' + T + '" width="' + bwi.toFixed(1) + '" height="' + (H - T - B) + '" rx="3"/>';
      if (C.isNum(wk.weeklyScore)) {
        var hgt = Math.max(2, (H - T - B) * wk.weeklyScore);
        g += '<g class="' + ratingClass(wk.rating) + '"><rect class="bar" x="' + x0.toFixed(1) + '" y="' + (H - B - hgt).toFixed(1) + '" width="' + bwi.toFixed(1) +
          '" height="' + hgt.toFixed(1) + '" rx="3"><title>Week ' + wk.week + ': ' + pct(wk.weeklyScore) + ' ' + esc(wk.rating) + '</title></rect></g>';
        if (wk.week === curWeek) g += '<rect class="cur" x="' + (x0 - 1.5).toFixed(1) + '" y="' + (T - 1.5) + '" width="' + (bwi + 3).toFixed(1) + '" height="' + (H - T - B + 3) + '" rx="4"/>';
        g += '<text class="val" x="' + cx + '" y="' + (H - B - hgt - 3).toFixed(1) + '" text-anchor="middle" font-size="8">' + Math.round(wk.weeklyScore * 100) + '</text>';
      }
      g += '<text x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle">' + wk.week + '</text>';
    });
    var started = weeks.filter(function (wk) { return C.isNum(wk.weeklyScore); });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Weekly scores: ' +
      (started.length ? started.map(function (wk) { return 'week ' + wk.week + ' ' + pct(wk.weeklyScore); }).join(', ') : 'no weeks yet') + '">' + g + '</svg>' +
      '<div class="muted small" style="text-align:center;margin-top:2px">Week</div>';
  }

  // ---------------- WEEKLY ----------------
  function renderWeekly() {
    var s = state.settings;
    var weeks = C.allWeekStats(state, today()).filter(function (x) { return x.started; }).reverse();
    var h = pageHead('Weekly review', 'Scores update as you log. Week 15 is days 99–100.');
    if (!weeks.length) {
      h += '<div class="card empty">Week 1 starts on ' + esc(niceDate(s.startDate, { weekday: 'long', month: 'long', day: 'numeric' })) + '.</div>';
    }
    var nextWeek = weeks.length ? weeks[0].week + 1 : 1;
    if (weeks.length && nextWeek <= C.TOTAL_WEEKS) {
      h += '<p class="muted small">Week ' + nextWeek + ' starts ' + esc(niceDate(C.dateForDay(s.startDate, C.weekRange(nextWeek).first), { weekday: 'short', month: 'short', day: 'numeric' })) +
        '. Each new week shows up here when it starts.</p>';
    }
    weeks.forEach(function (x, idx) {
      var rv = state.weeks[x.week] || {};
      var rc = ratingClass(x.rating);
      var first = C.dateForDay(s.startDate, x.firstDay), last = C.dateForDay(s.startDate, x.lastDay);
      h += '<article class="card ' + rc + '" id="week-' + x.week + '">' +
        '<div class="week-head"><div><h2>Week ' + x.week + '</h2><div class="muted small">Days ' + x.firstDay + '–' + x.lastDay + ' · ' +
        esc(niceDate(first, { month: 'short', day: 'numeric' })) + '–' + esc(niceDate(last, { month: 'short', day: 'numeric' })) + '</div>' +
        '<div class="muted small">' + x.daysSoFar + ' of ' + x.weekLength + ' days so far · ' + x.daysLogged + ' logged</div></div>' +
        '<div class="week-score"><div class="pct">' + pct(x.weeklyScore) + '</div><span class="chip">' + esc(x.rating || '') + '</span></div></div>' +
        '<div class="subscores"><div><div class="k">Fitness score</div><div class="v">' + pct(x.fitnessScore) + '</div></div>' +
        '<div><div class="k">Habit score</div><div class="v">' + pct(x.habitScore) + '</div></div></div>' +
        '<dl class="stats">' +
        stat('Avg weight', w(x.avgWeight)) +
        stat(x.week === 1 ? 'vs. start' : 'vs. last week', '<span class="' + changeClass(x.weightChange) + '">' + signed(x.weightChange, 1, ' ' + unit()) + '</span>') +
        stat('Workouts / goal', x.workouts + (C.isNum(x.workoutTarget) ? ' / ' + fmt(x.workoutTarget, x.daysSoFar === 7 ? 0 : 1) : '')) +
        stat('Workout %', pct(x.workoutPct)) +
        stat('Avg steps', fmt(x.avgSteps)) +
        stat('Steps %', pct(x.stepsPct)) +
        stat('Avg calories', fmt(x.avgCalories)) +
        stat('Avg protein', C.isNum(x.avgProtein) ? fmt(x.avgProtein) + ' g' : '—') +
        stat('Sleep', C.isNum(x.avgSleep) ? fmt(x.avgSleep, 1) + '/5' : '—') +
        stat('Stress', C.isNum(x.avgStress) ? fmt(x.avgStress, 1) + '/5' : '—') +
        stat('Fatigue', C.isNum(x.avgFatigue) ? fmt(x.avgFatigue, 1) + '/5' : '—') +
        stat('Hunger', C.isNum(x.avgHunger) ? fmt(x.avgHunger, 1) + '/5' : '—') +
        stat('Daily habits', pct(x.dailyHabitsPct)) +
        stat('Extra habits', pct(x.extraHabitsPct)) +
        (state.exercises.length ?
          stat('Sets lifted', String(x.liftSets)) +
          stat('New bests', x.newBests ? '⭐ ' + x.newBests : '0') +
          stat('Lifting volume', x.liftVolume ? fmt(x.liftVolume) + ' ' + unit() : '—') +
          stat('vs. last week', C.isNum(x.liftVolumeChange) ? '<span class="' + (x.liftVolumeChange > 0 ? 'down' : x.liftVolumeChange < 0 ? 'up' : '') + '">' +
            signed(x.liftVolumeChange * 100, 0, '%') + '</span>' : '—') : '') +
        '</dl>';
      if (x.habits.length) {
        h += '<div class="habit-list">' + x.habits.map(function (hb) {
          return '<div class="h"><span>' + esc(hb.name) + '</span><span class="muted">' + hb.yes + ' / ' + fmt(hb.expected, x.daysSoFar === 7 ? 0 : 1) + '</span>' +
            '<div class="track"><i style="width:' + Math.round(hb.pct * 100) + '%"></i></div></div>';
        }).join('') + '</div>';
      }
      var hasText = rv.wins || rv.challenges || rv.adjustment;
      h += '<details class="reflect"' + (idx === 0 || hasText ? ' open' : '') + '><summary>Reflection</summary>' +
        wText(x.week, 'wins', 'Wins this week', rv.wins) +
        wText(x.week, 'challenges', 'Challenges', rv.challenges) +
        wText(x.week, 'adjustment', 'One adjustment for next week', rv.adjustment) + '</details></article>';
    });
    view.innerHTML = h;
  }
  function stat(k, v) { return '<div><dt>' + esc(k) + '</dt><dd>' + v + '</dd></div>'; }
  function wText(week, key, label, val) {
    var id = 'w' + week + '-' + key;
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><textarea id="' + id + '" data-week="' + week + '" data-wtext="' + key + '">' + esc(val || '') + '</textarea></div>';
  }

  // ---------------- MEASUREMENTS ----------------
  function toDisplay(cm) { return state.measureUnit === 'in' ? cm / CM_PER_IN : cm; }
  function fromDisplay(v) { return state.measureUnit === 'in' ? v * CM_PER_IN : v; }

  function renderMeasurements() {
    var s = state.settings;
    var cw = currentWeek();
    var wk = ui.mWeek = ui.mWeek || cw;
    var m = state.measurements[wk] || {};
    var u = state.measureUnit;
    var ch = C.measurementChanges(state.measurements, wk);
    var h = pageHead('Measurements', 'Measure once a week, same time of day.', true);

    h += '<section class="card"><div class="row2">' +
      '<div class="field"><label for="mWeek">Week</label><select id="mWeek">' +
      Array.apply(null, { length: C.TOTAL_WEEKS }).map(function (_, i) {
        var n = i + 1;
        return '<option value="' + n + '"' + (n === wk ? ' selected' : '') + '>Week ' + n + (C.hasMeasurements(state.measurements[n]) ? ' ✓' : '') + '</option>';
      }).join('') + '</select></div>' +
      '<div class="field"><div class="label">Units</div><div class="seg" role="group" aria-label="Measurement units">' +
      '<button type="button" data-munit="cm" aria-pressed="' + (u === 'cm') + '">cm</button>' +
      '<button type="button" data-munit="in" aria-pressed="' + (u === 'in') + '">in</button></div></div></div>' +
      '<div class="field"><label for="mDate">Date measured</label><input type="date" id="mDate" data-mdate="1" value="' + esc(m.date || '') + '"></div></section>';

    h += '<section class="card"><h2><span class="dot"></span>Week ' + wk + ' (' + u + ')</h2>';
    C.MEASURE_FIELDS.forEach(function (f) {
      var c = ch && ch.fields[f.key];
      h += '<div class="m-row"><label for="m-' + f.key + '">' + esc(f.label) +
        '<small class="' + changeClass(c) + '" id="mc-' + f.key + '">' + changeText(c, ch) + '</small></label>' +
        '<input type="number" inputmode="decimal" step="0.1" min="0" id="m-' + f.key + '" data-meas="' + f.key + '" value="' +
        (C.isNum(m[f.key]) ? Number(toDisplay(m[f.key]).toFixed(1)) : '') + '"></div>';
    });
    var tot = C.measurementTotal(m);
    h += '<div class="m-row"><strong>Total of all</strong><strong style="text-align:right" id="mTotal">' + (C.isNum(tot) ? fmt(toDisplay(tot), 1) + ' ' + u + countText(m) : '—') +
      '<small class="' + changeClass(ch && ch.total) + '" style="display:block" id="mc-total">' + changeText(ch && ch.total, ch) + '</small></strong></div></section>';

    var weeksWith = Object.keys(state.measurements).map(Number).filter(function (n) { return C.hasMeasurements(state.measurements[n]); }).sort(function (a, b) { return a - b; });
    if (weeksWith.length) {
      h += '<section class="card"><h2><span class="dot"></span>History</h2><div class="table-wrap" tabindex="0" role="region" aria-label="Measurement history"><table class="hist"><caption class="sr-only">Measurements by week (' + u + ')</caption><thead><tr><th>Week</th><th>Date</th><th>Waist (navel)</th><th>Hips</th><th>Total</th><th>Change</th></tr></thead><tbody>' +
        weeksWith.map(function (n) {
          var mm = state.measurements[n], cc = C.measurementChanges(state.measurements, n), t = C.measurementTotal(mm);
          return '<tr><td>' + n + '</td><td>' + (mm.date ? esc(niceDate(mm.date, { month: 'short', day: 'numeric' })) : '—') + '</td><td>' +
            (C.isNum(mm.waistNavel) ? fmt(toDisplay(mm.waistNavel), 1) : '—') + '</td><td>' + (C.isNum(mm.hips) ? fmt(toDisplay(mm.hips), 1) : '—') + '</td><td>' +
            fmt(toDisplay(t), 1) + '</td><td class="' + changeClass(cc && cc.total) + '">' + (cc && cc.baseWeek !== n ? signed(toDisplay(cc.total), 1) : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div><p class="hint">Change compares only the body parts measured in both weeks, so skipping the optional calf won’t skew it.</p></section>';
    }

    h += '<section class="card"><h2><span class="dot"></span>Progress photos</h2><div class="field"><label for="photoLink">Photo folder link</label>' +
      '<input type="url" id="photoLink" inputmode="url" placeholder="https://photos.google.com/…" value="' + esc(state.photoLink) + '"></div>' +
      (safeLink(state.photoLink) ? '<a class="btn block" style="display:flex;align-items:center;justify-content:center;text-decoration:none" target="_blank" rel="noopener" href="' + esc(safeLink(state.photoLink)) + '">Open my photo folder ↗</a>' : '') +
      '<p class="hint">Photos stay in your own folder (Google Photos, iCloud, Drive…). This app only saves the link.</p></section>';
    view.innerHTML = h;
  }
  function changeText(c, ch) {
    if (!ch) return '';
    if (!C.isNum(c)) return '';
    return signed(toDisplay(c), 1, ' ' + state.measureUnit) + ' since wk ' + ch.baseWeek;
  }
  function countText(m) {
    var n = C.MEASURE_FIELDS.filter(function (f) { return C.isNum(m[f.key]); }).length;
    return n && n < C.MEASURE_FIELDS.length ? ' (' + n + ' of ' + C.MEASURE_FIELDS.length + ')' : '';
  }
  function safeLink(u) {
    u = (u || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { var p = new URL(u); return /^https?:$/.test(p.protocol) ? p.href : ''; } catch (e) { return ''; }
  }
  function updateMeasureLive() {
    var wk = ui.mWeek, m = state.measurements[wk] || {}, ch = C.measurementChanges(state.measurements, wk);
    C.MEASURE_FIELDS.forEach(function (f) {
      var el = document.getElementById('mc-' + f.key);
      var c = ch && ch.fields[f.key];
      el.textContent = changeText(c, ch);
      el.className = changeClass(c);
    });
    var tot = C.measurementTotal(m);
    var te = document.getElementById('mTotal');
    te.firstChild.textContent = C.isNum(tot) ? fmt(toDisplay(tot), 1) + ' ' + state.measureUnit + countText(m) : '—';
    var tc = document.getElementById('mc-total');
    tc.textContent = changeText(ch && ch.total, ch);
    tc.className = changeClass(ch && ch.total);
  }

  // ---------------- SETTINGS / SETUP ----------------
  function settingsForm(s, isSetup) {
    var habits = (s.habits || []).slice(0, 5);
    while (habits.length < 5) habits.push({ id: '', name: '', target: 3 });
    function n(v) { return C.isNum(v) ? v : ''; }
    var u = s.unit || 'kg';
    var h = '<form id="settingsForm" novalidate>';
    h += '<section class="card"><h2><span class="dot"></span>About me</h2>' +
      '<div class="field"><label for="s-name">Name</label><input type="text" id="s-name" name="name" maxlength="40" value="' + esc(s.name || '') + '" autocomplete="given-name"></div>' +
      '<div class="field"><label for="s-start">Challenge start date (Day 1)</label><input type="date" id="s-start" name="startDate" value="' + esc(s.startDate || '') + '" required aria-describedby="s-start-hint formErr">' +
      '<div class="hint" id="s-start-hint"></div></div>' +
      '<div class="field"><label for="s-why">My why</label><textarea id="s-why" name="why" maxlength="500" placeholder="The version of me I’m building is…">' + esc(s.why || '') + '</textarea>' +
      '<div class="hint">Shown at the top of your Today screen.</div></div></section>';

    h += '<section class="card"><h2><span class="dot"></span>Weight goals</h2>' +
      '<div class="field"><div class="label">Weight unit</div><div class="seg" role="group" aria-label="Weight unit">' +
      '<button type="button" data-unit="kg" aria-pressed="' + (u === 'kg') + '">kg</button><button type="button" data-unit="lbs" aria-pressed="' + (u === 'lbs') + '">lbs</button></div>' +
      '<input type="hidden" name="unit" value="' + u + '"><div class="hint" id="unitHint" aria-live="polite"></div></div>' +
      '<div class="row2">' + sNum('startWeight', 'Starting weight', n(s.startWeight), 0.1) + sNum('minGoal', 'Minimum goal', n(s.minGoal), 0.1) + '</div>' +
      '<div class="row2">' + sNum('targetGoal', 'Target goal', n(s.targetGoal), 0.1) + sNum('dreamGoal', 'Dream goal', n(s.dreamGoal), 0.1) + '</div></section>';

    h += '<section class="card"><h2><span class="dot"></span>Daily & weekly targets</h2>' +
      '<div class="row2">' + sNum('stepsTarget', 'Daily steps', n(s.stepsTarget), 1) + sNum('workoutsTarget', 'Workouts / week', n(s.workoutsTarget), 1) + '</div>' +
      '<div class="row2">' + sNum('proteinTarget', 'Protein (g)', n(s.proteinTarget), 1, 'Optional') + sNum('calorieTarget', 'Calories', n(s.calorieTarget), 1, 'Optional') + '</div></section>';

    h += '<section class="card"><h2><span class="dot"></span>Extra habits (up to 5)</h2><p class="hint" style="margin-top:-6px;margin-bottom:12px">Pick how many days a week you aim for. Renaming a habit keeps its history; ✕ removes it.</p>' +
      habits.map(function (hb, i) {
        var opts = '';
        for (var d = 1; d <= 7; d++) opts += '<option value="' + d + '"' + (Number(hb.target) === d ? ' selected' : '') + '>' + d + '× / wk</option>';
        return '<div class="habit-edit"><input type="text" name="habitName" maxlength="60" data-hid="' + esc(hb.id || '') + '" aria-label="Habit ' + (i + 1) + ' name" placeholder="Habit ' + (i + 1) + '" value="' + esc(hb.name || '') + '">' +
          '<select name="habitTarget" aria-label="Habit ' + (i + 1) + ' days per week">' + opts + '</select>' +
          '<button type="button" class="btn icon" data-act="rmhabit" aria-label="Remove habit ' + (i + 1) + '">✕</button></div>';
      }).join('') + '</section>';
    var ls = C.liftSettings(s);
    function repOpts(sel) { var o = ''; for (var r = 1; r <= 30; r++) o += '<option value="' + r + '"' + (r === sel ? ' selected' : '') + '>' + r + '</option>'; return o; }
    h += '<section class="card"><h2><span class="dot"></span>Strength training</h2>' +
      '<p class="hint" style="margin-top:-6px;margin-bottom:12px">Used for the “aim for” suggestions in your Workout log. When every set reaches the top of your rep range, it suggests going up one weight step.</p>' +
      '<div class="row2"><div class="field"><label for="s-repLow">Reps: from</label><select id="s-repLow" name="repLow">' + repOpts(ls.lo) + '</select></div>' +
      '<div class="field"><label for="s-repHigh">to</label><select id="s-repHigh" name="repHigh">' + repOpts(ls.hi) + '</select></div></div>' +
      '<div class="field"><label for="s-liftIncrement">Weight step (<span class="unit-lbl">' + u + '</span>)</label>' +
      '<input type="number" id="s-liftIncrement" name="liftIncrement" inputmode="decimal" step="any" min="0" value="' + ls.inc + '"></div>';
    if (state.exercises.length && !isSetup) {
      h += '<div class="field"><div class="label">My exercises</div><p class="hint" style="margin-top:0">Renaming keeps the history. ✕ deletes the exercise and all its logged sets.</p>' +
        state.exercises.map(function (ex, i) {
          return '<div class="habit-edit ex-edit"><input type="text" name="exName" maxlength="60" data-exid="' + esc(ex.id) + '" aria-label="Exercise ' + (i + 1) + ' name" value="' + esc(ex.name) + '">' +
            '<button type="button" class="btn icon" data-act="rmexdef" aria-label="Delete ' + esc(ex.name) + '">✕</button></div>';
        }).join('') + '</div>';
    }
    h += '</section>';
    h += '<div id="formErr" class="err" role="alert"></div>';
    h += '<button type="submit" class="btn primary block" style="margin-bottom:14px">' + (isSetup ? 'Start my 100 days' : 'Save settings') + '</button></form>';
    return h;
  }
  function sNum(name, label, v, step, placeholder) {
    return '<div class="field"><label for="s-' + name + '">' + esc(label) + '</label><input type="number" id="s-' + name + '" name="' + name + '" inputmode="' +
      (step === 1 ? 'numeric' : 'decimal') + '" step="' + step + '" min="0" value="' + v + '"' + (placeholder ? ' placeholder="' + placeholder + '"' : '') + '></div>';
  }

  function renderSetup() {
    var draft = {
      name: 'Nice', startDate: today(), unit: 'kg', stepsTarget: 5000, workoutsTarget: 4,
      habits: EXAMPLE_HABITS.map(function (x) { return { id: '', name: x.name, target: x.target }; })
    };
    var h = '<div class="setup-hero"><img src="icons/icon.svg" alt=""><h1>100-Day Progress Tracker</h1>' +
      '<p>Let’s set up your 100 days. You can change any of this later in Settings.</p></div>';
    h += settingsForm(draft, true);
    h += '<section class="card"><h2>Just looking?</h2><p class="muted small" style="margin-top:0">Load sample data to try every screen first. You can clear it in Settings.</p>' +
      '<button type="button" class="btn block" data-act="sample">Load sample data</button></section>';
    view.innerHTML = h;
    updateStartHint();
  }

  function renderSettings() {
    var s = state.settings;
    var theme = getTheme();
    var h = pageHead('Settings', 'Everything is saved only on this device.');
    h += settingsForm(s, false);
    h += '<section class="card"><h2><span class="dot"></span>Appearance</h2><div class="seg" role="group" aria-label="Theme">' +
      ['auto', 'light', 'dark'].map(function (t) {
        return '<button type="button" data-theme-set="' + t + '" aria-pressed="' + (theme === t) + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</button>';
      }).join('') + '</div></section>';
    h += '<section class="card"><h2><span class="dot"></span>Backup</h2>' +
      '<p class="muted small" style="margin-top:0">Your data lives only in this browser. Export a backup every week or so and keep it in your Files / Drive. ' +
      (state.lastBackup ? 'Last backup: <strong>' + esc(niceDate(state.lastBackup, { month: 'short', day: 'numeric', year: 'numeric' })) + '</strong>.' : '<strong>No backup yet.</strong>') + '</p>' +
      '<div class="btn-grid"><button type="button" class="btn primary" data-act="export">Export Backup</button>' +
      '<button type="button" class="btn" data-act="import">Import Backup</button></div>' +
      '<button type="button" class="btn block" style="margin-top:10px" data-act="csv">Export CSV (for spreadsheets)</button>' +
      '<input type="file" id="importFile" accept="application/json,.json" hidden></section>';
    h += '<section class="card"><h2><span class="dot"></span>Try it out</h2><div class="btn-grid">' +
      '<button type="button" class="btn" data-act="sample">Load sample data</button>' +
      '<button type="button" class="btn danger" data-act="clear">Clear all data</button></div></section>';
    view.innerHTML = h;
    updateStartHint();
  }

  function updateStartHint() {
    var el = document.getElementById('s-start'), hint = document.getElementById('s-start-hint');
    if (!el || !hint) return;
    if (C.isValidDate(el.value)) {
      var end = C.dateForDay(el.value, 100);
      var d = C.dayNumber(el.value, today());
      hint.textContent = 'Day 100 is ' + niceDate(end, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) +
        (d >= 1 && d <= 100 ? ' · today is Day ' + d : '');
    } else hint.textContent = '';
  }

  function readSettingsForm(form) {
    var prev = state.settings || {};
    function num(name) { var v = parseNum(form.elements[name].value); return v !== null && v >= 0 ? v : null; }
    var names = form.querySelectorAll('[name="habitName"]');
    var targets = form.querySelectorAll('[name="habitTarget"]');
    var habits = [];
    for (var i = 0; i < names.length; i++) {
      var nm = names[i].value.trim();
      if (!nm) continue;
      habits.push({ id: names[i].getAttribute('data-hid') || uid(), name: nm.slice(0, 60), target: Math.max(1, Math.min(7, Number(targets[i].value) || 1)) });
    }
    return {
      name: form.elements.namedItem('name').value.trim().slice(0, 40),
      startDate: form.elements.startDate.value,
      unit: form.elements.unit.value === 'lbs' ? 'lbs' : 'kg',
      startWeight: num('startWeight'), minGoal: num('minGoal'), targetGoal: num('targetGoal'), dreamGoal: num('dreamGoal'),
      stepsTarget: num('stepsTarget'), workoutsTarget: num('workoutsTarget'),
      proteinTarget: num('proteinTarget'), calorieTarget: num('calorieTarget'),
      why: form.elements.why.value.trim().slice(0, 500),
      habits: habits,
      repLow: Number(form.elements.repLow.value) || 8,
      repHigh: Math.max(Number(form.elements.repHigh.value) || 12, Number(form.elements.repLow.value) || 8),
      liftIncrement: num('liftIncrement') || null,
      _prevUnit: prev.unit
    };
  }

  function convertWeights(factor) {
    Object.keys(state.days).forEach(function (d) {
      var e = state.days[d];
      if (C.isNum(e.weight)) e.weight = Math.round(e.weight * factor * 10) / 10;
      (e.exercises || []).forEach(function (x) {
        (x.sets || []).forEach(function (st) { if (C.isNum(st.w)) st.w = Math.round(st.w * factor * 10) / 10; });
      });
    });
  }

  function submitSettings(form) {
    var s = readSettingsForm(form);
    var err = document.getElementById('formErr');
    var startEl = form.elements.startDate;
    if (!C.isValidDate(s.startDate)) {
      err.textContent = 'Please choose your challenge start date (Day 1).';
      startEl.setAttribute('aria-invalid', 'true');
      startEl.focus();
      return;
    }
    startEl.removeAttribute('aria-invalid');
    var prevUnit = s._prevUnit;
    delete s._prevUnit;
    var isSetup = !state.settings;
    // Exercise renames / deletions
    var removed = [];
    Array.prototype.forEach.call(form.querySelectorAll('[name="exName"]'), function (inp) {
      var ex = exById(inp.getAttribute('data-exid'));
      if (!ex) return;
      if (inp.getAttribute('data-removed') === '1') removed.push(ex);
      else if (inp.value.trim()) ex.name = inp.value.trim().slice(0, 60);
    });
    if (removed.length) {
      if (!window.confirm('Delete ' + removed.map(function (ex) { return ex.name; }).join(', ') + ' and every set you logged for ' + (removed.length > 1 ? 'them' : 'it') + '?')) return;
      var ids = removed.map(function (ex) { return ex.id; });
      state.exercises = state.exercises.filter(function (ex) { return ids.indexOf(ex.id) < 0; });
      Object.keys(state.days).forEach(function (d) {
        var e = state.days[d];
        if (!e.exercises) return;
        e.exercises = e.exercises.filter(function (x) { return ids.indexOf(x.id) < 0; });
        if (!e.exercises.length) delete e.exercises;
        if (C.isBlankEntry(e) && !e.exercises) delete state.days[d];
      });
    }
    if (!isSetup && prevUnit && prevUnit !== s.unit) {
      convertWeights(s.unit === 'lbs' ? LBS_PER_KG : 1 / LBS_PER_KG);
    }
    state.settings = s;
    if (!saveNow()) return;
    if (isSetup) {
      ui.date = null;
      toast('You’re all set. Let’s go!');
      go('today');
    } else {
      toast('Settings saved');
      render();
    }
  }

  function getTheme() {
    try { var t = localStorage.getItem(THEME_KEY); return t === 'light' || t === 'dark' ? t : 'auto'; } catch (e) { return 'auto'; }
  }
  function setTheme(t) {
    try { if (t === 'auto') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, t); } catch (e) {}
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  // ---------------- backup ----------------
  function exportBackup() {
    flush();
    var data = JSON.parse(JSON.stringify(state));
    data.app = '100-Day Progress Tracker';
    data.exportedAt = new Date().toISOString();
    data.lastBackup = today();
    saveFile('100-day-tracker-backup-' + today() + '.json', JSON.stringify(data, null, 2), 'application/json').then(function (ok) {
      if (!ok) return;
      state.lastBackup = today();
      saveNow();
      toast('Backup saved');
      if (ui.tab === 'settings') renderSettings();
    });
  }
  function exportCSV() {
    flush();
    saveFile('100-day-tracker-' + today() + '.csv', '\ufeff' + C.toCSV(state), 'text/csv;charset=utf-8').then(function (ok) {
      if (ok) toast('CSV saved');
    });
  }
  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (e) { toast('That file isn’t a valid backup (not JSON).'); return; }
      if (!isObj(data) || !isObj(data.settings) || !C.isValidDate(data.settings.startDate) || !isObj(data.days || {})) {
        toast('That file doesn’t look like a 100-Day Tracker backup.'); return;
      }
      var n = Object.keys(data.days || {}).length;
      if (!window.confirm('Replace everything on this device with this backup?\n\n' + n + ' logged day' + (n === 1 ? '' : 's') + ', starting ' + data.settings.startDate + '.')) return;
      state = normalize(data);
      ui.date = null; ui.mWeek = null;
      if (saveNow()) toast('Backup restored');
      render();
    };
    reader.onerror = function () { toast('Couldn’t read that file.'); };
    reader.readAsText(file);
  }

  // ---------------- sample data ----------------
  function sampleData() {
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    function pick(p) { return rnd() < p; }
    var start = C.addDays(today(), -31); // today = Day 32 (mid-week 5)
    var habits = EXAMPLE_HABITS.map(function (x, i) { return { id: 'sample' + i, name: x.name, target: x.target }; });
    var s = {
      name: 'Nice', startDate: start, unit: 'kg', startWeight: 72, minGoal: 69, targetGoal: 66, dreamGoal: 63,
      stepsTarget: 5000, workoutsTarget: 4, proteinTarget: 100, calorieTarget: 1600,
      why: 'I’m building a strong, calm, energized version of me — someone who keeps the promises I make to myself.',
      habits: habits
    };
    var days = {};
    var blanks = { 6: 1, 17: 1, 18: 1, 26: 1 };
    var exercises = [
      { id: 'xsq', name: 'Goblet squat' }, { id: 'xbp', name: 'Dumbbell bench press' }, { id: 'xpu', name: 'Push-ups' },
      { id: 'xrdl', name: 'Romanian deadlift' }, { id: 'xlat', name: 'Lat pulldown' }
    ];
    var prog = { xsq: { w: 12, r: 8 }, xbp: { w: 6, r: 9 }, xpu: { w: null, r: 6 }, xrdl: { w: 16, r: 8 }, xlat: { w: 25, r: 10 } };
    var nextA = true;
    function session(id) {
      var p = prog[id], sets = [];
      for (var k = 0; k < 3; k++) sets.push({ w: p.w, r: Math.max(1, p.r - (k === 2 && rnd() < 0.4 ? 1 : 0)) });
      if (p.w === null) p.r += rnd() < 0.7 ? 1 : 0;
      else if (sets.every(function (st) { return st.r >= 12; })) { p.w += 2.5; p.r = 8; }
      else p.r = Math.min(12, p.r + (rnd() < 0.75 ? 1 : 0));
      return { id: id, sets: sets };
    }
    var wins = ['Chose grilled over fried at lunch', 'Walked to the market', 'Morning workout before work', 'Slept before 11', 'Said no to the extra rice', 'Played pickleball with friends'];
    for (var d = 1; d <= 32; d++) {
      if (blanks[d]) continue;
      var date = C.dateForDay(start, d);
      var e = {};
      var isToday = d === 32;
      if (pick(0.8) || d === 1) e.weight = Math.round((72 - d * 0.085 + (rnd() - 0.5) * 0.9) * 10) / 10;
      e.period = d >= 12 && d <= 16;
      e.sleep = 2 + Math.floor(rnd() * 4);
      e.workout = pick(0.6);
      if (e.workout && !isToday) {
        e.exercises = (nextA ? ['xsq', 'xbp', 'xpu'] : ['xrdl', 'xlat']).map(session);
        nextA = !nextA;
      }
      e.steps = Math.round((3000 + rnd() * 5500) / 10) * 10;
      e.water = pick(0.75);
      if (!isToday) {
        e.calories = Math.round((1400 + rnd() * 450) / 10) * 10;
        e.protein = Math.round(70 + rnd() * 50);
        e.stress = 1 + Math.floor(rnd() * 4);
        e.fatigue = 1 + Math.floor(rnd() * 4);
        e.hunger = 1 + Math.floor(rnd() * 4);
        e.reviewedWhy = pick(0.8);
        e.plannedTomorrow = pick(0.7);
        e.habits = {};
        habits.forEach(function (hb) { e.habits[hb.id] = pick(hb.target / 7 + 0.05); });
        if (pick(0.5)) e.wins = wins[Math.floor(rnd() * wins.length)];
      }
      e.priorities = ['Workout', 'Prep healthy lunch', isToday ? '' : 'Read before bed'].filter(Boolean);
      days[date] = e;
    }
    var weeks = {
      1: { wins: 'Logged every day except one. Hit my steps most days.', challenges: 'Late-night snacking on Friday.', adjustment: 'Prep a high-protein snack for the evenings.' },
      2: { wins: 'Four workouts!', challenges: 'Period week — low energy.', adjustment: 'Swap one workout for a long walk when tired.' },
      3: { wins: 'Back on track after a missed weekend.', challenges: 'Skipped two days of logging.', adjustment: 'Set a 9pm reminder to log.' }
    };
    var meas = {
      1: { date: C.dateForDay(start, 1), chest: 92, rightArm: 31, leftArm: 30.5, waistAbove: 80, waistNavel: 86, lowerBelly: 94, hips: 104, rightThigh: 59, leftThigh: 58.5, calf: 37 },
      3: { date: C.dateForDay(start, 15), chest: 91.2, rightArm: 30.6, leftArm: 30.2, waistAbove: 78.5, waistNavel: 84.4, lowerBelly: 92.8, hips: 103, rightThigh: 58.4, leftThigh: 58, calf: 36.8 },
      5: { date: C.dateForDay(start, 29), chest: 90.6, rightArm: 30.3, leftArm: 30, waistAbove: 77.4, waistNavel: 83.2, lowerBelly: 91.5, hips: 102.1, rightThigh: 57.9, leftThigh: 57.6 }
    };
    return { version: 1, settings: s, days: days, weeks: weeks, measurements: meas, exercises: exercises, measureUnit: 'cm', photoLink: '', lastBackup: null };
  }
  function loadSample() {
    var has = state.settings && Object.keys(state.days).length;
    if (has && !window.confirm('Load sample data?\n\nThis REPLACES your current data. Export a backup first if you want to keep it.')) return;
    state = normalize(sampleData());
    ui.date = null; ui.mWeek = null;
    saveNow();
    toast('Sample data loaded — explore!');
    go('today');
  }
  function clearAll() {
    if (!window.confirm('Clear ALL data?\n\nThis deletes your settings, every day you logged, weekly reviews and measurements from this device. It can’t be undone.')) return;
    if (!window.confirm('Are you sure? Tip: tap Cancel and Export Backup first.')) return;
    state = emptyState();
    try { localStorage.removeItem(KEY); } catch (e) {}
    ui.date = null; ui.mWeek = null;
    toast('All data cleared');
    location.hash = '';
    render();
  }

  // ---------------- routing ----------------
  function go(tab) {
    if (location.hash !== '#' + tab) location.hash = tab;
    else render();
  }
  function render() {
    var setup = !state.settings;
    tabbar.hidden = setup;
    if (setup) { renderSetup(); return; }
    var tab = (location.hash || '').replace('#', '');
    ui.tab = TABS.indexOf(tab) >= 0 ? tab : 'today';
    Array.prototype.forEach.call(tabbar.querySelectorAll('a'), function (a) {
      if (a.getAttribute('data-tab') === ui.tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    ({ today: renderToday, dashboard: renderDashboard, weekly: renderWeekly, measurements: renderMeasurements, settings: renderSettings })[ui.tab]();
  }
  window.addEventListener('hashchange', function () {
    flush();
    render();
    window.scrollTo(0, 0);
    var h1 = view.querySelector('h1');
    if (h1) h1.focus({ preventScroll: true });
  });

  // ---------------- events ----------------
  view.addEventListener('click', function (ev) {
    var b = ev.target.closest('button, a[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'prev' || act === 'next') {
      flush();
      ui.date = clampDate(C.addDays(ui.date, act === 'prev' ? -1 : 1));
      renderToday();
      return;
    }
    if (act === 'gotoday') { ev.preventDefault(); flush(); ui.date = null; renderToday(); return; }
    if (act === 'export') return exportBackup();
    if (act === 'csv') return exportCSV();
    if (act === 'import') return document.getElementById('importFile').click();
    if (act === 'sample') return loadSample();
    if (act === 'clear') return clearAll();
    if (act === 'addex') {
      var ni = document.getElementById('newEx');
      if (!ni.value.trim()) { ni.focus(); return; }
      var ex = findOrCreateExercise(ni.value);
      addExerciseToDay(ex.id);
      return;
    }
    if (act === 'addexid') return addExerciseToDay(b.getAttribute('data-id'));
    if (act === 'addset' || act === 'rmset' || act === 'rmex') {
      var de = state.days[ui.date] || {};
      var xi = Number(b.getAttribute('data-xi'));
      var xx = de.exercises && de.exercises[xi];
      if (!xx) return;
      if (act === 'addset') {
        var prevSet = xx.sets[xx.sets.length - 1] || {};
        xx.sets.push({ w: C.isNum(prevSet.w) ? prevSet.w : null, r: null });
        commitDay(ui.date, de);
        refreshWorkout('[data-set="' + xi + ':' + (xx.sets.length - 1) + ':r"]');
      } else if (act === 'rmset') {
        xx.sets.splice(Number(b.getAttribute('data-si')), 1);
        if (!xx.sets.length) de.exercises.splice(xi, 1);
        commitDay(ui.date, de);
        refreshWorkout('#newEx');
      } else {
        var exn = (exById(xx.id) || { name: 'this exercise' }).name;
        if (C.validSets(xx).length && !window.confirm('Remove ' + exn + ' and its sets from this day?')) return;
        de.exercises.splice(xi, 1);
        commitDay(ui.date, de);
        refreshWorkout('#newEx');
      }
      return;
    }
    if (act === 'rmexdef') {
      var row = b.parentNode, ei = row.querySelector('[name="exName"]');
      var gone = ei.getAttribute('data-removed') === '1';
      ei.setAttribute('data-removed', gone ? '0' : '1');
      ei.disabled = !gone;
      row.classList.toggle('removed', !gone);
      b.textContent = gone ? '✕' : '↺';
      b.setAttribute('aria-label', (gone ? 'Delete ' : 'Keep ') + ei.value);
      return;
    }
    if (act === 'rmhabit') {
      var inp = b.parentNode.querySelector('[name="habitName"]');
      inp.value = '';
      inp.setAttribute('data-hid', ''); // a habit typed here later starts fresh
      inp.focus();
      return;
    }

    var key = b.getAttribute('data-yn') || b.getAttribute('data-scale');
    if (key) {
      var isScale = b.hasAttribute('data-scale');
      var val = isScale ? Number(b.getAttribute('data-val')) : b.getAttribute('data-val') === 'true';
      var cur = getField(entry(ui.date), key);
      var next = cur === val ? null : val; // tap again to clear
      setField(ui.date, key, next);
      Array.prototype.forEach.call(b.parentNode.querySelectorAll('button'), function (x) {
        var xv = isScale ? Number(x.getAttribute('data-val')) : x.getAttribute('data-val') === 'true';
        x.setAttribute('aria-pressed', String(next === xv));
      });
      updateTodayLive();
      return;
    }
    if (b.hasAttribute('data-munit')) {
      flush();
      state.measureUnit = b.getAttribute('data-munit');
      saveNow();
      renderMeasurements();
      return;
    }
    if (b.hasAttribute('data-unit')) {
      var u = b.getAttribute('data-unit');
      var f = b.form;
      if (state.settings && f.elements.unit.value !== u) {
        var factor = u === 'lbs' ? LBS_PER_KG : 1 / LBS_PER_KG;
        ['startWeight', 'minGoal', 'targetGoal', 'dreamGoal'].forEach(function (n) {
          var v = parseNum(f.elements[n].value);
          if (v !== null) f.elements[n].value = Math.round(v * factor * 10) / 10;
        });
        var inc = parseNum(f.elements.liftIncrement.value);
        if (inc !== null) f.elements.liftIncrement.value = (u === 'lbs' && inc === 2.5) ? 5 : (u === 'kg' && inc === 5) ? 2.5 : Math.round(inc * factor * 2) / 2;
        document.getElementById('unitHint').textContent = 'Goals converted to ' + u + '. Your logged weights will be converted when you save.';
      }
      f.elements.unit.value = u;
      Array.prototype.forEach.call(f.querySelectorAll('.unit-lbl'), function (x) { x.textContent = u; });
      Array.prototype.forEach.call(b.parentNode.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      return;
    }
    if (b.hasAttribute('data-theme-set')) {
      setTheme(b.getAttribute('data-theme-set'));
      Array.prototype.forEach.call(b.parentNode.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    }
  });

  view.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.hasAttribute('data-num')) {
      var v = parseNum(t.value);
      var k = t.getAttribute('data-num');
      if (v !== null && (v < 0 || (k === 'weight' && v === 0))) v = null;
      if (v !== null && k !== 'weight') v = Math.round(v);
      setField(ui.date, k, v);
      updateTodayLive();
    } else if (t.hasAttribute('data-set')) {
      var parts = t.getAttribute('data-set').split(':');
      var se = state.days[ui.date] || {};
      var sx = se.exercises && se.exercises[Number(parts[0])];
      var st = sx && sx.sets[Number(parts[1])];
      if (!st) return;
      var sv = parseNum(t.value);
      if (sv !== null && sv <= 0) sv = null;
      if (parts[2] === 'w') st.w = sv === null ? null : Math.round(sv * 100) / 100;
      else st.r = sv === null ? null : Math.round(sv);
      if (parts[2] === 'r' && st.r && se.workout === undefined) {
        se.workout = true; // logging sets means you worked out
        Array.prototype.forEach.call(view.querySelectorAll('[data-yn="workout"]'), function (x) {
          x.setAttribute('aria-pressed', String(x.getAttribute('data-val') === 'true'));
        });
      }
      commitDay(ui.date, se);
      var bd = document.getElementById('best-' + parts[0]);
      if (bd) bd.textContent = bestText(ui.date, Number(parts[0]));
    } else if (t.hasAttribute('data-text')) {
      setField(ui.date, t.getAttribute('data-text'), t.value);
    } else if (t.hasAttribute('data-prio')) {
      var e = entry(ui.date);
      var pr = (e.priorities || []).slice();
      while (pr.length < 3) pr.push('');
      pr[Number(t.getAttribute('data-prio'))] = t.value;
      setField(ui.date, 'priorities', pr.some(function (p) { return p.trim(); }) ? pr : null);
    } else if (t.hasAttribute('data-wtext')) {
      var wk = t.getAttribute('data-week');
      var rv = state.weeks[wk] || {};
      rv[t.getAttribute('data-wtext')] = t.value;
      state.weeks[wk] = rv;
      saveSoon();
    } else if (t.hasAttribute('data-meas')) {
      var mv = parseNum(t.value);
      var mw = ui.mWeek;
      var m = state.measurements[mw] || {};
      var mk = t.getAttribute('data-meas');
      if (mv === null || mv <= 0) delete m[mk]; else m[mk] = fromDisplay(mv);
      if (!m.date && C.hasMeasurements(m)) {
        m.date = today();
        var md = document.getElementById('mDate');
        if (md) md.value = m.date;
      }
      state.measurements[mw] = m;
      saveSoon();
      updateMeasureLive();
    } else if (t.id === 'photoLink') {
      state.photoLink = t.value.trim();
      saveSoon();
    } else if (t.id === 's-start') {
      updateStartHint();
    }
  });

  view.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'datePick') {
      if (C.isValidDate(t.value)) { flush(); ui.date = clampDate(t.value); renderToday(); }
    } else if (t.id === 'mWeek') {
      flush(); ui.mWeek = Number(t.value); renderMeasurements();
    } else if (t.id === 'strengthEx') {
      ui.strengthEx = t.value;
      renderDashboard();
      var se2 = document.getElementById('strengthEx');
      if (se2) se2.focus();
    } else if (t.id === 'mDate') {
      var m = state.measurements[ui.mWeek] || {};
      if (C.isValidDate(t.value)) m.date = t.value; else delete m.date;
      state.measurements[ui.mWeek] = m;
      saveSoon();
    } else if (t.id === 'photoLink') {
      flush(); renderMeasurements();
    } else if (t.id === 'importFile' && t.files && t.files[0]) {
      importBackup(t.files[0]);
      t.value = '';
    } else if (t.hasAttribute('data-num') || t.hasAttribute('data-text') || t.hasAttribute('data-wtext') || t.hasAttribute('data-meas') || t.hasAttribute('data-set')) {
      flush();
    }
  });

  view.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && ev.target.id === 'newEx') {
      ev.preventDefault();
      view.querySelector('[data-act="addex"]').click();
    }
  });

  view.addEventListener('submit', function (ev) {
    if (ev.target.id === 'settingsForm') { ev.preventDefault(); submitSettings(ev.target); }
  });

  // ---------------- start ----------------
  document.getElementById('storageWarning').hidden = checkStorage();
  render();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    // When a new version is published, reload once so it shows up right away
    // (not on the first install, when nothing was controlling the page yet).
    var hadController = !!navigator.serviceWorker.controller;
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || reloading) { hadController = true; return; }
      reloading = true;
      flush(); // save anything typed in the last moment
      location.reload();
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
        // Home-screen apps often resume instead of reopening, so check for updates on resume too.
        document.addEventListener('visibilitychange', function () {
          if (!document.hidden) reg.update().catch(function () {});
        });
      }).catch(function () {});
    });
  }

  // Exposed for automated browser tests only.
  window.__tracker = { getState: function () { return state; }, sampleData: sampleData };
})();
