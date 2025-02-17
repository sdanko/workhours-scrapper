import axios from 'axios';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import {
  LocationWithWorkhours,
  Scrapper,
  TommyAddress,
  TommyData,
  TommyLocation,
  TommyWorkHours,
  TommyWorkHourSchedule,
  WorkHour,
} from '../models/domain';
import { translateToEn } from '../translations/daysOfTheWeek';
import {
  getDayDateInCurrentWeek,
  getIsoStringDateAndTime,
  weekDays,
} from '../utils/dates';
import { saveDataToPostgres } from '../utils/db';

export class Tommy implements Scrapper {
  retailName = 'Tommy';

  async fetch(db: NodePgDatabase<typeof schema>) {
    try {
      const response = await axios.get(
        'https://spiza.tommy.hr/api/v2/shop/channels?itemsPerPage=500'
      );

      const data: TommyData = response.data;
      const locations: Partial<LocationWithWorkhours>[] = this.mapLocations(
        data['hydra:member']
      );

      await saveDataToPostgres(db, locations, this.retailName);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  }

  mapLocations(locations: TommyLocation[]): Partial<LocationWithWorkhours>[] {
    return locations.map((location) => {
      const workHours = this.mapWorkHours(location.businessHours);

      return {
        name: location.name,
        address: this.mapAddress(location.address),
        phoneNumber: location.phoneNumber,
        description: location.storeType,
        workHours,
        openThisSunday: workHours.some(
          (x) =>
            x.name?.hr === 'Nedjelja' &&
            x.fromHour !== null &&
            x.toHour !== null
        ),
      };
    });
  }

  mapAddress(address: TommyAddress): string {
    return `${address.street}, ${address.city}, ${address.postcode}`;
  }

  mapWorkHours(workHours: TommyWorkHours): Partial<WorkHour>[] {
    const mappedWorkHours: Partial<WorkHour>[] = [];
    for (const day of weekDays) {
      const [_, date] = getIsoStringDateAndTime(getDayDateInCurrentWeek(day));
      const [fromHour, toHour] = this.mapWorkHour(
        day,
        workHours.workweekSchedule,
        workHours.saturdaySchedule,
        workHours.sundaySchedule
      );
      mappedWorkHours.push({
        name: { hr: day, en: translateToEn(day) },
        fromHour,
        toHour,
        date,
      });
    }

    return mappedWorkHours;
  }

  mapWorkHour(
    day: string,
    workweekSchedule: TommyWorkHourSchedule,
    saturdaySchedule: TommyWorkHourSchedule,
    sundaySchedule: TommyWorkHourSchedule
  ): [string | null, string | null] {
    if (day === 'Subota') {
      return [
        saturdaySchedule.start ? saturdaySchedule.start : null,
        saturdaySchedule.end ? saturdaySchedule.end : null,
      ];
    } else if (day === 'Nedjelja') {
      return [
        sundaySchedule.start ? saturdaySchedule.start : null,
        sundaySchedule.end ? sundaySchedule.end : null,
      ];
    } else {
      return [
        workweekSchedule.start ? workweekSchedule.start : null,
        workweekSchedule.end ? workweekSchedule.end : null,
      ];
    }
  }
}
