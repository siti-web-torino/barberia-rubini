import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveSetting, settingsQuery } from "@/lib/admin";
import { ImageField } from "@/components/admin/ImageField";

export const Route = createFileRoute("/_authenticated/admin/sito")({ component: SitePage });

const TEXT: [string, string][] = [
  ["name", "Nome attività"],
  ["hero_title", "Titolo principale"],
  ["about_title", "Titolo sezione barberia"],
  ["address", "Indirizzo"],
  ["map_query", "Indirizzo per la mappa (se diverso)"],
  ["phone", "Telefono"],
  ["email", "Email di contatto"],
  ["instagram", "Link Instagram"],
  ["facebook", "Link Facebook"],
  ["legal_name", "Ragione sociale"],
  ["vat", "Partita IVA"],
];
const AREAS: [string, string][] = [
  ["hero_subtitle", "Presentazione breve"],
  ["about_text", "Testo sezione barberia"],
  ["footer_text", "Testo del footer"],
  ["privacy_text", "Informativa privacy (da verificare prima della pubblicazione)"],
];

function SitePage() {
  const qc = useQueryClient();
  const settings = useQuery(settingsQuery);
  const [c, setC] = useState<Record<string, any>>({});
  useEffect(() => { if (settings.data) setC(settings.data.content); }, [settings.data]);
  const gallery: string[] = Array.isArray(c.gallery) ? c.gallery : [];

  async function save() {
    try {
      await saveSetting("content", c);
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      qc.invalidateQueries({ queryKey: ["public"] });
      toast.success("Sito aggiornato");
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="max-w-3xl space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl">Gestione sito</h1>
        <Button variant="hero" onClick={save}>Salva modifiche</Button>
      </div>
      <section className="grid gap-4 rounded-md border border-border bg-card p-5 sm:grid-cols-2">
        {TEXT.map(([k, l]) => (
          <div key={k} className="space-y-2"><Label>{l}</Label><Input value={c[k] ?? ""} onChange={(e) => setC({ ...c, [k]: e.target.value })} /></div>
        ))}
        {AREAS.map(([k, l]) => (
          <div key={k} className="space-y-2 sm:col-span-2"><Label>{l}</Label><Textarea rows={k === "privacy_text" ? 10 : 4} value={c[k] ?? ""} onChange={(e) => setC({ ...c, [k]: e.target.value })} /></div>
        ))}
      </section>
      <section className="space-y-4 rounded-md border border-border bg-card p-5">
        <h2 className="text-xl">Immagini</h2>
        <p className="text-xs text-muted-foreground">Se lasci vuoto, il sito usa le fotografie dimostrative.</p>
        <ImageField value={c.logo_url} onChange={(u) => setC({ ...c, logo_url: u })} folder="site" label="Logo" />
        <ImageField value={c.hero_image} onChange={(u) => setC({ ...c, hero_image: u })} folder="site" label="Immagine principale" />
        <ImageField value={c.about_image} onChange={(u) => setC({ ...c, about_image: u })} folder="site" label="Immagine barberia" />
        <div>
          <Label>Galleria</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {gallery.map((g, i) => (
              <div key={i} className="relative">
                <img src={g} alt="" className="h-20 w-20 rounded object-cover" />
                <button className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground" onClick={() => setC({ ...c, gallery: gallery.filter((_, j) => j !== i) })} aria-label="Rimuovi"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
          <div className="mt-2"><ImageField value="" onChange={(u) => u && setC({ ...c, gallery: [...gallery, u] })} folder="gallery" label="Aggiungi foto" /></div>
        </div>
      </section>
      <Button variant="hero" onClick={save}>Salva modifiche</Button>
    </div>
  );
}
