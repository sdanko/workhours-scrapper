export const dayTranslationsEn: { [key: string]: string } = {
  ponedjeljak: 'Monday',
  utorak: 'Tuesday',
  srijeda: 'Wednesday',
  četvrtak: 'Thursday',
  cetvrtak: 'Thursday',
  petak: 'Friday',
  subota: 'Saturday',
  nedjelja: 'Sunday',
};

export function translateToEn(value: string): string {
  return dayTranslationsEn[value.toLowerCase()];
}
