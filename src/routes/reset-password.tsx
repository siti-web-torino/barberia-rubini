import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nuova password — Barbiere Rubini" },
      { name: "description", content: "Imposta una nuova password per l'area riservata." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Nuova password" },
      { property: "og:description", content: "Reimposta la password." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 10) return toast.error("Almeno 10 caratteri.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error("Link scaduto o non valido. Richiedine uno nuovo.");
    toast.success("Password aggiornata.");
    navigate({ to: "/admin" });
  }
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-md border border-border bg-card p-8">
        <h1 className="text-3xl">Nuova password</h1>
        <div className="space-y-2">
          <Label htmlFor="pw">Password</Label>
          <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </div>
        <Button type="submit" variant="hero" size="xl" className="w-full" disabled={busy}>Salva</Button>
      </form>
    </main>
  );
}
