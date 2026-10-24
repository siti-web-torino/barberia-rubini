import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SiteHeader, SiteFooter } from "@/components/site/SiteChrome";
import { publicQuery } from "@/lib/public-query";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Informativa privacy — Barbiere Rubini" },
      { name: "description", content: "Come Barbiere Rubini tratta i dati personali raccolti con le prenotazioni." },
      { property: "og:title", content: "Informativa privacy — Barbiere Rubini" },
      { property: "og:description", content: "Trattamento dei dati personali delle prenotazioni." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicQuery),
  component: Privacy,
});

function Privacy() {
  const { data } = useSuspenseQuery(publicQuery);
  return (
    <div className="min-h-screen">
      <SiteHeader content={data.content} />
      <main className="mx-auto max-w-2xl px-5 pb-20 pt-28">
        <h1 className="text-4xl">Informativa privacy</h1>
        <div className="mt-8 whitespace-pre-line leading-relaxed text-muted-foreground">{data.content.privacy_text}</div>
      </main>
      <SiteFooter content={data.content} />
    </div>
  );
}
