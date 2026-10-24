import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/account")({ component: Account });

function Account() {
  const { user } = Route.useRouteContext();
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [email, setEmail] = useState("");

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 10) return toast.error("Almeno 10 caratteri.");
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: current } as any);
    if (error) return toast.error("Password attuale errata o non valida.");
    setPw(""); setCurrent("");
    toast.success("Password aggiornata");
  }
  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ email });
    if (error) return toast.error(error.message);
    toast.success("Controlla la nuova casella per confermare il cambio.");
  }

  return (
    <div className="max-w-md space-y-8">
      <h1 className="text-3xl">Account</h1>
      <p className="text-sm text-muted-foreground">Accesso attuale: {user.email}</p>
      <form onSubmit={changePw} className="space-y-3 rounded-md border border-border bg-card p-5">
        <h2 className="text-lg">Cambia password</h2>
        <div className="space-y-2"><Label>Password attuale</Label><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></div>
        <div className="space-y-2"><Label>Nuova password</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
        <Button type="submit" variant="hero">Aggiorna</Button>
      </form>
      <form onSubmit={changeEmail} className="space-y-3 rounded-md border border-border bg-card p-5">
        <h2 className="text-lg">Cambia email di accesso</h2>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" variant="outline">Aggiorna</Button>
      </form>
    </div>
  );
}
