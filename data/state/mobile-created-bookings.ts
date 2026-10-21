import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { testDataPath } from '@data/mobile-csv-loader';

// Local-only file that hands the bookings made by mobile BKG-001 to the later mobile flow tests.
const createdBookingsPath = testDataPath('traveler', 'mobile-created-bookings.json');

/** A booking made by the mobile traveler. */
export interface MobileCreatedBooking {
  /** "Booking ID: <id>" shown on the booking cards. */
  bookingId: string;
  experienceTitle: string;
  /** "MM-DD-YYYY", as the app shows it. */
  date: string;
  startTime: string;
  people: number;
  note: string;
  /** Total Amount Due shown in the Payment dialog (paid bookings), e.g. 183.87. */
  totalAmountDue?: number;
}

export interface MobileCreatedBookings {
  travelerEmail: string;
  localiteEmail: string;
  paid: MobileCreatedBooking[];
  pending: MobileCreatedBooking[];
}

/** Save the bookings of a BKG-001 run (replaces any earlier run). */
export async function saveMobileCreatedBookings(bookings: MobileCreatedBookings): Promise<void> {
  await writeFile(createdBookingsPath, `${JSON.stringify(bookings, null, 2)}\n`, 'utf8');
}

/** Read the bookings of the last BKG-001 run; fails if it has not run yet. */
export async function readMobileCreatedBookings(): Promise<MobileCreatedBookings> {
  if (!existsSync(createdBookingsPath)) {
    throw new Error(
      `No bookings found (${createdBookingsPath}). ` +
      'Run the mobile booking test first: tests/flows/booking/mobile-01-experience-booking.spec.ts',
    );
  }
  const bookings = JSON.parse(await readFile(createdBookingsPath, 'utf8')) as MobileCreatedBookings;
  if (!bookings.paid?.length || !bookings.pending?.length) {
    throw new Error(`${createdBookingsPath} must list at least one paid and one pending booking.`);
  }
  return bookings;
}
