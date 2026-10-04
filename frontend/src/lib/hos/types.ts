export type DutyStatus = "OFF" | "SB" | "D" | "ON";

export const DUTY_LABELS: Record<DutyStatus, string> = {
  OFF: "Off Duty",
  SB: "Sleeper Berth",
  D: "Driving",
  ON: "On Duty (Not Driving)",
};

export const DUTY_ORDER: DutyStatus[] = ["OFF", "SB", "D", "ON"];

export type EventKind =
  | "prior"
  | "drive"
  | "pickup"
  | "dropoff"
  | "fuel"
  | "break"
  | "rest"
  | "restart"
  | "end";

export interface GeoPoint {
  name: string;
  lat: number;
  lng: number;
}

export interface TripInput {
  currentLocation: string;
  pickupLocation: string;
  dropoffLocation: string;
  cycleUsedHours: number;
  /** Oldest to newest duty-hour totals for the driver's current 8-day window. */
  cycleHistoryHours?: number[];
  /** Local start time for day 1, in 24-hour HH:MM form. */
  startTime?: string;
  /** Driver-selected planning speed; road distance still comes from OSRM. */
  averageSpeedMph?: number;
}

/** Times are minutes from 00:00 of trip day 1. */
export interface DutyEvent {
  id: string;
  kind: EventKind;
  status: DutyStatus;
  start: number;
  end: number;
  location: GeoPoint;
  note: string;
  miles?: number | undefined;
}

export interface LogSegment {
  status: DutyStatus;
  start: number; // 0..1440
  end: number;
}

export interface LogRemark {
  time: number; // minutes in day
  status: DutyStatus;
  location: string;
  note: string;
}

export interface DailyLog {
  day: number;
  date: string; // ISO yyyy-mm-dd
  segments: LogSegment[];
  remarks: LogRemark[];
  totals: Record<DutyStatus, number>; // minutes
  miles: number;
}

export type WarningLevel = "ok" | "info" | "warning" | "critical";

export interface HosWarning {
  level: WarningLevel;
  title: string;
  message: string;
}

export interface TripPlan {
  id: string;
  input: TripInput;
  startDate: string; // ISO date of day 1
  points: { current: GeoPoint; pickup: GeoPoint; dropoff: GeoPoint };
  /** Road geometry returned by the Django routing service when available. */
  routeGeometry?: GeoPoint[];
  routingSource?: "osrm" | "estimate";
  routingNotice?: string;
  totalMiles: number;
  legMiles: { toPickup: number; toDropoff: number };
  drivingMinutes: number;
  onDutyMinutes: number;
  handlingMinutes: number;
  tripMinutes: number; // trip start -> delivery complete
  events: DutyEvent[];
  logs: DailyLog[];
  counts: { breaks: number; fuel: number; rests: number; restarts: number };
  cycleRemainingMinutes: number;
  warnings: HosWarning[];
  driverDetails?: DriverDetails;
}

export interface DriverDetails {
  driverName: string;
  driverSignature: string;
  coDriver: string;
  homeTerminal: string;
  carrier: string;
  carrierAddress: string;
  truck: string;
  trailer: string;
  shippingDoc: string;
  shipperCommodity: string;
}

export interface TripHistoryItem {
  id: string;
  date: string;
  route: string;
  miles: number;
  days: number;
  status: "completed" | "planned" | "in_progress";
}
