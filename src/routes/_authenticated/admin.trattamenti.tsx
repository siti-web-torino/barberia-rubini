import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
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
import { euro, minutesLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/trattamenti")({ component: ServicesPage });

function ServicesPage() {
  const qc = useQueryClient();
  const services = useQuery(servicesQuery);
  const [edit, setEdit] = useState<any | null>(null);
  const list = services.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });

  async function move(i: number, dir: number) {
    const a = list[i], b = list[i + dir];
    if (!a || !b) return;
    await Promise.all([
      supabase.from("services").update({ sort_order: i + dir }).eq("id", a.id),
      supabase.from("services").update({ sort_order: i }).eq("id", b.id),
    ]);
    await Promise.all(list.map((s, j) => (j !== i && j !== i + dir ? supabase.from("services").update({ sort_order: j }).eq("id", s.id) : null)));
    refresh();
  }

  async function remove(s: any) {
    if (!window.confirm(`Eliminare "${s.name}"? Le prenotazioni passate conservano nome e prezzo applicati.`)) return;
    const { error } = await supabase.from("services").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl">Trattamenti e prezzi</h1>
        <Button variant="hero" onClick={() => setEdit({ name: "", description: "", price_cents: 2000, duration_min: 30, category: "Taglio", image_url: "", active: true, visible: true, barber_services: [] })}><Plus /> Aggiungi</Button>
      </div>
      <div className="divide-y divide-border rounded-md border border-border bg-card">
        {list.map((s, i) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="flex flex-col">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="disabled:opacity-20" aria-label="Su"><ArrowUp className="h-4 w-4" /></button>
              <button onClick={() => move(i, 1)} disabled={i === list.length - 1} className="disabled:opacity-20" aria-label="Giù"><ArrowDown className="h-4 w-4" /></button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg">{s.name} {!s.active && <span className="text-xs text-muted-foreground">(disattivato)</span>} {!s.visible && <span className="text-xs text-muted-foreground">(nascosto)</span>}</p>
              <p className="text-xs text-muted-foreground">{s.category} · {minutesLabel(s.duration_min)} · {s.barber_services.length} barbieri</p>
            </div>
            <span className="font-display text-lg text-primary">{euro(s.price_cents)}</span>
            <Switch checked={s.active} onCheckedChange={async (v) => { await supabase.from("services").update({ active: v }).eq("id", s.id); refresh(); }} aria-label="Attivo" />
            <Button size="sm" variant="outline" onClick={() => setEdit(s)}>Modifica</Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(s)}><Trash2 /></Button>
          </div>
        ))}
      </div>
      {edit && <ServiceDialog s={edit} count={list.length} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ServiceDialog({ s, count, onClose }: { s: any; count: number; onClose: () => void }) {
  const qc = useQueryClient();
  const barbers = useQuery(barbersQuery);
  const [f, setF] = useState({
    name: s.name, description: s.description, price: (s.price_cents / 100).toFixed(2).replace(".", ","), duration_min: s.duration_min,
    category: s.category, image_url: s.image_url ?? "", visible: s.visible, active: s.active,
    barberIds: s.barber_services.map((x: any) => x.barber_id) as string[],
  });
  async function save() {
    const price = Math.round(parseFloat(String(f.price).replace(",", ".")) * 100);
    if (!f.name.trim() || isNaN(price) || price < 0 || f.duration_min < 5) return toast.error("Controlla nome, prezzo e durata.");
    const row = { name: f.name.trim(), description: f.description, price_cents: price, duration_min: Number(f.duration_min), category: f.category || "Altro", image_url: f.image_url || null, visible: f.visible, active: f.active };
    let id = s.id;
    if (id) {
      const { error } = await supabase.from("services").update(row).eq("id", id);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase.from("services").insert({ ...row, sort_order: count }).select("id").single();
      if (error) return toast.error(error.message);
      id = data.id;
    }
    await supabase.from("barber_services").delete().eq("service_id", id);
    if (f.barberIds.length) await supabase.from("barber_services").insert(f.barberIds.map((b) => ({ barber_id: b, service_id: id })));
    qc.invalidateQueries({ queryKey: ["admin"] });
    qc.invalidateQueries({ queryKey: ["public"] });
    toast.success("Salvato");
    onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-2xl">{s.id ? "Modifica trattamento" : "Nuovo trattamento"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2"><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Descrizione</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="space-y-2"><Label>Prezzo (€)</Label><Input inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
          <div className="space-y-2"><Label>Durata (minuti)</Label><Input type="number" min={5} step={5} value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: Number(e.target.value) })} /></div>
          <div className="space-y-2"><Label>Categoria</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm"><Switch checked={f.visible} onCheckedChange={(v) => setF({ ...f, visible: v })} /> Visibile sul sito</label>
          </div>
          <div className="sm:col-span-2"><ImageField value={f.image_url} onChange={(u) => setF({ ...f, image_url: u })} folder="services" /></div>
          <div className="sm:col-span-2">
            <Label>Barbieri abilitati</Label>
            <div className="mt-2 space-y-1">
              {barbers.data?.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={f.barberIds.includes(b.id)} onCheckedChange={(v) => setF({ ...f, barberIds: v ? [...f.barberIds, b.id] : f.barberIds.filter((x) => x !== b.id) })} /> {b.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end"><Button variant="hero" onClick={save}>Salva</Button></div>
      </DialogContent>
    </Dialog>
  );
}
