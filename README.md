# Imerzn Mobile Tests (Android app)

End-to-end tests for the Imerzn Android app (Flutter), against [dev.imerzn.com](https://dev.imerzn.com).
Appium (UiAutomator2) + WebdriverIO + Mocha, in TypeScript. Config: `mobile-wdio.conf.ts`, TypeScript: `tsconfig.json`.

## Setup

Once:

1. Node.js 20+, then `npm install` (also installs the Appium UiAutomator2 driver).
2. Android Studio with an emulator (default AVD `Medium_Phone_API_36.0`; `Pixel_8_Pro` also works) and `ANDROID_HOME` set.
3. `Copy-Item .env.example .env`
4. Add the app at **`testdata/apk/app-debug.apk`** and **`testdata/common/auth.csv`** (logins, signup data, admin account). Neither is in git — ask the team.

`auth.csv` also needs `Traveler Location Search`, `Traveler Location` and `Traveler Profile Picture` for the traveler signup.

## Run tests

| Command | What it does |
|---|---|
| `npm run mobile:emulator` | Start the emulator and wait until it is ready (`MOBILE_AVD=<name>` for another AVD, `MOBILE_HEADLESS=true` for no window) |
| `npm run mobile:test` | Run all mobile tests |
| `npx wdio run mobile-wdio.conf.ts --spec <file>` | Run one test file |
| `npm run mobile:login` | Login (AUTH-001, AUTH-002) |
| `npm run mobile:signup` | Traveler signup (AUTH-003) |
| `npm run mobile:localite-signup` | Localite signup + admin verification (LOC-001) |
| `npm run mobile:typecheck` | Check for TypeScript errors |

- Start the emulator first and leave it open between runs (booting takes minutes). To use a USB phone instead, plug it in with USB debugging on (set `$env:MOBILE_UDID='<adb device id>'` if several devices are connected).
- Signup tests create real accounts, so they only run with `RUN_SIGNUP_TEST=true`.
- Each test clears the app data and grants its permissions first, so it starts logged out on the welcome screen.
- After a new APK with the same version number, reinstall it: `adb uninstall com.app.siestaglobal`, then `adb install -r -g testdata/apk/app-debug.apk`.

## Tests

Test titles start with "mobile ". Run the signup tests first: the other tests use the accounts they create.

| Folder | Test |
|---|---|
| `auth/` | Login fails / succeeds (AUTH-001, AUTH-002) |
| | Traveler signup (AUTH-003) — saves the traveler for the traveler tests |
| | Localite signup + admin verification (LOC-001) — saves the localite for the localite tests |
| `localite/` | Create and publish an experience (EXP-002) |
| | Create a gallery (GAL-001) |
| | Edit profile (PRF-002), Preview profile (PRF-001), Share profile (PRF-003) |
| | Change password (SET-002) |
| | Left menu items (MENU-001) |
| `traveler/` | Edit name and phone on Edit Profile (SET-001) |
| | Share a story after login (STR-001) |
| | Wishlist (WSH-001) |
| `flows/booking/` | 01 Book: 2 paid + 2 pending (BKG-001) |
| | 02 Traveler Bookings and Transaction History (DSH-002) |
| | 03 Localite Bookings, Transactions, earnings (LBK-001) |
| | 04 Traveler cancels an On Going and a pending booking (CNL-001) |
| | 05 Localite cancels an On Going and a pending booking (LCN-001) |

## How tests share accounts

Tests save the accounts and content they create, and later tests use them. These files are generated, local-only, and ignored by git:

- **Localite** → `testdata/localite/mobile-created-localite.json` (LOC-001; EXP-002 and GAL-001 add their titles)
- **Traveler** → `testdata/traveler/mobile-created-traveler.json` (AUTH-003)
- **Bookings** → `testdata/traveler/mobile-created-bookings.json` (BKG-001, used by the rest of the booking flow)

## Test data

| Folder | Contents |
|---|---|
| `testdata/common/` | `auth.csv` (local only) |
| `testdata/localite/` | Experience, gallery, edit-profile, settings CSVs, plus images |
| `testdata/traveler/` | Booking, wishlist, story, and settings CSVs, plus images |

Edit the **Value** column of a CSV to change test data; keep the **Field** names as they are. Rows starting with "Mobile" are values picked in the app (e.g. a location suggestion).

## Project structure

```
config/mobile-env.ts             Settings from .env (MOBILE_UDID, MOBILE_AVD, RUN_SIGNUP_TEST, ...)
data/mobile-csv-loader.ts        Reads Field,Value CSVs
data/<area>/mobile-*-data.ts     One reader per CSV in testdata/
data/state/mobile-created-*.ts   The files that pass accounts and bookings between tests
helpers/mobile-step.ts           step()
helpers/mobile-app.ts            Reset / keep the app open, add images to the device
helpers/mobile-elements.ts       Find elements by Flutter label or hint, type, scroll, tap
pages/<role>/mobile-*.ts         Screens (admin/mobile-admin-portal-page.ts is the web admin portal, driven with Playwright)
tests/<area>/mobile-*.spec.ts    Tests
scripts/mobile-start-emulator.mjs
docs/                            Prompt and framework notes
```

Imports use short aliases from `tsconfig.json`: `@config/…`, `@data/…`, `@helpers/…`, `@pages/…`.

## Debugging

Failure screenshots, the screen's element tree, and the Appium log go to `mobile-test-results/`.

## Known app issues (2026-10-21)

- **Payment price:** the Payment screen shows a 2.15% Platform Fee (e.g. $183.87 for 4 people), but the traveler is charged 2% ($183.60). DSH-002's last step fails on this.
- **Withdraw dialog:** Referral Program > Withdraw shows **Name: null** (reported to the dev team). Not checked by REF-001. A second withdrawal while one is pending is refused with "You already have a pending withdrawal request for this referral" — expected; REF-001 accepts it.
- **Story submit:** after Submit Experience the app shows a red error screen, though the story is saved; STR-001 reopens the app.
- **Slow emulator:** on a 2 GB emulator the app can empty rich-text boxes after they are filled (fine on a real phone).
