import { MatronPathNavigate } from "@/components/matron/MatronPathNavigate";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MatronPathPage({ searchParams }: Props) {
  const params = await searchParams;
  const raw = params.tripId;
  const tripId =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  return <MatronPathNavigate initialTripId={tripId} />;
}
