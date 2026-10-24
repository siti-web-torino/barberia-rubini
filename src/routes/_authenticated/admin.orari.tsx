import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { saveSetting, settingsQuery } from "@/lib/admin";
import { DEFAULT_RULES } from "@/lib/availability";

export const Route = createFileRoute("/_authenticated/admin/orari")({ component: HoursPage });

function HoursPage() {
  const qc = useQueryClient();
  const settings = useQuery(settingsQuery);
  const [rules, setRules] = useState(DEFAULT_RULES);
  useEffect(() => { if (settings.data) setRules({ ...DEFAULT_RULES, ...settings.data.booking }); }, [settings.data]);
  const closures = useQuery({
    queryKey: ["admin", "closures"],
    queryFn: async () => (await supabase.from("time_off").select("*").is("barber_id", null).order("start_date", { ascending: false })).data ?? [],
  });
  const [c, setC] = useState({ start_date: "", end_date: "", reason: "" });

  async function saveRules() {
    try {
      await saveSetting("booking", rules);
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      toast.success("Regole salvate");
    } catch (e: any) { toast.error(e.message); }
  }
  async function addClosure() {
    if (!c.start_date) return;
    const { data: conflicts } = await supabase.from("appointments").select("id").in("status", ["pending", "confirmed"])
      .gte("start_at", `${c.start_date}T00:00:00`).lte("start_at", `${c.end_date || c.start_date}T23:59:59`);
    if (conflicts?.length && !window.confirm(`Ci sono ${conflicts.length} appuntamenti in questo periodo. Non verranno annullati automaticamente: dovrai gestirli dal calendario. Continuare?`)) return;
    const { error } = await supabase.from("time_off").insert({ barber_id: null, start_date: c.start_date, end_date: c.end_date || c.start_date, reason: c.reason });
    if (error) return toast.error(error.message);
    setC({ start_date: "", end_date: "", reason: "" });
    closures.refetch();
  }
  const num = (k: keyof typeof rules) => (
    <Input type="number" min={0} value={rules[k] as number} onChange={(e) => setRules({ ...rules, [k]: Number(e.target.value) })} />
  );

  return (
    <div className="max-w-3xl space-y-10">
      <h1 className="text-3xl">Orari, chiusure e regole</h1>
      <p className="text-sm text-muted-foreground">Gli orari di lavoro e le pause di ogni barbiere si impostano nella sezione Barbieri. Gli orari mostrati sul sito sono calcolati da questi.</p>

      <section className="space-y-4 rounded-md border border-border bg-card p-5">
        <h2 className="text-xl">Regole di prenotazione</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Anticipo minimo (minuti)</Label>{num("min_notice_minutes")}</div>
          <div className="space-y-2"><Label>Giorni prenotabili in anticipo</Label>{num("max_days_ahead")}</div>
          <div className="space-y-2"><Label>Pausa tra appuntamenti (minuti)</Label>{num("buffer_minutes")}</div>
          <div className="space-y-2"><Label>Intervallo tra gli orari proposti (minuti)</Label>{num("slot_step_minutes")}</div>
        </div>
        <label className="flex items-center gap-3 text-sm"><Switch checked={rules.auto_confirm} onCheckedChange={(v) => setRules({ ...rules, auto_confirm: v })} /> Conferma automatica (altrimenti le prenotazioni restano "In attesa")</label>
        <label className="flex items-center gap-3 text-sm"><Switch checked={rules.allow_multiple} onCheckedChange={(v) => setRules({ ...rules, allow_multiple: v })} /> Consenti più trattamenti nella stessa prenotazione</label>
        <label className="flex items-center gap-3 text-sm"><Switch checked={rules.reminders_enabled} onCheckedChange={(v) => setRules({ ...rules, reminders_enabled: v })} /> Promemoria email il giorno prima (attivo quando le email saranno configurate)</label>
        <Button variant="hero" onClick={saveRules}>Salva regole</Button>
      </section>

      <section className="space-y-4 rounded-md border border-border bg-card p-5">
        <h2 className="text-xl">Chiusure, festività e ferie della barberia</h2>
        <div className="flex flex-wrap gap-2">
          <Input type="date" className="w-auto" value={c.start_date} onChange={(e) => setC({ ...c, start_date: e.target.value })} />
          <Input type="date" className="w-auto" value={c.end_date} onChange={(e) => setC({ ...c, end_date: e.target.value })} />
          <Input placeholder="Motivo (es. Natale)" className="w-48" value={c.reason} onChange={(e) => setC({ ...c, reason: e.target.value })} />
          <Button variant="outline" onClick={addClosure}>Aggiungi chiusura</Button>
        </div>
        <ul className="divide-y divide-border text-sm">
          {closures.data?.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2">
              <span>{t.start_date === t.end_date ? t.start_date : `${t.start_date} → ${t.end_date}`} {t.reason && `· ${t.reason}`}</span>
              <button className="text-muted-foreground hover:text-destructive" onClick={async () => { await supabase.from("time_off").delete().eq("id", t.id); closures.refetch(); }}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
          {!closures.data?.length && <li className="py-2 text-muted-foreground">Nessuna chiusura programmata.</li>}
        </ul>
      </section>
    </div>
  );
}
