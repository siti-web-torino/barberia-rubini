import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CalendarPlus, Check, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBookingByCode } from "@/lib/booking.functions";
import { googleCalendarUrl, downloadIcs, type CalEvent } from "@/lib/calendar-links";
import { euro, longDate, timeOf, minutesLabel, STATUS_LABEL } from "@/lib/format";

export const Route = createFileRoute("/prenotazione/$code")({
  head: () => ({
    meta: [
      { title: "Prenotazione — Barbiere Rubini" },
      { name: "description", content: "Riepilogo della tua prenotazione da Barbiere Rubini." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Prenotazione — Barbiere Rubini" },
      { property: "og:description", content: "Riepilogo della prenotazione." },
    ],
  }),
  loader: async ({ params }) => {
    const b = await getBookingByCode({ data: { code: params.code } });
    if (!b) throw notFound();
    return b;
  },
  component: Confirmation,
});

function Confirmation() {
  const b = Route.useLoaderData();
  const services = b.appointment_services.map((s) => s.name).join(" + ");
  const ev: CalEvent = {
    uid: b.id,
    title: `${b.shop.name} — ${services}`,
    description: `Prenotazione ${b.code}\nBarbiere: ${b.barber_name}\nTrattamenti: ${services}\nTotale: ${euro(b.total_cents)}`,
    location: b.shop.address,
    start: b.start_at,
    end: b.end_at,
  };
  const pending = b.status === "pending";

  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <Link to="/" className="font-display text-lg">{b.shop.name}</Link>
      <div className="mt-10 grid h-14 w-14 place-items-center rounded-full bg-gradient-bronze text-primary-foreground rise">
        <Check />
      </div>
      <h1 className="mt-6 text-4xl">{pending ? "Richiesta ricevuta" : "Prenotazione confermata"}</h1>
      <p className="mt-3 text-muted-foreground">
        {pending
          ? `Grazie ${b.customer_name}, la tua richiesta è in attesa di approvazione. Riceverai una conferma.`
          : `Grazie ${b.customer_name}, ti aspettiamo.`}
      </p>

      <div className="mt-8 rounded-md border border-border bg-card p-6">
        <p className="eyebrow">Codice prenotazione</p>
        <p className="mt-1 font-mono text-2xl tracking-widest">{b.code}</p>
        <dl className="mt-6 space-y-3 text-sm">
          <R k="Stato" v={STATUS_LABEL[b.status]} />
          <R k="Data" v={<span className="capitalize">{longDate(b.start_at)}</span>} />
          <R k="Ora" v={`${timeOf(b.start_at)} – ${timeOf(b.end_at)}`} />
          <R k="Barbiere" v={b.barber_name} />
          <R k="Durata" v={minutesLabel(b.total_minutes)} />
        </dl>
        <ul className="mt-5 divide-y divide-border border-y border-border text-sm">
          {b.appointment_services.map((s, i) => (
            <li key={i} className="flex justify-between py-2"><span>{s.name}</span><span>{euro(s.price_cents)}</span></li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between font-display text-2xl"><span>Totale</span><span className="text-primary">{euro(b.total_cents)}</span></div>
        {b.shop.address && <p className="mt-4 text-sm text-muted-foreground">{b.shop.address}</p>}
      </div>

      <div className="mt-8">
        <p className="mb-3 flex items-center gap-2 text-sm"><CalendarPlus className="h-4 w-4 text-primary" /> Aggiungi al calendario</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button asChild variant="hero" size="xl">
            <a href={googleCalendarUrl(ev)} target="_blank" rel="noreferrer">Aggiungi a Google Calendar</a>
          </Button>
          <Button variant="line" size="xl" onClick={() => downloadIcs(ev)}>
            <Apple /> Calendario Apple/iPhone
          </Button>
        </div>
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        Per modificare o annullare l'appuntamento contatta la barberia{b.shop.phone ? ` al ${b.shop.phone}` : ""} indicando il codice di prenotazione.
      </p>
    </main>
  );
}

function R({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
