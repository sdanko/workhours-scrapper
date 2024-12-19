import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Scrapper, LocationWithWorkhours, WorkHour } from '../models/domain';
import * as schema from '../db/schema';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { saveDataToPostgres } from '../utils/db';
import { throttleAsync, cleanHtmlTags, capitalize } from '../utils/common';
import {
  getIsoStringDateAndTime,
  getDayDateInCurrentWeek,
} from '../utils/dates';
import { translateToEn } from '../translations/daysOfTheWeek';

export class Eurospin implements Scrapper {
  retailName = 'Eurospin';

  async fetch(db: NodePgDatabase<typeof schema>): Promise<void> {
    try {
      const response = await axios.get(
        'https://www.eurospin.hr/store-sitemap.xml'
      );
      const $ = cheerio.load(response.data, { xmlMode: true });

      const locations: string[] = [];
      const locationResolvers: Promise<Partial<LocationWithWorkhours>>[] = [];

      $('url loc').each((_, loc) => {
        const url = $(loc).text();
        locations.push(url);
      });

      for (const location of locations) {
        locationResolvers.push(this.resolveLocation(location));
      }

      const resolvedLocations = await throttleAsync(locationResolvers, 10);
      await saveDataToPostgres(db, resolvedLocations, this.retailName);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  }

  async resolveLocation(link: string): Promise<Partial<LocationWithWorkhours>> {
    const response = await axios.get(link);
    const $ = cheerio.load(response.data);

    const name = $('section.sn_store_brochure h1').text().trim();

    const container = $('div.col-xs-12.col-sm-6').html();
    if (container === null) {
      throw Error('Container element not found');
    }

    const address = container.split('</h1>')[1]?.split('<br>')[0]?.trim();

    const workHours: Partial<WorkHour>[] = [];
    const workingHoursText = container
      .split('</h2>')[1]
      ?.split('<div class="row sn_store_brochure_lists">')[0];

    workingHoursText?.split('<br>').forEach((line) => {
      const day = this.normalizeDayString(line.slice(0, line.indexOf(':')));
      const hours = cleanHtmlTags(line.slice(line.indexOf(':') + 1));
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

  normalizeDayString(day: string): string {
    const cleanString = cleanHtmlTags(day);
    return capitalize(cleanString);
  }
}
