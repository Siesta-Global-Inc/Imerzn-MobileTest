import { randomInt } from 'node:crypto';
import { existingFile, readFieldValueCsv, requiredGetter, testDataPath } from '@data/mobile-csv-loader';

/*
 * Data for the mobile localite Profile tests. They read the same CSV files as the web tests;
 * only rows starting with "Mobile" are mobile-only (e.g. the location picked in the app).
 */

/** Values typed into the mobile Create Experience form (testdata/localite/create-experience.csv). */
export interface MobileExperienceData {
  title: string;
  category: string;
  /** Picked from the location suggestions for Location, Meeting Point, and Drop-off Point. */
  location: string;
  price: string;
  knowBefore: string;
  minPeople: string;
  maxPeople: string;
  duration: string;
  startingTimes: string[];
  meetingNotes: string;
  included: string[];
  description: string;
  policy: string;
  primaryImagePath: string;
}

/** Values typed into the mobile Create Gallery form (testdata/localite/create-gallery.csv). */
export interface MobileGalleryData {
  title: string;
  location: string;
  description: string;
  primaryImagePath: string;
}

/** New values entered on the mobile Edit Profile screen (testdata/localite/edit-profile.csv). */
export interface MobileEditProfileData {
  firstName: string;
  lastName: string;
  bio: string;
  experiences: string[];
}

/**
 * Read create-experience.csv. The title is "Mobile-<Title> Experience - <5 random digits>",
 * the web title with "Mobile-" in front, so every run publishes a new experience.
 */
export async function readMobileExperienceData(): Promise<MobileExperienceData> {
  const path = testDataPath('localite', 'create-experience.csv');
  const get = requiredGetter(await readFieldValueCsv(path), path);

  return {
    title: `Mobile-${get('Title')} Experience - ${randomInt(10_000, 100_000)}`,
    category: get('Category'),
    location: get('Mobile Location'),
    price: get('Price'),
    knowBefore: get('Know Before'),
    minPeople: get('Min People'),
    maxPeople: get('Max People'),
    duration: get('Duration'),
    startingTimes: splitList(get('Starting Times')),
    meetingNotes: get('Meeting/Drop-off Notes'),
    included: splitList(get('Included')),
    description: get('Description'),
    policy: get('Mobile Policy'),
    primaryImagePath: existingFile(get('Primary Image')),
  };
}

/** Read create-gallery.csv. The title is "Mobile-<Title Prefix> <6 random digits>". */
export async function readMobileGalleryData(): Promise<MobileGalleryData> {
  const path = testDataPath('localite', 'create-gallery.csv');
  const get = requiredGetter(await readFieldValueCsv(path), path);

  return {
    title: `Mobile-${get('Title Prefix')} ${randomInt(100_000, 1_000_000)}`,
    location: get('Mobile Location'),
    description: get('Description'),
    primaryImagePath: existingFile(get('Primary Image')),
  };
}

/**
 * Read edit-profile.csv. The last name is "<Last Name Prefix><6 random letters>", so every run
 * gives the localite a new name (the app accepts letters only, at most 15 characters).
 */
export async function readMobileEditProfileData(): Promise<MobileEditProfileData> {
  const path = testDataPath('localite', 'edit-profile.csv');
  const get = requiredGetter(await readFieldValueCsv(path), path);

  let letters = '';
  for (let index = 0; index < 6; index += 1) {
    letters += String.fromCharCode(97 + randomInt(0, 26));
  }

  return {
    firstName: get('First Name'),
    lastName: `${get('Last Name Prefix')}${letters}`,
    bio: get('Bio'),
    experiences: splitList(get('Experiences I Host')),
  };
}

/** Split a "|"-separated CSV value into trimmed, non-empty items. */
function splitList(value: string): string[] {
  return value.split('|').map((item) => item.trim()).filter(Boolean);
}
