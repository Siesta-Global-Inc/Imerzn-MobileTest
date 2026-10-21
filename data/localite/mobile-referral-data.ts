import { readFieldValueCsv, requiredGetter, testDataPath } from '@data/mobile-csv-loader';

/**
 * Fixed referral-program accounts (testdata/localite/Referral-program.csv, the same file as the web
 * test): the referrer, the referee who signed up with the referrer's code, and the traveler who
 * books the referee's experience. All three share one password.
 */
export interface MobileReferralData {
  password: string;
  referrerEmail: string;
  referralCode: string;
  /** e.g. "25%" */
  referralPercent: string;
  /** e.g. "Active" */
  referralStatus: string;
  referee: { email: string; name: string };
  traveler: { email: string; name: string };
  experience: { title: string; price: number };
  booking: { groupSize: number; note: string };
}

export async function readMobileReferralData(): Promise<MobileReferralData> {
  const path = testDataPath('localite', 'Referral-program.csv');
  const get = requiredGetter(await readFieldValueCsv(path), path);

  return {
    password: get('Password'),
    referrerEmail: get('Referrer Email'),
    referralCode: get('Referral Code'),
    referralPercent: get('Referral Percent'),
    referralStatus: get('Referral Status'),
    referee: {
      email: get('Referee 1 Email'),
      name: `${get('Referee 1 First Name')} ${get('Referee 1 Last Name')}`,
    },
    traveler: {
      email: get('Traveler Email'),
      name: `${get('Traveler First Name')} ${get('Traveler Last Name')}`,
    },
    experience: { title: get('Experience Title'), price: Number(get('Experience Price')) },
    booking: { groupSize: Number(get('Booking Group Size')), note: get('Booking Note') },
  };
}
