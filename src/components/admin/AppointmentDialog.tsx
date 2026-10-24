import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { adminSaveAppointment, adminSetStatus } from "@/lib/booking.functions";
import { barbersQuery, servicesQuery, type AdminAppointment } from "@/lib/admin";
import { euro, minutesLabel, STATUS_LABEL } from "@/lib/format";
import { localHm, localYmd } from "@/lib/tz";

const TZ = "Europe/Rome";
type Status = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";

export function AppointmentDialog({
  open,
  onOpenChange,
  appointment,
  defaults,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  appointment?: AdminAppointment | null;
  defaults?: { date?: string; time?: string; barberId?: string };
}) {
  const qc = useQueryClient();
  const barbers = useQuery(barbersQuery);
  const services = useQuery(servicesQuery);
  const saveFn = useServerFn(adminSaveAppointment);
  const statusFn = useServerFn(adminSetStatus);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    barberId: "",
    serviceIds: [] as string[],
    date: "",
    time: "",
    name: "",
    phone: "",
    email: "",
    notes: "",
    status: "confirmed" as Status,
    notify: true,
  });

  useEffect(() => {
    if (!open) return;
    if (appointment) {
      setF({
        barberId: appointment.barber_id ?? "",
        serviceIds: appointment.appointment_services.map((s) => s.service_id).filter(Boolean) as string[],
        date: localYmd(new Date(appointment.start_at), TZ),
        time: localHm(new Date(appointment.start_at), TZ),
        name: appointment.customer_name,
        phone: appointment.customer_phone,
        email: appointment.customer_email ?? "",
        notes: appointment.notes,
        status: appointment.status,
        notify: true,
      });
    } else {
      setF((p) => ({
        ...p,
        barberId: defaults?.barberId ?? barbers.data?.find((b) => b.active)?.id ?? "",
        serviceIds: [],
        date: defaults?.date ?? localYmd(new Date(), TZ),
        time: defaults?.time ?? "09:00",
        name: "",
        phone: "",
        email: "",
        notes: "",
        status: "confirmed",
      }));
    }
  }, [open, appointment, defaults?.date, defaults?.time, defaults?.barberId, barbers.data]);

  const sel = (services.data ?? []).filter((s) => f.serviceIds.includes(s.id));
  const removedSnap = appointment?.appointment_services.filter((s) => !s.service_id) ?? [];

  async function save(outsideHours = false) {
    if (!f.barberId || !f.serviceIds.length) return toast.error("Scegli barbiere e almeno un trattamento.");
    setBusy(true);
    try {
      await saveFn({ data: { ...f, id: appointment?.id, outsideHours } });
      toast.success("Appuntamento salvato");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore";
      if (msg.includes("OUTSIDE_HOURS")) {
        if (window.confirm("L'orario è fuori dall'orario di lavoro del barbiere. Salvare comunque?")) return save(true);
      } else toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: Status) {
    if (!appointment) return;
    if (status === "cancelled" && !window.confirm("Annullare questo appuntamento?")) return;
    try {
      await statusFn({ data: { id: appointment.id, status, notify: f.notify } });
      toast.success(`Stato: ${STATUS_LABEL[status]}`);
      qc.invalidateQueries({ queryKey: ["appointments"] });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  }

  async function remove() {
    if (!appointment) return;
    if (!window.confirm("Eliminare definitivamente? L'operazione non può essere annullata.")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", appointment.id);
    if (error) return toast.error(error.message);
    toast.success("Eliminato");
    qc.invalidateQueries({ queryKey: ["appointments"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{appointment ? `Appuntamento ${appointment.code}` : "Nuovo appuntamento"}</DialogTitle>
        </DialogHeader>
        {appointment && (
          <div className="flex flex-wrap gap-2">
            {(["confirmed", "completed", "no_show", "cancelled"] as Status[]).map((s) => (
              <Button key={s} size="sm" variant={appointment.status === s ? "default" : "outline"} onClick={() => setStatus(s)} disabled={appointment.status === s}>
                {STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Barbiere</Label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.barberId} onChange={(e) => setF({ ...f, barberId: e.target.value })}>
              <option value="">—</option>
              {barbers.data?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}{b.active ? "" : " (disattivato)"}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2"><Label>Data</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div className="space-y-2"><Label>Ora</Label><Input type="time" step={300} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Trattamenti</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {services.data?.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={f.serviceIds.includes(s.id)}
                    onCheckedChange={(v) => setF({ ...f, serviceIds: v ? [...f.serviceIds, s.id] : f.serviceIds.filter((x) => x !== s.id) })}
                  />
                  {s.name} <span className="text-muted-foreground">· {euro(s.price_cents)}</span>
                </label>
              ))}
            </div>
            {removedSnap.length > 0 && <p className="text-xs text-warning">Trattamenti non più a listino: {removedSnap.map((s) => s.name).join(", ")}</p>}
            {appointment ? (
              <p className="text-xs text-muted-foreground">Prezzo applicato: {euro(appointment.total_cents)} · {minutesLabel(appointment.total_minutes)} (i prezzi si ricalcolano solo se cambi i trattamenti)</p>
            ) : (
              <p className="text-xs text-muted-foreground">Totale: {euro(sel.reduce((a, s) => a + s.price_cents, 0))} · {minutesLabel(sel.reduce((a, s) => a + s.duration_min, 0))}</p>
            )}
          </div>
          <div className="space-y-2"><Label>Nome cliente</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Telefono</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Note</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          {!appointment && (
            <div className="space-y-2">
              <Label>Stato</Label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Status })}>
                <option value="confirmed">Confermato</option>
                <option value="pending">In attesa</option>
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={f.notify} onCheckedChange={(v) => setF({ ...f, notify: v === true })} /> Avvisa il cliente via email
          </label>
        </div>
        <div className="flex items-center justify-between gap-2 pt-2">
          {appointment && appointment.status === "cancelled" ? (
            <Button variant="ghost" className="text-destructive" onClick={remove}><Trash2 /> Elimina</Button>
          ) : <span />}
          <Button variant="hero" onClick={() => save()} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Salva</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    confirmed: "bg-success/15 text-success",
    pending: "bg-warning/15 text-warning",
    cancelled: "bg-destructive/15 text-destructive line-through",
    completed: "bg-muted text-muted-foreground",
    no_show: "bg-destructive/10 text-destructive",
  };
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${cls[status] ?? ""}`}>{STATUS_LABEL[status]}</span>;
}
