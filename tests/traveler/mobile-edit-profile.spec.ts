import { MobileLoginPage } from '@pages/auth/mobile-login-page';
import { MobileTravelerHomePage } from '@pages/traveler/mobile-traveler-home-page';
import { MobileTravelerProfilePage } from '@pages/traveler/mobile-traveler-profile-page';
import { readMobileTravelerProfileEditData } from '@data/traveler/mobile-traveler-data';
import { readMobileCreatedTraveler, updateMobileCreatedTraveler } from '@data/state/mobile-created-traveler';
import { step } from '@helpers/mobile-step';
import { resetApp } from '@helpers/mobile-app';

describe('mobile-traveler-edit-profile', () => {
  it('mobile SET-001 | Traveler edits name and phone on Edit Profile', async () => {
    // Pre-setup: the traveler created by mobile AUTH-003, and new details from traveler-settings.csv.
    const traveler = await readMobileCreatedTraveler();
    const data = await readMobileTravelerProfileEditData();
    console.info(`[DATA] Traveler email: ${traveler.email}`);

    const loginPage = new MobileLoginPage();
    const homePage = new MobileTravelerHomePage();
    const profilePage = new MobileTravelerProfilePage();

    await resetApp();

    // Step 1: Log in as the traveler (opens the Experiences tab).
    await step('Log in as traveler', async () => {
      await loginPage.open();
      await loginPage.login(traveler.email, traveler.password);
      await homePage.waitForLoaded();
    });

    // Step 2: Left menu > Profile > Edit Profile; change first name, last name, and phone; save.
    await step('Edit name and phone', async () => {
      await homePage.openMenuItem('Profile');
      await profilePage.waitForLoaded();
      await profilePage.openEditProfile();
      await profilePage.editDetails(data);
      await profilePage.saveChanges();
    });

    // Keep the saved account in sync so other traveler tests expect the new name.
    await updateMobileCreatedTraveler({ firstName: data.firstName, lastName: data.lastName });

    // Step 3: Open Edit Profile again and check the new details were kept.
    await step('Verify the saved details', async () => {
      await profilePage.waitForLoaded();
      await profilePage.openEditProfile();
      await profilePage.verifyDetails(data);
    });
  });
});
