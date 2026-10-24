// Timezone helpers without external libs. All shop logic happens in the shop timezone.

function partsIn(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return {
    y: +o.year,
    m: +o.month,
    d: +o.day,
    h: +o.hour === 24 ? 0 : +o.hour,
    mi: +o.minute,
    s: +o.second,
  };
}

function offsetMs(date: Date, tz: string) {
  const p = partsIn(date, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Convert a local wall time (YYYY-MM-DD, HH:MM) in tz to a UTC Date. */
export function zonedToUtc(ymd: string, hm: string, tz: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const off1 = offsetMs(new Date(guess), tz);
  let res = guess - off1;
  const off2 = offsetMs(new Date(res), tz);
  if (off2 !== off1) res = guess - off2;
  return new Date(res);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function localYmd(date: Date, tz: string) {
  const p = partsIn(date, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function localHm(date: Date, tz: string) {
  const p = partsIn(date, tz);
  return `${pad(p.h)}:${pad(p.mi)}`;
}

export function weekdayOf(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(ymd: string, n: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function hmToMin(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

export function minToHm(min: number) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}
