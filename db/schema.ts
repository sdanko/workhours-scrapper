import {
  boolean,
  jsonb,
  serial,
  text,
  pgTable,
  integer,
  index,
  time,
  date,
} from 'drizzle-orm/pg-core';

export type LocalizableString = {
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

export const locations = pgTable(
  'location',
  {
    id: serial('id').primaryKey(),
    name: text('name'),
    address: text('address'),
    phoneNumber: text('phone_number'),
    description: text('description'),
    openThisSunday: boolean('open_this_sunday'),
    cityId: integer('city_id').references(() => cities.id),
    retailChainId: integer('retail_chain_id').references(() => retailChains.id),
  },
  (table) => {
    return {
      cityIdIdx: index('cityId_idx').on(table.cityId),
      retailChainIdIdx: index('retailChainId_idx').on(table.retailChainId),
    };
  }
);

export const workHours = pgTable(
  'work_hours',
  {
    id: serial('id').primaryKey(),
    name: jsonb('name').$type<LocalizableString>(),
    fromHour: time('from_hour'),
    toHour: time('to_hour'),
    date: date('date'),
    locationId: integer('location_id').references(() => locations.id),
  },
  (table) => {
    return {
      locationIdIdx: index('locationId_idx').on(table.locationId),
      dateIdx: index('date_idx').on(table.date),
      nameIdx: index('name_idx').using('gin', table.name),
    };
  }
);
