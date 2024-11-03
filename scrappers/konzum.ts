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

const konzumName = 'Konzum';

export class Konzum implements Scrapper {
  async fetch(db: NodePgDatabase<typeof schema>) {
    try {
      const response = await axios.get(
        'https://trgovine.konzum.hr/api/locations/'
      );

      const data: KonzumData = response.data;
      const locations: Partial<LocationWithWorkhours>[] = this.mapLocations(
        data.locations
      );

      await saveDataToPostgres(db, locations, konzumName);
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
          return {
            name: {
              value: workHour.name,
              locale: 'hr_HR',
            } as LocalizableString,
            fromHour: workHour.from_hour ? new Date(workHour.from_hour) : null,
            toHour: workHour.to_hour ? new Date(workHour.to_hour) : null,
          };
        }),
      };
    });
  }
}
