import axios from 'axios';
import { cities, locations, retailChains, workHours } from '../db/schema';
import { sql, and, eq, ExtractTablesWithRelations } from 'drizzle-orm';
import { extractCity } from '../utils/common';
import {
  KonzumData,
  KonzumWorkhour,
  LocalizableString,
  Location,
  Scrapper,
  WorkHour,
} from '../models/domain';
import { dayTranslationsEn } from '../translations/days-of-the-week';
import * as schema from '../db/schema';
import {
  NodePgDatabase,
  NodePgQueryResultHKT,
} from 'drizzle-orm/node-postgres';
import { PgTransaction } from 'drizzle-orm/pg-core';

const konzumName = 'Konzum';

export class Konzum implements Scrapper {
  async fetch(db: NodePgDatabase<typeof schema>) {
    try {
      const response = await axios.get(
        'https://trgovine.konzum.hr/api/locations/'
      );
      const data: KonzumData = response.data;

      // Parse the response and save data to Postgres
      await this.saveDataToPostgres(db, data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  }

  async saveDataToPostgres(
    db: NodePgDatabase<typeof schema>,
    data: KonzumData
  ) {
    try {
      await db.transaction(
        async (tx) => {
          let retailChainId: number;
          const [retailChain] = await tx
            .select()
            .from(retailChains)
            .where(eq(retailChains.name, konzumName));

          if (retailChain) {
            retailChainId = retailChain.id;
          } else {
            const [insertResult] = await tx
              .insert(retailChains)
              .values({ name: konzumName })
              .returning({ insertedId: retailChains.id });
            retailChainId = insertResult.insertedId;
          }

          for (const location of data.locations) {
            let cityId: number;
            const cityName = extractCity(location.address);
            const [city] = await tx
              .select()
              .from(cities)
              .where(eq(cities.name, cityName));

            if (city) {
              cityId = city.id;
            } else {
              const [insertResult] = await tx
                .insert(cities)
                .values({ name: cityName })
                .returning({ insertedId: cities.id });
              cityId = insertResult.insertedId;
            }

            const [insertResult] = await tx
              .insert(locations)
              .values({
                name: location.name,
                address: location.address,
                phoneNumber: location.phone_number,
                description: location.type.join(),
                openThisSunday: location.open_this_sunday,
                cityId,
                retailChainId,
              } as Partial<Location>)
              .returning({ insertedId: locations.id });

            const locationId = insertResult.insertedId;
            const workHours: KonzumWorkhour[] = JSON.parse(location.work_hours);

            await this.saveWorkhoursForLocation(
              tx,
              workHours,
              locationId,
              'hr_HR'
            );
            await this.saveWorkhoursForLocation(
              tx,
              workHours,
              locationId,
              'en_US',
              dayTranslationsEn
            );
          }
        },
        {
          isolationLevel: 'read committed',
          accessMode: 'read write',
          deferrable: true,
        }
      );
    } catch (error) {
      console.error('Error saving data to Postgres:', error);
    }
  }

  async saveWorkhoursForLocation(
    tx: PgTransaction<
      NodePgQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >,
    workHoursValues: KonzumWorkhour[],
    locationId: number,
    locale: string,
    translationsMap: { [key: string]: string } | null = null
  ) {
    for (const workHour of workHoursValues) {
      const [existingWorkhour] = await tx
        .select({ id: workHours.id })
        .from(workHours)
        .where(
          and(
            sql`${workHours.name}->>'value' = ${workHour.name} AND ${workHours.name}->>'locale' = ${locale}`,
            eq(workHours.locationId, locationId)
          )
        );

      const upsertValues: Partial<WorkHour> = {
        name: {
          value: translationsMap
            ? translationsMap[workHour.name.toLowerCase()]
            : workHour.name,
          locale,
        } as LocalizableString,
        fromHour: workHour.from_hour ? new Date(workHour.from_hour) : null,
        toHour: workHour.to_hour ? new Date(workHour.to_hour) : null,
        locationId,
      };

      await tx
        .insert(workHours)
        .values(
          existingWorkhour?.id
            ? { id: existingWorkhour.id, ...upsertValues }
            : { ...upsertValues }
        )
        .onConflictDoUpdate({
          target: workHours.id,
          set: {
            name: upsertValues.name,
            fromHour: upsertValues.fromHour,
            toHour: upsertValues.toHour,
          },
        });
    }
  }
}
