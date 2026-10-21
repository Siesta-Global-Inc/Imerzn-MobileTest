// Start the Android emulator for the mobile tests and wait until it has fully booted.
// Usage: npm run mobile:emulator   (AVD from MOBILE_AVD, default Medium_Phone_API_36.0)
// Set MOBILE_HEADLESS=true to run it without a window (lighter on a slow PC).
// Leave the emulator open between test runs: booting it takes minutes on a slow PC.
import { execFileSync, spawn } from 'node:child_process';
import { join } from 'node:path';

const sdk = process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
const adb = join(sdk, 'platform-tools', 'adb');
const emulator = join(sdk, 'emulator', 'emulator');
const avd = process.env.MOBILE_AVD || 'Medium_Phone_API_36.0';
const headless = process.env.MOBILE_HEADLESS === 'true';

function adbOutput(...args) {
  try {
    return execFileSync(adb, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

if (/emulator-\d+\s+device/.test(adbOutput('devices'))) {
  console.info('An emulator is already running.');
  process.exit(0);
}

console.info(`Starting emulator ${avd}${headless ? ' (headless)' : ''} ...`);
const args = ['-avd', avd, '-no-boot-anim', ...(headless ? ['-no-window'] : [])];
// Detached, so the emulator keeps running after this script ends.
spawn(emulator, args, { detached: true, stdio: 'ignore' }).unref();

const deadline = Date.now() + 10 * 60_000;
while (adbOutput('shell', 'getprop', 'sys.boot_completed') !== '1') {
  if (Date.now() > deadline) {
    console.error('The emulator did not finish booting within 10 minutes.');
    process.exit(1);
  }
  await new Promise((done) => setTimeout(done, 5_000));
}

// Android keeps starting background services right after boot; give it time to settle.
console.info('Booted. Waiting 60 seconds for Android to settle ...');
await new Promise((done) => setTimeout(done, 60_000));
console.info('Emulator is ready.');
