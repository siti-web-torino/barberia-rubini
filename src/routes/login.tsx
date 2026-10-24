import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { createFirstAdmin, getAdminSetupStatus } from "@/lib/booking.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Accesso amministrazione — Barbiere Rubini" },
      { name: "description", content: "Area riservata al personale di Barbiere Rubini." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Accesso amministrazione" },
      { property: "og:description", content: "Area riservata." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const statusFn = useServerFn(getAdminSetupStatus);
  const setupFn = useServerFn(createFirstAdmin);
  const status = useQuery({ queryKey: ["setup"], queryFn: () => statusFn() });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const setup = status.data?.needsSetup;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (forgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        toast.success("Se l'indirizzo è corretto riceverai un'email per reimpostare la password.");
        setForgot(false);
        return;
      }
      if (setup) {
        if (password.length < 10) throw new Error("La password deve avere almeno 10 caratteri.");
        await setupFn({ data: { email, password } });
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("Credenziali non valide o troppi tentativi. Riprova tra poco.");
      navigate({ to: "/admin" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-md border border-border bg-card p-8 shadow-elegant">
        <div>
          <p className="eyebrow">Barbiere Rubini</p>
          <h1 className="mt-2 text-3xl">{forgot ? "Recupera password" : setup ? "Crea l'amministratore" : "Area riservata"}</h1>
          {setup && !forgot && <p className="mt-2 text-sm text-muted-foreground">Primo accesso: scegli l'email e la password del proprietario. Questa schermata non sarà più disponibile.</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email (nome utente)</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </div>
        {!forgot && (
          <div className="space-y-2">
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={setup ? "new-password" : "current-password"} />
          </div>
        )}
        <Button type="submit" variant="hero" size="xl" className="w-full" disabled={busy || status.isLoading}>
          {busy && <Loader2 className="animate-spin" />}
          {forgot ? "Invia link" : setup ? "Crea e accedi" : "Accedi"}
        </Button>
        {!setup && (
          <button type="button" className="w-full text-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setForgot(!forgot)}>
            {forgot ? "Torna all'accesso" : "Password dimenticata?"}
          </button>
        )}
      </form>
    </main>
  );
}
