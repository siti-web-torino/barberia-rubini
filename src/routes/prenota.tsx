import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, differenceInCalendarDays, max as maxDate } from "date-fns";
import { it } from "date-fns/locale";
import { Check, ChevronLeft, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SiteHeader } from "@/components/site/SiteChrome";
import { publicQuery, barberPhoto } from "@/lib/public-query";
import { createBooking, getDaySlots, getMonthAvailability } from "@/lib/booking.functions";
import { euro, minutesLabel, longDate, WEEKDAYS } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/prenota")({
  head: () => ({
    meta: [
      { title: "Prenota un appuntamento — Barbiere Rubini" },
      { name: "description", content: "Scegli barbiere, trattamenti, giorno e orario: prenota online da Barbiere Rubini." },
      { property: "og:title", content: "Prenota da Barbiere Rubini" },
      { property: "og:description", content: "Prenotazione online in pochi passaggi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicQuery),
  component: Booking,
});

const STEPS = ["Barbiere", "Trattamenti", "Giorno", "Orario", "Dati"];
const ANY = "any";

function Booking() {
  const { data } = useSuspenseQuery(publicQuery);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [barber, setBarber] = useState<string | null>(null); // id or ANY
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState<string | null>(null);
  const [month, setMonth] = useState<Date>(new Date());
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "", privacy: false });
  const [submitting, setSubmitting] = useState(false);
  const [review, setReview] = useState(false);

  const monthFn = useServerFn(getMonthAvailability);
  const slotsFn = useServerFn(getDaySlots);
  const bookFn = useServerFn(createBooking);

  const barberId = barber === ANY ? null : barber;
  const chosenBarber = data.barbers.find((b) => b.id === barberId);
  const services = useMemo(
    () => data.services.filter((s) => (barberId ? s.barberIds.includes(barberId) : s.barberIds.length > 0)),
    [data.services, barberId],
  );
  const selected = serviceIds.map((id) => data.services.find((s) => s.id === id)!).filter(Boolean);
  const total = selected.reduce((a, s) => a + s.price_cents, 0);
  const minutes = selected.reduce((a, s) => a + s.duration_min, 0);
  const ymd = date ? format(date, "yyyy-MM-dd") : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = maxDate([startOfMonth(month), today]);
  const days = Math.max(1, differenceInCalendarDays(endOfMonth(month), from) + 1);
  const monthQ = useQuery({
    queryKey: ["month", barberId, serviceIds, format(from, "yyyy-MM-dd"), days],
    queryFn: () => monthFn({ data: { serviceIds, barberId, from: format(from, "yyyy-MM-dd"), days } }),
    enabled: step === 2 && serviceIds.length > 0 && from <= endOfMonth(month),
  });
  const slotsQ = useQuery({
    queryKey: ["slots", barberId, serviceIds, ymd],
    queryFn: () => slotsFn({ data: { serviceIds, barberId, date: ymd! } }),
    enabled: step >= 3 && !!ymd,
  });

  const toggleService = (id: string) => {
    setTime(null);
    if (!data.booking.allow_multiple) return setServiceIds([id]);
    setServiceIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const formValid =
    form.name.trim().length >= 2 && /^[+0-9 ()-]{6,20}$/.test(form.phone.trim()) && /^\S+@\S+\.\S+$/.test(form.email.trim()) && form.privacy;

  async function confirm() {
    if (!ymd || !time) return;
    setSubmitting(true);
    try {
      const res = await bookFn({
        data: { serviceIds, barberId, date: ymd, time, name: form.name, phone: form.phone, email: form.email, notes: form.notes, privacy: true },
      });
      navigate({ to: "/prenotazione/$code", params: { code: res.code } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("SLOT_TAKEN")) {
        toast.error("Questo orario è appena stato prenotato. Scegline un altro.");
        setTime(null);
        setReview(false);
        setStep(3);
        slotsQ.refetch();
      } else toast.error("Non è stato possibile completare la prenotazione. Controlla i dati e riprova.");
    } finally {
      setSubmitting(false);
    }
  }

  const canNext = [!!barber, serviceIds.length > 0, !!date, !!time, formValid][step];

  return (
    <div className="min-h-screen pb-32">
      <SiteHeader content={data.content} />
      <main className="mx-auto max-w-3xl px-5 pt-24">
        <p className="eyebrow">Prenotazione online</p>
        <h1 className="mt-2 text-4xl md:text-5xl">Prenota il tuo appuntamento</h1>

        <ol className="mt-8 flex gap-2">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <div className={cn("h-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
              <span className={cn("mt-2 block text-[11px] uppercase tracking-wider", i === step ? "text-foreground" : "text-muted-foreground")}>{s}</span>
            </li>
          ))}
        </ol>

        <div className="mt-10">
          {step === 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice active={barber === ANY} onClick={() => { setBarber(ANY); setServiceIds([]); setDate(undefined); setTime(null); }}>
                <div className="grid h-20 w-16 place-items-center rounded bg-muted"><Users className="text-primary" /></div>
                <div>
                  <p className="font-display text-xl">Nessuna preferenza</p>
                  <p className="text-sm text-muted-foreground">Ti mostriamo i primi orari liberi tra tutti i barbieri.</p>
                </div>
              </Choice>
              {data.barbers.map((b, i) => (
                <Choice key={b.id} active={barber === b.id} onClick={() => { setBarber(b.id); setServiceIds((p) => p.filter((id) => b.serviceIds.includes(id))); setDate(undefined); setTime(null); }}>
                  <img src={barberPhoto(b, i)} alt={b.name} className="h-20 w-16 rounded object-cover" />
                  <div className="min-w-0">
                    <p className="font-display text-xl">{b.name}</p>
                    {b.specialties.length > 0 && <p className="text-xs text-primary">{b.specialties.join(" · ")}</p>}
                    <p className="line-clamp-2 text-sm text-muted-foreground">{b.bio}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {b.serviceIds.length} trattamenti · lavora {b.workDays.map((d) => WEEKDAYS[d].slice(0, 3)).join(", ") || "—"}
                    </p>
                  </div>
                </Choice>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              {!data.booking.allow_multiple && <p className="text-sm text-muted-foreground">Seleziona un trattamento.</p>}
              {services.map((s) => {
                const on = serviceIds.includes(s.id);
                const names = data.barbers.filter((b) => s.barberIds.includes(b.id)).map((b) => b.name);
                return (
                  <Choice key={s.id} active={on} onClick={() => toggleService(s.id)}>
                    {s.image_url && <img src={s.image_url} alt="" className="h-16 w-16 rounded object-cover" />}
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-display text-xl">{s.name}</p>
                        <p className="font-display text-xl text-primary">{euro(s.price_cents)}</p>
                      </div>
                      {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {minutesLabel(s.duration_min)}
                        {!barberId && names.length > 0 && ` · ${names.join(", ")}`}
                      </p>
                    </div>
                    <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                      {on && <Check className="h-4 w-4" />}
                    </span>
                  </Choice>
                );
              })}
              {services.length === 0 && <p className="text-muted-foreground">Nessun trattamento disponibile per questo barbiere.</p>}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center">
              <div className="relative rounded-md border border-border bg-card p-2">
                <Calendar
                  mode="single"
                  locale={it}
                  weekStartsOn={1}
                  selected={date}
                  month={month}
                  onMonthChange={setMonth}
                  startMonth={new Date()}
                  onSelect={(d) => { setDate(d); setTime(null); }}
                  disabled={(d) => {
                    if (d < today) return true;
                    const k = format(d, "yyyy-MM-dd");
                    if (!monthQ.data) return true;
                    return !(monthQ.data[k] > 0);
                  }}
                  modifiers={{ available: (d) => !!monthQ.data && (monthQ.data[format(d, "yyyy-MM-dd")] ?? 0) > 0 }}
                  modifiersClassNames={{ available: "[&>button]:text-primary [&>button]:font-semibold" }}
                  className="bg-card [--cell-size:2.6rem]"
                />
                {monthQ.isFetching && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-primary" />}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">I giorni in evidenza hanno orari disponibili.</p>
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="mb-4 capitalize text-muted-foreground">{ymd && longDate(`${ymd}T12:00:00Z`)}</p>
              {slotsQ.isLoading ? (
                <Loader2 className="animate-spin text-primary" />
              ) : slotsQ.data?.length ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {slotsQ.data.map((s) => (
                    <button
                      key={s.time}
                      onClick={() => setTime(s.time)}
                      className={cn("rounded-md border py-3 text-sm transition-colors", time === s.time ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary")}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Nessun orario disponibile in questo giorno. Scegli un'altra data.</p>
              )}
            </div>
          )}

          {step === 4 && !review && (
            <div className="space-y-5">
              <Field label="Nome e cognome"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" maxLength={100} /></Field>
              <Field label="Telefono"><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" maxLength={20} /></Field>
              <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" maxLength={255} /></Field>
              <Field label="Note (facoltative)"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} /></Field>
              <label className="flex items-start gap-3 text-sm text-muted-foreground">
                <Checkbox checked={form.privacy} onCheckedChange={(v) => setForm({ ...form, privacy: v === true })} className="mt-0.5" />
                <span>
                  Ho letto l'<Link to="/privacy" target="_blank" className="text-primary underline">informativa privacy</Link>. I dati servono solo a gestire la prenotazione.
                </span>
              </label>
            </div>
          )}

          {step === 4 && review && (
            <div className="rounded-md border border-border bg-card p-6">
              <h2 className="text-2xl">Riepilogo</h2>
              <dl className="mt-5 space-y-3 text-sm">
                <Row k="Cliente" v={form.name} />
                <Row k="Barbiere" v={chosenBarber?.name ?? "Primo disponibile"} />
                <Row k="Data" v={<span className="capitalize">{ymd && longDate(`${ymd}T12:00:00Z`)}</span>} />
                <Row k="Ora" v={time} />
                <Row k="Durata prevista" v={minutesLabel(minutes)} />
              </dl>
              <ul className="mt-5 divide-y divide-border border-y border-border text-sm">
                {selected.map((s) => (
                  <li key={s.id} className="flex justify-between py-2"><span>{s.name}</span><span>{euro(s.price_cents)}</span></li>
                ))}
              </ul>
              <div className="mt-4 flex justify-between font-display text-2xl"><span>Totale</span><span className="text-primary">{euro(total)}</span></div>
              {form.notes && <p className="mt-4 text-sm text-muted-foreground">Note: {form.notes}</p>}
            </div>
          )}
        </div>
      </main>

      {/* Footer bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3">
          {step > 0 && (
            <Button variant="ghost" size="icon" aria-label="Indietro" onClick={() => (review ? setReview(false) : setStep(step - 1))}>
              <ChevronLeft />
            </Button>
          )}
          <div className="flex-1 text-sm">
            {selected.length > 0 ? (
              <>
                <span className="font-semibold text-primary">{euro(total)}</span>
                <span className="text-muted-foreground"> · {minutesLabel(minutes)}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Passo {step + 1} di 5</span>
            )}
          </div>
          {step < 4 && (
            <Button variant="hero" size="lg" disabled={!canNext} onClick={() => setStep(step + 1)}>Continua</Button>
          )}
          {step === 4 && !review && (
            <Button variant="hero" size="lg" disabled={!formValid} onClick={() => setReview(true)}>Rivedi</Button>
          )}
          {step === 4 && review && (
            <Button variant="hero" size="lg" disabled={submitting} onClick={confirm}>
              {submitting && <Loader2 className="animate-spin" />} Conferma prenotazione
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-4 rounded-md border bg-card p-4 text-left transition-all",
        active ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
