import chalk from 'chalk';

export function formatJSON(data: unknown, pretty = true): string {
  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

export function printJSON(data: unknown): void {
  console.log(formatJSON(data));
}
