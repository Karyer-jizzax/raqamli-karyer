/** Helpers the trip and M-1 grids both need. */

/** ISO -> separate date and time, so a cell can stack them on two lines. */
export function splitDateTime(iso: string | null): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' };
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`,
    time: `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`,
  };
}

/** Filter state is a sparse record: a key is present only while it filters. */
export type Filters = Record<string, string>;

export function setFilter(f: Filters, key: string, value: string): Filters {
  const next = { ...f };
  if (value) next[key] = value;
  else delete next[key];
  return next;
}

/** Case-insensitive "region + number" match used by every plate search box. */
export function plateMatches(needle: string, region: string, number: string): boolean {
  return `${region} ${number}`.toUpperCase().includes(needle.toUpperCase());
}
