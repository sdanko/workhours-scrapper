import axios from 'axios';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import {
  KonzumData,
  KonzumLocation,
  KonzumWorkHour,
  LocalizableString,
  LocationWithWorkhours,
  Scrapper,
} from '../models/domain';
import { saveDataToPostgres } from '../utils/db';
import {
  getDayDateInCurrentWeek,
  getIsoStringDateAndTime,
} from '../utils/common';

export class Konzum implements Scrapper {
  retailName = 'Konzum';

  async fetch(db: NodePgDatabase<typeof schema>) {
    try {
      const response = await axios.get(
        'https://trgovine.konzum.hr/api/locations/'
      );

      const data: KonzumData = response.data;
      const locations: Partial<LocationWithWorkhours>[] = this.mapLocations(
        data.locations
      );

      await saveDataToPostgres(db, locations, this.retailName);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  }

  mapLocations(locations: KonzumLocation[]): Partial<LocationWithWorkhours>[] {
    return locations.map((location) => {
      const konzumWorkHours: KonzumWorkHour[] = JSON.parse(location.work_hours);

      return {
        name: location.name,
        address: location.address,
        phoneNumber: location.phone_number,
        description: location.type.join(),
        openThisSunday: location.open_this_sunday,
        workHours: konzumWorkHours.map((workHour) => {
          const [fromHourTime, date] = workHour.from_hour
            ? getIsoStringDateAndTime(new Date(workHour.from_hour))
            : [null, null];

          const [toHourTime] = workHour.to_hour
            ? getIsoStringDateAndTime(new Date(workHour.to_hour))
            : [null];

          return {
            name: {
              value: workHour.name,
              locale: 'hr_HR',
            } as LocalizableString,
            fromHour: fromHourTime,
            toHour: toHourTime,
            date:
              date ??
              getIsoStringDateAndTime(
                getDayDateInCurrentWeek(workHour.name)
              )[1],
          };
        }),
      };
    });
  }
}
