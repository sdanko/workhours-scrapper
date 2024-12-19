import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Scrapper, LocationWithWorkhours, WorkHour } from '../models/domain';
import * as schema from '../db/schema';
import * as cheerio from 'cheerio';
import { saveDataToPostgres } from '../utils/db';
import { capitalize } from '../utils/common';
import {
  getIsoStringDateAndTime,
  getDayDateInCurrentWeek,
  addDays,
} from '../utils/dates';
import { translateToEn } from '../translations/daysOfTheWeek';
import { bypassFlare } from '../utils/flareBypasser';

export class Spar implements Scrapper {
  retailName = 'Spar';

  async fetch(db: NodePgDatabase<typeof schema>): Promise<void> {
    try {
      const sitemapUrl =
        'https://www.spar.hr/index.sitemap.lokacije-sitemap.xml';

      const response = await bypassFlare(sitemapUrl);
      if (!response) {
        throw Error('Failed to load sitemap');
      }

      const $ = cheerio.load(response, { xmlMode: true });

      const locations: string[] = [];

      $('url loc').each((i, loc) => {
        if (i !== 0) {
          const url = $(loc).text();
          locations.push(url);
        }
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

    const name = $('h1.store-detail__title').text();
    const address = $('div.store-detail__address').text();
    const phoneNumber = $('span.store-detail__info-value > a').text();

    const workHours: Partial<WorkHour>[] = [];
    let initialDate: Date;
    $('ul.store-detail__opening-list > li').each((i, element) => {
      const day = capitalize(
        $(element)
          .find('.store-detail__opening-desc > span')
          .text()
          .trim()
          .replace(':', '')
      );
      const hours = $(element)
        .find('.store-detail__opening-value > span')
        .text()
        .trim();

      if (day && hours) {
        let date: Date;
        if (i === 0) {
          initialDate = date = getDayDateInCurrentWeek(day);
        } else {
          date = addDays(initialDate, i);
        }
        const [fromHour, toHour] = hours.includes('–')
          ? hours.split('–')
          : [null, null];
        workHours.push({
          name: { hr: day, en: translateToEn(day) },
          fromHour: fromHour,
          toHour: toHour,
          date: getIsoStringDateAndTime(date)[1],
        });
      }
    });

    return {
      name,
      address,
      phoneNumber,
      workHours,
      openThisSunday: workHours.some(
        (x) =>
          x.name?.hr === 'Nedjelja' && x.fromHour !== null && x.toHour !== null
      ),
    };
  }
}
