export const weekDays: readonly string[] = [
  'Ponedjeljak',
  'Utorak',
  'Srijeda',
  'Četvrtak',
  'Petak',
  'Subota',
  'Nedjelja',
];

export const weekDaysShort: readonly string[] = [
  'pon',
  'uto',
  'sri',
  'čet',
  'pet',
  'sub',
  'ned',
];

// Function to extract the city from the address
export function extractCity(address: string): string {
  let match = address.match(/,\s*\d+\s*(.+)$/);
  if (match && match[1]) {
    return match[1];
  }

  match = address.match(/,\s*(.+)$/);
  if (match && match[1]) {
    return match[1];
  }

  return '';
}

export async function throttleAsync<T>(
  promises: Promise<T>[],
  batchSize: number
): Promise<T[]> {
  const result: T[] = [];

  for (let i = 0; i < promises.length; i += batchSize) {
    const batch = promises.slice(i, i + batchSize);

    // Use Promise.allSettled to allow some promises to fail
    const batchResult = await Promise.allSettled(batch);

    // Filter out the rejected promises and only push the fulfilled values
    batchResult.forEach((res) => {
      if (res.status === 'fulfilled') {
        result.push(res.value);
      }
    });
  }

  return result;
}

export function getDayDateInCurrentWeek(day: string): Date {
  const currentDate = new Date();
  const mondayDate = getMondayDate(currentDate);
  const currentDayIndex = getAdjustedDay(currentDate);
  const dayIndex = weekDays.indexOf(day);
  const dayDiff = getDifferenceInDays(mondayDate, currentDate);

  const addDays = dayDiff + (dayIndex - currentDayIndex);

  // One day’s worth of milliseconds (1000 * 60 * 60 * 24)
  const dateTimestamp = mondayDate.getTime() + 1000 * 60 * 60 * 24 * addDays;
  const date = new Date(dateTimestamp);

  return date;
}

export function getDifferenceInDays(date1: Date, date2: Date): number {
  // Calculate the time difference in milliseconds
  const timeDiff = Math.abs(date2.getTime() - date1.getTime());

  // Convert milliseconds to days (1 day = 24 * 60 * 60 * 1000 ms)
  const diffInDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  return diffInDays;
}

export function getIsoStringDateAndTime(date: Date): string[] {
  // Extract the date part (YYYY-MM-DD)
  const datePart = date.toISOString().split('T')[0];

  // Extract the time part (HH:MM:SS)
  const timePart = date.toTimeString().split(' ')[0];

  return [timePart, datePart];
}

function getMondayDate(today: Date): Date {
  const dayOfWeek = today.getDay();
  const difference = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust if today is Sunday (0)

  today.setDate(today.getDate() + difference);
  return today;
}

function getAdjustedDay(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}
