import { readFieldValueCsv, requiredGetter, testDataPath } from '@data/mobile-csv-loader';

/*
 * Data for the mobile booking flow (tests/flows/booking/mobile-*). It reads the same booking.csv
 * as the web flow; rows starting with "Mobile" are mobile-only (billing pickers in the app).
 */

/** One booking to make: date, group size, and note. */
export interface MobileBookingRequest {
  date: Date;
  groupSize: number;
  note: string;
}

/** Card and billing address typed into the app's Payment dialog. */
export interface MobilePaymentDetails {
  cardNumber: string;
  /** "MM/YY" in the CSV; typed as digits only. */
  cardExpiry: string;
  cardCvv: string;
  billingName: string;
  billingAddress: string;
  billingCountry: string;
  billingState: string;
  billingCity: string;
  billingZip: string;
}

export interface MobileBookingData {
  /** First paid booking (today + Days From Today). */
  paid: MobileBookingRequest;
  /** First pending booking: booked, then Payment is cancelled. */
  pending: MobileBookingRequest;
  /** Second paid booking. */
  paid2: MobileBookingRequest;
  /** Second pending booking. */
  pending2: MobileBookingRequest;
  payment: MobilePaymentDetails;
  cancelReason: string;
  localiteCancelReason: string;
}

/** Read booking.csv; dates are today + the configured number of days. */
export async function readMobileBookingData(): Promise<MobileBookingData> {
  const path = testDataPath('traveler', 'booking.csv');
  const get = requiredGetter(await readFieldValueCsv(path), path);
  const request = (prefix: string): MobileBookingRequest => ({
    date: daysFromToday(Number(get(`${prefix}Days From Today`))),
    groupSize: Number(get(`${prefix}Group Size`)),
    note: get(`${prefix}Note`),
  });

  return {
    paid: request(''),
    pending: request('Pending '),
    paid2: request('Paid 2 '),
    pending2: request('Pending 2 '),
    payment: {
      cardNumber: get('Card Number'),
      cardExpiry: get('Card Expiry'),
      cardCvv: get('Card CVV'),
      billingName: get('Billing Full Name'),
      billingAddress: get('Billing Address'),
      billingCountry: get('Mobile Billing Country'),
      billingState: get('Mobile Billing State'),
      billingCity: get('Mobile Billing City'),
      billingZip: get('Billing Zip'),
    },
    cancelReason: get('Cancel Reason'),
    localiteCancelReason: get('Localite Cancel Reason'),
  };
}

function daysFromToday(days: number): Date {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

/** Date as the app shows it on bookings: "MM-DD-YYYY", e.g. "10-22-2026". */
export function toAppDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${date.getFullYear()}`;
}

/** Day label in the app's date picker, e.g. "Thursday, October 22, 2026". */
export function toPickerDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
