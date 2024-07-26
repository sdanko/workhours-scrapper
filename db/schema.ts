import {
  boolean,
  jsonb,
  serial,
  text,
  timestamp,
  pgTable,
  integer,
} from 'drizzle-orm/pg-core';

export type localizableString = {
  locale: string;
  value: string;
};

export const cities = pgTable('city', {
  id: serial('id').primaryKey(),
  name: text('name'),
});

export const retailChains = pgTable('retail_chain', {
  id: serial('id').primaryKey(),
  name: text('name'),
});

export const locations = pgTable('location', {
  id: serial('id').primaryKey(),
  name: text('name'),
  address: text('address'),
  phoneNumber: text('phone_number'),
  description: text('description'),
  openThisSunday: boolean('open_this_sunday'),
  cityId: integer('city_id').references(() => cities.id),
  retailChainId: integer('retail_chain_id').references(() => retailChains.id),
});

export const workHours = pgTable('work_hours', {
  id: serial('id').primaryKey(),
  name: jsonb('name').$type<localizableString>(),
  fromHour: timestamp('from_hour'),
  toHour: timestamp('to_hour'),
  locationId: integer('location_id').references(() => locations.id),
});
