import 'dotenv/config';
import { join } from 'node:path';

/**
 * Settings for the mobile tests that come from the environment (.env locally, the workflow's
 * env: block in CI). Read them from here instead of process.env, so every name and default
 * lives in one place.
 */
export const mobileEnv = {
  /** True on GitHub Actions (and any CI that sets CI=true). */
  isCI: Boolean(process.env.CI),

  /** Android SDK location, needed by Appium. Defaults to the Android Studio install path on Windows. */
  androidHome: process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk'),

  /** Device name sent to Appium. */
  device: process.env.MOBILE_DEVICE ?? 'Android',

  /** adb id of the device to use when several are connected. */
  udid: process.env.MOBILE_UDID,

  /**
   * AVD name: when set, Appium starts that emulator itself (slow: it cold boots each run).
   * Leave it empty to use the emulator started with `npm run mobile:emulator` or a USB phone.
   */
  avd: process.env.MOBILE_AVD,

  /** Admin portal (used by the localite signup test to verify the new localite). */
  adminBaseURL: process.env.ADMIN_BASE_URL ?? 'https://dev.admin.imerzn.com',

  /** The admin portal browser is hidden in CI, or locally when MOBILE_ADMIN_HEADLESS=true. */
  adminHeadless: Boolean(process.env.CI) || process.env.MOBILE_ADMIN_HEADLESS === 'true',

  /** Signup tests create real accounts, so they only run when RUN_SIGNUP_TEST=true. */
  runSignup: process.env.RUN_SIGNUP_TEST === 'true',
};
