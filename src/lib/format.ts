export function euro(cents: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function longDate(iso: string | Date, tz = "Europe/Rome") {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function timeOf(iso: string | Date, tz = "Europe/Rome") {
  return new Intl.DateTimeFormat("it-IT", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

export function minutesLabel(m: number) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "In attesa",
  confirmed: "Confermato",
  cancelled: "Annullato",
  completed: "Completato",
  no_show: "Assente",
};

export const WEEKDAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
