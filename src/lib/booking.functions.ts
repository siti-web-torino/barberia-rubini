import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^\d{2}:\d{2}$/;

/* ---------------- Public ---------------- */

export const getPublicData = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [settings, barbers, services, bs, wh, closures] = await Promise.all([
    supabaseAdmin.from("site_settings").select("key, value"),
    supabaseAdmin.from("barbers").select("id, name, photo_url, bio, specialties, sort_order").eq("active", true).order("sort_order"),
    supabaseAdmin
      .from("services")
      .select("id, name, description, price_cents, duration_min, image_url, category, sort_order")
      .eq("active", true)
      .eq("visible", true)
      .order("sort_order"),
    supabaseAdmin.from("barber_services").select("barber_id, service_id"),
    supabaseAdmin.from("working_hours").select("barber_id, weekday, start_time, end_time"),
    supabaseAdmin.from("time_off").select("start_date, end_date, reason").is("barber_id", null).gte("end_date", new Date().toISOString().slice(0, 10)).order("start_date"),
  ]);
  const map = Object.fromEntries((settings.data ?? []).map((r) => [r.key, r.value]));
  const content = (map.content ?? {}) as Record<string, any>;
  const booking = (map.booking ?? {}) as Record<string, any>;
  return {
    content,
    booking: { allow_multiple: booking.allow_multiple !== false, max_days_ahead: Number(booking.max_days_ahead ?? 60) },
    barbers: (barbers.data ?? []).map((b) => ({
      ...b,
      serviceIds: (bs.data ?? []).filter((x) => x.barber_id === b.id).map((x) => x.service_id),
      workDays: [...new Set((wh.data ?? []).filter((w) => w.barber_id === b.id).map((w) => w.weekday))].sort(),
    })),
    services: (services.data ?? []).map((s) => ({
      ...s,
      barberIds: (bs.data ?? []).filter((x) => x.service_id === s.id).map((x) => x.barber_id),
    })),
    hours: wh.data ?? [],
    closures: closures.data ?? [],
  };
});

const availInput = z.object({
  serviceIds: z.array(z.string().uuid()).min(1).max(6),
  barberId: z.string().uuid().nullable(),
});

export const getMonthAvailability = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => availInput.extend({ from: z.string().regex(dateRe), days: z.number().int().min(1).max(62) }).parse(i))
  .handler(async ({ data }) => {
    const { monthDays } = await import("./booking.server");
    return monthDays(data);
  });

export const getDaySlots = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => availInput.extend({ date: z.string().regex(dateRe) }).parse(i))
  .handler(async ({ data }) => {
    const { slotsFor } = await import("./booking.server");
    const r = await slotsFor({ date: data.date, serviceIds: data.serviceIds, barberId: data.barberId });
    return r.slots.map((s) => ({ time: s.time, start: s.start }));
  });

