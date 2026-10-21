import { randomInt } from 'node:crypto';
import { existingFile, readFieldValueCsv, requiredGetter, testDataPath } from '@data/mobile-csv-loader';

const authCsvPath = testDataPath('common', 'auth.csv');

/** Values from auth.csv used by the mobile auth tests. */
export interface MobileAuthData {
  loginEmail: string;
  loginPassword: string;
  signupFullName: string;
  signupTravelerEmail: string;
  signupLocaliteEmail: string;
  signupPhone: string;
  signupPassword: string;
  signupOtp: string;
  localiteNewPassword: string;
  adminEmail: string;
  adminPassword: string;
  localiteProfilePicture: string;
  localiteBio: string;
  localiteExperiences: string[];
  localiteZipcode: string;
}

/** Data typed into the mobile Sign Up form. */
export interface MobileSignupFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}

/** Data for the traveler "Create Your Profile" screen. */
export interface MobileTravelerProfileData {
  profilePicturePath: string;
  locationSearch: string;
  location: string;
}

/** Data for the localite "Create Your Profile" screen. */
export interface MobileLocaliteProfileData {
  profilePicturePath: string;
  bio: string;
  experiences: string[];
  zipcode: string;
}

/** Read and validate auth.csv. */
export async function readMobileAuthData(): Promise<MobileAuthData> {
  const data = await readFieldValueCsv(authCsvPath);
  const get = requiredGetter(data, authCsvPath);

  return {
    loginEmail: get('Login Email'),
    loginPassword: get('Login Password'),
    signupFullName: get('Signup Full Name'),
    signupTravelerEmail: get('Signup Traveler Email'),
    signupLocaliteEmail: get('Signup Localite Email'),
    signupPhone: get('Signup Phone'),
    signupPassword: get('Signup Password'),
    signupOtp: get('Signup OTP'),
    localiteNewPassword: get('Localite New Password'),
    adminEmail: get('Admin Email'),
    adminPassword: get('Admin Password'),
    localiteProfilePicture: get('Localite Profile Picture'),
    localiteBio: get('Localite Bio'),
    localiteExperiences: get('Localite Experiences I Host')
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean),
    localiteZipcode: get('Localite Zipcode'),
  };
}

/**
 * Traveler profile data from auth.csv. Traveler Location Search is typed into "Search location...",
 * then the suggestion that exactly matches Traveler Location is tapped (it fills Country, State, City).
 */
export async function readMobileTravelerProfileData(): Promise<MobileTravelerProfileData> {
  const data = await readFieldValueCsv(authCsvPath);
  const get = requiredGetter(data, authCsvPath);

  return {
    profilePicturePath: existingFile(get('Traveler Profile Picture')),
    locationSearch: get('Traveler Location Search'),
    location: get('Traveler Location'),
  };
}

/** Localite profile data from auth.csv. */
export function createMobileLocaliteProfileData(authData: MobileAuthData): MobileLocaliteProfileData {
  if (authData.localiteExperiences.length === 0) {
    throw new Error(`Set "Localite Experiences I Host" in ${authCsvPath}.`);
  }
  return {
    profilePicturePath: existingFile(authData.localiteProfilePicture),
    bio: authData.localiteBio,
    experiences: authData.localiteExperiences,
    zipcode: authData.localiteZipcode,
  };
}

/**
 * Signup form data from auth.csv. The email gets a random "+<number>" suffix so every run
 * creates a new account, e.g. autotraveler@yopmail.com -> autotraveler+48213@yopmail.com.
 */
export function createMobileSignupFormData(authData: MobileAuthData, email: string): MobileSignupFormData {
  const [firstName, ...lastNameParts] = authData.signupFullName.trim().split(/\s+/);
  const lastName = lastNameParts.join(' ');
  if (!firstName || !lastName) {
    throw new Error(`"Signup Full Name" in ${authCsvPath} must include first and last names.`);
  }

  return {
    firstName,
    lastName,
    email: withEmailSuffix(email, randomInt(100_000, 1_000_000)),
    phone: authData.signupPhone,
    password: authData.signupPassword,
  };
}

/** Add "+<suffix>" before the @ of an email, replacing any existing plus suffix. */
export function withEmailSuffix(email: string, suffix: number): string {
  const separator = email.lastIndexOf('@');
  if (separator <= 0 || separator === email.length - 1) {
    throw new Error(`"${email}" must be a valid email address.`);
  }
  const localPart = email.slice(0, separator).replace(/\+.*$/, '');
  return `${localPart}+${suffix}@${email.slice(separator + 1)}`;
}
