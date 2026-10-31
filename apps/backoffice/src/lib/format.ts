import { toMajor } from '@metrobet/contracts';

const moneyFormat = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GEL' });
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Tbilisi',
});

/** Minor units → "₾12.50" style GEL. */
export const money = (minor: number) => moneyFormat.format(toMajor(minor));

/** ISO instant → date and time in Tbilisi (staff always see Georgian time). */
export const dateTime = (iso: string) => dateFormat.format(new Date(iso));
