import { MobileLoginPage } from '@pages/auth/mobile-login-page';
import { MobileCreateGalleryPage } from '@pages/localite/mobile-create-gallery-page';
import { MobileProfilePage } from '@pages/localite/mobile-profile-page';
import { readMobileGalleryData } from '@data/localite/mobile-localite-data';
import { readMobileCreatedLocalite, updateMobileCreatedLocalite } from '@data/state/mobile-created-localite';
import { step } from '@helpers/mobile-step';
import { resetApp } from '@helpers/mobile-app';

describe('mobile-create-gallery', () => {
  it('mobile GAL-001 | Localite creates a gallery and it appears on the profile', async () => {
    // Pre-setup: the localite created by mobile LOC-001, and gallery data from create-gallery.csv.
    const localite = await readMobileCreatedLocalite();
    const data = await readMobileGalleryData();
    console.info(`[DATA] Localite email: ${localite.email}`);
    console.info(`[DATA] Gallery title: ${data.title}`);

    const loginPage = new MobileLoginPage();
    const profilePage = new MobileProfilePage();
    const createGalleryPage = new MobileCreateGalleryPage();

    await resetApp();

    // Step 1: Log in as the localite (opens the Profile screen).
    await step('Log in as localite', async () => {
      await loginPage.open();
      await loginPage.login(localite.email, localite.password);
      await profilePage.waitForLoaded();
    });

    // Step 2: Open Create Gallery and fill in the form.
    await step('Fill in the Create Gallery form', async () => {
      await profilePage.tapButton(profilePage.createGalleryButton);
      await createGalleryPage.fillForm(data);
    });

    // Step 3: Save; the app shows a success message and returns to the Profile.
    await step('Save the gallery', async () => {
      await createGalleryPage.save();
      await profilePage.waitForLoaded();
    });

    // Record the title so Preview Profile can verify it.
    await updateMobileCreatedLocalite({ galleryTitle: data.title });

    // Step 4: Verify the gallery is listed on the Profile.
    await step('Verify the gallery on the Profile', async () => {
      await profilePage.verifyCardDisplayed(data.title);
    });
  });
});
