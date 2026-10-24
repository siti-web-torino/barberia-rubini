import { queryOptions } from "@tanstack/react-query";
import { getPublicData } from "./booking.functions";
import hero from "@/assets/hero.jpg";
import beard from "@/assets/beard.jpg";
import tools from "@/assets/tools.jpg";
import cut from "@/assets/cut.jpg";
import barber1 from "@/assets/barber1.jpg";
import barber2 from "@/assets/barber2.jpg";

export const publicQuery = queryOptions({
  queryKey: ["public"],
  queryFn: () => getPublicData(),
  staleTime: 60_000,
});

export type PublicData = Awaited<ReturnType<typeof getPublicData>>;

/** Demo photos used until the owner uploads real ones from the admin panel. */
export const demo = { hero, beard, tools, cut, barbers: [barber1, barber2] };

export function barberPhoto(b: { photo_url: string | null }, index: number) {
  return b.photo_url || demo.barbers[index % demo.barbers.length];
}
