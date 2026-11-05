# 100-Day Progress Tracker

A private, phone-first tracker for my 100-day fitness and habit challenge.

- **Private:** no account, no login, no tracking, no AI. Everything is saved **only on your phone**, in the browser.
- **Works offline** once it's been opened, and installs to your home screen like an app.
- **Five screens:** Today · Dashboard · Weekly · Measurements · Settings.
- **Workout log with progressive overload:** log your sets, see what you did last time, and get a target for next time.

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

**To back up:** go to **Settings → Export Backup**. It makes a file named like `100-day-tracker-backup-2026-11-05.json`.
- **On a phone,** the share menu opens. On iPhone, choose **Save to Files** (iCloud Drive is safest). On Android, choose **Drive** or **Files**.
- **On a computer,** it downloads to your Downloads folder.

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

## Workout log (progressive overload)

On the **Today** screen, under Movement, the **Workout log** is where you record your lifting.

1. **Add an exercise.** Type a name and tap **Add**, or tap one of your recent exercises.
2. **Log each set:** weight and reps. Leave the weight blank for bodyweight moves like push-ups. Logging reps also marks the day as "Worked out."
3. **Next time you add it,** you'll see what you did last time and what to aim for. The weight is pre-filled, so usually you only type reps.

**How the "aim for" target works** ("double progression", a simple, common way to keep getting stronger):
- If **every set** at your heaviest weight reached the **top of your rep range** (8–12 by default), it suggests **going up one weight step** (2.5 kg / 5 lbs) and starting again at the bottom of the range.
- Otherwise, it suggests **staying at the same weight and doing one more rep**.
- For bodyweight exercises, it suggests one more rep than your best set.

You can change the rep range and weight step in **Settings → Strength training**. You can also rename or delete exercises there; renaming keeps the history.

**Where to see progress:**
- **Dashboard → Strength progress:** pick an exercise to see its chart, your best set, your recent sessions, and how much stronger you are than your first session.
- **Weekly cards:** sets lifted, lifting volume (weight × reps, added up) versus last week, and new bests.

**Est. max** is an *estimated* 1-rep max, using the Epley formula: weight × (1 + reps ÷ 30), for sets of up to 15 reps. It lets you compare a heavy set of 6 with a lighter set of 12, and you never have to test it. A **new best ⭐** means your estimated max beat every earlier session (for bodyweight moves: more reps in one set than ever before).

**Measurements:** the change in each body part is compared with week 1 (or your first measured week). The change in the total only counts body parts measured both times, so skipping the optional calf won't throw it off.

## Tips

- Tap a Yes/No or 1–5 button again to clear it.
- Missed logging a workout? Use the ‹ arrow to go back to that day and add it. The targets always use your most recent earlier session.
- Use the ‹ › arrows to move between days, or tap the date to pick one. You can fill in a missed day later.
- Everything saves automatically as you type ("Saved ✓" at the top of the Today screen).
- Light/dark mode follows your phone. You can change it in **Settings → Appearance**.

---

## What's here and how to update it

The whole app is a handful of plain files. There's no build step, and nothing to install to run it.

| File | What it is |
|---|---|
| `index.html` | The page itself, plus the title, description and link-preview tags |
| `css/styles.css` | All colours and layout. The colours are at the top (light mode first, then dark). |
| `js/app.js` | The screens, saving, backup/import, and the sample data |
| `js/calc.js` | Every calculation (scores, trend weight, averages, measurement changes, workout targets and bests) |
| `sw.js` | Lets the app open offline and load instantly from the phone's cache |
| `manifest.webmanifest` | Home-screen name, colours and icons |
| `icons/icon.svg` | The app icon (the source; PNG copies are made from it) |
| `icons/og-image.svg` | The picture shown when you share the link (the source for `og-image.png`) |
| `tests/` | Automatic checks: `calc.test.js` (the maths) and `browser.test.js` (the app in a real browser) |

**To change wording or colours:** edit the file on GitHub (open it, then tap the ✏️ pencil), and commit. GitHub Pages republishes in a minute or two.

**After any change, bump the cache version** in `sw.js` (for example `ptracker-v4` → `ptracker-v5`). Whenever a phone is online, opening the app loads the latest version. Bumping the version also makes an app that's already open (resumed from the background) reload itself with the update the next time you switch back to it.

**Not seeing an update?** Wait about 2 minutes after merging for GitHub to publish it, then fully close the app (on iPhone, swipe it away in the app switcher) and open it again.

**Your data is safe during updates.** Entries live on your phone, not in these files. Still, export a backup before big changes.

**If you change the icon or share image:** edit the `.svg` file, then run `node tests/make-icons.js` to remake the PNGs. This needs Playwright and Python's Pillow.

**If the site address changes** (a new repository name or your own domain), update the two `https://missniceph.github.io/wellness-tracker/` links in `index.html`. Link previews need the full address.

**Run the checks** (Node 18 or newer):

```bash
node --test tests/calc.test.js
```

The browser checks need Playwright with Chromium. They cover phone (360 and 390 px), tablet and laptop sizes, light and dark mode, keyboard focus, and backup export and import:

```bash
node tests/browser.test.js
```

Made by [@missniceph](https://instagram.com/missniceph).
