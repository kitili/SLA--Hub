export const PAGE_SIZE = 25;

export function parsePage(value?: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

export function pageSkip(page: number, pageSize = PAGE_SIZE): number {
  return (page - 1) * pageSize;
}

export function pageCount(total: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
