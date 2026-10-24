import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, LayoutDashboard, List, Scissors, Users, Clock, Globe, UserCog, LogOut, Menu, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Pannello — Barbiere Rubini" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/calendario", label: "Calendario", icon: CalendarDays },
  { to: "/admin/appuntamenti", label: "Appuntamenti", icon: List },
  { to: "/admin/barbieri", label: "Barbieri", icon: Users },
  { to: "/admin/trattamenti", label: "Trattamenti", icon: Scissors },
  { to: "/admin/orari", label: "Orari e chiusure", icon: Clock },
  { to: "/admin/sito", label: "Gestione sito", icon: Globe },
  { to: "/admin/account", label: "Account", icon: UserCog },
] as const;

function AdminLayout() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const role = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => (await supabase.rpc("is_admin")).data === true,
  });

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  if (role.isLoading) return <div className="p-10 text-muted-foreground">Caricamento…</div>;
  if (!role.data)
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl">Accesso non autorizzato</h1>
          <p className="mt-2 text-muted-foreground">Questo account non ha i permessi di amministrazione.</p>
          <Button className="mt-6" onClick={logout}>Esci</Button>
        </div>
      </div>
    );

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          activeOptions={{ exact: "exact" in n }}
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          activeProps={{ className: "bg-sidebar-accent !text-primary" }}
        >
          <n.icon className="h-4 w-4" /> {n.label}
        </Link>
      ))}
      <a href="/" target="_blank" className="mt-4 flex items-center gap-3 px-3 py-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground">
        <ExternalLink className="h-4 w-4" /> Vedi il sito
      </a>
      <button onClick={logout} className="flex items-center gap-3 px-3 py-2 text-left text-sm text-sidebar-foreground/60 hover:text-destructive">
        <LogOut className="h-4 w-4" /> Esci
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar p-4 md:block">
        <p className="mb-6 px-3 font-display text-lg">Rubini · Admin</p>
        {nav}
      </aside>
      <header className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 md:hidden">
        <p className="font-display">Rubini · Admin</p>
        <button onClick={() => setOpen(!open)} aria-label="Menu"><Menu /></button>
      </header>
      {open && <div className={cn("border-b border-border bg-sidebar p-3 md:hidden")}>{nav}</div>}
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
