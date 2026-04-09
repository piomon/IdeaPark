export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function overlaps(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return new Date(startA).getTime() < new Date(endB).getTime()
    && new Date(startB).getTime() < new Date(endA).getTime();
}

export function isWithinRange(
  childStart: string,
  childEnd: string,
  parentStart: string,
  parentEnd: string,
): boolean {
  return new Date(childStart).getTime() >= new Date(parentStart).getTime()
    && new Date(childEnd).getTime() <= new Date(parentEnd).getTime();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function addHours(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

export function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
