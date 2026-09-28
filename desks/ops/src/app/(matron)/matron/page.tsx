import { MatronHome } from "@/components/matron/MatronHome";
import {
  getBuses,
  getStudentBusIdsByRoute,
  getTrips,
} from "@/lib/db/queries";

export default async function MatronHomePage() {
  const [buses, trips, studentBusIds] = await Promise.all([
    getBuses(),
    getTrips(),
    getStudentBusIdsByRoute(),
  ]);
  return (
    <MatronHome buses={buses} trips={trips} studentBusIds={studentBusIds} />
  );
}
