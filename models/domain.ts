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
  fromHour: string | null;
  toHour: string | null;
  date: string | null;
  locationId: number;
};

export type KonzumData = {
  locations: KonzumLocation[];
};

export type KonzumLocation = {
  address: string;
  name: string;
  phone_number: string;
  type: string[];
  open_this_sunday: boolean;
  work_hours: string;
};

export type KonzumWorkHour = {
  name: string;
  from_hour: string;
  to_hour: string;
};

export type LocationWithWorkhours = {
  address: string;
  name: string;
  openThisSunday: boolean;
  phoneNumber: string;
  description: string;
  workHours: Partial<WorkHour>[];
};
