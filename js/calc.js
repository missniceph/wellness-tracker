/*
 * 100-Day Progress Tracker — pure calculation module.
 * No DOM access here, so it can be unit-tested in Node and used in the browser.
 *
 * Data rules used everywhere:
 *  - A missing number (blank field) is simply not counted in averages.
 *  - A missing yes/no answer counts as "no".
 *  - Dates are plain "YYYY-MM-DD" strings in the phone's local time.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TOTAL_DAYS = 100;
  var TOTAL_WEEKS = 15;

  // ---------- date helpers ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function todayStr(now) {
    var d = now || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function splitDate(s) { return s.split('-').map(Number); }

  function addDays(s, n) {
    var p = splitDate(s);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
  }

  /** Whole days from a to b (b - a). */
  function diffDays(a, b) {
    var x = splitDate(a), y = splitDate(b);
    return Math.round((Date.UTC(y[0], y[1] - 1, y[2]) - Date.UTC(x[0], x[1] - 1, x[2])) / 86400000);
  }

  function isValidDate(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;
  }

  /** Day number in the challenge (Day 1 = start date). Can be <1 or >100. */
  function dayNumber(startDate, date) { return diffDays(startDate, date) + 1; }

  function dateForDay(startDate, n) { return addDays(startDate, n - 1); }

  function weekOf(day) { return Math.ceil(day / 7); }

  /** Days covered by a week. Week 15 only has days 99–100. */
  function weekRange(w) { return { first: 7 * w - 6, last: Math.min(7 * w, TOTAL_DAYS) }; }

  // ---------- number helpers ----------
  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  function avg(values) {
    var nums = values.filter(isNum);
    if (!nums.length) return null;
    return nums.reduce(function (a, b) { return a + b; }, 0) / nums.length;
  }

  function meanOfAvailable(values) { return avg(values); }

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }

  function round(x, dp) {
    if (!isNum(x)) return null;
    var f = Math.pow(10, dp || 0);
    return Math.round(x * f) / f;
  }

  // ---------- per-day ----------
  function hasProteinTarget(settings) {
    return !!settings && isNum(settings.proteinTarget) && settings.proteinTarget > 0;
  }

  function proteinHit(entry, settings) {
    return hasProteinTarget(settings) && !!entry && isNum(entry.protein) &&
      entry.protein >= settings.proteinTarget;
  }

  /** (water + reviewed why + planned tomorrow [+ protein hit]) ÷ (3 or 4). Blank day = 0. */
  function dailyHabitsPct(entry, settings) {
    var e = entry || {};
    var withProtein = hasProteinTarget(settings);
    var points = (e.water === true ? 1 : 0) + (e.reviewedWhy === true ? 1 : 0) +
      (e.plannedTomorrow === true ? 1 : 0) + (proteinHit(e, settings) ? 1 : 0);
    return points / (withProtein ? 4 : 3);
  }

  function isBlankEntry(e) {
    if (!e) return true;
    return !Object.keys(e).some(function (k) {
      var v = e[k];
      if (v === null || v === undefined || v === '') return false;
      if (k === 'habits') return Object.keys(v || {}).some(function (h) { return v[h] === true || v[h] === false; });
      if (k === 'priorities') return (v || []).some(function (p) { return p && String(p).trim(); });
      return true;
    });
  }

  /** Average of weigh-ins from (date - 6) to date, inclusive. */
  function trendWeight(days, date) {
    var vals = [];
    for (var i = 0; i < 7; i++) {
      var e = days[addDays(date, -i)];
      if (e && isNum(e.weight)) vals.push(e.weight);
    }
    return avg(vals);
  }

  // ---------- weekly ----------
  function activeHabits(settings) {
    return ((settings && settings.habits) || []).filter(function (h) {
      return h && h.name && String(h.name).trim() && isNum(h.target) && h.target > 0;
    }).slice(0, 5);
  }

  function weekEntries(state, w, daysSoFar) {
    var s = state.settings, out = [];
    var first = weekRange(w).first;
    for (var d = first; d < first + daysSoFar; d++) {
      var date = dateForDay(s.startDate, d);
      out.push({ day: d, date: date, entry: state.days[date] || null });
    }
    return out;
  }

  function weekAvgWeight(state, w, daysSoFar) {
    return avg(weekEntries(state, w, daysSoFar).map(function (x) { return x.entry && x.entry.weight; }));
  }

  /**
   * All the numbers for one week, as of refDate (normally today).
   * "Days so far" = days of the week up to and including refDate.
   */
  function weekStats(state, w, refDate) {
    var s = state.settings;
    var range = weekRange(w);
    var refDay = Math.min(dayNumber(s.startDate, refDate), TOTAL_DAYS);
    var daysSoFar = Math.max(0, Math.min(range.last, refDay) - range.first + 1);
    var res = {
      week: w, firstDay: range.first, lastDay: range.last,
      weekLength: range.last - range.first + 1, daysSoFar: daysSoFar, started: daysSoFar > 0,
      daysLogged: 0, avgWeight: null, weightChange: null, workouts: 0, workoutTarget: null,
      workoutPct: null, avgSteps: null, stepsPct: null, avgCalories: null, avgProtein: null,
      avgSleep: null, avgStress: null, avgFatigue: null, avgHunger: null,
      dailyHabitsPct: null, extraHabitsPct: null, habits: [],
      fitnessScore: null, habitScore: null, weeklyScore: null, rating: null
    };
    if (!daysSoFar) return res;

    var items = weekEntries(state, w, daysSoFar);
    var entries = items.map(function (x) { return x.entry || {}; });
    function field(k) { return entries.map(function (e) { return e[k]; }); }

    res.daysLogged = entries.filter(function (e) { return !isBlankEntry(e); }).length;
    res.avgWeight = avg(field('weight'));
    var prev = w === 1 ? (isNum(s.startWeight) ? s.startWeight : null)
      : weekAvgWeight(state, w - 1, weekRange(w - 1).last - weekRange(w - 1).first + 1);
    res.weightChange = (res.avgWeight !== null && prev !== null) ? res.avgWeight - prev : null;

    res.workouts = entries.filter(function (e) { return e.workout === true; }).length;
    if (isNum(s.workoutsTarget) && s.workoutsTarget > 0) {
      res.workoutTarget = s.workoutsTarget * daysSoFar / 7;
      res.workoutPct = Math.min(1, res.workouts / res.workoutTarget);
    }

    res.avgSteps = avg(field('steps'));
    if (isNum(s.stepsTarget) && s.stepsTarget > 0) {
      res.stepsPct = res.avgSteps === null ? 0 : Math.min(1, res.avgSteps / s.stepsTarget);
    }

    res.avgCalories = avg(field('calories'));
    res.avgProtein = avg(field('protein'));
    res.avgSleep = avg(field('sleep'));
    res.avgStress = avg(field('stress'));
    res.avgFatigue = avg(field('fatigue'));
    res.avgHunger = avg(field('hunger'));

    res.dailyHabitsPct = avg(entries.map(function (e) { return dailyHabitsPct(e, s); }));

    var habits = activeHabits(s);
    if (habits.length) {
      var num = 0, den = 0;
      res.habits = habits.map(function (h) {
        var yes = entries.filter(function (e) { return e.habits && e.habits[h.id] === true; }).length;
        var expected = h.target * daysSoFar / 7;
        num += Math.min(yes, expected);
        den += expected;
        return { id: h.id, name: h.name, target: h.target, yes: yes, expected: expected,
          pct: Math.min(1, yes / expected) };
      });
      res.extraHabitsPct = den > 0 ? num / den : null;
    }

    res.fitnessScore = meanOfAvailable([res.workoutPct, res.stepsPct]);
    res.habitScore = meanOfAvailable([res.dailyHabitsPct, res.extraHabitsPct]);
    res.weeklyScore = meanOfAvailable([res.fitnessScore, res.habitScore]);
    res.rating = ratingFor(res.weeklyScore);
    return res;
  }

  function allWeekStats(state, refDate) {
    var out = [];
    for (var w = 1; w <= TOTAL_WEEKS; w++) out.push(weekStats(state, w, refDate));
    return out;
  }

  function ratingFor(score) {
    if (!isNum(score)) return null;
    var p = Math.round(score * 10000) / 100; // avoid floating-point edge cases at 90/75/60
    if (p >= 90) return 'Excellent';
    if (p >= 75) return 'Strong';
    if (p >= 60) return 'Building';
    return 'Reset & refocus';
  }

  // ---------- goals / dashboard ----------
  function goalDirection(s) {
    var goal = isNum(s.targetGoal) ? s.targetGoal : (isNum(s.minGoal) ? s.minGoal : s.dreamGoal);
    if (!isNum(s.startWeight) || !isNum(goal)) return -1;
    return goal > s.startWeight ? 1 : -1; // -1 = losing weight
  }

  function goalReached(current, goal, dir) {
    return dir < 0 ? current <= goal : current >= goal;
  }

  function milestone(label, goal, current, dir) {
    if (!isNum(goal)) return null;
    if (!isNum(current)) return { label: label, goal: goal, reached: false, toGo: null };
    var reached = goalReached(current, goal, dir);
    return { label: label, goal: goal, reached: reached, toGo: reached ? 0 : Math.abs(current - goal) };
  }

  /** Latest weigh-in on or before refDate, and its 7-day trend. */
  function currentWeight(state, refDate) {
    var t = trendWeight(state.days, refDate);
    if (t !== null) return { trend: t, asOf: refDate };
    var dates = Object.keys(state.days).filter(function (d) {
      return d <= refDate && isNum(state.days[d] && state.days[d].weight);
    }).sort();
    if (!dates.length) return { trend: null, asOf: null };
    var last = dates[dates.length - 1];
    return { trend: trendWeight(state.days, last), asOf: last };
  }

  function dashboardStats(state, refDate) {
    var s = state.settings;
    var day = dayNumber(s.startDate, refDate);
    var clampedDay = Math.max(0, Math.min(day, TOTAL_DAYS));
    var daysLogged = 0;
    for (var d = 1; d <= TOTAL_DAYS; d++) {
      if (!isBlankEntry(state.days[dateForDay(s.startDate, d)])) daysLogged++;
    }
    var week = day < 1 ? null : Math.min(weekOf(Math.min(day, TOTAL_DAYS)), TOTAL_WEEKS);
    var thisWeek = week ? weekStats(state, week, refDate) : null;
    var cw = currentWeight(state, refDate);
    var cur = cw.trend;
    var dir = goalDirection(s);
    var start = isNum(s.startWeight) ? s.startWeight : null;
    var progress = null;
    if (start !== null && isNum(s.targetGoal) && cur !== null && s.targetGoal !== start) {
      progress = clamp01((start - cur) / (start - s.targetGoal));
    }
    var last7 = [];
    for (var i = 0; i < 7; i++) last7.push(state.days[addDays(refDate, -i)] || {});
    function l7(k) { return avg(last7.map(function (e) { return e[k]; })); }

    return {
      day: day,
      week: week,
      daysLeft: TOTAL_DAYS - clampedDay,
      daysLogged: daysLogged,
      workoutsThisWeek: thisWeek ? thisWeek.workouts : 0,
      workoutsTarget: s.workoutsTarget,
      weekScore: thisWeek ? thisWeek.weeklyScore : null,
      weekRating: thisWeek ? thisWeek.rating : null,
      startWeight: start,
      trendWeight: cur,
      trendAsOf: cw.asOf,
      totalChange: (cur !== null && start !== null) ? cur - start : null,
      distanceToTarget: (cur !== null && isNum(s.targetGoal)) ?
        (goalReached(cur, s.targetGoal, dir) ? 0 : Math.abs(cur - s.targetGoal)) : null,
      progress: progress,
      milestones: [
        milestone('Minimum goal', s.minGoal, cur, dir),
        milestone('Target goal', s.targetGoal, cur, dir),
        milestone('Dream goal', s.dreamGoal, cur, dir)
      ].filter(Boolean),
      last7: { steps: l7('steps'), protein: l7('protein'), calories: l7('calories'), sleep: l7('sleep') }
    };
  }

  /** Points for the weight chart: each weigh-in plus the 7-day trend on that day. */
  function weightSeries(state) {
    var s = state.settings, out = [];
    for (var d = 1; d <= TOTAL_DAYS; d++) {
      var date = dateForDay(s.startDate, d);
      var e = state.days[date];
      if (e && isNum(e.weight)) out.push({ day: d, date: date, weight: e.weight, trend: trendWeight(state.days, date) });
    }
    return out;
  }

  // ---------- measurements ----------
  var MEASURE_FIELDS = [
    { key: 'chest', label: 'Chest' },
    { key: 'rightArm', label: 'Right upper arm' },
    { key: 'leftArm', label: 'Left upper arm' },
    { key: 'waistAbove', label: 'Waist 5 cm above navel' },
    { key: 'waistNavel', label: 'Waist at navel' },
    { key: 'lowerBelly', label: 'Lower belly 5 cm below navel' },
    { key: 'hips', label: 'Hips' },
    { key: 'rightThigh', label: 'Right thigh' },
    { key: 'leftThigh', label: 'Left thigh' },
    { key: 'calf', label: 'Calf (optional)', optional: true }
  ];

  function measurementTotal(m) {
    if (!m) return null;
    var vals = MEASURE_FIELDS.map(function (f) { return m[f.key]; }).filter(isNum);
    return vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) : null;
  }

  function hasMeasurements(m) {
    return !!m && MEASURE_FIELDS.some(function (f) { return isNum(m[f.key]); });
  }

  /** Earliest week that has measurements (normally week 1). */
  function baselineWeek(measurements) {
    var weeks = Object.keys(measurements || {}).map(Number)
      .filter(function (w) { return hasMeasurements(measurements[w]); }).sort(function (a, b) { return a - b; });
    return weeks.length ? weeks[0] : null;
  }

  /**
   * Change of each measurement vs the baseline week (week 1, or the earliest entry).
   * The total change only adds up body parts measured in both weeks, so a skipped
   * optional calf doesn't look like a huge loss.
   */
  function measurementChanges(measurements, week) {
    var base = baselineWeek(measurements);
    var m = measurements && measurements[week];
    if (base === null || !hasMeasurements(m)) return null;
    var b = measurements[base];
    var fields = {}, total = 0, any = false;
    MEASURE_FIELDS.forEach(function (f) {
      if (isNum(m[f.key]) && isNum(b[f.key])) {
        fields[f.key] = m[f.key] - b[f.key];
        total += fields[f.key];
        any = true;
      } else fields[f.key] = null;
    });
    return { baseWeek: base, fields: fields, total: any ? total : null };
  }

  // ---------- CSV ----------
  function csvCell(v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    if (/^[=+\-@\t\r]/.test(s) && !isNum(v)) s = "'" + s; // keep spreadsheets from running formulas
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function yn(v) { return v === true ? 'yes' : v === false ? 'no' : ''; }

  function toCSV(state) {
    var s = state.settings;
    var habits = activeHabits(s);
    var head = ['date', 'day', 'week', 'weight', 'trend_weight_7d', 'period', 'sleep_1_5', 'worked_out',
      'steps', 'calories', 'protein_g', 'water_goal', 'stress_1_5', 'fatigue_1_5', 'hunger_1_5']
      .concat(habits.map(function (h) { return 'habit: ' + h.name; }))
      .concat(['reviewed_why', 'planned_tomorrow', 'daily_habits_pct', 'priorities', 'wins', 'notes']);
    var rows = [head];
    for (var d = 1; d <= TOTAL_DAYS; d++) {
      var date = dateForDay(s.startDate, d);
      var e = state.days[date];
      if (isBlankEntry(e)) continue;
      var t = trendWeight(state.days, date);
      rows.push([date, d, weekOf(d), e.weight, round(t, 2), yn(e.period), e.sleep, yn(e.workout),
        e.steps, e.calories, e.protein, yn(e.water), e.stress, e.fatigue, e.hunger]
        .concat(habits.map(function (h) { return yn(e.habits && e.habits[h.id]); }))
        .concat([yn(e.reviewedWhy), yn(e.plannedTomorrow), Math.round(dailyHabitsPct(e, s) * 100),
          (e.priorities || []).filter(Boolean).join(' | '), e.wins, e.notes]));
    }
    return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }

  return {
    TOTAL_DAYS: TOTAL_DAYS, TOTAL_WEEKS: TOTAL_WEEKS, MEASURE_FIELDS: MEASURE_FIELDS,
    todayStr: todayStr, addDays: addDays, diffDays: diffDays, isValidDate: isValidDate,
    dayNumber: dayNumber, dateForDay: dateForDay, weekOf: weekOf, weekRange: weekRange,
    isNum: isNum, avg: avg, round: round,
    hasProteinTarget: hasProteinTarget, proteinHit: proteinHit, dailyHabitsPct: dailyHabitsPct,
    isBlankEntry: isBlankEntry, trendWeight: trendWeight, activeHabits: activeHabits,
    weekStats: weekStats, allWeekStats: allWeekStats, ratingFor: ratingFor,
    dashboardStats: dashboardStats, weightSeries: weightSeries, goalDirection: goalDirection,
    measurementTotal: measurementTotal, measurementChanges: measurementChanges,
    baselineWeek: baselineWeek, hasMeasurements: hasMeasurements, toCSV: toCSV
  };
});
