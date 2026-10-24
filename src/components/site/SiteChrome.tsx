import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, Instagram, Facebook, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicData } from "@/lib/public-query";

export function Logo({ content }: { content: PublicData["content"] }) {
  return (
    <Link to="/" className="flex items-center gap-3">
      {content.logo_url ? (
        <img src={content.logo_url} alt={content.name ?? "Barbiere Rubini"} className="h-9 w-auto" />
      ) : (
        <span className="grid h-9 w-9 place-items-center rounded-full border border-primary/70 font-display text-lg text-primary">R</span>
      )}
      <span className="font-display text-lg tracking-wide">{content.name || "Barbiere Rubini"}</span>
    </Link>
  );
}

const NAV = [
  ["#barberia", "Barberia"],
  ["#trattamenti", "Trattamenti"],
  ["#staff", "Staff"],
  ["#contatti", "Contatti"],
] as const;

export function SiteHeader({ content, home = false }: { content: PublicData["content"]; home?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo content={content} />
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {NAV.map(([h, l]) => (
            <a key={h} href={home ? h : `/${h}`} className="transition-colors hover:text-foreground">
              {l}
            </a>
          ))}
          <Button asChild variant="hero" size="sm">
            <Link to="/prenota">Prenota</Link>
          </Button>
        </nav>
        <button className="md:hidden" aria-label="Menu" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav className="flex flex-col gap-1 border-t border-border/50 bg-background px-5 py-4 md:hidden">
          {NAV.map(([h, l]) => (
            <a key={h} href={home ? h : `/${h}`} onClick={() => setOpen(false)} className="py-2 text-muted-foreground">
              {l}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

/** Sticky booking button on mobile. */
export function MobileBookBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 p-3 backdrop-blur-md md:hidden">
      <Button asChild variant="hero" size="xl" className="w-full">
        <Link to="/prenota">Prenota un appuntamento</Link>
      </Button>
    </div>
  );
}

export function SiteFooter({ content }: { content: PublicData["content"] }) {
  return (
    <footer className="border-t border-border/60 bg-ink pb-24 pt-14 md:pb-10">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-3">
        <div className="space-y-3">
          <Logo content={content} />
          {content.footer_text && <p className="text-sm text-muted-foreground">{content.footer_text}</p>}
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          {content.address && <p>{content.address}</p>}
          {content.phone && (
            <a href={`tel:${content.phone}`} className="flex items-center gap-2 hover:text-foreground">
              <Phone className="h-4 w-4" /> {content.phone}
            </a>
          )}
          <div className="flex gap-4 pt-2">
            {content.instagram && (
              <a href={content.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="hover:text-primary">
                <Instagram />
              </a>
            )}
            {content.facebook && (
              <a href={content.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="hover:text-primary">
                <Facebook />
              </a>
            )}
          </div>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground md:text-right">
          <Link to="/privacy" className="block hover:text-foreground">
            Informativa privacy
          </Link>
          <p>
            © {new Date().getFullYear()} {content.legal_name || content.name || "Barbiere Rubini"}
            {content.vat ? ` · P.IVA ${content.vat}` : ""}
          </p>
        </div>
      </div>
    </footer>
  );
}
