import { describe, expect, it } from "vitest";
import { computeSlots, DEFAULT_RULES, sumServices } from "@/lib/availability";
import { zonedToUtc } from "@/lib/tz";

const rules = { ...DEFAULT_RULES, min_notice_minutes: 0, slot_step_minutes: 30 };
const now = new Date("2026-11-01T00:00:00Z");
const hours = [{ weekday: 2, start_time: "09:00", end_time: "11:00" }]; // Tuesday
const base = { date: "2026-11-03", rules, now, timeOff: [], busy: [] as any[], barbers: [{ id: "a", hours }] };

describe("availability", () => {
  it("sums prices and durations of multiple services", () => {
    expect(sumServices([{ price_cents: 2000, duration_min: 30 }, { price_cents: 1200, duration_min: 20 }])).toEqual({ cents: 3200, minutes: 50 });
  });
  it("uses duration to fit slots inside working hours", () => {
    expect(computeSlots({ ...base, durationMin: 60 }).map((s) => s.time)).toEqual(["09:00", "09:30", "10:00"]);
  });
  it("never offers overlapping slots for the same barber", () => {
    const busy = [{ barber_id: "a", start: zonedToUtc("2026-11-03", "09:30", "Europe/Rome"), end: zonedToUtc("2026-11-03", "10:00", "Europe/Rome") }];
    expect(computeSlots({ ...base, durationMin: 30, busy }).map((s) => s.time)).toEqual(["09:00", "10:00", "10:30"]);
  });
  it("closes on shop closure days", () => {
    expect(computeSlots({ ...base, durationMin: 30, timeOff: [{ barber_id: null, start_date: "2026-11-03", end_date: "2026-11-03" }] })).toEqual([]);
  });
  it("no slots in the past", () => {
    expect(computeSlots({ ...base, date: "2026-10-27", durationMin: 30 })).toEqual([]);
  });
  it("converts Rome wall time to UTC (CET)", () => {
    expect(zonedToUtc("2026-11-03", "09:00", "Europe/Rome").toISOString()).toBe("2026-11-03T08:00:00.000Z");
  });
});
