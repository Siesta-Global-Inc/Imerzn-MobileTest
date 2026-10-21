import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

/** Android package of the Imerzn app. */
export const appPackage = 'com.app.siestaglobal';

/** Folder on the device where test images are copied so the gallery picker shows them. */
const devicePicturesDir = '/sdcard/Pictures';

/**
 * Start the app from a clean state, as if it was just installed: clear its data (logs out),
 * grant all its permissions so no system popup covers the screen, then open it.
 */
export async function resetApp(): Promise<void> {
  await browser.execute('mobile: terminateApp', { appId: appPackage });
  await browser.execute('mobile: clearApp', { appId: appPackage });
  await browser.execute('mobile: changePermissions', {
    permissions: 'all',
    appPackage,
    action: 'grant',
  });
  await browser.execute('mobile: activateApp', { appId: appPackage });
}

/**
 * Keep the app open while it is slow to respond: tap "Wait" on Android's
 * "Imerzn isn't responding" popup, and reopen the app if it is no longer in front.
 */
export async function keepAppRunning(): Promise<void> {
  const waitButton = browser.$('//android.widget.Button[@text="Wait"]');
  if (await waitButton.isDisplayed().catch(() => false)) {
    console.info('[INFO] Android reported the app as not responding; tapping Wait.');
    await waitButton.click().catch(() => {});
    return;
  }
  const currentPackage = await browser.getCurrentPackage().catch(() => appPackage);
  if (currentPackage !== appPackage) {
    console.info(`[INFO] The app is not in front (${currentPackage}); reopening it.`);
    await browser.execute('mobile: activateApp', { appId: appPackage });
  }
}

/**
 * After tapping an upload area: copy the image to the device, choose "Choose From Gallery",
 * and pick it (the newest photo) in Android's photo picker.
 */
export async function uploadFromGallery(imagePath: string, openPicker: () => Promise<void>): Promise<void> {
  await addImageToGallery(imagePath);
  await openPicker();
  await browser.$('~Choose From Gallery').click();

  const newestPhoto = browser.$('(//*[starts-with(@content-desc, "Photo")])[1]');
  await newestPhoto.waitForDisplayed({ timeout: 60_000 });
  // On a slow emulator the picker ignores taps for a few seconds after its photos show (CI saw
  // three taps 20 seconds apart all ignored): let it settle, then tap again until it closes.
  await browser.pause(3_000);
  for (let tap = 1; tap <= 5; tap += 1) {
    if (!(await newestPhoto.isDisplayed().catch(() => false))) {
      return;
    }
    await browser.execute('mobile: clickGesture', { elementId: await newestPhoto.elementId }).catch(() => {});
    await newestPhoto.waitForDisplayed({ reverse: true, timeout: 30_000 }).catch(() => {});
  }
  await newestPhoto.waitForDisplayed({ reverse: true, timeout: 30_000 });
}

/**
 * After tapping an upload area that opens Android's file picker directly (e.g. the story's
 * "Click to upload"): copy the image to the device and pick it by its file name.
 */
export async function uploadFromFilePicker(imagePath: string, openPicker: () => Promise<void>): Promise<void> {
  const fileName = await addImageToGallery(imagePath);
  await openPicker();
  const file = browser.$(`//*[@resource-id="android:id/title" and @text="${fileName}"]`);
  await file.waitForDisplayed({ timeout: 60_000 });
  await file.click();
  await file.waitForDisplayed({ reverse: true, timeout: 60_000 });
}

/**
 * Copy an image from the project to the device's Pictures folder and register it in the
 * media library, so the app's "Choose From Gallery" picker shows it (newest first).
 * Returns the file's name on the device (unique per call).
 */
export async function addImageToGallery(localPath: string): Promise<string> {
  const absolutePath = resolve(process.cwd(), localPath);
  const fileName = `${Date.now()}-${basename(absolutePath)}`;
  const devicePath = `${devicePicturesDir}/${fileName}`;
  await browser.pushFile(devicePath, (await readFile(absolutePath)).toString('base64'));
  await browser.execute('mobile: shell', {
    command: 'am',
    args: ['broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE', '-d', `file://${devicePath}`],
  });
  return fileName;
}
