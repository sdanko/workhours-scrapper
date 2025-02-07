import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Scrapper, LocationWithWorkhours, WorkHour } from '../models/domain';
import * as schema from '../db/schema';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { saveDataToPostgres } from '../utils/db';
import { throttleAsync } from '../utils/common';
import {
  getIsoStringDateAndTime,
  getDayDateInCurrentWeek,
  weekDaysThreeLetter,
  weekDays,
} from '../utils/dates';
import { translateToEn } from '../translations/daysOfTheWeek';

export class Kaufland implements Scrapper {
  invalidLocationUrls = [
    'https://www.kaufland.hr/usluge/poslovnica/varazdin-banfica-2330.html',
    'https://www.kaufland.hr/usluge/poslovnica/osijek-novi-grad-3130.html',
    'https://www.kaufland.hr/usluge/poslovnica/zagreb-pescenica-7130.html',
    'https://www.kaufland.hr/usluge/poslovnica/zadar-visnjik-2030.html',
    'https://www.kaufland.hr/usluge/poslovnica/rijeka-zamet-1730.html',
    'https://www.kaufland.hr/usluge/poslovnica/zagreb-sesvete-luka-3430.html',
    'https://www.kaufland.hr/usluge/poslovnica/split-ravne-njive-1630.html',
  ];
  additionalLocationUrls = [
    'https://www.kaufland.hr/usluge/poslovnica/varazdin-2330.html',
    'https://www.kaufland.hr/usluge/poslovnica/osijek-3130.html',
    'https://www.kaufland.hr/usluge/poslovnica/zagreb-pescenica-zitnjak-7130.html',
    'https://www.kaufland.hr/usluge/poslovnica/rijeka-1730.html',
    'https://www.kaufland.hr/usluge/poslovnica/split-1630.html',
  ];
  retailName = 'Kaufland';

  async fetch(db: NodePgDatabase<typeof schema>): Promise<void> {
    try {
      const response = await axios.get('https://www.kaufland.hr/.sitemap.xml');
      const $ = cheerio.load(response.data, { xmlMode: true });

      const locations: string[] = [];
      const locationResolvers: Promise<Partial<LocationWithWorkhours>>[] = [];

      // Find all <loc> tags and filter URLs containing "poslovnica"
      $('url loc').each((_, loc) => {
        const url = $(loc).text();
        if (
          url.includes('poslovnica') &&
          !this.invalidLocationUrls.includes(url)
        ) {
          locations.push(url);
        }
      });

      for (const location of locations.concat(this.additionalLocationUrls)) {
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

    const name = $('div.m-store-info__name').text();
    const street = $('div.m-store-info__street').text();
    const city = $('div.m-store-info__city').text();
    const address = `${street}, ${city}`;
    const phoneNumber = $('div.m-store-info__telephone').text();

    const hoursPerDay: { [key: string]: string } = {};
    // Loop through each <dt> element
    $('dl.m-store-info__shophours-data dt.m-store-info__day').each(
      (_, element) => {
        // Get the corresponding hours (text inside the next <dd>)
        const hours = $(element)
          .next('dd.m-store-info__hours')
          .text()
          .replace('h', '')
          .trim();

        // Get the day (text inside <dt>)
        const daySpanText = $(element).text().trim();
        let days: string[] = [];

        if (daySpanText.includes('-')) {
          const [startDay, endDay] = daySpanText.split('-');
          days = this.getDaysFromSpan(
            startDay.trim(),
            endDay.trim().replace(':', '')
          );
        } else if (
          weekDaysThreeLetter.indexOf(daySpanText.trim().replace(':', '')) !==
          -1
        ) {
          days.push(
            weekDays[
              weekDaysThreeLetter.indexOf(daySpanText.trim().replace(':', ''))
            ]
          );
        }

        for (const day of days) {
          hoursPerDay[day] = hours;
        }
      }
    );

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
      phoneNumber,
      workHours,
      openThisSunday: workHours.some(
        (x) =>
          x.name?.hr === 'Nedjelja' && x.fromHour !== null && x.toHour !== null
      ),
    };
  }

  getDaysFromSpan(startDay: string, endDay: string): string[] {
    return weekDays.slice(
      weekDaysThreeLetter.indexOf(startDay),
      weekDaysThreeLetter.indexOf(endDay) + 1
    );
  }
}
