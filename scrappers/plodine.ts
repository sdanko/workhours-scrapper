import axios from 'axios';
import * as cheerio from 'cheerio';
import { Element } from 'domhandler';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import { LocationWithWorkhours, Scrapper, WorkHour } from '../models/domain';
import { translateToEn } from '../translations/daysOfTheWeek';
import {
  getDayDateInCurrentWeek,
  getIsoStringDateAndTime,
  weekDays,
  weekDaysLowercase,
} from '../utils/dates';
import { saveLocationsInBatches } from '../utils/db';

export class Plodine implements Scrapper {
  retailName = 'Plodine';

  async fetch(db: NodePgDatabase<typeof schema>): Promise<void> {
    try {
      const response = await axios.get('https://www.plodine.hr/supermarketi');
      const $ = cheerio.load(response.data);

      const resolvedLocations: Partial<LocationWithWorkhours>[] = [];

      $('li.market').each((_, element) => {
        const resolvedLocation = this.resolveLocation(element, $);
        if (resolvedLocation) {
          resolvedLocations.push(resolvedLocation);
        }
      });

      await saveLocationsInBatches(resolvedLocations, db, 100, this.retailName);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  }

  resolveLocation(
    element: Element,
    $: cheerio.CheerioAPI
  ): Partial<LocationWithWorkhours> | null {
    const name = $(element).find('h2.market__title').text().trim();

    const address = $(element)
      .find('.market__location p')
      .map((_, el: Element) => $(el).text().trim())
      .get()
      .join(',');

    const hoursPerDay: { [key: string]: string } = {};
    $(element)
      .find('.market__workhours div')
      .each((i, workHoursEl) => {
        // Skip the first element
        if (i === 0) {
          return;
        }

        const textLine = $(workHoursEl).text();
        const daySpanText = textLine.slice(0, textLine.indexOf(':'));
        const hours = textLine.slice(textLine.indexOf(':') + 1).trim();

        let days: string[] = [];

        if (daySpanText.includes('-')) {
          const [startDay, endDay] = daySpanText.split('-');
          days = this.getDaysFromSpan(
            startDay.trim().toLowerCase(),
            endDay.trim().replace(':', '').toLowerCase()
          );
        } else if (
          weekDaysLowercase.indexOf(
            daySpanText.trim().replace(':', '').toLowerCase()
          ) !== -1
        ) {
          days.push(
            weekDays[
              weekDaysLowercase.indexOf(daySpanText.trim().replace(':', ''))
            ]
          );
        } else if (daySpanText === 'Subotom') {
          days.push('Subota');
        }

        for (const day of days) {
          hoursPerDay[day] = hours;
        }
      });

    const workHours: Partial<WorkHour>[] = [];
    for (const day of weekDays) {
      const [_, date] = getIsoStringDateAndTime(getDayDateInCurrentWeek(day));
      if (day in hoursPerDay) {
        const hours = hoursPerDay[day];
        const [fromHour, toHour] = hours.includes('-')
          ? hours.split('-')
          : [null, null];
        workHours.push({
          name: { hr: day, en: translateToEn(day) },
          fromHour,
          toHour,
          date,
        });
      } else {
        workHours.push({
          name: { hr: day, en: translateToEn(day) },
          fromHour: null,
          toHour: null,
          date,
        });
      }
    }

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

  getDaysFromSpan(startDay: string, endDay: string): string[] {
    return weekDays.slice(
      weekDaysLowercase.indexOf(startDay),
      weekDaysLowercase.indexOf(endDay) + 1
    );
  }
}
