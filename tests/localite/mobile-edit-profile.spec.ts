import { MobileLoginPage } from '@pages/auth/mobile-login-page';
import { MobileEditProfilePage } from '@pages/localite/mobile-edit-profile-page';
import { MobileProfilePage } from '@pages/localite/mobile-profile-page';
import { readMobileEditProfileData } from '@data/localite/mobile-localite-data';
import { readMobileCreatedLocalite, updateMobileCreatedLocalite } from '@data/state/mobile-created-localite';
import { step } from '@helpers/mobile-step';
import { resetApp } from '@helpers/mobile-app';

describe('mobile-edit-profile', () => {
  it('mobile PRF-002 | Localite edits name, bio, and hosted experiences', async () => {
    // Pre-setup: the localite created by mobile LOC-001, and new values from edit-profile.csv.
    const localite = await readMobileCreatedLocalite();
    const data = await readMobileEditProfileData();
    console.info(`[DATA] Localite email: ${localite.email}`);
    console.info(`[DATA] New localite name: ${data.firstName} ${data.lastName}`);

    const loginPage = new MobileLoginPage();
    const profilePage = new MobileProfilePage();
    const editProfilePage = new MobileEditProfilePage();

    await resetApp();

    // Step 1: Log in as the localite (opens the Profile screen).
    await step('Log in as localite', async () => {
      await loginPage.open();
      await loginPage.login(localite.email, localite.password);
      await profilePage.waitForLoaded();
    });

    // Step 2: Open Edit Profile and enter the new values.
    await step('Edit name, bio, and experiences', async () => {
      await profilePage.tapButton(profilePage.editProfileButton);
      await editProfilePage.fillForm(data, localite.bio);
    });

    // Step 3: Save; the app returns to the Profile.
    await step('Save the profile', async () => {
      await editProfilePage.save();
      await profilePage.waitForLoaded();
    });

    // Record the new name and bio so later tests (e.g. Preview Profile) expect them.
    await updateMobileCreatedLocalite({ firstName: data.firstName, lastName: data.lastName, bio: data.bio });

    // Step 4: Verify the new name and bio on the Profile.
    await step('Verify the updated profile', async () => {
      await profilePage.verifyDetails({ email: localite.email, ...data });
      await expect(profilePage.profileDetails(localite.email))
        .toHaveAttribute('content-desc', expect.stringContaining(data.experiences.join(', ')));
    });
  });
});
