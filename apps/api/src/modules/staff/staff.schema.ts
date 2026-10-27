import { STAFF_ROLES } from '@metrobet/contracts';
import { boolean, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const staffRole = pgEnum('staff_role', STAFF_ROLES);

/** Backoffice accounts. Disabling (`isActive = false`) blocks sign-in and existing sessions. */
export const staff = pgTable('staff', {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique('staff_email_unique'),
  name: text().notNull(),
  passwordHash: text().notNull(),
  role: staffRole().notNull(),
  isActive: boolean().notNull().default(true),
  lastLoginAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type StaffRow = typeof staff.$inferSelect;
