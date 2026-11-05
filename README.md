# 100-Day Progress Tracker

A private, phone-first tracker for my 100-day fitness and habit challenge.

- **Private:** no account, no login, no tracking, no AI. Everything is saved **only on your phone**, in the browser.
- **Works offline** once it's been opened, and installs to your home screen like an app.
- **Five screens:** Today · Dashboard · Weekly · Measurements · Settings.

**Open it:** https://missniceph.github.io/wellness-tracker/

---

## 1. Turn on the website (one time only)

GitHub has to publish the site before the link above works:

1. On GitHub, open this repository and tap **Settings**, then **Pages** (in the left menu).
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Pick the branch **main** and the folder **/ (root)**, then tap **Save**.
4. Wait a minute or two, then open https://missniceph.github.io/wellness-tracker/

## 2. Put it on your phone's home screen

> **Do this first, before you start logging.** On iPhone, the home-screen app keeps its own
> separate storage from Safari. Anything you log in Safari won't show up in the home-screen
> app. (If that happens, use Export Backup in Safari and Import Backup in the app.)

**iPhone (Safari)**
1. Open the link in **Safari**. Other browsers on iPhone can't do this.
2. Tap the **Share** button (the square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Open the tracker from the new **100 Days** icon.

**Android (Chrome)**
1. Open the link in **Chrome**.
2. Tap the **⋮** menu (top right), then **Install app** or **Add to Home screen**.
3. Open it from the new **100 Days** icon.

## 3. First run

You'll see a setup screen. Fill in your start date (Day 1), weights, goals, targets, your "why," and up to 5 extra habits. You can change all of it later in **Settings**.

**Just want to look around first?** Tap **Load sample data** to fill the app with a month of example entries. When you're ready to start for real, go to **Settings → Clear all data** (it asks twice before deleting anything).

## 4. Back up your data (please do this weekly!)

Your entries live only in your phone's browser. They can be lost if you clear your browser data, delete the home-screen app, or change phones. A backup protects you.

**To back up:** go to **Settings → Export Backup**. A file like `100-day-tracker-backup-2026-11-05.json` is saved.
- **iPhone:** choose **Save to Files**, ideally in iCloud Drive.
- **Android:** it goes to **Downloads**. Copy it to Google Drive to be safe.

**To restore** (new phone, or after clearing data): open the tracker and tap **Settings → Import Backup**, then pick your backup file. It replaces everything on this device, so it asks you to confirm first.

**Export CSV** creates a spreadsheet of all your daily entries that you can open in Google Sheets, Excel or Numbers. It's for looking at your data, not for restoring it. To restore, use the backup file.

Settings shows the date of your last backup.

## How the numbers work

| What | How it's calculated |
|---|---|
| Day / Week | Day 1 is your start date. Weeks are 7 days; week 15 is only days 99–100. |
| 7-day trend weight | Average of your weigh-ins from the last 7 days (including today). |
| Daily habits % | (Water + Reviewed why + Planned tomorrow + Protein target hit) ÷ 4. If you haven't set a protein target, it's the first three ÷ 3. |
| Workout % | Workouts ÷ (weekly target × days so far ÷ 7), capped at 100%. |
| Steps % | Average steps ÷ daily target, capped at 100%. |
| Extra habits % | For each habit, "yes" days count up to that habit's target for the days so far. Add those up for all habits, then divide by the total target. |
| Fitness score | Average of Workout % and Steps %. |
| Habit score | Average of Daily habits % and Extra habits %. |
| Weekly score | Average of Fitness and Habit scores. |
| Rating | 90%+ Excellent · 75%+ Strong · 60%+ Building · below 60% Reset & refocus |

**Blank fields and days:** a blank number (like steps you didn't enter) is left out of averages. A yes/no question you didn't answer counts as "no." **Days so far** means the days of the week up to and including today, so a week in progress is scored fairly.

**Measurements:** the change in each body part is compared with week 1 (or your first measured week). The change in the total only counts body parts measured both times, so skipping the optional calf won't throw it off.

## Tips

- Tap a Yes/No or 1–5 button again to clear it.
- Use the ‹ › arrows to move between days, or tap the date to pick one. You can fill in a missed day later.
- Everything saves automatically as you type ("Saved ✓" at the top of the Today screen).
- Light/dark mode follows your phone. You can change it in **Settings → Appearance**.

---

## For developers

Plain HTML/CSS/JS with no build step and no dependencies.

```
index.html            app shell
css/styles.css        styles (light + dark)
js/calc.js            all calculations (pure functions, no DOM)
js/app.js             screens, saving, backup/import, sample data
sw.js                 offline cache
manifest.webmanifest  home-screen install
icons/                icon.svg + PNGs rendered from it
tests/                unit tests + browser tests
```

Run the tests (Node 18+):

```bash
node --test tests/calc.test.js
```

The browser tests need Playwright with Chromium. They check phone and laptop sizes in both themes, plus backup export and import:

```bash
node tests/browser.test.js
```

To regenerate the PNG icons after editing `icons/icon.svg`, run `node tests/make-icons.js`.

Made by [@missniceph](https://instagram.com/missniceph).
