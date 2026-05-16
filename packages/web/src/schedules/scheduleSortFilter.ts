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
