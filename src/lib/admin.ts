import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const barbersQuery = queryOptions({
  queryKey: ["admin", "barbers"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("barbers")
      .select("*, barber_services(service_id), working_hours(id, weekday, start_time, end_time)")
      .order("sort_order");
    if (error) throw error;
    return data;
  },
});

export const servicesQuery = queryOptions({
  queryKey: ["admin", "services"],
  queryFn: async () => {
    const { data, error } = await supabase.from("services").select("*, barber_services(barber_id)").order("sort_order");
    if (error) throw error;
    return data;
  },
});

export const settingsQuery = queryOptions({
  queryKey: ["admin", "settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("site_settings").select("key, value");
    if (error) throw error;
    const m = Object.fromEntries(data.map((r) => [r.key, r.value])) as Record<string, any>;
    return { content: (m.content ?? {}) as Record<string, any>, booking: (m.booking ?? {}) as Record<string, any> };
  },
});

export type AdminAppointment = Awaited<ReturnType<typeof fetchAppointments>>[number];

export async function fetchAppointments(fromIso: string, toIso: string) {
  const { data, error } = await supabase
    .from("appointments")
    .select("*, appointment_services(id, service_id, name, price_cents, duration_min)")
    .gte("start_at", fromIso)
    .lt("start_at", toIso)
    .order("start_at");
  if (error) throw error;
  return data;
}

/** Upload to the private media bucket and return a long-lived signed URL. */
export async function uploadImage(file: File, folder: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data, error: e2 } = await supabase.storage.from("media").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (e2 || !data) throw e2 ?? new Error("upload");
  return data.signedUrl;
}

export async function saveSetting(key: "content" | "booking", value: Record<string, unknown>) {
  const { error } = await supabase.from("site_settings").upsert({ key, value: value as any, updated_at: new Date().toISOString() });
  if (error) throw error;
}
