import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Scrapper, LocationWithWorkhours, WorkHour } from '../models/domain';
import * as schema from '../db/schema';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { saveDataToPostgres } from '../utils/db';

const studenacName = 'Studenac';

export class Studenac implements Scrapper {
  async fetch(db: NodePgDatabase<typeof schema>): Promise<void> {
    try {
      const response = await axios.get('https://www.studenac.hr/trgovine');
      const $ = cheerio.load(response.data);

      const locations: string[] = [];
      const locationResolvers: Promise<Partial<LocationWithWorkhours>>[] = [];

      // Find the ul with id "storeList"
      $('#storeList li').each((_, element) => {
        // Find the a tag inside the div with class "card__cta" in each li
        const link = $(element).find('div.card__cta a').attr('href');

        // If the link exists, push it to the array
        if (link) {
          locations.push(link);
        }
      });

      for (const location of locations) {
        locationResolvers.push(this.resolveLocation(location));
      }

      await Promise.all(locationResolvers).then(async (locations) => {
        await saveDataToPostgres(db, locations, studenacName);
      });
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  }

  async resolveLocation(link: string): Promise<Partial<LocationWithWorkhours>> {
    return axios.get(link).then((response) => {
      const $ = cheerio.load(response.data);

      const name = $('h1.toparea__heading').text();
      const address = $('div.marketsingle__meta h2').text();

      const workHours: Partial<WorkHour>[] = [];

      // Loop through each li inside .marketsingle__column ul
      $('div.marketsingle__column ul li').each((index, element) => {
        // Get the text for the day (text before the strong tag)
        const day = $(element).text().split(':')[0].trim();

        // Get the working hours from the strong tag
        const hours = $(element).find('strong').text().trim();

        if (day && hours) {
          const fromHour = this.getDateFromString(hours.split('-')[0]);
          const toHour = this.getDateFromString(hours.split('-')[1]);

          workHours.push({
            name: { value: day, locale: 'hr_HR' },
            fromHour,
            toHour,
          });
        }
      });

      return {
        name,
        address,
        workHours,
        openThisSunday: workHours.some(
          (x) =>
            x.name?.value === 'Nedjelja' &&
            x.fromHour !== null &&
            x.toHour !== null
        ),
      };
    });
  }

  getDateFromString(timestring: string): Date | null {
    const [hours, minutes] = timestring.split(':').map(Number);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return null;
    }

    const currentDate = new Date();

    currentDate.setHours(hours);
    currentDate.setMinutes(minutes);

    return currentDate;
  }
}
