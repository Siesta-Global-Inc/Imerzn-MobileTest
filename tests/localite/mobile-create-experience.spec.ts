import { MobileLoginPage } from '@pages/auth/mobile-login-page';
import { MobileCreateExperiencePage } from '@pages/localite/mobile-create-experience-page';
import { MobileProfilePage } from '@pages/localite/mobile-profile-page';
import { readMobileExperienceData } from '@data/localite/mobile-localite-data';
import { readMobileCreatedLocalite, updateMobileCreatedLocalite } from '@data/state/mobile-created-localite';
import { step } from '@helpers/mobile-step';
import { resetApp } from '@helpers/mobile-app';

describe('mobile-create-experience', () => {
  it('mobile EXP-002 | Localite creates and publishes an experience', async function () {
    // Filling, rechecking, and publishing the long form takes over 10 minutes on a slow emulator.
    this.timeout(1_200_000);

    // Pre-setup: the localite created by mobile LOC-001, and form values from create-experience.csv.
    const localite = await readMobileCreatedLocalite();
    const data = await readMobileExperienceData();
    console.info(`[DATA] Localite email: ${localite.email}`);
    console.info(`[DATA] Experience title: ${data.title}`);

    const loginPage = new MobileLoginPage();
    const profilePage = new MobileProfilePage();
    const createExperiencePage = new MobileCreateExperiencePage();

    await resetApp();

    // Step 1: Log in as the localite (opens the Profile screen).
    await step('Log in as localite', async () => {
      await loginPage.open();
      await loginPage.login(localite.email, localite.password);
      await profilePage.waitForLoaded();
    });

    // Step 2: Open Create Experience and fill in the form.
    await step('Fill in the Create Experience form', async () => {
      await profilePage.tapButton(profilePage.createExperienceButton);
      await createExperiencePage.fillForm(data);
    });

    // Step 3: Scroll up, type Know Before You Go again if it is empty, and tap Price.
    await step('Recheck Know Before You Go and tap Price', async () => {
      await createExperiencePage.recheckBeforePublish(data);
    });

    // Step 4: Publish; the app returns to the Profile.
    await step('Publish the experience', async () => {
      await createExperiencePage.publish();
      await profilePage.waitForLoaded();
    });

    // Record the title so Preview Profile can verify it.
    await updateMobileCreatedLocalite({ experienceTitle: data.title });

    // Step 5: Verify the experience is listed on the Profile.
    await step('Verify the experience on the Profile', async () => {
      await profilePage.verifyCardDisplayed(data.title);
    });
  });
});
