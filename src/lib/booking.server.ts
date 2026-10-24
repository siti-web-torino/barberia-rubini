import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeSlots, DEFAULT_RULES, type BookingRules, type Busy } from "./availability";
import { addDays, zonedToUtc } from "./tz";

export async function loadRules(): Promise<BookingRules> {
  const { data } = await supabaseAdmin.from("site_settings").select("value").eq("key", "booking").maybeSingle();
  return { ...DEFAULT_RULES, ...((data?.value as Partial<BookingRules>) ?? {}) };
}

export async function loadContent(): Promise<Record<string, unknown>> {
  const { data } = await supabaseAdmin.from("site_settings").select("value").eq("key", "content").maybeSingle();
  return (data?.value as Record<string, unknown>) ?? {};
}

/** Barbers (active) that can perform all given services, with their hours. */
export async function loadCandidates(serviceIds: string[], barberId: string | null, includeInactive = false) {
  let q = supabaseAdmin.from("barbers").select("id, name, active, barber_services(service_id), working_hours(weekday, start_time, end_time)");
  if (!includeInactive) q = q.eq("active", true);
  if (barberId) q = q.eq("id", barberId);
  const { data, error } = await q.order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((b) => serviceIds.every((s) => b.barber_services.some((x) => x.service_id === s)))
    .map((b) => ({ id: b.id, name: b.name, hours: b.working_hours }));
}

export async function loadServices(ids: string[], onlyBookable = true) {
  let q = supabaseAdmin.from("services").select("id, name, price_cents, duration_min, active, visible").in("id", ids);
  if (onlyBookable) q = q.eq("active", true).eq("visible", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  if (!data || data.length !== new Set(ids).size) throw new Error("Uno o più trattamenti non sono disponibili.");
  // keep the customer's order
  return ids.map((id) => data.find((s) => s.id === id)!);
}

export async function loadBusy(fromDate: string, toDate: string, tz: string, excludeId?: string): Promise<Busy[]> {
  const from = zonedToUtc(addDays(fromDate, -1), "00:00", tz).toISOString();
  const to = zonedToUtc(addDays(toDate, 1), "23:59", tz).toISOString();
  let q = supabaseAdmin
    .from("appointments")
    .select("id, barber_id, start_at, end_at")
    .in("status", ["pending", "confirmed"])
    .lt("start_at", to)
    .gt("end_at", from);
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => ({ barber_id: a.barber_id, start: new Date(a.start_at), end: new Date(a.end_at) }));
}

export async function loadTimeOff(fromDate: string, toDate: string) {
  const { data, error } = await supabaseAdmin
    .from("time_off")
    .select("barber_id, start_date, end_date")
    .lte("start_date", toDate)
    .gte("end_date", fromDate);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function slotsFor(params: {
  date: string;
  serviceIds: string[];
  barberId: string | null;
  excludeAppointmentId?: string;
  ignoreLimits?: boolean;
}) {
  const rules = await loadRules();
  const services = await loadServices(params.serviceIds, !params.ignoreLimits);
  const duration = services.reduce((a, s) => a + s.duration_min, 0);
  const barbers = await loadCandidates(params.serviceIds, params.barberId);
  const [busy, timeOff] = await Promise.all([
    loadBusy(params.date, params.date, rules.timezone, params.excludeAppointmentId),
    loadTimeOff(params.date, params.date),
  ]);
  const slots = computeSlots({
    date: params.date,
    durationMin: duration,
    rules,
    now: new Date(),
    barbers,
    timeOff,
    busy,
    ignoreLimits: params.ignoreLimits,
  });
  return { slots, rules, services, barbers, duration };
}

export async function monthDays(params: { from: string; days: number; serviceIds: string[]; barberId: string | null }) {
  const rules = await loadRules();
  const services = await loadServices(params.serviceIds);
  const duration = services.reduce((a, s) => a + s.duration_min, 0);
  const barbers = await loadCandidates(params.serviceIds, params.barberId);
  const to = addDays(params.from, params.days - 1);
  const [busy, timeOff] = await Promise.all([loadBusy(params.from, to, rules.timezone), loadTimeOff(params.from, to)]);
  const now = new Date();
  const result: Record<string, number> = {};
  for (let i = 0; i < params.days; i++) {
    const date = addDays(params.from, i);
    result[date] = computeSlots({ date, durationMin: duration, rules, now, barbers, timeOff, busy }).length;
  }
  return result;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return "BR-" + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
