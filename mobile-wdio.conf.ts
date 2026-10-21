import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mobileEnv } from './config/mobile-env';

// Appium needs the Android SDK location.
process.env.ANDROID_HOME = mobileEnv.androidHome;

/** Android package and launch activity of the Imerzn app (testdata/apk/app-debug.apk). */
const appPackage = 'com.app.siestaglobal';
const appActivity = 'com.app.siestaglobal.MainActivity';

const resultsDir = resolve('mobile-test-results');
/** Failed tests of this run, one JSON object per line (error and screenshot path). */
const failuresFile = join(resultsDir, 'failures.jsonl');

// Tests use the running emulator or USB phone (start the emulator with `npm run mobile:emulator`).
// Set MOBILE_AVD=<AVD name> to let Appium start that emulator instead (slow: it cold boots each run).
const avd = mobileEnv.avd;

export const config: WebdriverIO.Config = {
  runner: 'local',
  tsConfigPath: './tsconfig.json',

  // Run order: the signups create the localite and traveler; Create Experience and Create Gallery
  // add the content the other tests use; the booking flow runs last, in file order (each step uses
  // the bookings made or changed before it). Add new test files to this list.
  specs: [
    './tests/auth/mobile-login.spec.ts',
    './tests/auth/mobile-traveler-signup.spec.ts',
    './tests/auth/mobile-localite-signup-and-verify.spec.ts',
    './tests/localite/mobile-create-experience.spec.ts',
    './tests/localite/mobile-create-gallery.spec.ts',
    './tests/localite/mobile-edit-profile.spec.ts',
    './tests/localite/mobile-preview-profile.spec.ts',
    './tests/localite/mobile-share-profile.spec.ts',
    './tests/localite/mobile-left-menu.spec.ts',
    './tests/localite/mobile-localite-settings.spec.ts',
    './tests/localite/mobile-referral-program.spec.ts',
    './tests/traveler/mobile-stories.spec.ts',
    './tests/traveler/mobile-edit-profile.spec.ts',
    './tests/traveler/mobile-wishlist.spec.ts',
    './tests/flows/booking/mobile-01-experience-booking.spec.ts',
    './tests/flows/booking/mobile-02-traveler-bookings-after-bookings.spec.ts',
    './tests/flows/booking/mobile-03-localite-bookings-after-bookings.spec.ts',
    './tests/flows/booking/mobile-04-traveler-cancel-booking.spec.ts',
    './tests/flows/booking/mobile-05-localite-cancel-booking.spec.ts',
  ],
  // One device, so run one test file at a time.
  maxInstances: 1,
  // On CI, run a failed test file once more right away: on a freshly booted emulator the first
  // session can fail while Appium's keyboard is still being registered.
  specFileRetries: process.env.CI ? 1 : 0,

  // Appium is started and stopped by the appium service (installed in node_modules).
  port: 4723,
  services: [
    [
      'appium',
      {
        // relaxedSecurity allows "mobile: shell", used to add test images to the gallery.
        // chromedriver_autodownload lets Appium fetch the ChromeDriver that matches the app's
        // web view, used to fill the rich-text editors (helpers/mobile-html-editor.ts).
        args: { relaxedSecurity: true, allowInsecure: 'uiautomator2:chromedriver_autodownload' },
        // Appium starts slowly on a slow PC; the default 30 seconds is not enough.
        appiumStartTimeout: 180_000,
        // Saves wdio-appium.log in this folder.
        logPath: resultsDir,
      },
    ],
  ],

  capabilities: [
    {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': mobileEnv.device,
      ...(mobileEnv.udid ? { 'appium:udid': mobileEnv.udid } : {}),
      ...(avd ? { 'appium:avd': avd, 'appium:avdLaunchTimeout': 300_000, 'appium:avdReadyTimeout': 300_000 } : {}),

      // Installed once (only when missing or older); each test resets the app data itself.
      'appium:app': resolve('testdata/apk/app-debug.apk'),
      'appium:appPackage': appPackage,
      'appium:appActivity': appActivity,
      'appium:noReset': true,

      // Type with Appium's hidden keyboard, so the on-screen keyboard never covers fields.
      'appium:hideKeyboard': true,

      // The debug build is slow on emulators: allow time to start.
      'appium:uiautomator2ServerLaunchTimeout': 180_000,
      'appium:uiautomator2ServerInstallTimeout': 180_000,
      'appium:adbExecTimeout': 120_000,
      'appium:androidInstallTimeout': 300_000,
      'appium:newCommandTimeout': 600,
    },
  ],

  logLevel: 'warn',
  waitforTimeout: 30_000,
  connectionRetryTimeout: 600_000,
  connectionRetryCount: 1,

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    // Signup flows on a slow emulator take several minutes.
    timeout: 600_000,
  },
  reporters: ['spec'],

  onPrepare() {
    mkdirSync(resultsDir, { recursive: true });
    rmSync(failuresFile, { force: true });
  },

  /** Do not wait for the app to go idle: its background video keeps the UI thread busy. */
  async before() {
    await browser.updateSettings({ waitForIdleTimeout: 0 });
  },

  /** Save a screenshot of the device when a test fails. */
  async afterTest(test, _context, { passed, error }) {
    if (!passed) {
      const name = test.title.replace(/[^\w-]+/g, '_');
      const screenshot = join(resultsDir, `${name}.png`);
      await browser.saveScreenshot(screenshot).catch(() => {});
      // The screen's element tree, to see which elements were there when the test failed.
      await browser.getPageSource()
        .then((source) => writeFileSync(join(resultsDir, `${name}.xml`), source))
        .catch(() => {});
      // One line per failed test, for the Slack report (scripts/slack-report.mjs).
      appendFileSync(failuresFile, `${JSON.stringify({
        title: test.fullTitle ?? test.title,
        file: test.file ? relative(process.cwd(), test.file) : undefined,
        error: error?.stack ?? error?.message ?? String(error ?? ''),
        images: [screenshot],
      })}\n`);
    }
  },

  /** A test file that passed on its retry is not a failure: drop what its first attempt recorded. */
  after(result, _capabilities, specs) {
    if (result !== 0 || !existsSync(failuresFile)) return;
    const files = new Set(specs.map((spec) => relative(process.cwd(), spec.startsWith('file:') ? fileURLToPath(spec) : spec)));
    const kept = readFileSync(failuresFile, 'utf8').split('\n')
      .filter((line) => line && !files.has(JSON.parse(line).file));
    writeFileSync(failuresFile, kept.map((line) => `${line}\n`).join(''));
  },
};
