import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Scrapper, LocationWithWorkhours, WorkHour } from '../models/domain';
import * as schema from '../db/schema';
import * as cheerio from 'cheerio';
import { saveDataToPostgres } from '../utils/db';
import {
  getIsoStringDateAndTime,
  getDayDateInCurrentWeek,
  weekDays,
  weekDaysTwoLetter,
  addDays,
} from '../utils/dates';
import { translateToEn } from '../translations/daysOfTheWeek';
import { bypassFlare } from '../utils/flareBypasser';

export class Lidl implements Scrapper {
  retailName = 'Lidl';

  async fetch(db: NodePgDatabase<typeof schema>): Promise<void> {
    try {
      const sitemapUrl =
        'https://www.lidl.hr/s/hr-HR/trazilica-trgovina/sitemap.xml';

      const response = await bypassFlare(sitemapUrl);
      if (!response) {
        throw Error('Failed to load sitemap');
      }

      const $ = cheerio.load(response, { xmlMode: true });

      const locations: string[] = [];

      $('url loc').each((i, loc) => {
        const url = $(loc).text();
        locations.push(url);
      });

      const resolvedLocations: Partial<LocationWithWorkhours>[] = [];
      for (const location of locations) {
        const resolvedLocation = await this.resolveLocation(location);
        if (resolvedLocation) {
          resolvedLocations.push(resolvedLocation);
        }
      }

      await saveDataToPostgres(db, resolvedLocations, this.retailName);
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

    const name = $('h1.lirt-o-store-detail-card__headline').text();

    const addressLines: string[] = [];
    $('.lirt-o-store-detail-card__address').each((index, element) => {
      const address = $(element).text();
      addressLines.push(address);
    });

    const [street, city] = addressLines;
    const address = `${street}, ${city}`;

    const workHours: Partial<WorkHour>[] = [];
    let initialDate: Date;
    $('div.lirt-o-store-detail-card__openingHours-data p').each(
      (i, element) => {
        const text = $(element).text().trim();
        const [twoLetterDay, hours] = text.split(/\s+/, 2);
        const day =
          weekDays[weekDaysTwoLetter.indexOf(twoLetterDay.toLowerCase())];

        if (day && hours) {
          let date: Date;
          if (i === 0) {
            initialDate = date = getDayDateInCurrentWeek(day);
          } else {
            date = addDays(initialDate, i);
          }

          const [fromHour, toHour] = hours.includes('-')
            ? hours.split('-')
            : [null, null];
          workHours.push({
            name: { hr: day, en: translateToEn(day) },
            fromHour: fromHour,
            toHour: toHour,
            date: getIsoStringDateAndTime(date)[1],
          });
        }
      }
    );

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
}
