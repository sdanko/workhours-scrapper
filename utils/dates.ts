export const weekDays: readonly string[] = [
  'Ponedjeljak',
  'Utorak',
  'Srijeda',
  'Četvrtak',
  'Petak',
  'Subota',
  'Nedjelja',
];

export const weekDaysThreeLetter: readonly string[] = [
  'pon',
  'uto',
  'sri',
  'čet',
  'pet',
  'sub',
  'ned',
];

export const weekDaysTwoLetter: readonly string[] = [
  'po',
  'ut',
  'sr',
  'če',
  'pe',
  'su',
  'ne',
];

export function getDayDateInCurrentWeek(day: string): Date {
  const currentDate = new Date();
  const mondayDate = getMondayDate(currentDate);
  const currentDayIndex = getAdjustedDay(currentDate);
  const dayIndex = weekDays.indexOf(day);
  const dayDiff = getDifferenceInDays(mondayDate, currentDate);

  const daysToAdd = dayDiff + (dayIndex - currentDayIndex);

  return addDays(mondayDate, daysToAdd);
}

export function addDays(startDate: Date, addDays: number) {
  // One day’s worth of milliseconds (1000 * 60 * 60 * 24)
  const dateTimestamp = startDate.getTime() + 1000 * 60 * 60 * 24 * addDays;
  const endDate = new Date(dateTimestamp);

  return endDate;
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
