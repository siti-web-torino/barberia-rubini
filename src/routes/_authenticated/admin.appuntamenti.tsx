import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { barbersQuery, type AdminAppointment } from "@/lib/admin";
import { AppointmentDialog, StatusBadge } from "@/components/admin/AppointmentDialog";
import { euro, STATUS_LABEL, timeOf } from "@/lib/format";
import { zonedToUtc, addDays } from "@/lib/tz";

export const Route = createFileRoute("/_authenticated/admin/appuntamenti")({ component: ListPage });

const TZ = "Europe/Rome";

function ListPage() {
  const barbers = useQuery(barbersQuery);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [barber, setBarber] = useState("");
  const [date, setDate] = useState("");
  const [when, setWhen] = useState<"future" | "past" | "all">("future");
  const [sel, setSel] = useState<AdminAppointment | null>(null);
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["appointments", "list", search, status, barber, date, when],
    queryFn: async () => {
      let r = supabase.from("appointments").select("*, appointment_services(id, service_id, name, price_cents, duration_min)");
      const now = new Date().toISOString();
      if (date) r = r.gte("start_at", zonedToUtc(date, "00:00", TZ).toISOString()).lt("start_at", zonedToUtc(addDays(date, 1), "00:00", TZ).toISOString());
      else if (when === "future") r = r.gte("start_at", now);
      else if (when === "past") r = r.lt("start_at", now);
      if (status) r = r.eq("status", status as any);
      if (barber) r = r.eq("barber_id", barber);
      if (search.trim()) {
        const s = search.trim().replace(/[%,()]/g, "");
        r = r.or(`customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%,customer_email.ilike.%${s}%,code.ilike.%${s}%`);
      }
      const { data, error } = await r.order("start_at", { ascending: when !== "past" }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const sel_ = "h-9 rounded-md border border-input bg-background px-3 text-sm";
  return (
    <div className="space-y-5">
      <h1 className="text-3xl">Appuntamenti</h1>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Cerca nome, telefono, email, codice" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
        <select className={sel_} value={when} onChange={(e) => setWhen(e.target.value as any)}>
          <option value="future">Futuri</option><option value="past">Passati</option><option value="all">Tutti</option>
        </select>
        <select className={sel_} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tutti gli stati</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={sel_} value={barber} onChange={(e) => setBarber(e.target.value)}>
          <option value="">Tutti i barbieri</option>
          {barbers.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-3">Data</th><th className="p-3">Cliente</th><th className="p-3">Barbiere</th><th className="p-3">Trattamenti</th><th className="p-3">Totale</th><th className="p-3">Stato</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {q.data?.map((a) => (
              <tr key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSel(a); setOpen(true); }}>
                <td className="whitespace-nowrap p-3">{new Date(a.start_at).toLocaleDateString("it-IT", { timeZone: TZ })} {timeOf(a.start_at)}</td>
                <td className="p-3">{a.customer_name}<span className="block text-xs text-muted-foreground">{a.customer_phone}</span></td>
                <td className="p-3">{a.barber_name}</td>
                <td className="p-3">{a.appointment_services.map((s) => s.name).join(", ")}</td>
                <td className="p-3">{euro(a.total_cents)}</td>
                <td className="p-3"><StatusBadge status={a.status} /></td>
              </tr>
            ))}
            {q.data?.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nessun risultato.</td></tr>}
          </tbody>
        </table>
      </div>
      <AppointmentDialog open={open} onOpenChange={setOpen} appointment={sel} />
    </div>
  );
}
