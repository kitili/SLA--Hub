export type TripDirection = "am" | "pm";
export type TripStatus = "scheduled" | "active" | "completed" | "cancelled";
export type BoardingEventType = "in" | "out";

export type School = {
  id: string;
  name: string;
  slug: string;
};

export type Student = {
  id: string;
  school_id: string;
  first_name: string;
  last_name: string;
  class_name: string | null;
  active: boolean;
};

export type StudentWithDetails = Student & {
  qr_code: string | null;
  fee_balance: number;
  fee_currency: string;
  fee_synced_at: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  school_name: string | null;
  school_slug: string | null;
};

export type QrMatchKind = "code" | "token" | "student_id";

export type QrResolveResult = {
  student: StudentWithDetails;
  matched_by: QrMatchKind;
  token: string;
};

export type Bus = {
  id: string;
  school_id: string;
  label: string;
  plate_number: string;
  capacity: number;
  /** Legal/registered seat count from the vehicle's reg card -- usually lower
   * than `capacity` (max capacity). Null = not yet recorded. */
  registered_capacity?: number | null;
  driver_id?: string | null;
  driver_name?: string | null;
  attendant_name?: string | null;
  owner_name?: string | null;
  active: boolean;
  route_id?: string | null;
  insurance_expiry?: string | null;
};

export type BusWithSchool = Bus & {
  school_name: string | null;
  school_slug: string | null;
};

export type Trip = {
  id: string;
  bus_id: string;
  trip_date: string;
  direction: TripDirection;
  status: TripStatus;
  matron_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  departed_school_at?: string | null;
  /** Manually-entered "arrived at school" time -- not GPS-derived. */
  actual_arrival_at?: string | null;
};

export type StopKind = "school" | "pickup" | "dropoff" | "waypoint";

export type Stop = {
  id: string;
  school_id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  kind: StopKind;
};

export type RouteStop = {
  stop_id: string;
  stop_order: number;
  eta_offset_minutes: number | null;
  stop: Stop;
};

export type TripLocation = {
  id: string;
  trip_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recorded_at: string;
  recorded_by: string | null;
};

export type IncidentType =
  | "breakdown"
  | "accident"
  | "delay"
  | "medical"
  | "behavior"
  | "other"
  | "overload"
  | "incomplete_roster"
  | "unlisted_child";

export type IncidentSeverity = "low" | "medium" | "high";

export type Incident = {
  id: string;
  trip_id: string;
  reported_by: string | null;
  type: IncidentType;
  severity: IncidentSeverity;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
};

export type TripWithBus = Trip & {
  bus_label: string;
  bus_plate: string;
  bus_capacity?: number | null;
  aboard_count: number;
  /** Distinct students with at least one boarding event on this trip. */
  students_scanned: number;
  /** Students assigned to this bus route (denominator for scan %). */
  roster_on_bus: number;
};

export type BoardingEvent = {
  id: string;
  trip_id: string;
  student_id: string;
  event_type: BoardingEventType;
  scanned_at: string;
  lat: number | null;
  lng: number | null;
  scanned_by: string | null;
  stop_id?: string | null;
};

export type BoardingResult = {
  event: BoardingEvent;
  student: StudentWithDetails;
  direction: TripDirection;
  fee: {
    balance: number;
    currency: string;
    synced_at: string | null;
  };
  aboard_count: number;
  stop: { id: string; name: string; distance_m: number } | null;
};

export type FeeSyncRun = {
  id: string;
  source: string;
  status: "running" | "success" | "failed";
  rows_upserted: number;
  rows_skipped: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
};

export type {
  MessageChannel,
  MessageLog,
  MessageStatus,
  ParentNotifyResult,
} from "@/types/messaging";