const bookingInput = availInput.extend({
  date: z.string().regex(dateRe),
  time: z.string().regex(timeRe),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[+0-9 ()-]{6,20}$/),
  email: z.string().trim().email().max(255),
  notes: z.string().trim().max(500).default(""),
  privacy: z.literal(true),
});

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => bookingInput.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { slotsFor, newCode } = await import("./booking.server");
    const { sendAppointmentEmail } = await import("./notify.server");

    const { slots, rules, services, barbers, duration } = await slotsFor({
      date: data.date,
      serviceIds: data.serviceIds,
      barberId: data.barberId,
    });
    if (!rules.allow_multiple && data.serviceIds.length > 1) throw new Error("È possibile prenotare un solo trattamento alla volta.");
    const slot = slots.find((s) => s.time === data.time);
    if (!slot) throw new Error("SLOT_TAKEN");

    const total = services.reduce((a, s) => a + s.price_cents, 0);
    const start = new Date(slot.start);
    const end = new Date(start.getTime() + duration * 60000);

    // Try each free barber in order; the DB exclusion constraint resolves races.
    for (const barberId of slot.barberIds) {
      const barber = barbers.find((b) => b.id === barberId)!;
      const code = newCode();
      const { data: appt, error } = await supabaseAdmin
        .from("appointments")
        .insert({
          code,
          customer_name: data.name,
          customer_phone: data.phone,
          customer_email: data.email,
          notes: data.notes,
          barber_id: barberId,
          barber_name: barber.name,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          total_cents: total,
          total_minutes: duration,
          status: rules.auto_confirm ? "confirmed" : "pending",
          source: "online",
        })
        .select("id, code")
        .single();
      if (error) {
        if (error.code === "23P01") continue; // overlap: someone booked meanwhile
        throw new Error("Impossibile salvare la prenotazione. Riprova.");
      }
      const { error: svcErr } = await supabaseAdmin.from("appointment_services").insert(
        services.map((s) => ({ appointment_id: appt.id, service_id: s.id, name: s.name, price_cents: s.price_cents, duration_min: s.duration_min })),
      );
      if (svcErr) {
        await supabaseAdmin.from("appointments").delete().eq("id", appt.id);
        throw new Error("Impossibile salvare la prenotazione. Riprova.");
      }
      await sendAppointmentEmail(appt.id, "confirmation");
      return { code: appt.code };
    }
    throw new Error("SLOT_TAKEN");
  });

export const getBookingByCode = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ code: z.string().regex(/^BR-[A-Z0-9]{8}$/) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: a } = await supabaseAdmin
      .from("appointments")
      .select("id, code, customer_name, barber_name, start_at, end_at, total_cents, total_minutes, status, notes, appointment_services(name, price_cents, duration_min)")
      .eq("code", data.code)
      .maybeSingle();
    if (!a) return null;
    const { loadContent } = await import("./booking.server");
    const c = await loadContent();
    return {
      ...a,
      customer_name: a.customer_name.split(" ")[0], // first name only
      shop: { name: String(c.name ?? "Barbiere Rubini"), address: String(c.address ?? ""), phone: String(c.phone ?? "") },
    };
  });

/* ---------------- Admin setup ---------------- */

export const getAdminSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
  return { needsSetup: (count ?? 0) === 0 };
});

export const createFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ email: z.string().email(), password: z.string().min(10).max(72) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("L'amministratore è già stato configurato.");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Errore");
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });
    return { ok: true };
  });

/* ---------------- Admin appointments ---------------- */

async function assertAdmin(supabase: any) {
  const { data } = await supabase.rpc("is_admin");
  if (!data) throw new Error("Non autorizzato");
}

const adminApptInput = z.object({
  id: z.string().uuid().optional(),
  barberId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1).max(8),
  date: z.string().regex(dateRe),
  time: z.string().regex(timeRe),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(3).max(30),
  email: z.string().trim().email().max(255).or(z.literal("")),
  notes: z.string().trim().max(500).default(""),
  status: z.enum(["pending", "confirmed", "cancelled", "completed", "no_show"]).default("confirmed"),
  outsideHours: z.boolean().default(false),
  notify: z.boolean().default(true),
});

