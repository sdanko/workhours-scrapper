import axios from 'axios';
import { cities, locations, retailChains, workHours } from '../db/schema';
import { sql, and, eq, ExtractTablesWithRelations } from 'drizzle-orm';
import { extractCity } from '../utils/common';
import { saveDataToPostgres } from '../utils/db';
import {
  KonzumData,
  KonzumLocation,
  KonzumWorkHour,
  LocalizableString,
  Location,
  LocationWithWorkhours,
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

  async saveDataToPostgres(
    db: NodePgDatabase<typeof schema>,
    data: KonzumData
  ) {
    try {
      await db.transaction(
        async (tx) => {
          const retailChainId: number = await this.saveRetailChain(tx);

          for (const location of data.locations) {
            const cityId: number = await this.saveCity(location, tx);

            const [existigLocation] = await tx
              .select({ id: locations.id })
              .from(locations)
              .where(
                and(
                  eq(locations.retailChainId, retailChainId),
                  eq(locations.cityId, cityId),
                  eq(locations.address, location.address)
                )
              );

            const upsertValues: Partial<Location> = {
              retailChainId,
              cityId,
              name: location.name,
              address: location.address,
              phoneNumber: location.phone_number,
              description: location.type.join(),
              openThisSunday: location.open_this_sunday,
            };

            const [insertResult] = await tx
              .insert(locations)
              .values(
                existigLocation?.id
                  ? {
                      id: existigLocation.id,
                      ...upsertValues,
                    }
                  : { ...upsertValues }
              )
              .onConflictDoUpdate({
                target: locations.id,
                set: {
                  name: upsertValues.name,
                  phoneNumber: upsertValues.phoneNumber,
                  description: upsertValues.description,
                  openThisSunday: upsertValues.openThisSunday,
                },
              })
              .returning({ insertedId: locations.id });

            const locationId = insertResult.insertedId;
            const workHours: KonzumWorkHour[] = JSON.parse(location.work_hours);

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

  private async saveCity(
    location: KonzumLocation,
    tx: PgTransaction<
      NodePgQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >
  ) {
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
    return cityId;
  }

  private async saveRetailChain(
    tx: PgTransaction<
      NodePgQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >
  ) {
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

    return retailChainId;
  }

  private async saveWorkhoursForLocation(
    tx: PgTransaction<
      NodePgQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >,
    workHoursValues: KonzumWorkHour[],
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
        locationId,
        name: {
          value: translationsMap
            ? translationsMap[workHour.name.toLowerCase()]
            : workHour.name,
          locale,
        } as LocalizableString,
        fromHour: workHour.from_hour ? new Date(workHour.from_hour) : null,
        toHour: workHour.to_hour ? new Date(workHour.to_hour) : null,
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
            fromHour: upsertValues.fromHour,
            toHour: upsertValues.toHour,
          },
        });
    }
  }
}
