import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { barbersQuery, servicesQuery } from "@/lib/admin";
import { ImageField } from "@/components/admin/ImageField";
import { WEEKDAYS, timeOf } from "@/lib/format";
import { fitsWorkingHours } from "@/lib/availability";
import { localHm, localYmd } from "@/lib/tz";
import { barberPhoto } from "@/lib/public-query";

export const Route = createFileRoute("/_authenticated/admin/barbieri")({ component: BarbersPage });

type Barber = NonNullable<ReturnType<typeof useQuery<any>>["data"]>[number];
type Iv = { weekday: number; start_time: string; end_time: string };
const TZ = "Europe/Rome";

async function futureAppointments(barberId: string) {
  const { data } = await supabase
    .from("appointments")
    .select("id, start_at, end_at, customer_name, total_minutes")
    .eq("barber_id", barberId)
    .in("status", ["pending", "confirmed"])
    .gte("start_at", new Date().toISOString())
    .order("start_at");
  return data ?? [];
}

function BarbersPage() {
  const qc = useQueryClient();
  const barbers = useQuery(barbersQuery);
  const [edit, setEdit] = useState<any | null>(null);

  async function toggleActive(b: any) {
    if (b.active) {
      const fut = await futureAppointments(b.id);
      if (fut.length && !window.confirm(`${b.name} ha ${fut.length} appuntamenti futuri. Non verranno cancellati: ricordati di riorganizzarli. Disattivare?`)) return;
    }
    await supabase.from("barbers").update({ active: !b.active }).eq("id", b.id);
    qc.invalidateQueries({ queryKey: ["admin"] });
  }

  async function remove(b: any) {
    const fut = await futureAppointments(b.id);
    if (fut.length) return toast.error(`Impossibile rimuovere: ${fut.length} appuntamenti futuri. Spostali o annullali prima.`);
    if (!window.confirm(`Rimuovere ${b.name}? Lo storico degli appuntamenti passati resta conservato.`)) return;
    const { error } = await supabase.from("barbers").delete().eq("id", b.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin"] });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl">Barbieri</h1>
        <Button variant="hero" onClick={() => setEdit({ name: "", bio: "", specialties: [], photo_url: "", active: true, barber_services: [], working_hours: [] })}><Plus /> Aggiungi</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {barbers.data?.map((b, i) => (
          <div key={b.id} className="flex gap-4 rounded-md border border-border bg-card p-4">
            <img src={barberPhoto(b, i)} alt="" className="h-24 w-20 rounded object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-xl">{b.name}</p>
                <Switch checked={b.active} onCheckedChange={() => toggleActive(b)} />
              </div>
              <p className="text-xs text-muted-foreground">{b.active ? "Attivo" : "Disattivato"} · {b.barber_services.length} trattamenti</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEdit(b)}>Modifica</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(b)}><Trash2 /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {edit && <BarberDialog barber={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function BarberDialog({ barber, onClose }: { barber: any; onClose: () => void }) {
  const qc = useQueryClient();
  const services = useQuery(servicesQuery);
  const [f, setF] = useState({
    name: barber.name as string,
    bio: barber.bio as string,
    specialties: (barber.specialties as string[]).join(", "),
    photo_url: (barber.photo_url ?? "") as string,
    serviceIds: barber.barber_services.map((x: any) => x.service_id) as string[],
    hours: barber.working_hours.map((h: any) => ({ weekday: h.weekday, start_time: h.start_time.slice(0, 5), end_time: h.end_time.slice(0, 5) })) as Iv[],
  });
  const [conflicts, setConflicts] = useState<any[]>([]);
  const timeOff = useQuery({
    queryKey: ["admin", "timeoff", barber.id],
    enabled: !!barber.id,
    queryFn: async () => (await supabase.from("time_off").select("*").eq("barber_id", barber.id).order("start_date")).data ?? [],
  });
  const [to, setTo] = useState({ start_date: "", end_date: "", reason: "" });

  async function save() {
    if (f.name.trim().length < 2) return toast.error("Inserisci il nome");
    if (f.hours.some((h) => h.end_time <= h.start_time)) return toast.error("Controlla gli orari: la fine deve essere dopo l'inizio.");
    const row = { name: f.name.trim(), bio: f.bio, specialties: f.specialties.split(",").map((s) => s.trim()).filter(Boolean), photo_url: f.photo_url || null };
    let id = barber.id as string | undefined;
    if (id) {
      const { error } = await supabase.from("barbers").update(row).eq("id", id);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase.from("barbers").insert({ ...row, sort_order: 99 }).select("id").single();
      if (error) return toast.error(error.message);
      id = data.id;
    }
    await supabase.from("barber_services").delete().eq("barber_id", id!);
    if (f.serviceIds.length) await supabase.from("barber_services").insert(f.serviceIds.map((s) => ({ barber_id: id!, service_id: s })));
    await supabase.from("working_hours").delete().eq("barber_id", id!);
    if (f.hours.length) await supabase.from("working_hours").insert(f.hours.map((h) => ({ ...h, barber_id: id! })));
    qc.invalidateQueries({ queryKey: ["admin"] });
    toast.success("Salvato");
    // Never move confirmed appointments silently: show conflicts.
    const fut = await futureAppointments(id!);
    const bad = fut.filter((a) => !fitsWorkingHours(localYmd(new Date(a.start_at), TZ), localHm(new Date(a.start_at), TZ), a.total_minutes, f.hours));
    if (bad.length) setConflicts(bad);
    else onClose();
  }

  async function addTimeOff() {
    if (!to.start_date) return;
    const { error } = await supabase.from("time_off").insert({ barber_id: barber.id, start_date: to.start_date, end_date: to.end_date || to.start_date, reason: to.reason });
    if (error) return toast.error(error.message);
    setTo({ start_date: "", end_date: "", reason: "" });
    timeOff.refetch();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-2xl">{barber.id ? "Modifica barbiere" : "Nuovo barbiere"}</DialogTitle></DialogHeader>
        {conflicts.length > 0 ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-warning"><AlertTriangle className="h-4 w-4" /> Questi appuntamenti confermati ora cadono fuori dall'orario di lavoro. Non sono stati spostati: riorganizzali dal calendario.</p>
            <ul className="text-sm">{conflicts.map((a) => <li key={a.id}>{new Date(a.start_at).toLocaleDateString("it-IT", { timeZone: TZ })} {timeOf(a.start_at)} — {a.customer_name}</li>)}</ul>
            <Button onClick={onClose}>Ho capito</Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Specializzazioni (separate da virgola)</Label><Input value={f.specialties} onChange={(e) => setF({ ...f, specialties: e.target.value })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Descrizione</Label><Textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
              <div className="sm:col-span-2"><ImageField value={f.photo_url} onChange={(u) => setF({ ...f, photo_url: u })} folder="barbers" label="Fotografia" /></div>
            </div>
            <div>
              <Label>Trattamenti che può eseguire</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {services.data?.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={f.serviceIds.includes(s.id)} onCheckedChange={(v) => setF({ ...f, serviceIds: v ? [...f.serviceIds, s.id] : f.serviceIds.filter((x) => x !== s.id) })} /> {s.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Orari di lavoro</Label>
              <p className="text-xs text-muted-foreground">Più fasce nello stesso giorno creano le pause (es. 9–13 e 14:30–19).</p>
              <div className="mt-2 space-y-2">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <div key={d} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-24">{WEEKDAYS[d]}</span>
                    {f.hours.map((h, i) => h.weekday !== d ? null : (
                      <span key={i} className="flex items-center gap-1">
                        <Input type="time" className="h-8 w-28" value={h.start_time} onChange={(e) => setF({ ...f, hours: f.hours.map((x, j) => (j === i ? { ...x, start_time: e.target.value } : x)) })} />
                        –
                        <Input type="time" className="h-8 w-28" value={h.end_time} onChange={(e) => setF({ ...f, hours: f.hours.map((x, j) => (j === i ? { ...x, end_time: e.target.value } : x)) })} />
                        <button className="text-muted-foreground hover:text-destructive" onClick={() => setF({ ...f, hours: f.hours.filter((_, j) => j !== i) })} aria-label="Rimuovi">×</button>
                      </span>
                    ))}
                    <Button size="sm" variant="ghost" onClick={() => setF({ ...f, hours: [...f.hours, { weekday: d, start_time: "09:00", end_time: "13:00" }] })}>+ fascia</Button>
                  </div>
                ))}
              </div>
            </div>
            {barber.id && (
              <div>
                <Label>Ferie e assenze</Label>
                <ul className="mt-2 space-y-1 text-sm">
                  {timeOff.data?.map((t) => (
                    <li key={t.id} className="flex items-center justify-between">
                      <span>{t.start_date} → {t.end_date} {t.reason && `· ${t.reason}`}</span>
                      <button className="text-muted-foreground hover:text-destructive" onClick={async () => { await supabase.from("time_off").delete().eq("id", t.id); timeOff.refetch(); }}><Trash2 className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Input type="date" className="w-auto" value={to.start_date} onChange={(e) => setTo({ ...to, start_date: e.target.value })} />
                  <Input type="date" className="w-auto" value={to.end_date} onChange={(e) => setTo({ ...to, end_date: e.target.value })} />
                  <Input placeholder="Motivo" className="w-40" value={to.reason} onChange={(e) => setTo({ ...to, reason: e.target.value })} />
                  <Button size="sm" variant="outline" onClick={addTimeOff}>Aggiungi</Button>
                </div>
              </div>
            )}
            <div className="flex justify-end"><Button variant="hero" onClick={save}>Salva</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
