import { randomInt } from 'node:crypto';
import { existingFile, readFieldValueCsv, requiredGetter, testDataPath } from '@data/mobile-csv-loader';

/*
 * Data for the mobile traveler tests. They read the same CSV files as the web traveler tests.
 */

/** New values entered on the mobile traveler Edit Profile screen (traveler-settings.csv). */
export interface MobileTravelerProfileEditData {
  firstName: string;
  lastName: string;
  phone: string;
}

/** Read traveler-settings.csv: the new first name, last name, and phone (10 digits, US). */
export async function readMobileTravelerProfileEditData(): Promise<MobileTravelerProfileEditData> {
  const path = testDataPath('traveler', 'traveler-settings.csv');
  const get = requiredGetter(await readFieldValueCsv(path), path);

  return {
    firstName: get('First Name'),
    lastName: get('Last Name'),
    phone: get('Phone'),
  };
}

/** Read wishlist.csv. The name is "Mobile-<Name Prefix> <6 random digits>", new on every run. */
export async function readMobileWishlistName(): Promise<string> {
  const path = testDataPath('traveler', 'wishlist.csv');
  const get = requiredGetter(await readFieldValueCsv(path), path);
  return `Mobile-${get('Name Prefix')} ${randomInt(100_000, 1_000_000)}`;
}

/** Values entered on the mobile "Share Your Travel Experience" screen (story.csv). */
export interface MobileStoryData {
  title: string;
  /** Picked from the location suggestions. */
  location: string;
  description: string;
  imagePath: string;
}

/** Read story.csv. The title is "Mobile-<Title Prefix> <6 random digits>", new on every run. */
export async function readMobileStoryData(): Promise<MobileStoryData> {
  const path = testDataPath('traveler', 'story.csv');
  const get = requiredGetter(await readFieldValueCsv(path), path);

  return {
    title: `Mobile-${get('Title Prefix')} ${randomInt(100_000, 1_000_000)}`,
    location: get('Mobile Location'),
    description: get('Description'),
    imagePath: existingFile(get('Image')),
  };
}
