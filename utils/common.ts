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

export function cleanHtmlTags(htmlString: string): string {
  return htmlString.trim().replace(/<\/?[^>]+(>|$)/g, '');
}

export function capitalize(str: string): string {
  if (!str) {
    return str; // Handle empty or null strings
  }

  return str.charAt(0).toUpperCase() + str.slice(1);
}
