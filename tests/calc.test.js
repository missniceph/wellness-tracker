// Run with:  node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calc.js');

const START = '2026-01-01'; // Day 1
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg || ''} expected ${b}, got ${a}`);

function settings(over) {
  return Object.assign({
    name: 'Nice', startDate: START, unit: 'kg', startWeight: 70,
    minGoal: 67, targetGoal: 64, dreamGoal: 60,
    stepsTarget: 5000, workoutsTarget: 4, proteinTarget: 100, calorieTarget: 1600,
    habits: [
      { id: 'h1', name: 'Read 10 pages', target: 5 },
      { id: 'h2', name: 'Stretch 10 minutes', target: 3 }
    ]
  }, over || {});
}
const dayDate = (n) => C.dateForDay(START, n);
function state(days, over) {
  const d = {};
  Object.keys(days || {}).forEach((n) => { d[dayDate(Number(n))] = days[n]; });
  return { settings: settings(over), days: d, weeks: {}, measurements: {} };
}

// ---------- dates ----------
test('day and week numbers', () => {
  assert.equal(C.dayNumber(START, START), 1);
  assert.equal(C.dayNumber(START, '2026-01-07'), 7);
  assert.equal(C.dayNumber(START, '2026-04-10'), 100);
  assert.equal(C.weekOf(1), 1);
  assert.equal(C.weekOf(7), 1);
  assert.equal(C.weekOf(8), 2);
  assert.equal(C.weekOf(98), 14);
  assert.equal(C.weekOf(99), 15);
  assert.equal(C.weekOf(100), 15);
  assert.deepEqual(C.weekRange(15), { first: 99, last: 100 });
  assert.equal(C.addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(C.addDays('2028-02-28', 1), '2028-02-29');
  assert.ok(C.isValidDate('2026-11-05'));
  assert.ok(!C.isValidDate('2026-02-30'));
});

test('todayStr uses local date, not UTC (Philippines is UTC+8)', () => {
  const d = new Date(2026, 10, 5, 1, 30); // 1:30am local
  assert.equal(C.todayStr(d), '2026-11-05');
});

// ---------- 7-day trend ----------
test('7-day trend weight averages weigh-ins in the last 7 days including today', () => {
  const s = state({ 1: { weight: 80 }, 2: { weight: 72 }, 5: { weight: 71 }, 8: { weight: 70 } });
  close(C.trendWeight(s.days, dayDate(8)), (72 + 71 + 70) / 3, 'day 1 is outside window of day 8');
  close(C.trendWeight(s.days, dayDate(7)), (80 + 72 + 71) / 3);
  close(C.trendWeight(s.days, dayDate(1)), 80);
});

test('7-day trend is null when no weigh-ins, ignores blank days', () => {
  const s = state({ 3: { steps: 5000 }, 4: {} });
  assert.equal(C.trendWeight(s.days, dayDate(4)), null);
});

// ---------- daily habits % ----------
test('daily habits % with protein target uses 4 points', () => {
  const st = settings();
  assert.equal(C.dailyHabitsPct({ water: true, reviewedWhy: true, plannedTomorrow: true, protein: 100 }, st), 1);
  assert.equal(C.dailyHabitsPct({ water: true, reviewedWhy: false, plannedTomorrow: true, protein: 99 }, st), 0.5);
  assert.equal(C.dailyHabitsPct({ water: true }, st), 0.25);
});

test('daily habits % with NO protein target uses 3 points', () => {
  const st = settings({ proteinTarget: null });
  close(C.dailyHabitsPct({ water: true, reviewedWhy: true, protein: 200 }, st), 2 / 3);
  assert.equal(C.dailyHabitsPct({ water: true, reviewedWhy: true, plannedTomorrow: true }, st), 1);
  assert.equal(C.dailyHabitsPct({ water: true }, settings({ proteinTarget: 0 })), 1 / 3);
});

test('daily habits % of a blank day is 0', () => {
  assert.equal(C.dailyHabitsPct(null, settings()), 0);
  assert.equal(C.dailyHabitsPct({}, settings({ proteinTarget: null })), 0);
});

// ---------- ratings ----------
test('ratings thresholds', () => {
  assert.equal(C.ratingFor(1), 'Excellent');
  assert.equal(C.ratingFor(0.9), 'Excellent');
  assert.equal(C.ratingFor(0.8999), 'Strong');
  assert.equal(C.ratingFor(0.75), 'Strong');
  assert.equal(C.ratingFor(0.7499), 'Building');
  assert.equal(C.ratingFor(0.6), 'Building');
  assert.equal(C.ratingFor(0.59), 'Reset & refocus');
  assert.equal(C.ratingFor(0), 'Reset & refocus');
  assert.equal(C.ratingFor(null), null);
  // floating point: 0.7 + 0.2 = 0.8999999999999999 should still count as 90%
  assert.equal(C.ratingFor((0.7 + 0.2 + 0.7 + 0.2) / 2 + 0.0 ), 'Excellent');
});

// ---------- full week ----------
function fullWeek() {
  // Week 1 (days 1–7), all logged.
  return state({
    1: { weight: 70, workout: true, steps: 6000, calories: 1500, protein: 110, sleep: 4, stress: 2, fatigue: 2, hunger: 3, water: true, reviewedWhy: true, plannedTomorrow: true, habits: { h1: true, h2: true } },
    2: { weight: 69.6, workout: false, steps: 4000, calories: 1700, protein: 90, sleep: 3, stress: 3, fatigue: 3, hunger: 3, water: true, reviewedWhy: false, plannedTomorrow: true, habits: { h1: true } },
    3: { weight: 69.4, workout: true, steps: 5000, calories: 1600, protein: 100, sleep: 5, stress: 1, fatigue: 2, hunger: 2, water: true, reviewedWhy: true, plannedTomorrow: true, habits: { h1: true, h2: true } },
    4: { weight: 69.2, workout: true, steps: 7000, calories: 1550, protein: 120, sleep: 4, stress: 2, fatigue: 1, hunger: 2, water: false, reviewedWhy: true, plannedTomorrow: false, habits: { h1: true, h2: true } },
    5: { weight: 69.0, workout: false, steps: 3000, calories: 1800, protein: 80, sleep: 2, stress: 4, fatigue: 4, hunger: 4, water: true, reviewedWhy: true, plannedTomorrow: true, habits: { h1: true, h2: true } },
    6: { weight: 68.8, workout: true, steps: 8000, calories: 1500, protein: 105, sleep: 4, stress: 2, fatigue: 2, hunger: 2, water: true, reviewedWhy: true, plannedTomorrow: true, habits: { h1: true } },
    7: { weight: 68.6, workout: true, steps: 2000, calories: 1650, protein: 100, sleep: 4, stress: 2, fatigue: 2, hunger: 3, water: true, reviewedWhy: true, plannedTomorrow: true, habits: {} }
  });
}

test('full week: averages, workouts, steps, scores', () => {
  const w = C.weekStats(fullWeek(), 1, dayDate(7));
  assert.equal(w.daysSoFar, 7);
  assert.equal(w.daysLogged, 7);
  close(w.avgWeight, (70 + 69.6 + 69.4 + 69.2 + 69 + 68.8 + 68.6) / 7);
  close(w.weightChange, w.avgWeight - 70, 'week 1 compares with starting weight');
  assert.equal(w.workouts, 5);
  close(w.workoutTarget, 4);
  assert.equal(w.workoutPct, 1, 'capped at 100%');
  close(w.avgSteps, 35000 / 7);
  close(w.stepsPct, 1);
  close(w.avgCalories, (1500 + 1700 + 1600 + 1550 + 1800 + 1500 + 1650) / 7);
  close(w.avgProtein, (110 + 90 + 100 + 120 + 80 + 105 + 100) / 7);
  close(w.avgSleep, 26 / 7);
  close(w.avgStress, 16 / 7);
  close(w.avgFatigue, 16 / 7);
  close(w.avgHunger, 19 / 7);
  // daily habits per day (4 points): d1 4, d2 2, d3 4, d4 2, d5 3, d6 4, d7 4 => 23/28
  close(w.dailyHabitsPct, 23 / 28);
  // extra: h1 yes 6, target 5 → min(6,5)=5; h2 yes 4, target 3 → 3; (5+3)/(5+3)=1
  close(w.extraHabitsPct, 1);
  close(w.fitnessScore, 1);
  close(w.habitScore, (23 / 28 + 1) / 2);
  close(w.weeklyScore, (1 + (23 / 28 + 1) / 2) / 2);
  assert.equal(w.rating, 'Excellent');
});

test('steps % below target is not capped; workout % partial', () => {
  const s = state({
    1: { steps: 2500, workout: true }, 2: { steps: 2500 }, 3: {}, 4: {}, 5: {}, 6: {}, 7: { workout: true }
  });
  const w = C.weekStats(s, 1, dayDate(7));
  close(w.avgSteps, 2500, 'blank days ignored in average');
  close(w.stepsPct, 0.5);
  close(w.workoutPct, 2 / 4);
  close(w.fitnessScore, 0.5);
});

test('change vs last week uses previous week average', () => {
  const days = {};
  for (let d = 1; d <= 7; d++) days[d] = { weight: 70 };
  days[8] = { weight: 69 }; days[9] = { weight: 68 };
  const w = C.weekStats(state(days), 2, dayDate(9));
  close(w.avgWeight, 68.5);
  close(w.weightChange, -1.5);
});

test('change vs last week is null when either week has no weigh-ins', () => {
  const s = state({ 8: { weight: 69 } });
  assert.equal(C.weekStats(s, 2, dayDate(8)).weightChange, null);
  assert.equal(C.weekStats(state({ 1: { steps: 1 } }), 1, dayDate(1)).weightChange, null);
});

// ---------- mid-week partial ----------
test('mid-week partial week (3 days so far)', () => {
  const s = state({
    8: { workout: true, steps: 6000, water: true, reviewedWhy: true, plannedTomorrow: true, protein: 120, habits: { h1: true, h2: true } },
    9: { workout: true, steps: 4000, water: true, habits: { h1: true } },
    10: { steps: 5000, habits: { h1: true, h2: true } }
  });
  const w = C.weekStats(s, 2, dayDate(10));
  assert.equal(w.daysSoFar, 3);
  close(w.workoutTarget, 4 * 3 / 7);
  close(w.workoutPct, Math.min(1, 2 / (12 / 7)));
  assert.equal(w.workoutPct, 1);
  close(w.avgSteps, 5000);
  close(w.stepsPct, 1);
  close(w.dailyHabitsPct, (1 + 0.25 + 0) / 3);
  // h1: yes 3, expected 5*3/7=2.142857 → min=2.142857; h2: yes 2, expected 3*3/7=1.285714 → 1.285714
  close(w.extraHabitsPct, 1);
  close(w.habitScore, ((1.25 / 3) + 1) / 2);
});

test('mid-week partial: extra habits % below target', () => {
  const s = state({ 8: { habits: { h1: true } }, 9: {}, 10: {}, 11: {} });
  const w = C.weekStats(s, 2, dayDate(11)); // 4 days so far
  const e1 = 5 * 4 / 7, e2 = 3 * 4 / 7;
  close(w.extraHabitsPct, Math.min(1, e1) / (e1 + e2));
  assert.equal(w.habits[0].yes, 1);
  close(w.habits[0].expected, e1);
});

test('extra habits % caps each habit at its own target', () => {
  // h1 done 7/7 (target 5), h2 done 0/7 (target 3) → (5 + 0) / (5 + 3)
  const days = {};
  for (let d = 1; d <= 7; d++) days[d] = { habits: { h1: true } };
  close(C.weekStats(state(days), 1, dayDate(7)).extraHabitsPct, 5 / 8);
});

// ---------- week 15 ----------
test('week 15 has only 2 days (99–100)', () => {
  const days = {};
  for (let d = 92; d <= 100; d++) days[d] = { weight: 65, workout: true, steps: 5000, water: true, reviewedWhy: true, plannedTomorrow: true, protein: 100, habits: { h1: true, h2: true } };
  const s = state(days);
  const w = C.weekStats(s, 15, dayDate(100));
  assert.equal(w.firstDay, 99);
  assert.equal(w.lastDay, 100);
  assert.equal(w.weekLength, 2);
  assert.equal(w.daysSoFar, 2);
  close(w.workoutTarget, 8 / 7);
  assert.equal(w.workoutPct, 1);
  close(w.habits[0].expected, 10 / 7);
  assert.equal(w.weeklyScore, 1);
  close(w.weightChange, 0);
  // after the challenge ends, week 15 still only counts 2 days
  assert.equal(C.weekStats(s, 15, C.addDays(dayDate(100), 30)).daysSoFar, 2);
  // on day 99 only 1 day so far
  const w99 = C.weekStats(s, 15, dayDate(99));
  assert.equal(w99.daysSoFar, 1);
  close(w99.workoutTarget, 4 / 7);
});

test('week 15 with one workout in 2 days', () => {
  const s = state({ 99: { workout: true }, 100: {} });
  const w = C.weekStats(s, 15, dayDate(100));
  close(w.workoutPct, 1 / (8 / 7)); // 0.875
});

test('there are 15 weeks', () => {
  const all = C.allWeekStats(state({}), dayDate(100));
  assert.equal(all.length, 15);
  assert.equal(all.reduce((a, w) => a + w.daysSoFar, 0), 100);
});

// ---------- blank days ----------
test('blank week: nothing logged gives 0 scores, null averages', () => {
  const w = C.weekStats(state({}), 1, dayDate(7));
  assert.equal(w.daysSoFar, 7);
  assert.equal(w.daysLogged, 0);
  assert.equal(w.avgWeight, null);
  assert.equal(w.avgSteps, null);
  assert.equal(w.avgSleep, null);
  assert.equal(w.workoutPct, 0);
  assert.equal(w.stepsPct, 0);
  assert.equal(w.dailyHabitsPct, 0);
  assert.equal(w.extraHabitsPct, 0);
  assert.equal(w.weeklyScore, 0);
  assert.equal(w.rating, 'Reset & refocus');
});

test('blank days count as 0% daily habits but are ignored in number averages', () => {
  const s = state({ 1: { water: true, reviewedWhy: true, plannedTomorrow: true, protein: 100, sleep: 4, weight: 70 } });
  const w = C.weekStats(s, 1, dayDate(2)); // day 2 blank
  close(w.dailyHabitsPct, 0.5);
  assert.equal(w.avgSleep, 4);
  assert.equal(w.avgWeight, 70);
  assert.equal(w.daysLogged, 1);
});

test('future week has not started', () => {
  const w = C.weekStats(state({}), 3, dayDate(10));
  assert.equal(w.started, false);
  assert.equal(w.daysSoFar, 0);
  assert.equal(w.weeklyScore, null);
});

test('before the challenge starts, week 1 has 0 days so far', () => {
  assert.equal(C.weekStats(state({}), 1, '2025-12-25').daysSoFar, 0);
});

// ---------- no habits / no targets ----------
test('no extra habits: habit score = daily habits % only', () => {
  const s = state({ 1: { water: true, reviewedWhy: true, plannedTomorrow: true } }, { habits: [], proteinTarget: null });
  const w = C.weekStats(s, 1, dayDate(1));
  assert.equal(w.extraHabitsPct, null);
  assert.equal(w.dailyHabitsPct, 1);
  assert.equal(w.habitScore, 1);
});

test('no protein target in a weekly calc', () => {
  const s = state({
    1: { water: true, reviewedWhy: true, plannedTomorrow: false, protein: 50 },
    2: { water: true, reviewedWhy: true, plannedTomorrow: true }
  }, { proteinTarget: null });
  const w = C.weekStats(s, 1, dayDate(2));
  close(w.dailyHabitsPct, (2 / 3 + 1) / 2);
});

test('habits with an empty name are ignored, max 5', () => {
  const st = settings({ habits: [
    { id: 'a', name: 'A', target: 1 }, { id: 'b', name: '  ', target: 3 }, { id: 'c', name: 'C', target: 2 },
    { id: 'd', name: 'D', target: 2 }, { id: 'e', name: 'E', target: 2 }, { id: 'f', name: 'F', target: 2 }, { id: 'g', name: 'G', target: 2 }
  ] });
  assert.deepEqual(C.activeHabits(st).map((h) => h.id), ['a', 'c', 'd', 'e', 'f']);
});

// ---------- dashboard ----------
test('dashboard tiles', () => {
  const s = fullWeek();
  s.days[dayDate(8)] = { weight: 68.4, workout: true };
  const d = C.dashboardStats(s, dayDate(8));
  assert.equal(d.day, 8);
  assert.equal(d.week, 2);
  assert.equal(d.daysLeft, 92);
  assert.equal(d.daysLogged, 8);
  assert.equal(d.workoutsThisWeek, 1);
  assert.equal(d.workoutsTarget, 4);
  assert.equal(d.startWeight, 70);
  const trend = (69.6 + 69.4 + 69.2 + 69 + 68.8 + 68.6 + 68.4) / 7;
  close(d.trendWeight, trend);
  close(d.totalChange, trend - 70);
  close(d.distanceToTarget, trend - 64);
  close(d.progress, (70 - trend) / (70 - 64));
  assert.equal(d.milestones.length, 3);
  assert.equal(d.milestones[0].reached, false);
  close(d.milestones[0].toGo, trend - 67);
  // last-7 averages: days 2..8
  close(d.last7.steps, (4000 + 5000 + 7000 + 3000 + 8000 + 2000) / 6);
  close(d.last7.sleep, (3 + 5 + 4 + 2 + 4 + 4) / 6);
  close(d.last7.protein, (90 + 100 + 120 + 80 + 105 + 100) / 6);
  close(d.last7.calories, (1700 + 1600 + 1550 + 1800 + 1500 + 1650) / 6);
  assert.ok(d.weekScore !== null);
});

test('dashboard: goals reached, days left bounds', () => {
  const s = state({ 50: { weight: 66 } });
  const d = C.dashboardStats(s, dayDate(50));
  assert.equal(d.milestones[0].reached, true);
  assert.equal(d.milestones[0].toGo, 0);
  assert.equal(d.milestones[1].reached, false);
  close(d.milestones[1].toGo, 2);
  close(d.progress, 4 / 6);
  assert.equal(C.dashboardStats(s, dayDate(100)).daysLeft, 0);
  assert.equal(C.dashboardStats(s, C.addDays(dayDate(100), 5)).daysLeft, 0);
  assert.equal(C.dashboardStats(s, '2025-12-31').daysLeft, 100);
  const past = C.dashboardStats(state({ 1: { weight: 60 } }), dayDate(5));
  assert.equal(past.distanceToTarget, 0);
  assert.equal(past.progress, 1, 'progress capped at 100%');
});

test('dashboard: trend falls back to the latest weigh-in when none this week', () => {
  const s = state({ 2: { weight: 69 }, 3: { weight: 68 } });
  const d = C.dashboardStats(s, dayDate(20));
  close(d.trendWeight, 68.5);
  assert.equal(d.trendAsOf, dayDate(3));
});

test('dashboard: no weigh-ins', () => {
  const d = C.dashboardStats(state({}), dayDate(3));
  assert.equal(d.trendWeight, null);
  assert.equal(d.totalChange, null);
  assert.equal(d.progress, null);
  assert.equal(d.milestones[0].toGo, null);
});

test('goal direction supports weight gain', () => {
  const s = state({ 10: { weight: 52 } }, { startWeight: 50, minGoal: 51, targetGoal: 53, dreamGoal: 55 });
  const d = C.dashboardStats(s, dayDate(10));
  assert.equal(d.milestones[0].reached, true);
  close(d.distanceToTarget, 1);
  close(d.progress, 2 / 3);
});

test('weight series has trend for each weigh-in', () => {
  const ser = C.weightSeries(state({ 1: { weight: 70 }, 3: { weight: 68 } }));
  assert.equal(ser.length, 2);
  close(ser[1].trend, 69);
});

// ---------- measurements ----------
test('measurement totals and change since week 1', () => {
  const m = {
    1: { chest: 90, rightArm: 30, leftArm: 30, waistAbove: 80, waistNavel: 85, lowerBelly: 92, hips: 100, rightThigh: 58, leftThigh: 58, calf: 36 },
    3: { chest: 89, rightArm: 29.5, leftArm: 29.5, waistAbove: 78, waistNavel: 83, lowerBelly: 90, hips: 99, rightThigh: 57, leftThigh: 57.5 }
  };
  close(C.measurementTotal(m[1]), 659);
  const ch = C.measurementChanges(m, 3);
  assert.equal(ch.baseWeek, 1);
  close(ch.fields.chest, -1);
  close(ch.fields.waistAbove, -2);
  assert.equal(ch.fields.calf, null, 'calf skipped in week 3');
  close(ch.total, -1 - 0.5 - 0.5 - 2 - 2 - 2 - 1 - 1 - 0.5, 'total only counts parts measured both times');
  assert.equal(C.measurementChanges(m, 2), null);
  close(C.measurementChanges(m, 1).total, 0);
});

test('measurement baseline falls back to earliest week', () => {
  const m = { 2: { chest: 90 }, 4: { chest: 88 } };
  const ch = C.measurementChanges(m, 4);
  assert.equal(ch.baseWeek, 2);
  close(ch.total, -2);
});

// ---------- CSV ----------
test('CSV export: header, skips blank days, escapes text', () => {
  const s = state({ 1: { weight: 70, water: true, notes: 'tired, "but" ok', priorities: ['a', 'b'] }, 2: {}, 3: { steps: 5000, habits: { h1: true } } });
  const csv = C.toCSV(s);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[0].startsWith('date,day,week,weight'));
  assert.ok(lines[0].includes('habit: Read 10 pages'));
  assert.ok(lines[1].includes('"tired, ""but"" ok"'));
  assert.ok(lines[1].includes('a | b'));
  assert.ok(lines[2].startsWith(dayDate(3) + ',3,1'));
});

test('CSV export neutralises spreadsheet formulas', () => {
  const csv = C.toCSV(state({ 1: { notes: '=HYPERLINK("x")' } }));
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
});

test('isBlankEntry', () => {
  assert.ok(C.isBlankEntry(null));
  assert.ok(C.isBlankEntry({}));
  assert.ok(C.isBlankEntry({ notes: '', habits: {}, priorities: ['', ''] }));
  assert.ok(!C.isBlankEntry({ water: false }));
  assert.ok(!C.isBlankEntry({ habits: { h1: false } }));
  assert.ok(!C.isBlankEntry({ priorities: ['run'] }));
});

// ---------- strength / progressive overload ----------
const SQ = 'sq', PU = 'pu';
function liftState(days, over) {
  const st = state(days, over);
  st.exercises = [{ id: SQ, name: 'Goblet squat' }, { id: PU, name: 'Push-ups' }];
  return st;
}
const sets = (...pairs) => pairs.map(([w, r]) => ({ w, r }));

test('estimated 1-rep max (Epley)', () => {
  close(C.e1rm(20, 10), 20 * (1 + 10 / 30));
  assert.equal(C.e1rm(50, 1), 50);
  assert.equal(C.e1rm(20, 16), null, 'too many reps to estimate');
  assert.equal(C.e1rm(null, 10), null, 'bodyweight');
  assert.equal(C.e1rm(20, 0), null);
});

test('session summary: volume, top weight, best set', () => {
  const sm = C.sessionSummary({ sets: [...sets([20, 10], [22.5, 8], [22.5, 6]), { w: 30, r: null }] });
  assert.equal(sm.sets, 3, 'set without reps is ignored');
  assert.equal(sm.totalReps, 24);
  close(sm.volume, 200 + 180 + 135);
  assert.equal(sm.topWeight, 22.5);
  assert.equal(sm.repsAtTop, 8);
  close(sm.bestE1RM, 22.5 * (1 + 8 / 30));
  assert.equal(sm.bodyweight, false);
});

test('session summary: bodyweight exercise', () => {
  const sm = C.sessionSummary({ sets: sets([null, 12], [null, 10]) });
  assert.equal(sm.bodyweight, true);
  assert.equal(sm.volume, 0);
  assert.equal(sm.maxReps, 12);
  assert.equal(sm.bestE1RM, null);
});

test('next target: all sets at top of range → add one weight step, restart at bottom', () => {
  const st = settings();
  assert.deepEqual(C.nextTarget(sets([20, 12], [20, 12], [20, 13]), st), { kind: 'weight', weight: 22.5, reps: 8, sets: 3 });
  assert.deepEqual(C.nextTarget(sets([20, 12]), settings({ unit: 'lbs' })), { kind: 'weight', weight: 25, reps: 8, sets: 1 }, '5 lbs default jump');
  assert.deepEqual(C.nextTarget(sets([20, 6]), settings({ repLow: 4, repHigh: 6, liftIncrement: 5 })), { kind: 'weight', weight: 25, reps: 4, sets: 1 }, 'custom range & jump');
});

test('next target: below top of range → same weight, one more rep', () => {
  assert.deepEqual(C.nextTarget(sets([20, 12], [20, 10], [20, 9]), settings()), { kind: 'reps', weight: 20, reps: 10, sets: 3 });
  assert.deepEqual(C.nextTarget(sets([20, 5]), settings()), { kind: 'reps', weight: 20, reps: 8, sets: 1 }, 'never below the bottom of the range');
  // only sets at the heaviest weight count (warm-ups ignored)
  assert.deepEqual(C.nextTarget(sets([10, 5], [20, 12], [20, 12]), settings()), { kind: 'weight', weight: 22.5, reps: 8, sets: 2 });
});

test('next target: bodyweight → one more rep than best set; nothing logged → null', () => {
  assert.deepEqual(C.nextTarget(sets([null, 12], [null, 10]), settings()), { kind: 'reps', weight: null, reps: 13, sets: 2 });
  assert.equal(C.nextTarget([], settings()), null);
  assert.equal(C.nextTarget(sets([20, null]), settings()), null);
});

test('exercise history: sorted, last session before a date, new bests', () => {
  const st = liftState({
    1: { exercises: [{ id: SQ, sets: sets([20, 10], [20, 10]) }] },
    3: { exercises: [{ id: SQ, sets: sets([20, 12]) }, { id: PU, sets: sets([null, 8]) }] },
    5: { exercises: [{ id: SQ, sets: sets([20, 11]) }] }, // not a best
    8: { exercises: [{ id: SQ, sets: sets([22.5, 8]) }, { id: PU, sets: sets([null, 10]) }] },
    9: { exercises: [{ id: SQ, sets: sets([25, null]) }] } // no reps → not a session
  });
  const h = C.exerciseHistory(st, SQ);
  assert.deepEqual(h.map((x) => x.date), [dayDate(1), dayDate(3), dayDate(5), dayDate(8)]);
  assert.deepEqual(h.map((x) => x.isBest), [false, true, false, true], 'first session is the baseline, not a "best"');
  assert.equal(C.lastSessionBefore(st, SQ, dayDate(5)).date, dayDate(3));
  assert.equal(C.lastSessionBefore(st, SQ, dayDate(1)), null);
  assert.deepEqual(C.exerciseHistory(st, PU).map((x) => x.isBest), [false, true]);
  assert.deepEqual(C.trainedExercises(st).map((x) => x.id), [SQ, PU]);

  const sm = C.strengthSummary(st, SQ);
  assert.equal(sm.sessions, 4);
  assert.equal(sm.best.date, dayDate(8));
  close(sm.change, C.e1rm(22.5, 8) / C.e1rm(20, 10) - 1);
  assert.equal(sm.bestCount, 2);
  const pu = C.strengthSummary(st, PU);
  assert.equal(pu.bodyweight, true);
  close(pu.change, 10 / 8 - 1);
  assert.equal(C.strengthSummary(st, 'nope'), null);
});

test('weekly lifting volume, change vs last week, new bests', () => {
  const st = liftState({
    1: { exercises: [{ id: SQ, sets: sets([20, 10], [20, 10]) }] }, // 400
    3: { exercises: [{ id: SQ, sets: sets([20, 12]) }] },          // 240, best
    8: { exercises: [{ id: SQ, sets: sets([22.5, 10], [22.5, 10]), }, { id: PU, sets: sets([null, 10]) }] } // 450, best
  });
  const w1 = C.weekStats(st, 1, dayDate(7));
  assert.equal(w1.liftSets, 3);
  assert.equal(w1.liftVolume, 640);
  assert.equal(w1.liftVolumeChange, null, 'no week before week 1');
  assert.equal(w1.newBests, 1);
  const w2 = C.weekStats(st, 2, dayDate(9));
  assert.equal(w2.liftSets, 3);
  assert.equal(w2.liftVolume, 450);
  close(w2.liftVolumeChange, 450 / 640 - 1);
  assert.equal(w2.newBests, 1, 'push-ups first session is not a best');
  assert.equal(C.weekStats(liftState({}), 1, dayDate(7)).liftVolume, 0);
});

test('setsText formats sets for hints and CSV', () => {
  assert.equal(C.setsText(sets([20, 10], [20, 10], [20, 10]), 'kg'), '3 × 10 @ 20 kg');
  assert.equal(C.setsText(sets([20, 10], [22.5, 8]), 'kg'), '20 kg × 10, 22.5 kg × 8');
  assert.equal(C.setsText(sets([20, 10], [20, 10], [20, 9]), 'kg'), '20 kg × 10, 10, 9');
  assert.equal(C.setsText(sets([null, 12], [null, 12]), 'kg'), '2 × 12');
  assert.equal(C.setsText(sets([null, 12], [null, 9]), 'kg'), '12, 9 reps');
  assert.equal(C.setsText([], 'kg'), '');
});

test('a day with only an empty exercise counts as blank; with sets it is logged', () => {
  assert.ok(C.isBlankEntry({ exercises: [{ id: SQ, sets: [{ w: 20, r: null }] }] }));
  assert.ok(!C.isBlankEntry({ exercises: [{ id: SQ, sets: sets([20, 8]) }] }));
});

test('CSV includes exercises', () => {
  const csv = C.toCSV(liftState({ 1: { exercises: [{ id: SQ, sets: sets([20, 10], [20, 10]) }, { id: PU, sets: sets([null, 12]) }] } }));
  assert.ok(csv.split('\r\n')[0].includes('exercises'));
  assert.ok(csv.includes('Goblet squat: 2 × 10 @ 20 kg | Push-ups: 1 × 12'));
});
