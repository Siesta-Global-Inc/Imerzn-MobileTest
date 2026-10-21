import { MobileAdminPortalPage } from '@pages/admin/mobile-admin-portal-page';
import { MobileCreateProfilePage } from '@pages/auth/mobile-create-profile-page';
import { MobileSignupPage } from '@pages/auth/mobile-signup-page';
import { MobileWelcomePage } from '@pages/auth/mobile-welcome-page';
import { MobileProfilePage } from '@pages/localite/mobile-profile-page';
import {
  createMobileLocaliteProfileData,
  createMobileSignupFormData,
  readMobileAuthData,
} from '@data/common/mobile-auth-data';
import { saveMobileCreatedLocalite } from '@data/state/mobile-created-localite';
import { mobileEnv } from '@config/mobile-env';
import { step } from '@helpers/mobile-step';
import { resetApp } from '@helpers/mobile-app';

describe('mobile-localite-signup-and-verify', () => {
  const adminPortal = new MobileAdminPortalPage();

  // Close the admin Chrome window even if a step fails.
  after(async () => {
    await adminPortal.close();
  });

  it('mobile LOC-001 | New localite signs up and is verified by an admin', async function () {
    // Run only when explicitly enabled because signup creates a real account.
    if (!mobileEnv.runSignup) {
      this.skip();
    }

    // Pre-setup: Prepare test data and screens.
    const authData = await readMobileAuthData();
    const signupData = createMobileSignupFormData(authData, authData.signupLocaliteEmail);
    const profileData = createMobileLocaliteProfileData(authData);
    console.info(`[DATA] Localite email: ${signupData.email}`);

    const welcomePage = new MobileWelcomePage();
    const signupPage = new MobileSignupPage();
    const createProfilePage = new MobileCreateProfilePage();
    const profilePage = new MobileProfilePage();

    await resetApp();

    // Step 1: Open Create Account and sign up as a Localite.
    await step('Sign up as a new Localite', async () => {
      await welcomePage.openSignup();
      await signupPage.selectRole('Localites');
      await signupPage.fillForm(signupData);
      await signupPage.submit();
    });

    // Step 2: Verify the phone number with the test OTP from auth.csv.
    await step('Verify phone number', async () => {
      await signupPage.verifyCode(authData.signupOtp);
      await createProfilePage.waitForLoaded();
    });

    // Step 3: Complete the Create Your Profile form and submit it.
    await step('Create the localite profile', async () => {
      await createProfilePage.uploadProfilePhoto(profileData.profilePicturePath);
      await createProfilePage.fillLocaliteDetails(profileData);
      await createProfilePage.submit();
    });

    // Step 4: The "Your profile has been updated!" popup appears; tap Return to Home and check the Profile screen.
    await step('Close the profile updated popup', async () => {
      await profilePage.closeProfileUpdatedPopup();
      await profilePage.waitForLoaded();
      await expect(profilePage.heading).toBeDisplayed();
    });

    // Step 5: Sign in to the admin portal (web).
    await step('Sign in to the admin portal', async () => {
      await adminPortal.launch();
      await adminPortal.login(authData.adminEmail, authData.adminPassword);
    });

    // Step 6: Find the new localite in Users > LOCALITE and open it.
    await step('Open the new localite in admin Users', async () => {
      await adminPortal.openUser('LOCALITE', signupData.email);
    });

    // Step 7: Enable Verified and save.
    await step('Mark the localite as Verified', async () => {
      await adminPortal.markVerifiedAndSave();
    });

    // Save the verified localite so the mobile Profile tests log in with it.
    await saveMobileCreatedLocalite({
      email: signupData.email,
      password: signupData.password,
      firstName: signupData.firstName,
      lastName: signupData.lastName,
      bio: profileData.bio,
    });
  });
});