export const adminSaveAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => adminApptInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadRules, loadServices, loadCandidates, loadBusy, newCode } = await import("./booking.server");
    const { fitsWorkingHours } = await import("./availability");
    const { zonedToUtc } = await import("./tz");
    const { sendAppointmentEmail } = await import("./notify.server");

    const rules = await loadRules();
    const { data: barber } = await supabaseAdmin
      .from("barbers")
      .select("id, name, working_hours(weekday, start_time, end_time)")
      .eq("id", data.barberId)
      .single();
    if (!barber) throw new Error("Barbiere non trovato");

    // keep price snapshots if services unchanged
    let snap: { service_id: string | null; name: string; price_cents: number; duration_min: number }[] = [];
    let existing: any = null;
    if (data.id) {
      const { data: ex } = await supabaseAdmin.from("appointments").select("*, appointment_services(*)").eq("id", data.id).single();
      existing = ex;
      const oldIds = (ex?.appointment_services ?? []).map((s: any) => s.service_id).sort().join();
      if (oldIds === [...data.serviceIds].sort().join()) snap = ex.appointment_services;
    }
    if (!snap.length) {
      const svcs = await loadServices(data.serviceIds, false);
      snap = svcs.map((s) => ({ service_id: s.id, name: s.name, price_cents: s.price_cents, duration_min: s.duration_min }));
    }
    const minutes = snap.reduce((a, s) => a + s.duration_min, 0);
    const cents = snap.reduce((a, s) => a + s.price_cents, 0);

    const blocking = data.status === "pending" || data.status === "confirmed";
    if (blocking) {
      if (!data.outsideHours && !fitsWorkingHours(data.date, data.time, minutes, barber.working_hours)) {
        throw new Error("OUTSIDE_HOURS");
      }
      const start = zonedToUtc(data.date, data.time, rules.timezone).getTime();
      const end = start + minutes * 60000;
      const busy = await loadBusy(data.date, data.date, rules.timezone, data.id);
      const buf = rules.buffer_minutes * 60000;
      if (busy.some((b) => b.barber_id === data.barberId && start < b.end.getTime() + buf && end + buf > b.start.getTime())) {
        throw new Error("Il barbiere ha già un appuntamento in questo orario.");
      }
    }
    void loadCandidates;

    const start = zonedToUtc(data.date, data.time, rules.timezone);
    const row = {
      customer_name: data.name,
      customer_phone: data.phone,
      customer_email: data.email || null,
      notes: data.notes,
      barber_id: data.barberId,
      barber_name: barber.name,
      start_at: start.toISOString(),
      end_at: new Date(start.getTime() + minutes * 60000).toISOString(),
      total_cents: cents,
      total_minutes: minutes,
      status: data.status,
      updated_at: new Date().toISOString(),
    };

    let id = data.id;
    if (id) {
      const { error } = await context.supabase.from("appointments").update(row).eq("id", id);
      if (error) throw new Error(error.code === "23P01" ? "Sovrapposizione con un altro appuntamento." : error.message);
      await context.supabase.from("appointment_services").delete().eq("appointment_id", id);
    } else {
      const { data: ins, error } = await context.supabase
        .from("appointments")
        .insert({ ...row, code: newCode(), source: "admin" })
        .select("id")
        .single();
      if (error) throw new Error(error.code === "23P01" ? "Sovrapposizione con un altro appuntamento." : error.message);
      id = ins.id;
    }
    await context.supabase
      .from("appointment_services")
      .insert(snap.map((s) => ({ appointment_id: id!, service_id: s.service_id, name: s.name, price_cents: s.price_cents, duration_min: s.duration_min })));

    if (data.notify && data.email) {
      const kind = data.status === "cancelled" ? "cancellation" : existing ? "update" : "confirmation";
      const changed = !existing || existing.start_at !== row.start_at || existing.barber_id !== row.barber_id || existing.status !== row.status || existing.total_cents !== row.total_cents;
      if (changed) await sendAppointmentEmail(id!, kind);
    }
    return { id };
  });

export const adminSetStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["pending", "confirmed", "cancelled", "completed", "no_show"]), notify: z.boolean().default(true) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { error } = await context.supabase
      .from("appointments")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.code === "23P01" ? "L'orario è ora occupato da un altro appuntamento." : error.message);
    if (data.notify && (data.status === "cancelled" || data.status === "confirmed")) {
      const { sendAppointmentEmail } = await import("./notify.server");
      await sendAppointmentEmail(data.id, data.status === "cancelled" ? "cancellation" : "confirmation");
    }
    return { ok: true };
  });

export const adminRetryEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ logId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase);
    const { data: log } = await context.supabase.from("email_log").select("appointment_id, kind").eq("id", data.logId).single();
    if (!log?.appointment_id) throw new Error("Invio non trovato");
    const { sendAppointmentEmail } = await import("./notify.server");
    return sendAppointmentEmail(log.appointment_id, log.kind as any, data.logId);
  });
