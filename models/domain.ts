import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import { Browser } from 'puppeteer-core';

export interface Scrapper {
  fetch(db: NodePgDatabase<typeof schema>, browser: Browser): Promise<void>;
}

export type LocalizableString = {
  locale: string;
  value: string;
};

export type City = {
  id: number;
  name: string;
};

export type Location = {
  id: number;
  name: string;
  address: string;
  phoneNumber: string;
  description: string;
  openThisSunday: boolean;
  cityId: number;
  retailChainId: number;
};

export type WorkHour = {
  id: number;
  name: LocalizableString;
  fromHour: Date | null;
  toHour: Date | null;
  locationId: number;
};

export type KonzumData = {
  locations: KonzumLocations[];
};

export type KonzumLocations = {
  address: string;
  name: string;
  phone_number: string;
  type: string[];
  open_this_sunday: boolean;
  work_hours: string;
};

export type KonzumWorkhour = {
  name: string;
  from_hour: string;
  to_hour: string;
};
