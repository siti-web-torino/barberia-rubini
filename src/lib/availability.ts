import { addDays, hmToMin, localYmd, minToHm, weekdayOf, zonedToUtc } from "./tz";

export type BookingRules = {
  timezone: string;
  min_notice_minutes: number;
  max_days_ahead: number;
  buffer_minutes: number;
  slot_step_minutes: number;
  auto_confirm: boolean;
  allow_multiple: boolean;
  reminders_enabled: boolean;
};

export const DEFAULT_RULES: BookingRules = {
  timezone: "Europe/Rome",
  min_notice_minutes: 60,
  max_days_ahead: 60,
  buffer_minutes: 0,
  slot_step_minutes: 15,
  auto_confirm: true,
  allow_multiple: true,
  reminders_enabled: false,
};

export type WorkInterval = { weekday: number; start_time: string; end_time: string };
export type TimeOff = { barber_id: string | null; start_date: string; end_date: string };
export type Busy = { barber_id: string | null; start: Date; end: Date };

export type AvailabilityInput = {
  date: string;
  durationMin: number;
  rules: BookingRules;
  now: Date;
  barbers: { id: string; hours: WorkInterval[] }[];
  timeOff: TimeOff[];
  busy: Busy[];
  /** Admin-created appointments skip notice/advance limits. */
  ignoreLimits?: boolean;
};

export type Slot = { time: string; start: string; barberIds: string[] };

export function isClosed(date: string, barberId: string | null, timeOff: TimeOff[]) {
  return timeOff.some(
    (t) =>
      (t.barber_id === null || t.barber_id === barberId) &&
      t.start_date <= date &&
      t.end_date >= date,
  );
}

export function computeSlots(input: AvailabilityInput): Slot[] {
  const { date, durationMin, rules, now, barbers, timeOff, busy } = input;
  const tz = rules.timezone;
  if (durationMin <= 0) return [];
  if (!input.ignoreLimits) {
    const today = localYmd(now, tz);
    if (date < today) return [];
    if (date > addDays(today, rules.max_days_ahead)) return [];
  }
  if (isClosed(date, null, timeOff)) return [];

  const earliest = now.getTime() + (input.ignoreLimits ? 0 : rules.min_notice_minutes * 60000);
  const wd = weekdayOf(date);
  const step = Math.max(5, rules.slot_step_minutes);
  const buffer = rules.buffer_minutes * 60000;
  const map = new Map<string, Slot>();

  for (const b of barbers) {
    if (isClosed(date, b.id, timeOff)) continue;
    const intervals = b.hours.filter((h) => h.weekday === wd);
    const mine = busy.filter((x) => x.barber_id === b.id);
    for (const iv of intervals) {
      const s = hmToMin(iv.start_time.slice(0, 5));
      const e = hmToMin(iv.end_time.slice(0, 5));
      for (let t = s; t + durationMin <= e; t += step) {
        const hm = minToHm(t);
        const start = zonedToUtc(date, hm, tz);
        const end = new Date(start.getTime() + durationMin * 60000);
        if (start.getTime() < earliest) continue;
        const clash = mine.some(
          (x) => start.getTime() < x.end.getTime() + buffer && end.getTime() + buffer > x.start.getTime(),
        );
        if (clash) continue;
        const slot = map.get(hm) ?? { time: hm, start: start.toISOString(), barberIds: [] };
        slot.barberIds.push(b.id);
        map.set(hm, slot);
      }
    }
  }
  return [...map.values()].sort((a, b) => a.time.localeCompare(b.time));
}

/** Check whether an interval fits inside the barber's working intervals for that date. */
export function fitsWorkingHours(
  date: string,
  startHm: string,
  durationMin: number,
  hours: WorkInterval[],
) {
  const wd = weekdayOf(date);
  const s = hmToMin(startHm);
  return hours.some(
    (h) =>
      h.weekday === wd &&
      hmToMin(h.start_time.slice(0, 5)) <= s &&
      s + durationMin <= hmToMin(h.end_time.slice(0, 5)),
  );
}

export function sumServices(services: { price_cents: number; duration_min: number }[]) {
  return services.reduce(
    (acc, s) => ({ cents: acc.cents + s.price_cents, minutes: acc.minutes + s.duration_min }),
    { cents: 0, minutes: 0 },
  );
}
