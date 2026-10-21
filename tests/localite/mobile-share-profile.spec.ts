import { MobileLoginPage } from '@pages/auth/mobile-login-page';
import { MobileProfilePage } from '@pages/localite/mobile-profile-page';
import { readMobileCreatedLocalite } from '@data/state/mobile-created-localite';
import { step } from '@helpers/mobile-step';
import { resetApp } from '@helpers/mobile-app';

describe('mobile-share-profile', () => {
  it('mobile PRF-003 | Localite opens and closes the share sheet from the profile', async () => {
    // Pre-setup: the localite created by mobile LOC-001.
    const localite = await readMobileCreatedLocalite();
    console.info(`[DATA] Localite email: ${localite.email}`);

    const loginPage = new MobileLoginPage();
    const profilePage = new MobileProfilePage();

    await resetApp();

    // Step 1: Log in as the localite (opens the Profile screen).
    await step('Log in as localite', async () => {
      await loginPage.open();
      await loginPage.login(localite.email, localite.password);
      await profilePage.waitForLoaded();
    });

    // Step 2: Share profile opens Android's share sheet with the profile link.
    await step('Open the share sheet', async () => {
      await profilePage.tapButton(profilePage.shareProfileButton);
      await profilePage.shareSheetLink.waitForDisplayed({ timeout: 30_000 });
      console.info(`[DATA] Shared link: ${await profilePage.shareSheetLink.getText()}`);
    });

    // Step 3: Back closes the share sheet and returns to the Profile.
    await step('Close the share sheet', async () => {
      await browser.back();
      await profilePage.shareSheetLink.waitForDisplayed({ reverse: true });
      await profilePage.waitForLoaded();
      await expect(profilePage.shareProfileButton).toBeDisplayed();
    });
  });
});
