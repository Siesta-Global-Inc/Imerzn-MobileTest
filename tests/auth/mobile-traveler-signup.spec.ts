import { MobileCreateProfilePage } from '@pages/auth/mobile-create-profile-page';
import { MobileLoginPage } from '@pages/auth/mobile-login-page';
import { MobileSignupPage } from '@pages/auth/mobile-signup-page';
import { MobileWelcomePage } from '@pages/auth/mobile-welcome-page';
import {
  createMobileSignupFormData,
  readMobileAuthData,
  readMobileTravelerProfileData,
} from '@data/common/mobile-auth-data';
import { saveMobileCreatedTraveler } from '@data/state/mobile-created-traveler';
import { mobileEnv } from '@config/mobile-env';
import { step } from '@helpers/mobile-step';
import { resetApp } from '@helpers/mobile-app';

describe('mobile-traveler-signup', () => {
  it('mobile AUTH-003 | Traveler can complete the signup process', async function () {
    // Run only when explicitly enabled because signup creates a real account.
    if (!mobileEnv.runSignup) {
      this.skip();
    }

    // Pre-setup: Prepare signup test data and screens.
    const authData = await readMobileAuthData();
    const signupData = createMobileSignupFormData(authData, authData.signupTravelerEmail);
    const profileData = await readMobileTravelerProfileData();
    console.info(`[DATA] Traveler email: ${signupData.email}`);

    const welcomePage = new MobileWelcomePage();
    const signupPage = new MobileSignupPage();
    const createProfilePage = new MobileCreateProfilePage();
    const loginPage = new MobileLoginPage();

    await resetApp();

    // Step 1: Open Create Account and select Traveler.
    await step('Open Sign Up as a Traveler', async () => {
      await welcomePage.openSignup();
      await signupPage.selectRole('Traveler');
    });

    // Step 2: Enter all required signup information and submit it.
    await step('Fill in and submit the signup form', async () => {
      await signupPage.fillForm(signupData);
      await signupPage.submit();
    });

    // Step 3: Enter the test OTP from auth.csv.
    await step('Verify OTP number', async () => {
      await signupPage.verifyCode(authData.signupOtp);
      await createProfilePage.waitForLoaded();
    });

    // Step 4: Upload and save the cropped profile picture.
    await step('Upload and save profile picture', async () => {
      await createProfilePage.uploadProfilePhoto(profileData.profilePicturePath);
    });

    // Step 5: Pick the location (fills Country, State and City) and submit the profile.
    await step('Select location and submit profile', async () => {
      await createProfilePage.selectLocation(profileData);
      await createProfilePage.submit();
    });

    // Step 6: Verify the traveler is signed in: the app shows neither the profile form nor the login screen.
    await step('Verify the traveler is signed in', async () => {
      await expect(createProfilePage.heading).not.toBeDisplayed();
      await expect(loginPage.heading).not.toBeDisplayed();
    });

    // Save the new traveler so the mobile traveler tests log in with it.
    await saveMobileCreatedTraveler({
      email: signupData.email,
      password: signupData.password,
      firstName: signupData.firstName,
      lastName: signupData.lastName,
    });
  });
});
