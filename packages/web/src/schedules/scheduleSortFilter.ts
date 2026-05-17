export function sortRows<T extends object>(rows: T[], key: keyof T, dir: 'asc' | 'desc'): T[] {
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    let cmp: number;
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv;
    } else {
      cmp = String(av ?? '').localeCompare(String(bv ?? ''));
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

export function filterRows<T extends object>(rows: T[], filter: string): T[] {
  if (!filter) return rows;
  const lc = filter.toLowerCase();
  return rows.filter((row) =>
    Object.values(row).some((v) => typeof v === 'string' && v.toLowerCase().includes(lc)),
  );
}

export function groupByKey<T>(rows: T[], key: keyof T): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const row of rows) {
    const raw = row[key];
    const k = raw == null ? '' : String(raw);
    if (!result[k]) result[k] = [];
    result[k]!.push(row);
  }
  return result;
}
