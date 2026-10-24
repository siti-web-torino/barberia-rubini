import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Clock, MapPin, Phone, Instagram, Facebook, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter, MobileBookBar } from "@/components/site/SiteChrome";
import { publicQuery, demo, barberPhoto } from "@/lib/public-query";
import { euro, minutesLabel, WEEKDAYS } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Barbiere Rubini — Tagli, barba e prenotazione online" },
      { name: "description", content: "Barbiere Rubini: tagli uomo, cura della barba e styling. Prenota il tuo appuntamento online in pochi passaggi." },
      { property: "og:title", content: "Barbiere Rubini — Prenota online" },
      { property: "og:description", content: "Tagli uomo, barba e styling. Scegli barbiere, trattamento e orario." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicQuery),
  component: Home,
});

function Placeholder({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm italic text-muted-foreground">{children}</p>;
}

function hoursSummary(hours: { weekday: number; start_time: string; end_time: string }[]) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((d) => {
    const iv = hours.filter((h) => h.weekday === d);
    if (!iv.length) return { day: WEEKDAYS[d], text: "Chiuso" };
    const starts = iv.map((h) => h.start_time.slice(0, 5)).sort();
    const ends = iv.map((h) => h.end_time.slice(0, 5)).sort();
    // merge across barbers into a simple open–close range per block
    const uniq = [...new Set(iv.map((h) => `${h.start_time.slice(0, 5)}–${h.end_time.slice(0, 5)}`))].sort();
    return { day: WEEKDAYS[d], text: uniq.length <= 2 ? uniq.join(" · ") : `${starts[0]}–${ends[ends.length - 1]}` };
  });
}

