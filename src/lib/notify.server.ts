import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type EmailKind = "confirmation" | "update" | "cancellation" | "reminder";

/**
 * Sends an appointment email and records the outcome in email_log.
 * Never throws: a failed email must not lose the booking.
 * Sending activates once the sender domain is configured; until then every attempt
 * is logged as "skipped" and can be retried from the admin panel.
 */
export async function sendAppointmentEmail(appointmentId: string, kind: EmailKind, logId?: string) {
  const { data: appt } = await supabaseAdmin
    .from("appointments")
    .select("id, customer_email")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt?.customer_email) return { sent: false, reason: "no_email" };

  let status = "skipped";
  let error: string | null = "Dominio email non ancora configurato";
  try {
    // Email provider not yet connected (no verified sender domain).
    // When the domain is set up, the real send goes here.
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : String(e);
  }

  const row = { appointment_id: appt.id, kind, recipient: appt.customer_email, status, error };
  if (logId) await supabaseAdmin.from("email_log").update({ ...row, created_at: new Date().toISOString() }).eq("id", logId);
  else await supabaseAdmin.from("email_log").insert(row);
  return { sent: status === "sent", reason: error };
}
