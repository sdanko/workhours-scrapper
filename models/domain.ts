import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';

export interface Scrapper {
  retailName: string;
  fetch(db: NodePgDatabase<typeof schema>): Promise<void>;
}

export type LocalizableString = {
  hr: string;
  en: string;
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

export type TommyData = {
  'hydra:member': TommyLocation[];
};

export type TommyLocation = {
  name: string;
  address: TommyAddress;
  phoneNumber: string;
  storeType: string;
  businessHours: TommyWorkHours;
};

export type TommyAddress = {
  street: string;
  city: string;
  postcode: string;
};

export type TommyWorkHours = {
  workweekSchedule: TommyWorkHourSchedule;
  saturdaySchedule: TommyWorkHourSchedule;
  sundaySchedule: TommyWorkHourSchedule;
};

export type TommyWorkHourSchedule = {
  start: string;
  end: string;
};
