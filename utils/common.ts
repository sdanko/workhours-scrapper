// Function to extract the city from the address
export function extractCity(address: string): string {
  const match = address.match(/,\s*\d+\s*(.+)$/);
  return match ? match[1] : '';
}
