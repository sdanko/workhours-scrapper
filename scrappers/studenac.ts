import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Scrapper, LocationWithWorkhours, WorkHour } from '../models/domain';
import * as schema from '../db/schema';
import * as cheerio from 'cheerio';
import { saveDataToPostgres } from '../utils/db';
import {
  getIsoStringDateAndTime,
  getDayDateInCurrentWeek,
} from '../utils/dates';
import { translateToEn } from '../translations/daysOfTheWeek';
import { bypassFlare } from '../utils/flareBypasser';
import axios from 'axios';

export class Studenac implements Scrapper {
  retailName = 'Studenac';

  async fetch(db: NodePgDatabase<typeof schema>): Promise<void> {
    try {
      const response = await axios.get('https://www.studenac.hr/trgovine');
      const $ = cheerio.load(response.data);

      const locations: string[] = [];

      // Find the ul with id "storeList"
      $('#storeList li').each((_, element) => {
        // Find the a tag inside the div with class "card__cta" in each li
        const link = $(element).find('div.card__cta a').attr('href');

        // If the link exists, push it to the array
        if (link) {
          locations.push(link);
        }
      });

      const resolvedLocations: Partial<LocationWithWorkhours>[] = [];
      for (const location of locations) {
        const resolvedLocation = await this.resolveLocation(location);
        if (resolvedLocation) {
          resolvedLocations.push(resolvedLocation);
        }
      }

      await this.saveDataInBatches(resolvedLocations, db, 100);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  }

  async resolveLocation(
    link: string
  ): Promise<Partial<LocationWithWorkhours> | null> {
    const response = await bypassFlare(link);
    if (!response) {
      return null;
    }
    const $ = cheerio.load(response);

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
        const [_, date] = getIsoStringDateAndTime(getDayDateInCurrentWeek(day));
        const [fromHour, toHour] = hours.includes('-')
          ? hours.split('-')
          : [null, null];
        workHours.push({
          name: { hr: day, en: translateToEn(day) },
          fromHour: fromHour,
          toHour: toHour,
          date,
        });
      }
    });

    return {
      name,
      address,
      workHours,
      openThisSunday: workHours.some(
        (x) =>
          x.name?.hr === 'Nedjelja' && x.fromHour !== null && x.toHour !== null
      ),
    };
  }

  async saveDataInBatches(
    data: Partial<LocationWithWorkhours>[],
    db: NodePgDatabase<typeof schema>,
    batchSize: number
  ): Promise<void> {
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);

      await saveDataToPostgres(db, batch, this.retailName);
    }
  }
}
