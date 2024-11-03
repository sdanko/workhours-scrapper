import { and, eq, ExtractTablesWithRelations, sql } from 'drizzle-orm';
import {
  NodePgDatabase,
  NodePgQueryResultHKT,
} from 'drizzle-orm/node-postgres';
import { PgTransaction } from 'drizzle-orm/pg-core';
import { locations, cities, retailChains, workHours } from '../db/schema';
import { Location, WorkHour, LocationWithWorkhours } from '../models/domain';
import { extractCity } from './common';
import * as schema from '../db/schema';
import { dayTranslationsEn } from '../translations/days-of-the-week';

export async function saveDataToPostgres(
  db: NodePgDatabase<typeof schema>,
  data: Partial<LocationWithWorkhours>[],
  retailName: string
) {
  try {
    await db.transaction(
      async (tx) => {
        const retailChainId: number = await saveRetailChain(tx, retailName);

        for (const location of data) {
          const cityId: number = await saveCity(location, tx);

          const [existigLocation] = await tx
            .select({ id: locations.id })
            .from(locations)
            .where(
              and(
                eq(locations.retailChainId, retailChainId),
                eq(locations.cityId, cityId),
                eq(locations.address, location.address as string)
              )
            );

          const upsertValues: Partial<Location> = {
            retailChainId,
            cityId,
            name: location.name,
            address: location.address,
            phoneNumber: location.phoneNumber,
            description: location.description,
            openThisSunday: location.openThisSunday,
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

          if (location.workHours) {
            await saveWorkhoursForLocation(tx, location.workHours, locationId);
            await saveWorkhoursForLocation(
              tx,
              translateToLocale(location.workHours, 'en_US', dayTranslationsEn),
              locationId
            );
          }
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

async function saveCity(
  location: Partial<LocationWithWorkhours>,
  tx: PgTransaction<
    NodePgQueryResultHKT,
    typeof schema,
    ExtractTablesWithRelations<typeof schema>
  >
) {
  let cityId: number;
  const cityName = extractCity(location.address as string);
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

async function saveRetailChain(
  tx: PgTransaction<
    NodePgQueryResultHKT,
    typeof schema,
    ExtractTablesWithRelations<typeof schema>
  >,
  retailName: string
) {
  let retailChainId: number;
  const [retailChain] = await tx
    .select()
    .from(retailChains)
    .where(eq(retailChains.name, retailName));

  if (retailChain) {
    retailChainId = retailChain.id;
  } else {
    const [insertResult] = await tx
      .insert(retailChains)
      .values({ name: retailName })
      .returning({ insertedId: retailChains.id });
    retailChainId = insertResult.insertedId;
  }

  return retailChainId;
}

async function saveWorkhoursForLocation(
  tx: PgTransaction<
    NodePgQueryResultHKT,
    typeof schema,
    ExtractTablesWithRelations<typeof schema>
  >,
  workHoursValues: Partial<WorkHour>[],
  locationId: number
) {
  for (const workHour of workHoursValues) {
    const [existingWorkhour] = await tx
      .select({ id: workHours.id })
      .from(workHours)
      .where(
        and(
          sql`${workHours.name}->>'value' = ${workHour.name?.value} AND ${workHours.name}->>'locale' = ${workHour.name?.locale}`,
          eq(workHours.locationId, locationId)
        )
      );

    const upsertValues: Partial<WorkHour> = {
      locationId,
      name: workHour.name,
      fromHour: workHour.fromHour,
      toHour: workHour.toHour,
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
function translateToLocale(
  workHours: Partial<WorkHour>[],
  locale: string,
  translationsMap: { [key: string]: string }
): Partial<WorkHour>[] {
  return workHours.map((workHour) => {
    return {
      name: {
        value: translationsMap[workHour.name!.value.toLowerCase()],
        locale,
      },
      fromHour: workHour.fromHour,
      toHour: workHour.toHour,
    };
  });
}
