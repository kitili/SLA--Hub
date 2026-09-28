"use client";

import { TripGpsTrailMap } from "@/components/maps/TripGpsTrailMap";

type Props = {
  tripId: string;
  busLabel: string;
};

export function TripDetailTrailSection({ tripId, busLabel }: Props) {
  return <TripGpsTrailMap tripId={tripId} busLabel={busLabel} />;
}
