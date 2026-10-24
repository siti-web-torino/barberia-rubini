import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchAppointments, type AdminAppointment } from "@/lib/admin";
import { AppointmentDialog, StatusBadge } from "@/components/admin/AppointmentDialog";
import { adminRetryEmail } from "@/lib/booking.functions";
import { longDate, timeOf } from "@/lib/format";
import { addDays, localYmd, zonedToUtc } from "@/lib/tz";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Dashboard });

const TZ = "Europe/Rome";

function Dashboard() {
  const qc = useQueryClient();
  const today = localYmd(new Date(), TZ);
  const from = zonedToUtc(today, "00:00", TZ).toISOString();
  const to = zonedToUtc(addDays(today, 14), "00:00", TZ).toISOString();
  const tomorrow = zonedToUtc(addDays(today, 1), "00:00", TZ).toISOString();
  const appts = useQuery({ queryKey: ["appointments", from, to], queryFn: () => fetchAppointments(from, to) });
  const recentCancel = useQuery({
    queryKey: ["appointments", "cancelled"],
    queryFn: async () =>
      (await supabase.from("appointments").select("id, code, customer_name, start_at, updated_at").eq("status", "cancelled").order("updated_at", { ascending: false }).limit(5)).data ?? [],
  });
  const emails = useQuery({
    queryKey: ["appointments", "emails"],
    queryFn: async () =>
      (await supabase.from("email_log").select("id, kind, recipient, status, error, created_at").neq("status", "sent").order("created_at", { ascending: false }).limit(8)).data ?? [],
  });
  const retry = useServerFn(adminRetryEmail);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<AdminAppointment | null>(null);

  const all = appts.data ?? [];
  const todayList = all.filter((a) => a.start_at < tomorrow && a.status !== "cancelled");
  const upcoming = all.filter((a) => a.start_at >= tomorrow && (a.status === "confirmed" || a.status === "pending")).slice(0, 10);
  const pending = all.filter((a) => a.status === "pending");

  const openA = (a: AdminAppointment | null) => { setSel(a); setOpen(true); };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="text-3xl capitalize">{longDate(new Date())}</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/admin/calendario">Calendario</Link></Button>
          <Button variant="hero" onClick={() => openA(null)}><Plus /> Nuovo</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Oggi" value={todayList.length} />
        <Stat label="Prossimi 14 giorni" value={all.filter((a) => a.status === "confirmed" || a.status === "pending").length} />
        <Stat label="In attesa" value={pending.length} warn={pending.length > 0} />
        <Stat label="Annullati di recente" value={recentCancel.data?.length ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Appuntamenti di oggi">
          <List items={todayList} onOpen={openA} empty="Nessun appuntamento oggi." />
        </Panel>
        <Panel title="Prossimi appuntamenti">
          <List items={upcoming} onOpen={openA} showDate empty="Nessun appuntamento in arrivo." />
        </Panel>
        {pending.length > 0 && (
          <Panel title="Da confermare">
            <List items={pending} onOpen={openA} showDate empty="" />
          </Panel>
        )}
        <Panel title="Annullamenti recenti">
          <ul className="divide-y divide-border text-sm">
            {recentCancel.data?.map((a) => (
              <li key={a.id} className="flex justify-between py-2"><span>{a.customer_name}</span><span className="text-muted-foreground">{longDate(a.start_at)} {timeOf(a.start_at)}</span></li>
            ))}
            {!recentCancel.data?.length && <li className="py-2 text-muted-foreground">Nessuno.</li>}
          </ul>
        </Panel>
        <Panel title="Email non inviate">
          <p className="mb-2 text-xs text-muted-foreground">Le email partiranno quando sarà collegato il dominio del mittente. Puoi ritentare l'invio senza duplicare l'appuntamento.</p>
          <ul className="divide-y divide-border text-sm">
            {emails.data?.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate">{e.kind} → {e.recipient}<span className="block text-xs text-muted-foreground">{e.error}</span></span>
                <Button size="sm" variant="ghost" onClick={async () => { const r = await retry({ data: { logId: e.id } }); toast(r.sent ? "Email inviata" : "Invio non riuscito: " + (r.reason ?? "")); qc.invalidateQueries({ queryKey: ["appointments", "emails"] }); }}>
                  <RotateCw />
                </Button>
              </li>
            ))}
            {!emails.data?.length && <li className="py-2 text-muted-foreground">Tutto in ordine.</li>}
          </ul>
        </Panel>
      </div>
      <AppointmentDialog open={open} onOpenChange={setOpen} appointment={sel} />
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-3xl ${warn ? "text-warning" : ""}`}>{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-card p-5">
      <h2 className="mb-3 text-lg">{title}</h2>
      {children}
    </section>
  );
}

function List({ items, onOpen, showDate, empty }: { items: AdminAppointment[]; onOpen: (a: AdminAppointment) => void; showDate?: boolean; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((a) => (
        <li key={a.id}>
          <button onClick={() => onOpen(a)} className="flex w-full items-center gap-3 py-2 text-left text-sm hover:text-primary">
            <span className="w-24 shrink-0 font-mono text-xs">{showDate ? new Date(a.start_at).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", timeZone: TZ }) + " " : ""}{timeOf(a.start_at)}</span>
            <span className="min-w-0 flex-1 truncate">{a.customer_name} <span className="text-muted-foreground">· {a.appointment_services.map((s) => s.name).join(", ")} · {a.barber_name}</span></span>
            <StatusBadge status={a.status} />
          </button>
        </li>
      ))}
    </ul>
  );
}
