import { MobileLoginPage } from '@pages/auth/mobile-login-page';
import { MobilePreviewProfilePage } from '@pages/localite/mobile-preview-profile-page';
import { MobileProfilePage } from '@pages/localite/mobile-profile-page';
import { readMobileCreatedLocalite } from '@data/state/mobile-created-localite';
import { step } from '@helpers/mobile-step';
import { resetApp } from '@helpers/mobile-app';

describe('mobile-preview-profile', () => {
  it('mobile PRF-001 | Localite previews the profile and goes back', async () => {
    // Pre-setup: the localite created by mobile LOC-001, with the experience and gallery created
    // by mobile EXP-002 and GAL-001.
    const localite = await readMobileCreatedLocalite();
    const { experienceTitle, galleryTitle } = localite;
    if (!experienceTitle || !galleryTitle) {
      throw new Error(
        `No created experience/gallery recorded for ${localite.email}. ` +
        'Run the mobile Create Experience and Create Gallery tests first.',
      );
    }
    console.info(`[DATA] Localite email: ${localite.email}`);

    const loginPage = new MobileLoginPage();
    const profilePage = new MobileProfilePage();
    const previewProfilePage = new MobilePreviewProfilePage();

    await resetApp();

    // Step 1: Log in as the localite (opens the Profile screen).
    await step('Log in as localite', async () => {
      await loginPage.open();
      await loginPage.login(localite.email, localite.password);
      await profilePage.waitForLoaded();
    });

    // Step 2: Open Preview Profile.
    await step('Open Preview Profile', async () => {
      await profilePage.tapButton(profilePage.previewProfileButton);
      await previewProfilePage.waitForLoaded();
    });

    // Step 3: Verify name, bio, and the buttons travelers see.
    await step('Verify profile details on the preview', async () => {
      await previewProfilePage.verifyDetails(localite);
    });

    // Step 4: Verify the created gallery and experience are shown.
    await step('Verify the created gallery and experience', async () => {
      await previewProfilePage.verifyCardDisplayed(galleryTitle);
      await previewProfilePage.verifyCardDisplayed(experienceTitle);
    });

    // Step 5: Back returns to the Profile.
    await step('Go back to the Profile', async () => {
      await previewProfilePage.backButton.click();
      await profilePage.waitForLoaded();
      await expect(previewProfilePage.heading).not.toBeDisplayed();
    });
  });
});