function Home() {
  const { data } = useSuspenseQuery(publicQuery);
  const c = data.content;
  const gallery: string[] = Array.isArray(c.gallery) && c.gallery.length ? c.gallery : [demo.cut, demo.tools, demo.beard, demo.hero];
  const categories = [...new Set(data.services.map((s) => s.category))];
  const hours = hoursSummary(data.hours);

  return (
    <div className="min-h-screen">
      <SiteHeader content={c} home />

      {/* Hero */}
      <section className="relative flex min-h-[92svh] items-end overflow-hidden">
        <img src={c.hero_image || demo.hero} alt="Interno della barberia" className="absolute inset-0 h-full w-full object-cover" width={1600} height={1008} />
        <div className="absolute inset-0 bg-gradient-fade" />
        <div className="relative mx-auto w-full max-w-6xl px-5 pb-28 pt-32 md:pb-24">
          <p className="eyebrow rise">{c.name || "Barbiere Rubini"}</p>
          <h1 className="rise mt-4 max-w-3xl text-5xl leading-[1.02] md:text-7xl" style={{ animationDelay: "80ms" }}>
            {c.hero_title}
          </h1>
          <p className="rise mt-6 max-w-xl text-lg text-muted-foreground" style={{ animationDelay: "160ms" }}>
            {c.hero_subtitle}
          </p>
          <div className="rise mt-10 flex flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
            <Button asChild variant="hero" size="xl">
              <Link to="/prenota">Prenota un appuntamento</Link>
            </Button>
            <Button asChild variant="line" size="xl">
              <a href="#trattamenti">Trattamenti e prezzi</a>
            </Button>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="barberia" className="mx-auto grid max-w-6xl scroll-mt-20 gap-12 px-5 py-24 md:grid-cols-2 md:items-center">
        <img src={c.about_image || demo.tools} alt="Strumenti del barbiere" loading="lazy" width={1200} height={912} className="aspect-[4/3] w-full rounded-md object-cover shadow-elegant" />
        <div>
          <p className="eyebrow">La barberia</p>
          <h2 className="mt-3 text-4xl md:text-5xl">{c.about_title}</h2>
          <p className="mt-6 whitespace-pre-line leading-relaxed text-muted-foreground">{c.about_text}</p>
        </div>
      </section>

      {/* Gallery */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {gallery.slice(0, 8).map((src, i) => (
            <img key={i} src={src} alt="Lavori e ambienti della barberia" loading="lazy" className={`h-full w-full rounded-md object-cover ${i === 0 ? "row-span-2 aspect-[3/4] md:aspect-auto" : "aspect-square"}`} />
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="trattamenti" className="scroll-mt-20 border-y border-border/60 bg-ink py-24">
        <div className="mx-auto max-w-4xl px-5">
          <p className="eyebrow text-center">Listino</p>
          <h2 className="mt-3 text-center text-4xl md:text-5xl">Trattamenti e prezzi</h2>
          <div className="mt-14 space-y-12">
            {categories.map((cat) => (
              <div key={cat}>
                <h3 className="mb-4 text-sm uppercase tracking-[0.25em] text-muted-foreground">{cat}</h3>
                <ul className="divide-y divide-border/60">
                  {data.services
                    .filter((s) => s.category === cat)
                    .map((s) => (
                      <li key={s.id} className="flex items-baseline gap-4 py-4">
                        <div className="flex-1">
                          <p className="font-display text-xl">{s.name}</p>
                          {s.description && <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground">{minutesLabel(s.duration_min)}</span>
                        <span className="w-20 text-right font-display text-xl text-primary">{euro(s.price_cents)}</span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Button asChild variant="hero" size="xl">
              <Link to="/prenota">Prenota ora</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Staff */}
      <section id="staff" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
        <p className="eyebrow">Lo staff</p>
        <h2 className="mt-3 text-4xl md:text-5xl">I nostri barbieri</h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {data.barbers.map((b, i) => (
            <article key={b.id} className="group">
              <div className="overflow-hidden rounded-md">
                <img src={barberPhoto(b, i)} alt={b.name} loading="lazy" width={800} height={1008} className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <h3 className="mt-5 text-2xl">{b.name}</h3>
              {b.specialties.length > 0 && <p className="mt-1 text-sm text-primary">{b.specialties.join(" · ")}</p>}
              <p className="mt-3 text-sm text-muted-foreground">{b.bio}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Hours + contacts */}
      <section id="contatti" className="scroll-mt-20 border-t border-border/60 bg-ink py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 md:grid-cols-2">
          <div>
            <p className="eyebrow">Orari</p>
            <h2 className="mt-3 text-4xl">Quando trovarci</h2>
            <ul className="mt-8 divide-y divide-border/60">
              {hours.map((h) => (
                <li key={h.day} className="flex justify-between py-3 text-sm">
                  <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />{h.day}</span>
                  <span className={h.text === "Chiuso" ? "text-muted-foreground" : ""}>{h.text}</span>
                </li>
              ))}
            </ul>
            {data.closures.length > 0 && (
              <div className="mt-6 space-y-1 text-sm text-warning">
                {data.closures.slice(0, 3).map((cl, i) => (
                  <p key={i}>Chiusura: {cl.start_date === cl.end_date ? cl.start_date : `${cl.start_date} → ${cl.end_date}`} {cl.reason && `· ${cl.reason}`}</p>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="eyebrow">Contatti</p>
            <h2 className="mt-3 text-4xl">Vieni a trovarci</h2>
            <div className="mt-8 space-y-4 text-sm">
              {c.address ? <p className="flex gap-3"><MapPin className="h-5 w-5 text-primary" />{c.address}</p> : <Placeholder>Indirizzo da inserire dal pannello amministrativo.</Placeholder>}
              {c.phone ? <a href={`tel:${c.phone}`} className="flex gap-3"><Phone className="h-5 w-5 text-primary" />{c.phone}</a> : <Placeholder>Telefono da inserire dal pannello amministrativo.</Placeholder>}
              {c.email && <a href={`mailto:${c.email}`} className="flex gap-3"><Mail className="h-5 w-5 text-primary" />{c.email}</a>}
              <div className="flex gap-4">
                {c.instagram && <a href={c.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram className="text-primary" /></a>}
                {c.facebook && <a href={c.facebook} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook className="text-primary" /></a>}
              </div>
            </div>
            {c.map_query || c.address ? (
              <iframe
                title="Mappa"
                className="mt-8 h-64 w-full rounded-md border border-border grayscale"
                loading="lazy"
                src={`https://www.google.com/maps?q=${encodeURIComponent(c.map_query || c.address)}&output=embed`}
              />
            ) : (
              <div className="mt-8"><Placeholder>La mappa comparirà quando sarà inserito l'indirizzo.</Placeholder></div>
            )}
          </div>
        </div>
      </section>

      <SiteFooter content={c} />
      <MobileBookBar />
    </div>
  );
}
