import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Scrapper, LocationWithWorkhours, WorkHour } from '../models/domain';
import * as schema from '../db/schema';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { saveDataToPostgres } from '../utils/db';
import { getDifferenceInDays, throttleAsync } from '../utils/common';

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

      const resolvedLocations = await throttleAsync(locationResolvers, 10);
      await saveDataToPostgres(db, resolvedLocations, studenacName);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  }

  async resolveLocation(link: string): Promise<Partial<LocationWithWorkhours>> {
    return axios.get(link).then((response) => {
      const $ = cheerio.load(response.data);

      const name = $('h1.toparea__heading').text();
      const address = $('div.marketsingle__meta h2').text();
      const dateRangeText = $('h2.marketsingle__title small').text();
      const startDate = this.getStartDate(dateRangeText);

      const workHours: Partial<WorkHour>[] = [];

      // Loop through each li inside .marketsingle__column ul
      $('div.marketsingle__column ul li').each((index, element) => {
        // Get the text for the day (text before the strong tag)
        const day = $(element).text().split(':')[0].trim();

        // Get the working hours from the strong tag
        const hours = $(element).find('strong').text().trim();

        if (day && hours) {
          const fromHour = this.getDateFromString(
            hours.split('-')[0],
            day,
            startDate
          );
          const toHour = this.getDateFromString(
            hours.split('-')[1],
            day,
            startDate
          );
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

  getDateFromString(
    timestring: string,
    day: string,
    startDate: Date | undefined
  ): Date | null {
    if (!timestring) {
      return null;
    }

    const currentDate = new Date();
    const [hours, minutes] = timestring.split(':').map(Number);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return null;
    }

    if (!startDate) {
      currentDate.setHours(hours);
      currentDate.setMinutes(minutes);

      return currentDate;
    }

    const days = [
      'ponedjeljak',
      'utorak',
      'srijeda',
      'četvrtak',
      'petak',
      'subota',
      'nedjelja',
    ];

    const currentDayIndex = this.getAdjustedDay(currentDate);
    const dayIndex = days.indexOf(day.toLowerCase());
    const dayDiff = getDifferenceInDays(startDate, currentDate);

    const addDays = dayDiff + (dayIndex - currentDayIndex);

    // One day’s worth of milliseconds (1000 * 60 * 60 * 24)
    const dateTimestamp = startDate.getTime() + 1000 * 60 * 60 * 24 * addDays;
    const date = new Date(dateTimestamp);
    date.setHours(hours);
    date.setMinutes(minutes);

    return date;
  }

  getStartDate(dateRangeText: string): Date | undefined {
    let startDate;
    const [startDateText, endDateText] = dateRangeText
      .split('-')
      .map((x) => x.trim());

    const [startDateDay, startDateMonth] = startDateText.split('.').map(Number);
    const [, , year] = endDateText.split('.').map(Number);

    if (
      !Number.isNaN(startDateDay) &&
      !Number.isNaN(startDateMonth) &&
      !Number.isNaN(year)
    ) {
      startDate = new Date(year, startDateMonth - 1, startDateDay);
    }

    return startDate;
  }

  getAdjustedDay(date: Date): number {
    const day = date.getDay();
    return day === 0 ? 6 : day - 1;
  }
}
