import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { barbersQuery, fetchAppointments, type AdminAppointment } from "@/lib/admin";
import { AppointmentDialog, StatusBadge } from "@/components/admin/AppointmentDialog";
import { minutesLabel, timeOf, WEEKDAYS } from "@/lib/format";
import { addDays, localYmd, weekdayOf, zonedToUtc } from "@/lib/tz";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/calendario")({ component: CalendarPage });

const TZ = "Europe/Rome";
type View = "day" | "week" | "month";

function range(view: View, anchor: string) {
  if (view === "day") return { from: anchor, days: 1 };
  if (view === "week") {
    const wd = (weekdayOf(anchor) + 6) % 7;
    return { from: addDays(anchor, -wd), days: 7 };
  }
  const first = anchor.slice(0, 8) + "01";
  const wd = (weekdayOf(first) + 6) % 7;
  return { from: addDays(first, -wd), days: 42 };
}

function CalendarPage() {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(localYmd(new Date(), TZ));
  const [barberFilter, setBarberFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<AdminAppointment | null>(null);
  const [defaults, setDefaults] = useState<{ date?: string }>({});
  const barbers = useQuery(barbersQuery);

  const { from, days } = range(view, anchor);
  const fromIso = zonedToUtc(from, "00:00", TZ).toISOString();
  const toIso = zonedToUtc(addDays(from, days), "00:00", TZ).toISOString();
  const q = useQuery({ queryKey: ["appointments", fromIso, toIso], queryFn: () => fetchAppointments(fromIso, toIso) });
  const items = (q.data ?? []).filter((a) => !barberFilter || a.barber_id === barberFilter);
  const byDay = (d: string) => items.filter((a) => localYmd(new Date(a.start_at), TZ) === d);
  const step = view === "day" ? 1 : view === "week" ? 7 : 0;
  const move = (dir: number) => {
    if (view === "month") {
      const [y, m] = anchor.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1 + dir, 1));
      setAnchor(dt.toISOString().slice(0, 10));
    } else setAnchor(addDays(anchor, dir * step));
  };
  const today = localYmd(new Date(), TZ);
  const openA = (a: AdminAppointment) => { setSel(a); setOpen(true); };
  const newA = (date?: string) => { setSel(null); setDefaults({ date }); setOpen(true); };

  const title = new Date(`${anchor}T12:00:00Z`).toLocaleDateString("it-IT", view === "month" ? { month: "long", year: "numeric" } : { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-3xl capitalize">{title}</h1>
        <div className="flex rounded-md border border-border">
          {(["day", "week", "month"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("px-3 py-1.5 text-sm", view === v && "bg-primary text-primary-foreground")}>
              {v === "day" ? "Giorno" : v === "week" ? "Settimana" : "Mese"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => move(-1)} aria-label="Precedente"><ChevronLeft /></Button>
          <Button size="sm" variant="outline" onClick={() => setAnchor(today)}>Oggi</Button>
          <Button size="icon" variant="ghost" onClick={() => move(1)} aria-label="Successivo"><ChevronRight /></Button>
        </div>
        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={barberFilter} onChange={(e) => setBarberFilter(e.target.value)}>
          <option value="">Tutti i barbieri</option>
          {barbers.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <Button variant="hero" onClick={() => newA(anchor)}><Plus /> Nuovo</Button>
      </div>

      {view === "day" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(barbers.data ?? []).filter((b) => !barberFilter || b.id === barberFilter).map((b) => (
            <div key={b.id} className="rounded-md border border-border bg-card p-4">
              <h2 className="mb-3 text-lg">{b.name}</h2>
              <div className="space-y-2">
                {byDay(anchor).filter((a) => a.barber_id === b.id).map((a) => <Chip key={a.id} a={a} onClick={() => openA(a)} full />)}
                {!byDay(anchor).some((a) => a.barber_id === b.id) && <p className="text-sm text-muted-foreground">Nessun appuntamento.</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "week" && (
        <div className="grid gap-2 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => (
            <div key={d} className={cn("min-h-40 rounded-md border border-border bg-card p-2", d === today && "border-primary")}>
              <button onClick={() => { setAnchor(d); setView("day"); }} className="mb-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-primary">
                {WEEKDAYS[weekdayOf(d)].slice(0, 3)} {Number(d.slice(8))}
              </button>
              <div className="space-y-1.5">{byDay(d).map((a) => <Chip key={a.id} a={a} onClick={() => openA(a)} />)}</div>
            </div>
          ))}
        </div>
      )}

      {view === "month" && (
        <div className="grid grid-cols-7 gap-1">
          {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => <div key={d} className="px-1 text-xs text-muted-foreground">{d}</div>)}
          {Array.from({ length: 42 }, (_, i) => addDays(from, i)).map((d) => {
            const list = byDay(d).filter((a) => a.status !== "cancelled");
            const inMonth = d.slice(0, 7) === anchor.slice(0, 7);
            return (
              <button key={d} onClick={() => { setAnchor(d); setView("day"); }} className={cn("min-h-20 rounded border border-border p-1 text-left align-top", inMonth ? "bg-card" : "opacity-40", d === today && "border-primary")}>
                <span className="text-xs">{Number(d.slice(8))}</span>
                {list.length > 0 && <span className="mt-1 block rounded bg-primary/20 px-1 text-[11px] text-primary">{list.length} app.</span>}
                <span className="hidden md:block">
                  {list.slice(0, 2).map((a) => <span key={a.id} className="block truncate text-[10px] text-muted-foreground">{timeOf(a.start_at)} {a.customer_name}</span>)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <AppointmentDialog open={open} onOpenChange={setOpen} appointment={sel} defaults={defaults} />
    </div>
  );
}

function Chip({ a, onClick, full }: { a: AdminAppointment; onClick: () => void; full?: boolean }) {
  return (
    <button onClick={onClick} className={cn("w-full rounded border-l-2 bg-muted p-2 text-left text-xs hover:bg-accent", a.status === "cancelled" ? "border-destructive opacity-60" : a.status === "pending" ? "border-warning" : "border-primary")}>
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold">{timeOf(a.start_at)}</span>
        {full && <StatusBadge status={a.status} />}
      </div>
      <div className="truncate">{a.customer_name}</div>
      <div className="truncate text-muted-foreground">{a.appointment_services.map((s) => s.name).join(", ")}</div>
      <div className="text-muted-foreground">{a.barber_name} · {minutesLabel(a.total_minutes)}</div>
      {!full && a.status !== "confirmed" && <div className="mt-1"><StatusBadge status={a.status} /></div>}
    </button>
  );
}
